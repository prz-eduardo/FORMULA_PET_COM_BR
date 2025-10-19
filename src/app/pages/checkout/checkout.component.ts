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
  pedidoCodigo?: string; // código/ID do pedido criado
  pagamentoStatus?: 'pendente'|'pago'|'falhou';

  // Capturas simples vindas do carrinho (poderíamos recuperar do store/cart e do localStorage)
  get resumo() { return this.store.getCartTotals(); }

  entregaModo: 'retirada'|'entrega' = 'entrega';
  enderecoSelecionado: any | null = null;
  freteSelecionado: { servico?: string; nome?: string; prazo_dias?: number; valor?: number } | null = null;
  // Contexto extra vindo do carrinho
  freteOpcoes: Array<{ servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }> = [];
  freteOrigem?: { cep: string; endereco?: string; cidade?: string; uf?: string } | null;
  freteDestino?: { cep: string; city?: string; state?: string; neighborhood?: string; street?: string; fonte?: string } | null;

  // Opções de pagamento retornadas pelo backend ao criar pedido
  pagamentoOpcoes: Array<{ metodo: string; label?: string; detalhes?: any }> = [];
  pagamentoMetodo: string = 'pix';

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
    // Carrega contexto salvo do carrinho (se disponível)
    const ctx = this.store.getCheckoutContext();
    if (ctx) {
      this.entregaModo = ctx.entregaModo as any || 'entrega';
      this.enderecoSelecionado = ctx.enderecoSelecionado || null;
      this.freteSelecionado = ctx.freteSelecionado || null;
      this.freteOpcoes = ctx.freteOpcoes || [];
      this.freteOrigem = ctx.freteOrigem || null;
      this.freteDestino = ctx.freteDestino || null;
    }
    if (!this.store.cartSnapshot.length) {
      this.toast.info('Seu carrinho está vazio.');
      this.router.navigate(['/loja']);
      return;
    }
  }

  get totalComFrete() {
    const base = this.store.getCartTotals().subtotal;
    const frete = (this.entregaModo === 'entrega') ? (this.freteSelecionado?.valor || 0) : 0;
    return base + frete;
  }

  async criarPedido() {
    if (!this.store.isCheckoutAllowed()) {
      this.toast.error('Finalize as receitas pendentes antes de continuar.');
      return;
    }
    try {
      this.carregando = true;
      const token = localStorage.getItem('token') || '';
      const itens = this.store.cartSnapshot.map(ci => ({
        produto_id: ci.product.id,
        nome: ci.product.name,
        quantidade: ci.quantity,
        preco_unit: this.store.getPriceWithDiscount(ci.product),
        prescriptionId: ci.prescriptionId,
        prescriptionFileName: ci.prescriptionFileName,
      }));
      // Fallback automático: se modo entrega mas sem endereço selecionado, vira retirada na loja
      let modo: 'retirada'|'entrega' = this.entregaModo;
      let endereco = this.enderecoSelecionado;
      let freteSel = this.freteSelecionado;
      if (modo === 'entrega' && (!endereco || !freteSel)) {
        modo = 'retirada';
        endereco = null;
        freteSel = { servico: 'retirada', nome: 'Retirar na loja', prazo_dias: 0, valor: 0 };
      }

      const payload: any = {
        itens,
        entrega: {
          modo,
          endereco,
          frete: freteSel,
          opcoes: this.freteOpcoes || [],
          origem: this.freteOrigem || undefined,
          destino: this.freteDestino || (endereco ? { cep: endereco?.cep, city: endereco?.cidade, state: endereco?.estado, neighborhood: endereco?.bairro, street: endereco?.logradouro } : undefined),
        },
        totais: {
          subtotal: this.store.getCartTotals().subtotal,
          frete: modo === 'entrega' ? (freteSel?.valor || 0) : 0,
          total: this.totalComFrete,
        }
      };
      const res = await this.api.criarPedido(token, payload).toPromise();
      this.pedidoCodigo = res?.codigo || res?.id || res?.numero || undefined;
      // Captura opções de pagamento retornadas pelo backend
      const opcoes = res?.paymentOptions || res?.pagamento_opcoes || res?.opcoesPagamento || [];
      if (Array.isArray(opcoes)) {
        this.pagamentoOpcoes = opcoes.map((o: any) => ({ metodo: o.metodo || o.method || String(o), label: o.label || o.nome || String(o), detalhes: o }));
        if (this.pagamentoOpcoes.length) this.pagamentoMetodo = this.pagamentoOpcoes[0].metodo;
      }
      this.toast.success('Pedido criado! Agora vamos para o pagamento.');
    } catch (e) {
      this.toast.error('Não foi possível criar o pedido.');
    } finally {
      this.carregando = false;
    }
  }

  async pagar() {
    if (!this.pedidoCodigo) {
      this.toast.info('Crie o pedido primeiro.');
      return;
    }
    try {
      this.carregando = true;
      const token = localStorage.getItem('token') || '';
      // Exemplo de pagamento simples à vista; adapte conforme o gateway.
      const pagamento = await this.api.criarPagamento(token, this.pedidoCodigo, {
        metodo: this.pagamentoMetodo || 'pix',
        valor: this.totalComFrete,
      }).toPromise();

      // Atualiza status do pedido como "pago" (ou aguarda confirmação assíncrona)
      await this.api.atualizarPedido(token, this.pedidoCodigo, { status: 'pago', pagamento }).toPromise();
      this.pagamentoStatus = 'pago';
      this.toast.success('Pagamento confirmado!');
      // Esvazia carrinho e redireciona para pedidos
      this.store.clearCart();
      this.router.navigate(['/meus-pedidos']);
    } catch (e) {
      this.pagamentoStatus = 'falhou';
      this.toast.error('Falha ao processar o pagamento.');
    } finally {
      this.carregando = false;
    }
  }

  voltarCarrinho() {
    this.router.navigate(['/carrinho']);
  }
}
