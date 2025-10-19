import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { StoreService, ShopProduct } from '../../services/store.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { ApiService, Receita } from '../../services/api.service';
import { PrescriptionPickerComponent } from '../../components/prescription-picker/prescription-picker.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NavmenuComponent, PrescriptionPickerComponent, FormsModule],
  templateUrl: './carrinho.component.html',
  styleUrls: ['./carrinho.component.scss']
})
export class CarrinhoComponent implements OnInit {
  receitasDisponiveis: Receita[] = [];
  carregandoReceitas = false;
  // Highlights quando carrinho vazio
  loadingHighlights = false;
  highlights: ShopProduct[] = [];
  // Confirm remove modal state
  showConfirmRemove = false;
  confirmTargetId: number | null = null;
  confirmTargetName: string | null = null;

  // Entrega/Retirada
  entregaModo: 'retirada' | 'entrega' = 'entrega';
  enderecos: any[] = [];
  enderecoSelecionado: any | null = null;
  mostrandoEnderecos = false; // modal
  mostrandoCadastroEndereco = false; // dentro do modal: alterna entre lista e form
  freteValor: number = 0;
  fretePrazo?: string;
  // Novo modelo de frete com múltiplas opções
  freteOpcoes: Array<{ servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }> = [];
  freteSelecionado?: { servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string };
  freteOrigem?: { cep: string; endereco?: string; cidade?: string; uf?: string };
  freteDestino?: { cep: string; city?: string; state?: string; neighborhood?: string; street?: string; fonte?: string };
  carregandoFrete = false;
  // CEP digitado para cálculo de frete
  cepInput: string = '';
  lojaInfo = {
    nome: 'Fórmula Pet',
    endereco: 'Rua Treze de Maio, 506, Conjunto 04 - São Francisco, Curitiba/PR',
    cep: '80510-030',
    horario: 'Seg a Sex 09:00–18:00, Sáb 09:00–13:00'
  };
  // Novo endereço (form)
  novoEndereco: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string; nome?: string; tipo?: string } = {
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', nome: 'Casa', tipo: 'casa'
  };

  constructor(public store: StoreService, private api: ApiService, private router: Router) {}

  async ngOnInit() {
    await this.loadReceitasDisponiveis();
    await this.loadHighlights();
    await this.loadEnderecos();
    // Se já estiver em modo entrega e há endereços, seleciona o primeiro e calcula
    if (this.entregaModo === 'entrega' && this.enderecos?.length) {
      this.enderecoSelecionado = this.enderecos[0];
      this.calcularFrete();
    }
  }

  async loadReceitasDisponiveis() {
    try {
      this.carregandoReceitas = true;
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'cliente') { this.receitasDisponiveis = []; return; }
      // Se o backend suportar, peça apenas receitas disponíveis e do cliente logado
      const me = await this.api.getClienteMe(token).toPromise();
      const clienteId = me?.user?.id;
      const resp = await this.api.getReceitas(token, { cliente_id: clienteId, availableOnly: true, context: 'carrinho', pageSize: 50, page: 1 }).toPromise();
      this.receitasDisponiveis = resp?.data || [];
    } catch {
      this.receitasDisponiveis = [];
    } finally {
      this.carregandoReceitas = false;
    }
  }

  async loadHighlights() {
    try {
      this.loadingHighlights = true;
      this.highlights = await this.store.loadHomeHighlights();
    } finally {
      this.loadingHighlights = false;
    }
  }

  inc(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    if (item) this.store.updateQuantity(id, item.quantity + 1);
  }
  dec(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    if (!item) return;
    if (item.quantity > 1) {
      this.store.updateQuantity(id, item.quantity - 1);
    } else {
      // quantity == 1: ask for confirmation to remove
      this.openConfirmRemove(item.product.id, item.product.name);
    }
  }
  onRequestRemove(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    const name = item?.product?.name ?? '';
    this.openConfirmRemove(id, name);
  }
  private openConfirmRemove(id: number, name: string) {
    this.confirmTargetId = id;
    this.confirmTargetName = name;
    this.showConfirmRemove = true;
  }
  cancelRemove() {
    this.showConfirmRemove = false;
    this.confirmTargetId = null;
    this.confirmTargetName = null;
  }
  confirmRemoveNow() {
    if (this.confirmTargetId != null) {
      this.store.removeFromCart(this.confirmTargetId);
    }
    this.cancelRemove();
  }
  remove(id: number) { this.onRequestRemove(id); }
  clear() { this.store.clearCart(); }
  total() { return this.store.getCartTotals(); }

  onAttachPrescriptionId(productId: number, value: string) {
    const id = value.trim();
    this.store.setItemPrescriptionById(productId, { prescriptionId: id || undefined, prescriptionFileName: undefined });
  }

  onSelectPrescription(productId: number, receitaId: number | undefined) {
    const id = receitaId != null ? String(receitaId) : undefined;
    this.store.setItemPrescriptionById(productId, { prescriptionId: id, prescriptionFileName: undefined });
  }

  onUploadPrescriptionFile(productId: number, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // For now, we only store the file name as a placeholder for the upload flow
    this.store.setItemPrescriptionById(productId, { prescriptionFileName: file.name, prescriptionId: undefined });
    // reset input so same file can be re-selected
    input.value = '';
  }

  onUploadPrescriptionFileDirect(productId: number, file: File) {
    if (!file) return;
    this.store.setItemPrescriptionById(productId, { prescriptionFileName: file.name, prescriptionId: undefined });
  }

  // Endereços e frete
  async loadEnderecos() {
    try {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'cliente') { this.enderecos = []; return; }
      this.enderecos = (await this.api.listEnderecosCliente(token).toPromise()) || [];
      if (this.enderecos?.length) {
        this.enderecoSelecionado = this.enderecos[0];
        this.cepInput = this.enderecos[0]?.cep || '';
        if (this.entregaModo === 'entrega') await this.calcularFrete();
      }
    } catch {
      this.enderecos = [];
    }
  }

  abrirModalEnderecos() { this.mostrandoEnderecos = true; this.mostrandoCadastroEndereco = !this.enderecos?.length; }
  fecharModalEnderecos() { this.mostrandoEnderecos = false; this.mostrandoCadastroEndereco = false; }
  mostrarFormNovoEndereco() {
    this.mostrandoCadastroEndereco = true;
    // Reset com defaults amigáveis
    this.novoEndereco = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', nome: 'Casa', tipo: 'casa' };
  }
  mostrarListaEnderecos() { this.mostrandoCadastroEndereco = false; }

  selecionarEndereco(e: any) {
    this.enderecoSelecionado = e;
    // Seleção aplicada imediatamente (sem botão)
    this.mostrandoEnderecos = false;
    // Alimenta input de CEP com o CEP do endereço
    this.cepInput = e?.cep || '';
    this.calcularFrete();
  }

  // Seleção inline (cards dentro da seção de entrega)
  selecionarEnderecoInline(e: any) {
    this.enderecoSelecionado = e;
    this.cepInput = e?.cep || '';
    this.calcularFrete();
  }

  onToggleEntregaModo(mode: 'retirada' | 'entrega') {
    this.entregaModo = mode;
    if (mode === 'retirada') {
      // Zera frete e destaca retirada
      const retiradaBase = { servico: 'retirada_loja', nome: 'Retirar na loja', prazo_dias: 0, valor: 0, observacao: this.lojaInfo.endereco };
      this.freteOpcoes = [retiradaBase];
      this.freteSelecionado = retiradaBase;
      this.freteValor = 0;
      this.fretePrazo = undefined;
    } else {
      // Garante um endereço e calcula
      if (!this.enderecoSelecionado && this.enderecos?.length) {
        this.enderecoSelecionado = this.enderecos[0];
        this.cepInput = this.enderecos[0]?.cep || '';
      }
      this.calcularFrete();
    }
  }

  async cadastrarEndereco(novo: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string; }) {
    try {
      const token = localStorage.getItem('token') || '';
      const payload = { ...novo, cep: (novo.cep || '').replace(/\D/g, '') };
      const created = await this.api.createEnderecoCliente(token, payload).toPromise();
      this.enderecos = [created, ...this.enderecos];
      this.enderecoSelecionado = created;
      this.cepInput = created?.cep || this.cepInput;
      this.mostrandoEnderecos = false;
      this.calcularFrete();
    } catch {}
  }

  // Máscara e busca CEP no formulário de novo endereço
  onCepInputMask(ev: any) {
    const raw = (ev?.target?.value ?? '').toString();
    const dig = raw.replace(/\D/g, '').slice(0, 8);
    const masked = dig.length > 5 ? `${dig.slice(0,5)}-${dig.slice(5)}` : dig;
    this.novoEndereco.cep = masked;
  }

  async onCepBlurLookup() {
    const cep = (this.novoEndereco.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      // Tenta ViaCEP
      const via = await this.api.buscarCepViaCep(cep).toPromise();
      if (via && !via.erro) {
        this.novoEndereco.logradouro = via.logradouro || this.novoEndereco.logradouro;
        this.novoEndereco.bairro = via.bairro || this.novoEndereco.bairro;
        this.novoEndereco.cidade = via.localidade || this.novoEndereco.cidade;
        this.novoEndereco.estado = via.uf || this.novoEndereco.estado;
        return;
      }
      // Fallback BrasilAPI
      const br = await this.api.buscarCepBrasilAPI(cep).toPromise();
      if (br) {
        this.novoEndereco.logradouro = br.street || this.novoEndereco.logradouro;
        this.novoEndereco.bairro = br.neighborhood || this.novoEndereco.bairro;
        this.novoEndereco.cidade = br.city || this.novoEndereco.cidade;
        this.novoEndereco.estado = br.state || this.novoEndereco.estado;
      }
    } catch {
      // silencioso; usuário pode preencher manualmente
    }
  }

  async calcularFrete() {
    this.freteValor = 0; this.fretePrazo = undefined;
    this.freteOrigem = undefined; this.freteDestino = undefined;
    this.carregandoFrete = true;
    // Sempre oferece retirada na loja como primeira opção, mesmo sem cálculo externo
    const retiradaBase = { servico: 'retirada_loja', nome: 'Retirar na loja', prazo_dias: 0, valor: 0, observacao: this.lojaInfo.endereco };
    this.freteOpcoes = [retiradaBase];
    if (!this.freteSelecionado) this.freteSelecionado = retiradaBase;
    try {
      if (this.entregaModo !== 'entrega') return;
      // Auto-seleciona o primeiro endereço se nenhum estiver selecionado
      if (!this.enderecoSelecionado && this.enderecos?.length) this.enderecoSelecionado = this.enderecos[0];
      // Define CEP a partir do input ou do endereço selecionado
      const cep = (this.cepInput || this.enderecoSelecionado?.cep || '').trim();
      if (!cep) return;
      const token = localStorage.getItem('token') || undefined;
      const itens = this.store.cartSnapshot.map(ci => ({ id: ci.product.id, qtd: ci.quantity, preco: this.store.getPriceWithDiscount(ci.product) }));
      const resp = await this.api.cotarFrete(token, { cep, itens }).toPromise();
      // Suporta tanto resposta antiga { valor, prazo } quanto nova com { origem, destino, pacote, opcoes }
      if (resp) {
        // Nova resposta com múltiplas opções
        if ((resp as any).opcoes && Array.isArray((resp as any).opcoes)) {
          const r: any = resp as any;
          this.freteOrigem = r.origem;
          this.freteDestino = r.destino;
          const opcoes = (r.opcoes || []) as Array<{ servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }>;
          // Garante retirada no topo
          const semRetirada = opcoes.filter(o => o.servico !== 'retirada_loja');
          this.freteOpcoes = [retiradaBase, ...semRetirada];
          // Seleciona a mais barata por padrão
          if (this.freteOpcoes.length) {
            this.freteSelecionado = this.freteOpcoes.slice().sort((a,b) => a.valor - b.valor)[0];
            this.freteValor = Math.max(0, this.freteSelecionado.valor);
            this.fretePrazo = this.freteSelecionado.prazo_dias != null ? `${this.freteSelecionado.prazo_dias} dia${this.freteSelecionado.prazo_dias === 1 ? '' : 's'}` : undefined;
          }
        } else if (typeof (resp as any).valor === 'number') {
          // Resposta antiga
          const antigo = { servico: 'entrega', nome: 'Entrega', prazo_dias: undefined as any, valor: Math.max(0, (resp as any).valor) };
          this.freteOpcoes = [retiradaBase, antigo as any];
          this.freteSelecionado = antigo as any;
          this.freteValor = antigo.valor;
          this.fretePrazo = (resp as any).prazo;
        }
      }
    } catch {
      // Fallback genérico de frete se o endpoint não estiver disponível
      const subtotal = this.store.getCartTotals().subtotal;
      // Estimativa simples: 8% do subtotal, min 12, max 40
      const estimado = Math.min(40, Math.max(12, subtotal * 0.08));
      const estimativa = { servico: 'estimativa_entrega', nome: 'Entrega estimada', prazo_dias: undefined as any, valor: Math.round(estimado * 100) / 100 };
      this.freteOpcoes = [retiradaBase, estimativa as any];
      this.freteSelecionado = estimativa as any;
      this.freteValor = estimativa.valor;
      this.fretePrazo = '3–7 dias úteis';
    } finally {
      this.carregandoFrete = false;
    }
  }

  get totalComFrete() {
    const t = this.store.getCartTotals();
    const freteSel = this.freteSelecionado?.valor ?? this.freteValor;
    return t.subtotal + (this.entregaModo === 'entrega' ? (freteSel || 0) : 0);
  }

  selecionarOpcaoFrete(opt: { servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }) {
    this.freteSelecionado = opt;
    this.freteValor = Math.max(0, opt?.valor || 0);
    this.fretePrazo = opt?.prazo_dias != null ? `${opt.prazo_dias} dia${opt.prazo_dias === 1 ? '' : 's'}` : undefined;
  }

  tipoEmoji(tipo?: string): string {
    const t = (tipo || '').toLowerCase().trim();
    switch (t) {
      case 'casa': return '🏠';
      case 'trabalho': return '💼';
      case 'entrega': return '📦';
      case 'cobranca': return '🧾';
      default: return '📍';
    }
  }

  // Ir para checkout: persiste contexto mínimo e navega
  irParaCheckout() {
    this.store.setCheckoutContext({
      entregaModo: this.entregaModo,
      enderecoSelecionado: this.enderecoSelecionado,
      freteSelecionado: this.freteSelecionado || (this.freteValor ? { valor: this.freteValor } : null),
      freteOpcoes: this.freteOpcoes,
      freteOrigem: this.freteOrigem,
      freteDestino: this.freteDestino
    });
    this.router.navigate(['/checkout']);
  }
}
