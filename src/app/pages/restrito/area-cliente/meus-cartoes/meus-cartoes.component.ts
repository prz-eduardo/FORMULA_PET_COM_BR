import { Component, OnInit, Inject, PLATFORM_ID, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardsService, PaymentMethod } from '../../../../services/cards.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../../enviroments/environment';

@Component({
  selector: 'app-meus-cartoes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meus-cartoes.component.html',
  styleUrls: ['./meus-cartoes.component.scss']
})
export class MeusCartoesComponent implements OnInit {
  @Input() modal = false;
  @Output() close = new EventEmitter<void>();
  cards: PaymentMethod[] = [];
  loading = false;
  tokenizing = false;
  // Form model accepts raw card data; CVV is never persisted
  newCard: any = {
    holder_name: '',
    numero: '',
    exp_month: '',
    exp_year: '',
    cvv: '',
    brand: '',
    last4: '',
    provider_token: ''
  };

  constructor(
    private cardsService: CardsService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  private get isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Faça login para gerenciar seus cartões');
      this.router.navigate(['/restrito/login']);
      return;
    }
    this.loadCards(token);
  }

  private loadCards(token: string) {
    this.loading = true;
    this.cardsService.list(token).subscribe({
      next: (res) => { this.cards = res || []; },
      error: () => { this.toast.error('Não foi possível carregar cartões.'); },
      complete: () => { this.loading = false; }
    });
  }

  onAdd(e: Event) {
    e.preventDefault();
    const token = this.auth.getToken();
    if (!token) { this.toast.error('Sessão inválida'); return; }

    // If the app is configured with Mercado Pago public key, tokenize client-side.
    const publicKey = environment.mercadopagoPublicKey || '';
    if (publicKey && this.isBrowser) {
      this.tokenizing = true;
      this.tokenizeWithMercadoPago(publicKey).then((providerToken) => {
        // do not keep CVV in memory
        this.newCard.cvv = '';
        const payload = {
          provider: 'mercadopago',
          provider_token: providerToken,
          holder_name: this.newCard.holder_name,
          brand: this.newCard.brand || undefined,
          last4: String(this.newCard.numero || '').slice(-4) || this.newCard.last4,
          exp_month: this.newCard.exp_month,
          exp_year: this.newCard.exp_year,
        };
        this.cardsService.create(token, payload).subscribe({ next: () => { this.toast.success('Cartão adicionado.'); this.loadCards(token); this.newCard = { holder_name: '', numero: '', exp_month: '', exp_year: '', cvv: '', brand: '', last4: '', provider_token: '' }; }, error: () => { this.toast.error('Falha ao adicionar cartão.'); }, complete: () => { this.tokenizing = false; } });
      }).catch((err) => {
        this.tokenizing = false;
        console.error('Tokenização falhou', err);
        this.toast.error('Falha ao tokenizar o cartão.');
      });
      return;
    }

    // Fallback: if no public key available, backend must accept a token provided somehow
    if (!this.newCard.provider_token) {
      this.toast.error('Token do provedor ausente. Configure a chave pública do Mercado Pago ou gere o token via gateway.');
      return;
    }
    const payload = {
      provider: 'mercadopago',
      provider_token: this.newCard.provider_token,
      holder_name: this.newCard.holder_name,
      brand: this.newCard.brand,
      last4: this.newCard.last4,
      exp_month: this.newCard.exp_month,
      exp_year: this.newCard.exp_year,
    };
    this.cardsService.create(token, payload).subscribe({ next: (res) => { this.toast.success('Cartão adicionado.'); this.newCard = { holder_name: '', numero: '', exp_month: '', exp_year: '', cvv: '', brand: '', last4: '', provider_token: '' }; this.loadCards(token); }, error: () => this.toast.error('Falha ao adicionar cartão.') });
  }

  private async loadMercadoPagoSdk(): Promise<void> {
    if (!this.isBrowser) return;
    if ((window as any).Mercadopago || (window as any).MercadoPago) return;
    return new Promise((resolve, reject) => {
      const id = 'mercadopago-sdk';
      if (document.getElementById(id)) return resolve();
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://secure.mlstatic.com/sdk/javascript/v1/mercadopago.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar SDK Mercado Pago'));
      document.body.appendChild(s);
    });
  }

  private async tokenizeWithMercadoPago(publicKey: string): Promise<string> {
    if (!this.isBrowser) throw new Error('Somente no browser');
    await this.loadMercadoPagoSdk();
    const mp = (window as any).Mercadopago || (window as any).MercadoPago;
    if (!mp) throw new Error('SDK Mercado Pago não disponível');
    try {
      if (typeof mp.setPublishableKey === 'function') mp.setPublishableKey(publicKey);
    } catch {}
    const cardData = {
      cardNumber: String(this.newCard.numero || '').replace(/\s+/g, ''),
      expirationMonth: String(this.newCard.exp_month || ''),
      expirationYear: String(this.newCard.exp_year || ''),
      securityCode: String(this.newCard.cvv || ''),
      cardholderName: String(this.newCard.holder_name || ''),
    };
    return new Promise((resolve, reject) => {
      try {
        (window as any).Mercadopago.createToken(cardData, (status: number, response: any) => {
          if (status === 200 || status === 201) {
            const token = response?.id || response?.card?.id || response?.token;
            if (token) return resolve(token);
            return reject(new Error('Resposta sem token'));
          }
          return reject(response || new Error('Status ' + status));
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // Detect card brand from number using common BIN patterns
  private detectCardBrand(cardNumber: string): string | undefined {
    const n = (cardNumber || '').toString().replace(/\D/g, '');
    if (!n) return undefined;
    // Visa
    if (/^4/.test(n)) return 'Visa';
    // Mastercard (51-55, 2221-2720 approx)
    if (/^(5[1-5]|2(?:2[2-9]|[3-6]\d|7(?:0|1)|720))/.test(n)) return 'Mastercard';
    // American Express
    if (/^3[47]/.test(n)) return 'American Express';
    // Diners Club
    if (/^3(?:0[0-5]|[68])/.test(n)) return 'Diners Club';
    // Discover
    if (/^6(?:011|5|4[4-9])/.test(n)) return 'Discover';
    // Maestro
    if (/^(5018|5020|5038|6304|6759|676[1-3])/.test(n)) return 'Maestro';
    // Elo (common prefixes)
    if (/^(401178|401179|431274|438935|457631|457632|504175|506699|5067|5090|627780|636297|636368|650)/.test(n)) return 'Elo';
    // Hipercard / others
    if (/^(38|60|62)/.test(n)) return 'Hipercard';
    return undefined;
  }

  // --- Input masks / formatters (keeps model + DOM in sync) ---
  onHolderNameInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').toString();
    // keep as typed but trim excessive whitespace and normalize spaces
    const normalized = v.replace(/\s+/g, ' ').trimStart();
    input.value = normalized;
    this.newCard.holder_name = normalized;
  }

  onCardNumberInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let digits = (input.value || '').toString().replace(/\D/g, '').slice(0, 19);
    const groups = digits.match(/.{1,4}/g);
    const formatted = groups ? groups.join(' ') : digits;
    input.value = formatted;
    this.newCard.numero = formatted;
    // always fill last4 when available
    if (digits.length >= 4) {
      this.newCard.last4 = digits.slice(-4);
    } else {
      this.newCard.last4 = '';
    }
    // detect brand and set if found
    const brand = this.detectCardBrand(digits);
    if (brand) this.newCard.brand = brand;
  }

  onExpMonthInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let digits = (input.value || '').toString().replace(/\D/g, '').slice(0, 2);
    if (digits.length === 2) {
      const n = parseInt(digits, 10) || 0;
      if (n < 1) digits = '01';
      else if (n > 12) digits = '12';
      else digits = digits.padStart(2, '0');
    }
    input.value = digits;
    this.newCard.exp_month = digits;
  }

  onExpYearInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = (input.value || '').toString().replace(/\D/g, '').slice(0, 4);
    input.value = digits;
    this.newCard.exp_year = digits;
  }

  onCvvInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = (input.value || '').toString().replace(/\D/g, '').slice(0, 4);
    input.value = digits;
    this.newCard.cvv = digits;
  }

  onBrandInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').toString().trim();
    input.value = v;
    this.newCard.brand = v;
  }

  onLast4Input(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = (input.value || '').toString().replace(/\D/g, '').slice(0, 4);
    input.value = digits;
    this.newCard.last4 = digits;
  }

  remove(card: PaymentMethod) {
    const token = this.auth.getToken();
    if (!token) { this.toast.error('Sessão inválida'); return; }
    if (!confirm('Excluir este cartão?')) return;
    this.cardsService.delete(token, card.id || '')
      .subscribe({ next: () => { this.toast.success('Cartão removido'); this.loadCards(token); }, error: () => this.toast.error('Falha ao remover cartão') });
  }

  setDefault(card: PaymentMethod) {
    const token = this.auth.getToken();
    if (!token) { this.toast.error('Sessão inválida'); return; }
    this.cardsService.update(token, card.id || '', { is_default: true }).subscribe({
      next: () => { this.toast.success('Cartão definido como padrão'); this.loadCards(token); },
      error: () => this.toast.error('Falha ao definir padrão')
    });
  }
}
