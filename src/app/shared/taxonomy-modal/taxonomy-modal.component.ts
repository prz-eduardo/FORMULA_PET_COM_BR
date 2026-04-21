import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-taxonomy-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './taxonomy-modal.component.html',
  styleUrls: ['./taxonomy-modal.component.scss']
})
export class TaxonomyModalComponent {
  @Input() title = 'Selecionar ou Adicionar';
  @Input() items: Array<{ id: any; name: string }> = [];
  @Input() selected: any = null; // for multiple selection this can be array of names/ids
  @Input() multiple = false;
  @Input() allowAdd = true;

  @Output() select = new EventEmitter<any>();
  @Output() add = new EventEmitter<string>();
  @Output() delete = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  newValue = '';

  onAdd() {
    const v = (this.newValue || '').trim();
    if (!v) return;
    this.add.emit(v);
    this.newValue = '';
  }

  isSelected(item: any) {
    if (this.multiple) {
      return Array.isArray(this.selected) && this.selected.includes(item.name || item.id);
    }
    return this.selected != null && (this.selected === item.id || this.selected === item.name);
  }

  toggle(item: any) {
    this.select.emit(item);
  }

  onDelete(item: any, ev?: Event) {
    if (ev) ev.stopPropagation();
    this.delete.emit(item);
  }

  onClose() { this.close.emit(); }
}
