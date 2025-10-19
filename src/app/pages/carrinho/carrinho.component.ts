import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { StoreService, ShopProduct } from '../../services/store.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { ApiService, Receita } from '../../services/api.service';
import { PrescriptionPickerComponent } from '../../components/prescription-picker/prescription-picker.component';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NavmenuComponent, PrescriptionPickerComponent],
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

  constructor(public store: StoreService, private api: ApiService) {}

  async ngOnInit() {
    await this.loadReceitasDisponiveis();
    await this.loadHighlights();
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
}
