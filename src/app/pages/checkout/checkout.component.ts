import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { StoreService } from '../../services/store.service';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { CardsService } from '../../services/cards.service';
import { AuthService } from '../../services/auth.service';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { LOJA_CEP, LOJA_ENDERECO_TEXTO, MARCA_NOME } from '../../constants/loja-public';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, BannerSlotComponent, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly hideMobileBottomNavClass = 'checkout-hide-mobile-nav';
  carregando = false;
  pedidoCodigo?: string | number; // código/ID do pedido criado
  pagamentoStatus?: 'pendente'|'pago'|'falhou'|'aguardando';

  // Capturas simples vindas do carrinho (poderíamos recuperar do store/cart e do localStorage)
  // Resumo calculado a partir do pedido criado (sempre retorna o mesmo shape)
  get resumo(): { subtotal: number; frete: number; desconto: number; cupom: number; pix: number; total: number; item_count: number } {
    // 1) Novo contrato do backend: preferir pedido.totals
    if (this.pedido && this.pedido.totals) {
      const t = this.pedido.totals;
      const cupom = Number(t.cupom_total ?? 0) || 0;
      const pix = Number(t.pix_total ?? 0) || 0;
      const discountTotal = Number(t.discount_total ?? 0) || 0;
      const outrosDescontos = Math.max(discountTotal - cupom - pix, 0);
      return {
        subtotal: Number(t.items_total ?? t.original_subtotal ?? 0) || 0,
        frete: Number(t.frete_total ?? this.pedido?.frete_valor) || 0,
        desconto: outrosDescontos,
        cupom,
        pix,
        total: Number(t.grand_total ?? this.pedido?.total_liquido ?? this.pedido?.total_bruto) || 0,
        item_count: Array.isArray(this.pedido.itens) ? this.pedido.itens.reduce((n: number, i: any) => n + Number(i.quantidade || 0), 0) : 0,
      };
    }
    // 2) Snapshot antigo usado anteriormente
    if (this.pedido && this.pedido.raw_snapshot?.input?.totais) {
      const t = this.pedido.raw_snapshot.input.totais;
      const cupom = Number(t.coupon_total ?? t.cupom_total ?? 0) || 0;
      const pix = Number(t.pix_total ?? 0) || 0;
      const discountTotal = Number(t.discount_total ?? this.pedido?.desconto_total ?? 0) || 0;
      const outrosDescontos = Math.max(discountTotal - cupom - pix, 0);
      return {
        subtotal: Number(t.items_total ?? t.subtotal ?? t.original_subtotal ?? 0) || 0,
        frete: Number(t.frete ?? t.frete_total ?? this.pedido?.frete_valor) || 0,
        desconto: outrosDescontos,
        cupom,
        pix,
        total: Number(t.grand_total ?? t.total ?? this.pedido?.total_liquido ?? this.pedido?.total_bruto) || 0,
        item_count: Array.isArray(this.pedido.itens) ? this.pedido.itens.reduce((n: number, i: any) => n + Number(i.quantidade || 0), 0) : Number(t.item_count ?? 0) || 0,
      };
    }
    // Fallback: usar campos de topo do pedido
    if (this.pedido) {
      const discountTotal = Number(this.pedido.desconto_total ?? 0) || 0;
      const cupom = Number(this.pedido.cupom?.desconto_aplicado ?? 0) || 0;
      const outrosDescontos = Math.max(discountTotal - cupom, 0);
      return {
        subtotal: Number(this.pedido.total_bruto) || 0,
        frete: Number(this.pedido.frete_valor) || 0,
        desconto: outrosDescontos,
        cupom,
        pix: 0,
        total: Number(this.pedido.total_liquido ?? this.pedido.total_bruto) || 0,
        item_count: Array.isArray(this.pedido.itens) ? this.pedido.itens.reduce((n: number, i: any) => n + Number(i.quantidade || 0), 0) : 0,
      };
    }
    // Último fallback: cart snapshot local (teoricamente não usado no checkout)
    const t = this.store.getCartTotals();
    return { subtotal: t.subtotal, frete: 0, desconto: 0, cupom: 0, pix: 0, total: t.total, item_count: t.count };
  }

  pedido: any | null = null; // objeto retornado pelo backend na criação
  cupomCodigo: string = '';
  cupomAplicado: { codigo: string; valor?: number; tipo?: string } | null = null;
  cupomErro: string | null = null;

  entregaModo: 'retirada'|'entrega' = 'entrega';
  enderecoSelecionado: any | null = null;
  freteSelecionado: { servico?: string; nome?: string; prazo_dias?: number; valor?: number } | null = null;
  // Contexto extra vindo do carrinho
  freteOpcoes: Array<{ servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }> = [];
  freteOrigem?: { cep: string; endereco?: string; cidade?: string; uf?: string } | null;
  freteDestino?: { cep: string; city?: string; state?: string; neighborhood?: string; street?: string; fonte?: string } | null;

  // Opções de pagamento retornadas pelo backend ao criar pedido
  pagamentoOpcoes: Array<{ metodo: string; label?: string; detalhes?: any }> = [];
  private _pagamentoMetodo: string = 'pix';
  private syncPagamentoTimer: ReturnType<typeof setTimeout> | null = null;
  private syncingPagamento = false;

  get pagamentoMetodo() {
    return this._pagamentoMetodo;
  }
  set pagamentoMetodo(v: string) {
    if (v === this._pagamentoMetodo) return;
    const wasPix = this._pagamentoMetodo === 'pix';
    this._pagamentoMetodo = v;
    const nowPix = v === 'pix';
    this.animacaoValor = nowPix ? 'gain' : wasPix ? 'lose' : '';
    if (this.animacaoValor) setTimeout(() => (this.animacaoValor = ''), 450);
    this.scheduleSyncPagamentoForma();
  }
  animacaoValor: ''|'gain'|'lose' = '';
  showPixModal = false;
  showCardModal = false;
  /** Dados PIX retornados pelo Mercado Pago após POST pagamento/iniciar */
  pixCheckout: { qrCode: string | null; qrCodeBase64: string | null; ticketUrl?: string | null; expiration?: string | null } | null = null;
  carregandoPix = false;
  pixIniciarErro: string | null = null;
  private pixPollTimer: ReturnType<typeof setInterval> | null = null;
  // Saved card selection
  savedCards: any[] = [];
  selectedCardId: string | number | null = null;

  // Info da loja para retirada (fallback)
  lojaInfo = {
    nome: MARCA_NOME,
    endereco: `${LOJA_ENDERECO_TEXTO} - Curitiba/PR`,
    cep: LOJA_CEP,
    horario: 'Seg a Sex 09:00–18:00, Sáb 09:00–13:00',
  };

  constructor(
    public store: StoreService,
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private cardsService: CardsService,
    private auth: AuthService,
  ){}

  ngOnInit(): void {
    // Resgata o pedido criado e o contexto do carrinho (somente leitura aqui)
    const created = this.store.getCreatedOrder();
    if (!created) {
      this.toast.info('Crie um pedido no carrinho antes de acessar o checkout.');
      this.router.navigate(['/carrinho']);
      return;
    }
    this.pedido = created;
    this.pedidoCodigo = created?.codigo || created?.id || created?.numero;
    this.pagamentoStatus = (created?.pagamento_status as any) || 'aguardando';
    // Carrega opções de pagamento do backend (se houver) ou usa um fallback elegante
    const opcoes = created?.paymentOptions || created?.pagamento_opcoes || created?.opcoesPagamento || [];
    if (Array.isArray(opcoes) && opcoes.length) {
      this.pagamentoOpcoes = opcoes.map((o: any) => ({ metodo: o.metodo || o.method || String(o), label: o.label || o.nome || String(o), detalhes: o }));
      this._pagamentoMetodo = this.pagamentoOpcoes[0]?.metodo || 'pix';
    } else {
      this.pagamentoOpcoes = [
        { metodo: 'pix', label: 'PIX (instantâneo)' },
        { metodo: 'cartao', label: 'Cartão de crédito' },
      ];
      this._pagamentoMetodo = 'pix';
    }
    // Load saved cards (tokenized) for this cliente if logged in
    try {
      const t = this.auth.getToken();
      if (t) {
        this.cardsService.list(t).subscribe({ next: (r) => { this.savedCards = r || []; }, error: () => {}, });
      }
    } catch {}
    // Carrega contexto salvo do carrinho (se disponível)
    const ctx = this.store.getCheckoutContext();
    if (ctx) {
      this.entregaModo = ctx.entregaModo as any || 'entrega';
      this.enderecoSelecionado = ctx.enderecoSelecionado || null;
      this.freteSelecionado = ctx.freteSelecionado || null;
      this.freteOpcoes = ctx.freteOpcoes || [];
      this.freteOrigem = ctx.freteOrigem || null;
      this.freteDestino = ctx.freteDestino || null;
    } else {
      // Fallback: tenta inferir do pedido criado
      const snapEntrega = created?.raw_snapshot?.input?.entrega;
      const rawShip = created?.raw_shipping;
      const end = created?.endereco_entrega || snapEntrega?.endereco || null;
      const frete = rawShip?.frete || snapEntrega?.frete || null;
      if (frete?.servico === 'retirada_loja' || snapEntrega?.modo === 'retirada') {
        this.entregaModo = 'retirada';
      } else {
        this.entregaModo = end ? 'entrega' : 'retirada';
      }
      this.enderecoSelecionado = end;
      this.freteSelecionado = frete;
      this.freteOpcoes = Array.isArray(snapEntrega?.opcoes) ? snapEntrega.opcoes : (Array.isArray(rawShip?.opcoes) ? rawShip.opcoes : []);
      this.freteOrigem = rawShip?.origem || null;
      this.freteDestino = rawShip?.destino || (snapEntrega?.destino || null);
    }
    this.scheduleSyncPagamentoForma();
    this.toggleMobileBottomNav(true);
  }

  get totalComFrete() {
    const base = this.store.getCartTotals().subtotal;
    const frete = (this.entregaModo === 'entrega') ? (this.freteSelecionado?.valor || 0) : 0;
    return base + frete;
  }

  /** PIX selecionado e loja com percentual > 0 (promocoes_config). */
  get temDescontoPix(): boolean {
    const pct = Number(this.pedido?.totals?.pix_discount_percent);
    return this._pagamentoMetodo === 'pix' && Number.isFinite(pct) && pct > 0;
  }

  get rotuloPixBadge(): string {
    const p = Number(this.pedido?.totals?.pix_discount_percent);
    if (!Number.isFinite(p) || p <= 0) return 'PIX';
    const s = Number.isInteger(p) ? String(p) : String(p);
    return `${s}% OFF no PIX`;
  }

  /** Total a pagar: usa grand_total já recalculado no backend após PATCH da forma de pagamento. */
  get totalVisual(): number {
    return this.resumo.total || 0;
  }

  /** Valor do desconto PIX (linha do resumo), alinhado ao backend. */
  get pixValorDesconto(): number {
    if (!this.temDescontoPix) return 0;
    return Number(this.resumo.pix) || 0;
  }

  /** Data URL da imagem do QR (PNG base64 do MP). */
  get pixQrSrc(): string {
    const b64 = this.pixCheckout?.qrCodeBase64;
    if (!b64) return '';
    const s = String(b64).trim();
    if (s.startsWith('data:')) return s;
    return `data:image/png;base64,${s}`;
  }

  private scheduleSyncPagamentoForma(): void {
    if (this.syncPagamentoTimer) clearTimeout(this.syncPagamentoTimer);
    this.syncPagamentoTimer = setTimeout(() => {
      this.syncPagamentoTimer = null;
      void this.flushSyncPagamentoForma();
    }, 300);
  }

  private async flushSyncPagamentoForma(): Promise<void> {
    if (!this.pedidoCodigo || this.syncingPagamento) return;
    this.syncingPagamento = true;
    try {
      const token = this.auth.getToken() || '';
      const up = await this.api
        .atualizarPedido(token, String(this.pedidoCodigo), { pagamento_forma: this._pagamentoMetodo })
        .toPromise();
      if (up && (up.id != null || up.codigo != null || up.numero != null)) {
        this.pedido = up;
        this.store.setCreatedOrder(up);
      }
    } catch {
      /* silencioso: totais locais até próximo sucesso */
    } finally {
      this.syncingPagamento = false;
    }
  }

  // Aplicar cupom: atualiza o pedido no backend e espelha no resumo local
  async aplicarCupom() {
    if (!this.pedidoCodigo || !this.cupomCodigo?.trim()) return;
    try {
      this.carregando = true;
      const token = this.auth.getToken() || '';
      const up = await this.api.atualizarPedido(token, String(this.pedidoCodigo), { cupom: this.cupomCodigo.trim() }).toPromise();
      // Alguns backends retornam o pedido atualizado; se vier, substitui
      if (up && (up.id || up.codigo || up.numero)) {
        this.pedido = up;
        this.store.setCreatedOrder(up);
        // Extrai info do cupom aplicado (preferir novo contrato)
        const codigo = up?.cupom?.codigo || this.cupomCodigo.trim();
        const valor = Number(
          up?.totals?.cupom_total ??
          up?.cupom?.desconto_aplicado ??
          up?.raw_snapshot?.input?.totais?.coupon_total ??
          up?.coupon_total ?? up?.cupom_total ?? up?.cupom?.valor ?? 0
        ) || 0;
        const tipo = up?.cupom?.tipo || undefined;
        this.cupomAplicado = { codigo, valor, tipo };
        this.cupomErro = null;
        this.fireConfetti();
        this.toast.success(`Cupom ${codigo} aplicado.`);
        this.scheduleSyncPagamentoForma();
        return;
      }
      this.cupomAplicado = { codigo: this.cupomCodigo.trim() };
      this.cupomErro = null;
      this.fireConfetti();
      this.toast.success('Cupom aplicado.');
    } catch(e) {
      const err: any = e as any;
      const msg = (err?.error && (err.error.message || err.error.error)) || err?.message || 'Não foi possível aplicar o cupom.';
      this.cupomErro = String(msg);
      this.toast.error(this.cupomErro);
    } finally {
      this.carregando = false;
    }
  }

  async pagar() {
    if (!this.pedidoCodigo) {
      this.toast.info('Crie o pedido primeiro.');
      return;
    }
    if (this.pagamentoMetodo === 'pix') {
      await this.openPixModal();
      return;
    }
    if (this.pagamentoMetodo === 'cartao') {
      // If user selected a saved card, pay with that token; otherwise redirect to Meus Cartões to add one.
      if (this.selectedCardId) {
        await this.pagarComCartaoSalvo();
        return;
      }
      this.toast.info('Selecione um cartão salvo ou adicione um novo em Meus Cartões');
      this.router.navigate(['/meus-cartoes']);
      return;
    }
    try {
      this.carregando = true;
      const token = this.auth.getToken() || '';
      const full = await this.api.criarPagamento(token, this.pedidoCodigo, {
        metodo: this.pagamentoMetodo || 'pix',
        valor: this.resumo.total,
      }).toPromise();
      if (full && String(full.status || '').toLowerCase() === 'pago') {
        this.onPagamentoConfirmado(full);
        return;
      }
      this.toast.info('Aguardando confirmação do pagamento…');
      await this.pollPedidoAtePago();
    } catch (e) {
      this.pagamentoStatus = 'falhou';
      this.toast.error('Falha ao processar o pagamento.');
    } finally {
      this.carregando = false;
    }
  }

  // Dispara confete ao aplicar cupom (tenta importar canvas-confetti, cai em fallback simples se não houver)
  private async fireConfetti() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    try {
      const mod = await import('canvas-confetti');
      const confetti = mod.default || (mod as any);
      confetti({
        particleCount: 160,
        spread: 70,
        origin: { y: 0.2 },
        ticks: 200
      });
      setTimeout(() => confetti({ particleCount: 120, spread: 90, origin: { x: 0.1, y: 0.3 } }), 150);
      setTimeout(() => confetti({ particleCount: 120, spread: 90, origin: { x: 0.9, y: 0.3 } }), 300);
    } catch {
      // Fallback: pequenos confetes emoji temporários
      const body = document.body;
      const create = (x: number) => {
        const el = document.createElement('div');
        el.textContent = '🎉';
        el.style.position = 'fixed';
        el.style.left = x + 'px';
        el.style.top = '0px';
        el.style.fontSize = '22px';
        el.style.zIndex = '9999';
        el.style.transition = 'transform 1.2s ease, opacity 1.2s ease';
        body.appendChild(el);
        requestAnimationFrame(() => {
          el.style.transform = `translateY(${window.innerHeight - 80}px) rotate(${(Math.random()*360)|0}deg)`;
          el.style.opacity = '0';
        });
        setTimeout(() => body.removeChild(el), 1400);
      };
      const w = window.innerWidth;
      [0.15, 0.35, 0.55, 0.75, 0.9].forEach(p => create(w * p));
    }
  }

  voltarCarrinho() {
    this.router.navigate(['/carrinho']);
  }

  async openPixModal() {
    this.pixIniciarErro = null;
    this.pixCheckout = null;
    this.showPixModal = true;
    this.carregandoPix = true;
    const token = this.auth.getToken() || undefined;
    try {
      const res = await firstValueFrom(
        this.api.iniciarPagamentoCheckout(token, this.pedidoCodigo!, { flow: 'pix' })
      );
      if (res?.status === 'failed' || res?.errorMessage) {
        this.pixIniciarErro = res?.errorMessage || 'Não foi possível iniciar o PIX.';
        return;
      }
      const pix = res?.pix;
      this.pixCheckout = pix
        ? {
            qrCode: pix.qrCode ?? null,
            qrCodeBase64: pix.qrCodeBase64 ?? null,
            ticketUrl: pix.ticketUrl ?? null,
            expiration: pix.expiration ?? null,
          }
        : null;
      if (!this.pixCheckout?.qrCode && !this.pixCheckout?.qrCodeBase64) {
        this.pixIniciarErro = 'Resposta do gateway sem QR Code ou código PIX. Tente novamente.';
      }
    } catch (e: any) {
      const msg = e?.error?.error || e?.error?.message || e?.message || 'Erro ao iniciar PIX.';
      this.pixIniciarErro = String(msg);
    } finally {
      this.carregandoPix = false;
    }
  }

  closePixModal() {
    this.stopPixPolling();
    this.showPixModal = false;
    this.pixIniciarErro = null;
  }

  openCardModal() { this.showCardModal = true; }
  closeCardModal() { this.showCardModal = false; }

  async copiar(str: string) {
    try {
      await navigator.clipboard.writeText(str);
      this.toast.success('Código PIX copiado.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = str; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); this.toast.success('Código PIX copiado.'); } catch {}
      document.body.removeChild(ta);
    }
  }

  /** Consulta o pedido até o webhook confirmar pagamento (status pago). */
  async confirmarPixPago() {
    this.toast.info('Verificando pagamento…');
    await this.pollPedidoAtePago();
  }

  private stopPixPolling() {
    if (this.pixPollTimer) {
      clearInterval(this.pixPollTimer);
      this.pixPollTimer = null;
    }
  }

  private onPagamentoConfirmado(up: any): void {
    this.pedido = up;
    this.store.setCreatedOrder(up);
    this.pagamentoStatus = 'pago';
    this.toast.success('Pagamento confirmado!');
    this.closePixModal();
    this.store.clearCart();
    this.store.setCreatedOrder(null);
    this.router.navigate(['/meus-pedidos']);
  }

  private async pollPedidoAtePago(): Promise<void> {
    this.stopPixPolling();
    const token = this.auth.getToken() || undefined;
    const id = String(this.pedidoCodigo || '');
    if (!id) return;

    const tick = async () => {
      try {
        const up = await firstValueFrom(this.api.atualizarPedido(token, id, {}));
        if (up && String(up.status || '').toLowerCase() === 'pago') {
          this.stopPixPolling();
          this.onPagamentoConfirmado(up);
        }
      } catch {
        /* continua tentando */
      }
    };

    await tick();
    this.pixPollTimer = setInterval(() => void tick(), 2500);
    setTimeout(() => {
      if (!this.pixPollTimer) return;
      this.stopPixPolling();
      this.toast.info('Ainda aguardando confirmação do pagamento. Você pode fechar e acompanhar em Meus pedidos.');
    }, 120000);
  }
  async confirmarCartaoPago() {
    this.closeCardModal();
    await this.pagarReal('cartao');
  }

  private async pagarComCartaoSalvo() {
    if (!this.pedidoCodigo) return;
    try {
      this.carregando = true;
      const token = this.auth.getToken() || '';
      const full = await this.api.criarPagamento(token, this.pedidoCodigo, {
        metodo: 'cartao',
        valor: this.resumo.total,
        payment_method_id: this.selectedCardId,
      }).toPromise();
      if (full && String(full.status || '').toLowerCase() === 'pago') {
        this.onPagamentoConfirmado(full);
        return;
      }
      this.toast.info('Aguardando confirmação do pagamento…');
      await this.pollPedidoAtePago();
    } catch (e) {
      this.pagamentoStatus = 'falhou';
      this.toast.error('Falha ao processar o pagamento.');
    } finally {
      this.carregando = false;
    }
  }

  goToMeusCartoes() {
    try { this.router.navigate(['/meus-cartoes']); } catch { window.location.href = '/meus-cartoes'; }
  }

  private async pagarReal(metodo: string) {
    if (!this.pedidoCodigo) return;
    try {
      this.carregando = true;
      const token = this.auth.getToken() || '';
      const full = await this.api.criarPagamento(token, this.pedidoCodigo, {
        metodo,
        valor: this.resumo.total,
        mock: true,
      }).toPromise();
      if (full && String(full.status || '').toLowerCase() === 'pago') {
        this.onPagamentoConfirmado(full);
        return;
      }
      this.toast.info('Aguardando confirmação…');
      await this.pollPedidoAtePago();
    } catch (e) {
      this.pagamentoStatus = 'falhou';
      this.toast.error('Falha ao processar o pagamento.');
    } finally {
      this.carregando = false;
    }
  }

  ngOnDestroy(): void {
    this.stopPixPolling();
    this.toggleMobileBottomNav(false);
  }

  private toggleMobileBottomNav(hide: boolean): void {
    if (typeof document === 'undefined') return;
    if (hide) {
      document.body.classList.add(this.hideMobileBottomNavClass);
      return;
    }
    document.body.classList.remove(this.hideMobileBottomNavClass);
  }
}
