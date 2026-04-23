import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ButtonDirective, ButtonComponent } from '../../../../../shared/button';

@Component({
  selector: 'admin-pagination',
  standalone: true,
  imports: [CommonModule, ButtonDirective, ButtonComponent],
  templateUrl: './admin-pagination.component.html',
  styleUrls: ['./admin-pagination.component.scss']
})
export class AdminPaginationComponent {
  @Input() page = 1;
  @Input() total = 0; // total items
  @Input() pageSize = 10;

  @Output() pageChange = new EventEmitter<number>();

  totalPages(): number { const s = Number(this.pageSize) || 1; const t = Number(this.total) || 0; return s ? Math.max(1, Math.ceil(t / s)) : 1; }
  canPrev(): boolean { return this.page > 1; }
  canNext(): boolean { return this.page < this.totalPages(); }
  prev() { if (this.canPrev()) this.emitPage(this.page - 1); }
  next() { if (this.canNext()) this.emitPage(this.page + 1); }
  goFirst() { if (this.canPrev()) this.emitPage(1); }
  goLast() { if (this.canNext()) this.emitPage(this.totalPages()); }

  pages(): Array<number|string> {
    const total = this.totalPages();
    const current = this.page;
    const delta = 2;
    if (total <= 1) return [1];
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const range: Array<number|string> = [];
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);
    range.push(1);
    if (left > 2) range.push('...');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < total - 1) range.push('...');
    range.push(total);
    return range;
  }

  emitPage(n: number) { if (n === this.page) return; this.pageChange.emit(n); }
  // wrapper to be used from template because template expressions cannot use TS casts
  emitPageNumber(p: number | string) { if (typeof p === 'number') this.emitPage(p); }
}
