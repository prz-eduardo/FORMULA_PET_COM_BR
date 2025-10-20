import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../services/store.service';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, NavmenuComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  carregando = false;
  pedidoCodigo?: string | number; // código/ID do pedido criado
  pagamentoStatus?: 'pendente'|'pago'|'falhou'|'aguardando';

  // Capturas simples vindas do carrinho (poderíamos recuperar do store/cart e do localStorage)
  // Resumo calculado a partir do pedido criado (sempre retorna o mesmo shape)
  get resumo(): { subtotal: number; frete: number; desconto: number; cupom: number; total: number; item_count: number } {
    // 1) Novo contrato do backend: preferir pedido.totals
    if (this.pedido && this.pedido.totals) {
      const t = this.pedido.totals;
      const cupom = Number(t.cupom_total ?? 0) || 0;
      const discountTotal = Number(t.discount_total ?? 0) || 0;
      // Evita dupla contagem: "Descontos" mostra apenas o que não for cupom
      const outrosDescontos = Math.max(discountTotal - cupom, 0);
      return {
        subtotal: Number(t.items_total ?? t.original_subtotal ?? 0) || 0,
        frete: Number(t.frete_total ?? this.pedido?.frete_valor) || 0,
        desconto: outrosDescontos,
        cupom,
        total: Number(t.grand_total ?? this.pedido?.total_liquido ?? this.pedido?.total_bruto) || 0,
        item_count: Array.isArray(this.pedido.itens) ? this.pedido.itens.reduce((n: number, i: any) => n + Number(i.quantidade || 0), 0) : 0,
      };
    }
    // 2) Snapshot antigo usado anteriormente
    if (this.pedido && this.pedido.raw_snapshot?.input?.totais) {
      const t = this.pedido.raw_snapshot.input.totais;
      const cupom = Number(t.coupon_total ?? t.cupom_total ?? 0) || 0;
      const discountTotal = Number(t.discount_total ?? this.pedido?.desconto_total ?? 0) || 0;
      const outrosDescontos = Math.max(discountTotal - cupom, 0);
      return {
        subtotal: Number(t.items_total ?? t.subtotal ?? t.original_subtotal ?? 0) || 0,
        frete: Number(t.frete ?? t.frete_total ?? this.pedido?.frete_valor) || 0,
        desconto: outrosDescontos,
        cupom,
        total: Number(t.grand_total ?? t.total ?? this.pedido?.total_liquido ?? this.pedido?.total_bruto) || 0,
        item_count: Array.isArray(this.pedido.itens) ? this.pedido.itens.reduce((n: number, i: any) => n + Number(i.quantidade || 0), 0) : Number(t.item_count ?? 0) || 0,
      };
    }
    // Fallback: usar campos de topo do pedido
    if (this.pedido) {
      const discountTotal = Number(this.pedido.desconto_total ?? 0) || 0;
      // Se houver info de cupom, usar para separar descontos
      const cupom = Number(this.pedido.cupom?.desconto_aplicado ?? 0) || 0;
      const outrosDescontos = Math.max(discountTotal - cupom, 0);
      return {
        subtotal: Number(this.pedido.total_bruto) || 0,
        frete: Number(this.pedido.frete_valor) || 0,
        desconto: outrosDescontos,
        cupom,
        total: Number(this.pedido.total_liquido ?? this.pedido.total_bruto) || 0,
        item_count: Array.isArray(this.pedido.itens) ? this.pedido.itens.reduce((n: number, i: any) => n + Number(i.quantidade || 0), 0) : 0,
      };
    }
    // Último fallback: cart snapshot local (teoricamente não usado no checkout)
    const t = this.store.getCartTotals();
    return { subtotal: t.subtotal, frete: 0, desconto: 0, cupom: 0, total: t.total, item_count: t.count };
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
  get pagamentoMetodo() { return this._pagamentoMetodo; }
  set pagamentoMetodo(v: string) {
    if (v === this._pagamentoMetodo) return;
    const wasPix = this._pagamentoMetodo === 'pix';
    this._pagamentoMetodo = v;
    const nowPix = v === 'pix';
    this.animacaoValor = nowPix ? 'gain' : (wasPix ? 'lose' : '');
    if (this.animacaoValor) setTimeout(() => this.animacaoValor = '', 450);
  }
  animacaoValor: ''|'gain'|'lose' = '';
  showPixModal = false;
  showCardModal = false;
  pixMock: { copiaCola: string; qrDataUrl: string } | null = null;
  cardMock = { nome: '', numero: '', validade: '', cvv: '' };

  // Info da loja para retirada (fallback)
  lojaInfo = {
    nome: 'Fórmula Pet',
    endereco: 'Rua Treze de Maio, 506, Conjunto 04 - São Francisco, Curitiba/PR',
    cep: '80510-030',
    horario: 'Seg a Sex 09:00–18:00, Sáb 09:00–13:00'
  };

  constructor(
    public store: StoreService,
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
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
  }

  get totalComFrete() {
    const base = this.store.getCartTotals().subtotal;
    const frete = (this.entregaModo === 'entrega') ? (this.freteSelecionado?.valor || 0) : 0;
    return base + frete;
  }

  // Visual: Pix dá 10% de desconto (somente exibição)
  get temDescontoPix(): boolean {
    return this._pagamentoMetodo === 'pix';
  }
  get totalVisual(): number {
    const t = this.resumo.total || 0;
    return this.temDescontoPix ? t * 0.9 : t;
  }
  get pixValorDesconto(): number {
    const t = this.resumo.total || 0;
    return this.temDescontoPix ? t * 0.1 : 0;
  }

  // Aplicar cupom: atualiza o pedido no backend e espelha no resumo local
  async aplicarCupom() {
    if (!this.pedidoCodigo || !this.cupomCodigo?.trim()) return;
    try {
      this.carregando = true;
      const token = localStorage.getItem('token') || '';
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
    // Fluxo simulado com modais: abre a UI específica e só confirma depois
    if (this.pagamentoMetodo === 'pix') {
      this.openPixModal();
      return;
    }
    if (this.pagamentoMetodo === 'cartao') {
      this.openCardModal();
      return;
    }
    try {
      this.carregando = true;
      const token = localStorage.getItem('token') || '';
      // Exemplo de pagamento simples à vista; adapte conforme o gateway.
      const pagamento = await this.api.criarPagamento(token, this.pedidoCodigo, {
        metodo: this.pagamentoMetodo || 'pix',
        valor: this.resumo.total,
      }).toPromise();

      // Atualiza status do pedido como "pago" (ou aguarda confirmação assíncrona)
      await this.api.atualizarPedido(token, this.pedidoCodigo, { status: 'pago', pagamento }).toPromise();
      this.pagamentoStatus = 'pago';
      this.toast.success('Pagamento confirmado!');
      // Esvazia carrinho e redireciona para pedidos
      this.store.clearCart();
      this.store.setCreatedOrder(null);
      this.router.navigate(['/meus-pedidos']);
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

  // ===== Mock/UX helpers =====
  private buildPixMock(): { copiaCola: string; qrDataUrl: string } {
    const id = String(this.pedidoCodigo || '0000');
    const valor = (this.resumo.total || 0).toFixed(2);
    const copiaCola = `00020126360014BR.GOV.BCB.PIX0114+554199999999520400005303986540${valor}5802BR5920FORMULA PET LTDA6009CURITIBA62140510PED-${id}6304ABCD`;
    // SVG simples como placeholder do QR (não é um QR real, apenas visual)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>
      <rect width='100%' height='100%' fill='#fff'/>
      <rect x='10' y='10' width='60' height='60' fill='#000'/>
      <rect x='190' y='10' width='60' height='60' fill='#000'/>
      <rect x='10' y='190' width='60' height='60' fill='#000'/>
      <rect x='190' y='190' width='60' height='60' fill='#000'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='18' fill='#111'>PIX SIMULADO</text>
    </svg>`;
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return { copiaCola, qrDataUrl: dataUrl };
  }

  openPixModal() {
    this.pixMock = this.buildPixMock();
    this.showPixModal = true;
  }
  closePixModal() { this.showPixModal = false; }

  openCardModal() { this.showCardModal = true; }
  closeCardModal() { this.showCardModal = false; }

  async copiar(str: string) {
    try {
      await navigator.clipboard.writeText(str);
      this.toast.success('Pix copia e cola copiado (simulado)');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = str; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); this.toast.success('Pix copia e cola copiado (simulado)'); } catch {}
      document.body.removeChild(ta);
    }
  }

  // Confirmar nos modais (simulado) -> chama o backend real para registrar pagamento
  async confirmarPixPago() {
    this.closePixModal();
    await this.pagarReal('pix');
  }
  async confirmarCartaoPago() {
    this.closeCardModal();
    await this.pagarReal('cartao');
  }

  private async pagarReal(metodo: string) {
    if (!this.pedidoCodigo) return;
    try {
      this.carregando = true;
      const token = localStorage.getItem('token') || '';
      const pagamento = await this.api.criarPagamento(token, this.pedidoCodigo, {
        metodo,
        valor: this.resumo.total,
        mock: true,
      }).toPromise();
      await this.api.atualizarPedido(token, this.pedidoCodigo, { status: 'pago', pagamento }).toPromise();
      this.pagamentoStatus = 'pago';
      this.toast.success('Pagamento confirmado!');
      this.store.clearCart();
      this.store.setCreatedOrder(null);
      this.router.navigate(['/meus-pedidos']);
    } catch (e) {
      this.pagamentoStatus = 'falhou';
      this.toast.error('Falha ao processar o pagamento.');
    } finally {
      this.carregando = false;
    }
  }
}
