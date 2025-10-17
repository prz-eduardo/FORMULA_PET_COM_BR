import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Receita } from '../../services/api.service';

@Component({
  selector: 'app-prescription-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prescription-picker.component.html',
  styleUrls: ['./prescription-picker.component.scss']
})
export class PrescriptionPickerComponent {
  @Input() prescriptions: Receita[] = [];
  @Input() selectedId: string | number | null | undefined = undefined;
  @Input() loading = false;
  @Input() disabled = false;
  // Optional modes
  @Input() allowManualId = false; // disabled by default as requested
  @Input() allowUpload = true;

  @Output() select = new EventEmitter<number>();
  @Output() manualId = new EventEmitter<string>();
  @Output() upload = new EventEmitter<File>();

  filter = '';
  view: 'list' | 'upload' = 'list';
  expanded: number | null = null;

  get filtered(): Receita[] {
    const f = (this.filter || '').trim().toLowerCase();
    if (!f) return this.prescriptions;
    return this.prescriptions.filter(r => {
      const idStr = String(r.id);
      const pet = (r.pet_nome || r.nome_pet || '').toLowerCase();
      const cliente = (r.cliente_nome || '').toLowerCase();
      return idStr.includes(f) || pet.includes(f) || cliente.includes(f);
    });
  }

  isSelected(rx: Receita): boolean {
    if (this.selectedId == null) return false;
    return String(this.selectedId) === String(rx.id);
  }

  onToggleExpand(id: number) {
    this.expanded = this.expanded === id ? null : id;
  }

  onPick(rx: Receita) {
    if (this.disabled) return;
    this.select.emit(rx.id);
  }

  onEnterId(val: string) {
    if (this.disabled) return;
    this.manualId.emit((val || '').trim());
  }

  onFile(ev: Event) {
    if (this.disabled) return;
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload.emit(file);
    if (input) input.value = '';
  }
}
