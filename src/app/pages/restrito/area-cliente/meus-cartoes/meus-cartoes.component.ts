import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardsService, PaymentMethod } from '../../../../services/cards.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import { environment } from '../../../../../enviroments/environment';

/** Estilo dentro dos iframes PCI — sem height fixo grande (altura vem do container .mp-field-host). */
const MP_FIELD_STYLE: Record<string, string> = {
  color: '#e6eef8',
  fontSize: '16px',
  lineHeight: '1.25',
  placeholderColor: '#64748b',
};

@Component({
  selector: 'app-meus-cartoes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meus-cartoes.component.html',
  styleUrls: ['./meus-cartoes.component.scss'],
})
export class MeusCartoesComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() modal = false;
  @Output() close = new EventEmitter<void>();
  cards: PaymentMethod[] = [];
  loading = false;
  tokenizing = false;
  /** Campos seguros (iframes) montados e prontos para tokenizar. */
  mpReady = false;
  mpInitializing = false;

  private mp: any = null;
  private fieldInstances: Array<{ unmount: () => void }> = [];
  private identificationType = 'CPF';

  newCard: any = {
    holder_name: '',
    cpf_titular: '',
    numero: '',
    exp_month: '',
    exp_year: '',
    cvv: '',
    brand: '',
    last4: '',
    provider_token: '',
  };

  constructor(
    private cardsService: CardsService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get hasMpKey(): boolean {
    return !!(environment.mercadopagoPublicKey || '').toString().trim();
  }

  /** Chave pública de teste (sandbox) — exibe ajuda de cenários APRO/OTHE. */
  get isMpSandboxPublicKey(): boolean {
    const k = (environment.mercadopagoPublicKey || '').toString().trim();
    return k.startsWith('TEST-');
  }

  readonly mpTestCardsDocUrl =
    'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards';

  readonly mpCheckoutProTestUrl =
    'https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-purchases';

  /** Painel de ajuda sandbox (HTML) */
  sandboxHelpOpen = false;

  toggleSandboxHelp(): void {
    this.sandboxHelpOpen = !this.sandboxHelpOpen;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Faça login para gerenciar seus cartões');
      this.router.navigate(['/restrito/login']);
      return;
    }
    this.loadCards(token);
  }

  ngAfterViewInit(): void {
    if (!this.auth.getToken() || !this.hasMpKey || !this.isBrowser) return;
    queueMicrotask(() => {
      void this.initSecureCardFields();
    });
  }

  ngOnDestroy(): void {
    this.destroySecureFields();
  }

  private loadCards(token: string) {
    this.loading = true;
    this.mpReady = false;
    this.cardsService
      .list(token)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.cards = res || [];
        },
        error: () => {
          this.cards = [];
          this.toast.error('Não foi possível carregar cartões.');
        },
      });
  }

  private async loadMpSdkV2(): Promise<void> {
    if (!this.isBrowser) throw new Error('browser');
    const w = window as any;
    if (typeof w.MercadoPago === 'function') return;

    await new Promise<void>((resolve, reject) => {
      const id = 'mercadopago-sdk-v2';
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (s) {
        if (typeof w.MercadoPago === 'function') return resolve();
        s.addEventListener('load', () => resolve(), { once: true });
        s.addEventListener('error', () => reject(new Error('SDK')), { once: true });
        return;
      }
      s = document.createElement('script');
      s.id = id;
      s.src = 'https://sdk.mercadopago.com/js/v2';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar SDK de pagamento.'));
      document.body.appendChild(s);
    });
  }

  private async resolveIdentificationType(mpInstance: any): Promise<string> {
    try {
      const fn = mpInstance?.getIdentificationTypes;
      if (typeof fn !== 'function') return 'CPF';
      const types = await fn.call(mpInstance);
      const arr = Array.isArray(types) ? types : types?.results || [];
      const cpf = arr.find(
        (t: any) =>
          String(t?.id || '').toUpperCase() === 'CPF' ||
          String(t?.name || '')
            .toLowerCase()
            .includes('cpf'),
      );
      return String(cpf?.id || 'CPF');
    } catch {
      return 'CPF';
    }
  }

  /** Campos PCI em iframes (SDK v2), sem logomarca na nossa página. */
  async initSecureCardFields(): Promise<void> {
    if (!this.isBrowser || !this.hasMpKey) return;
    if (this.mpInitializing) return;
    this.mpInitializing = true;
    this.mpReady = false;
    this.cdr.markForCheck();

    try {
      await this.loadMpSdkV2();
      const MercadoPago = (window as any).MercadoPago;
      if (typeof MercadoPago !== 'function') {
        throw new Error('MercadoPago não disponível');
      }

      this.destroySecureFields();
      this.mp = new MercadoPago(environment.mercadopagoPublicKey, { locale: 'pt-BR' });
      this.identificationType = await this.resolveIdentificationType(this.mp);

      const mountIds = ['mp-secure-card-number', 'mp-secure-expiration', 'mp-secure-cvv'];
      for (const id of mountIds) {
        if (!document.getElementById(id)) {
          throw new Error(`Elemento #${id} não encontrado`);
        }
      }

      let ready = 0;
      const onFieldReady = () => {
        this.ngZone.run(() => {
          ready += 1;
          if (ready >= 3) {
            this.mpReady = true;
            this.mpInitializing = false;
            this.cdr.markForCheck();
          }
        });
      };

      const cn = this.mp.fields.create('cardNumber', {
        placeholder: 'Número do cartão',
        style: MP_FIELD_STYLE,
      });
      cn.mount('mp-secure-card-number');
      cn.on('ready', onFieldReady);

      const exp = this.mp.fields.create('expirationDate', {
        placeholder: 'MM/AA',
        style: MP_FIELD_STYLE,
      });
      exp.mount('mp-secure-expiration');
      exp.on('ready', onFieldReady);

      const sec = this.mp.fields.create('securityCode', {
        placeholder: 'CVV',
        style: MP_FIELD_STYLE,
      });
      sec.mount('mp-secure-cvv');
      sec.on('ready', onFieldReady);

      this.fieldInstances = [cn, exp, sec];
    } catch (e: any) {
      console.error(e);
      this.mpInitializing = false;
      this.mpReady = false;
      this.toast.error(e?.message || 'Não foi possível iniciar o formulário seguro.');
      this.cdr.markForCheck();
    }
  }

  private destroySecureFields(): void {
    for (const inst of this.fieldInstances) {
      try {
        inst.unmount();
      } catch {
        /* ignore */
      }
    }
    this.fieldInstances = [];
    this.mp = null;
    this.mpReady = false;
  }

  async onAdd(e: Event) {
    e.preventDefault();
    const token = this.auth.getToken();
    if (!token) {
      this.toast.error('Sessão inválida');
      return;
    }

    const holder = (this.newCard.holder_name || '').trim();
    if (!holder) {
      this.toast.info('Informe o nome no cartão.');
      return;
    }
    const cpfDigits = (this.newCard.cpf_titular || '').toString().replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      this.toast.info('Informe um CPF válido (11 dígitos).');
      return;
    }

    if (!this.hasMpKey) {
      this.toast.error('Chave pública do gateway não configurada.');
      return;
    }

    if (!this.mp || !this.mpReady) {
      this.toast.info('Aguarde o carregamento dos campos do cartão.');
      return;
    }

    this.tokenizing = true;
    try {
      const tr = await this.mp.fields.createCardToken({
        cardholderName: holder,
        identificationType: this.identificationType,
        identificationNumber: cpfDigits,
      });
      const tid = tr?.id;
      if (!tid) {
        throw new Error('Token não retornado');
      }

      const expMonth = String(tr.expiration_month ?? '').padStart(2, '0');
      const expYear = String(tr.expiration_year ?? '');
      const last4 = String(tr.last_four_digits || '').slice(-4);
      const bin = String(tr.first_six_digits || (tr as any).firstSixDigits || '');

      const payload = {
        provider: 'mercadopago',
        provider_token: tid,
        holder_name: holder,
        brand: this.brandFromToken(tr) || this.detectCardBrandFromBin(bin) || undefined,
        last4: last4 || undefined,
        exp_month: expMonth || undefined,
        exp_year: expYear || undefined,
      };

      try {
        await firstValueFrom(this.cardsService.create(token, payload));
      } catch (httpErr: unknown) {
        const msg = this.extractApiErrorMessage(httpErr);
        throw new Error(msg || 'Não foi possível registrar o cartão.');
      }

      this.toast.success('Cartão adicionado.');
      this.newCard = {
        holder_name: '',
        cpf_titular: '',
        numero: '',
        exp_month: '',
        exp_year: '',
        cvv: '',
        brand: '',
        last4: '',
        provider_token: '',
      };
      const cpfInput = document.getElementById('meus-cartoes-cpf') as HTMLInputElement | null;
      if (cpfInput) cpfInput.value = '';

      this.loadCards(token);
      queueMicrotask(async () => {
        await this.initSecureCardFields();
      });
    } catch (err: unknown) {
      console.error(err);
      const direct =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
          ? String((err as { message: string }).message).trim()
          : '';
      const msg = direct || this.mapMpCreateCardTokenError(err);
      this.toast.error(msg);
    } finally {
      this.tokenizing = false;
      this.cdr.markForCheck();
    }
  }

  private brandFromToken(tr: any): string | undefined {
    const id = String(tr?.payment_method_id || tr?.paymentMethodId || '').toLowerCase();
    if (!id) return undefined;
    const map: Record<string, string> = {
      visa: 'Visa',
      master: 'Mastercard',
      mastercard: 'Mastercard',
      amex: 'American Express',
      elo: 'Elo',
      hipercard: 'Hipercard',
      debelo: 'Elo',
    };
    return map[id] || id.charAt(0).toUpperCase() + id.slice(1);
  }

  private detectCardBrandFromBin(firstSix: string | undefined): string | undefined {
    const n = (firstSix || '').toString().replace(/\D/g, '');
    if (n.length < 4) return undefined;
    return this.detectCardBrand(n + '0000000000');
  }

  private extractApiErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
        return String((body as { error: string }).error).trim();
      }
      if (typeof body === 'string' && body.trim()) return body.trim();
      return (err.message || `Erro HTTP ${err.status}`).trim();
    }
    return '';
  }

  /** Mensagem legível quando o SDK falha em createCardToken (texto frequentemente em EN). */
  private mapMpCreateCardTokenError(err: unknown): string {
    const parts: string[] = [];
    const seen = new Set<string>();
    const push = (s: string) => {
      const t = s.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        parts.push(t);
      }
    };
    const walk = (x: unknown, depth: number) => {
      if (depth > 8 || x == null) return;
      if (typeof x === 'string') {
        push(x);
        return;
      }
      if (typeof x !== 'object') return;
      const o = x as Record<string, unknown>;
      if (typeof o['message'] === 'string') push(o['message']);
      const c = o['cause'];
      if (Array.isArray(c)) {
        for (const it of c) walk(it, depth + 1);
      } else if (c != null) {
        walk(c, depth + 1);
      }
      if (Array.isArray(o['errors'])) {
        for (const it of o['errors']) walk(it, depth + 1);
      }
    };
    walk(err, 0);
    const raw = parts.join(' ').toLowerCase();
    const joined = parts.join(' — ');
    if (/identification|document|cpf|cnpj|invalid[_\s-]?doc/i.test(raw)) {
      return 'Confira o CPF do titular (11 dígitos) e o documento informado.';
    }
    if (/expir|exp_date|invalid[_\s-]?expiration|vencim/i.test(raw)) {
      return 'Confira a data de validade do cartão.';
    }
    if (/cvv|cvc|security|cod_seg|security_code/i.test(raw)) {
      return 'Confira o código de segurança (CVV) do cartão.';
    }
    if (/card[_\s-]?number|invalid[_\s-]?number|bin/i.test(raw)) {
      return 'Confira o número do cartão.';
    }
    if (/network|failed to fetch|networkerror|load failed|econnrefused/i.test(raw)) {
      return 'Falha de rede ao falar com o Mercado Pago. Tente novamente.';
    }
    // SDK envia eventos para api.mercadolibre.com/tracks; bloqueadores (Opera, uBlock, etc.) costumam barrar.
    if (/blocked_by_adblocker|adblock|blocked by ad/i.test(raw)) {
      return (
        'O navegador ou uma extensão bloqueou uma chamada do Mercado Pago (comum em api.mercadolibre.com). ' +
        'Desative o bloqueador para este site ou permita Mercado Pago / Mercado Livre e tente de novo.'
      );
    }
    if (joined.trim()) return joined.trim();
    return 'Não foi possível tokenizar o cartão. Verifique os dados e tente novamente.';
  }

  onCpfInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = (input.value || '').toString().replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 9) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    input.value = formatted;
    this.newCard.cpf_titular = digits;
  }

  onHolderNameInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').toString();
    const normalized = v.replace(/\s+/g, ' ').trimStart();
    input.value = normalized;
    this.newCard.holder_name = normalized;
  }

  private detectCardBrand(cardNumber: string): string | undefined {
    const n = (cardNumber || '').toString().replace(/\D/g, '');
    if (!n) return undefined;
    if (/^4/.test(n)) return 'Visa';
    if (/^(5[1-5]|2(?:2[2-9]|[3-6]\d|7(?:0|1)|720))/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'American Express';
    if (/^3(?:0[0-5]|[68])/.test(n)) return 'Diners Club';
    if (/^6(?:011|5|4[4-9])/.test(n)) return 'Discover';
    if (/^(5018|5020|5038|6304|6759|676[1-3])/.test(n)) return 'Maestro';
    if (/^(401178|401179|431274|438935|457631|457632|504175|506699|5067|5090|627780|636297|636368|650)/.test(n)) {
      return 'Elo';
    }
    if (/^(38|60|62)/.test(n)) return 'Hipercard';
    return undefined;
  }

  remove(card: PaymentMethod) {
    const token = this.auth.getToken();
    if (!token) {
      this.toast.error('Sessão inválida');
      return;
    }
    if (!confirm('Excluir este cartão?')) return;
    this.cardsService.delete(token, card.id || '').subscribe({
      next: () => {
        this.toast.success('Cartão removido');
        this.loadCards(token);
      },
      error: () => this.toast.error('Falha ao remover cartão'),
    });
  }

  setDefault(card: PaymentMethod) {
    const token = this.auth.getToken();
    if (!token) {
      this.toast.error('Sessão inválida');
      return;
    }
    this.cardsService.update(token, card.id || '', { is_default: true }).subscribe({
      next: () => {
        this.toast.success('Cartão definido como padrão');
        this.loadCards(token);
      },
      error: () => this.toast.error('Falha ao definir padrão'),
    });
  }
}
