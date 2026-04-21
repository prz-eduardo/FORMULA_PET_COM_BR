import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-entity-lookup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './entity-lookup.component.html',
  styleUrls: ['./entity-lookup.component.scss']
})
export class EntityLookupComponent {
  // Backwards-compatible: array of selected IDs
  @Input() selectedIds: number[] = [];
  @Output() selectedIdsChange = new EventEmitter<number[]>();

  // Optional richer selected items (objects with id, name, price)
  @Input() selectedItems?: Array<{ id: number; name?: string; price?: number }>;
  @Output() selectedItemsChange = new EventEmitter<any[]>();

  // Optional form (FormGroup) to allow discount calculation in context (e.g. promo tipo/valor)
  @Input() form?: any;

  @Input() placeholder = 'Buscar...';
  // searchFn can return Observable<Array<{id,name,price}>> or Promise or plain Array
  @Input() searchFn?: (q: string) => any;

  searchControl = new FormControl('');
  suggestions: Array<{ id: number; name: string; price?: number }> = [];
  private searchTimeout: any = null;

  onInput() {
    const q = (this.searchControl.value || '').trim();
    if (!q) {
      this.suggestions = [];
      return;
    }
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.runSearch(q), 250);
  }

  private runSearch(q: string) {
    if (!this.searchFn) return;
    try {
      const res = this.searchFn(q);
      if (res && typeof res.subscribe === 'function') {
        res.subscribe((items: any) => this.suggestions = items || []);
      } else if (res && typeof res.then === 'function') {
        res.then((items: any) => this.suggestions = items || []);
      } else if (Array.isArray(res)) {
        this.suggestions = res;
      } else {
        this.suggestions = [];
      }
    } catch (e) {
      this.suggestions = [];
    }
  }

  // Add either an id or a full item object
  add(item: any) {
    if (!item && item !== 0) return;

    // normalize id
    const id = (typeof item === 'object') ? Number(item.id) : Number(item);
    if (isNaN(id)) return;

    // update selectedIds (always emit for backwards compat)
    const idSet = new Set(this.selectedIds || []);
    idSet.add(id);
    this.selectedIds = Array.from(idSet);
    this.selectedIdsChange.emit(this.selectedIds);

    // update selectedItems if provided or if we can infer from suggestion
    try {
      const existing = (this.selectedItems || []).slice();
      const idx = existing.findIndex(x => Number(x.id) === id);
      if (idx === -1) {
        let obj: any = null;
        if (typeof item === 'object') obj = { id, name: item.name ?? item.nome, price: (item.price ?? item.preco) != null ? Number(item.price ?? item.preco) : undefined };
        else {
          const fromSug = this.suggestions.find(s => Number(s.id) === id);
          if (fromSug) obj = { id, name: fromSug.name, price: fromSug.price };
        }
        if (obj) {
          existing.push(obj);
          this.selectedItems = existing;
          this.selectedItemsChange.emit(this.selectedItems);
        }
      }
    } catch (e) {
      // noop
    }

    this.suggestions = [];
    this.searchControl.setValue('');
  }

  remove(id: number) {
    const nid = Number(id);
    this.selectedIds = (this.selectedIds || []).filter(x => Number(x) !== nid);
    this.selectedIdsChange.emit(this.selectedIds);
    if (this.selectedItems) {
      this.selectedItems = (this.selectedItems || []).filter(x => Number(x.id) !== nid);
      this.selectedItemsChange.emit(this.selectedItems);
    }
  }

  formatCurrency(v: any) {
    const num = Number(v || 0);
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num); } catch { return `R$ ${num.toFixed(2)}`; }
  }

  getDiscountedPrice(item: any): number | null {
    if (!item) return null;
    const price = Number(item.price ?? item.preco ?? 0);
    if (isNaN(price)) return null;
    if (!this.form) return null;
    try {
      const tipo = (this.form.get('tipo')?.value) || (this.form?.value?.tipo) || 'percentual';
      const valorRaw = this.form.get('valor')?.value ?? this.form?.value?.valor ?? 0;
      const valor = Number(valorRaw || 0);
      if (isNaN(valor)) return null;
      if (tipo === 'percentual') return Math.max(0, +(price * (1 - valor / 100)).toFixed(2));
      if (tipo === 'valor') return Math.max(0, +(price - valor).toFixed(2));
      return null;
    } catch (e) { return null; }
  }
}
