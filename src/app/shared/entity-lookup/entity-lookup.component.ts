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
  @Input() selectedIds: number[] = [];
  @Output() selectedIdsChange = new EventEmitter<number[]>();

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

  add(id: number) {
    if (!id && id !== 0) return;
    const set = new Set(this.selectedIds || []);
    set.add(id);
    this.selectedIds = Array.from(set);
    this.selectedIdsChange.emit(this.selectedIds);
    this.suggestions = [];
    this.searchControl.setValue('');
  }

  remove(id: number) {
    this.selectedIds = (this.selectedIds || []).filter(x => x !== id);
    this.selectedIdsChange.emit(this.selectedIds);
  }
}
