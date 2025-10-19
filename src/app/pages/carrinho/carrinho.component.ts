import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { StoreService, ShopProduct } from '../../services/store.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { ApiService, Receita } from '../../services/api.service';
import { PrescriptionPickerComponent } from '../../components/prescription-picker/prescription-picker.component';
import { FormsModule } from '@angular/forms';

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
  entregaModo: 'retirada' | 'entrega' = 'retirada';
  enderecos: any[] = [];
  enderecoSelecionado: any | null = null;
  mostrandoEnderecos = false; // modal
  freteValor: number = 0;
  fretePrazo?: string;
  lojaInfo = {
    nome: 'Fórmula Pet',
    endereco: 'Rua Treze de Maio, 506, Conjunto 04 - São Francisco, Curitiba/PR',
    cep: '80510-030',
    horario: 'Seg a Sex 09:00–18:00, Sáb 09:00–13:00'
  };

  constructor(public store: StoreService, private api: ApiService) {}

  async ngOnInit() {
    await this.loadReceitasDisponiveis();
    await this.loadHighlights();
    await this.loadEnderecos();
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
      if (this.enderecos?.length) this.enderecoSelecionado = this.enderecos[0];
    } catch {
      this.enderecos = [];
    }
  }

  abrirModalEnderecos() { this.mostrandoEnderecos = true; }
  fecharModalEnderecos() { this.mostrandoEnderecos = false; }

  selecionarEndereco(e: any) {
    this.enderecoSelecionado = e;
    this.mostrandoEnderecos = false;
    this.calcularFrete();
  }

  async cadastrarEndereco(novo: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string; }) {
    try {
      const token = localStorage.getItem('token') || '';
      const created = await this.api.createEnderecoCliente(token, novo).toPromise();
      this.enderecos = [created, ...this.enderecos];
      this.enderecoSelecionado = created;
      this.mostrandoEnderecos = false;
      this.calcularFrete();
    } catch {}
  }

  async calcularFrete() {
    this.freteValor = 0; this.fretePrazo = undefined;
    try {
      if (this.entregaModo !== 'entrega' || !this.enderecoSelecionado) return;
      const token = localStorage.getItem('token') || undefined;
      const itens = this.store.cartSnapshot.map(ci => ({ id: ci.product.id, qtd: ci.quantity, preco: this.store.getPriceWithDiscount(ci.product) }));
      const cep = this.enderecoSelecionado?.cep || '';
      if (!cep) return;
      const resp = await this.api.cotarFrete(token, { cep, itens }).toPromise();
      if (resp && typeof resp.valor === 'number') {
        this.freteValor = Math.max(0, resp.valor);
        this.fretePrazo = resp.prazo;
      }
    } catch {
      // fallback: zero ou mensagem pode ser mostrada na UI
    }
  }

  get totalComFrete() {
    const t = this.store.getCartTotals();
    return t.subtotal + (this.entregaModo === 'entrega' ? this.freteValor : 0);
  }
}
