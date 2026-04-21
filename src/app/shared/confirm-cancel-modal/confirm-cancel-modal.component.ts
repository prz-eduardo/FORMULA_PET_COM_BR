import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirm-cancel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirm-cancel-modal.component.html',
  styleUrls: ['./confirm-cancel-modal.component.scss']
})
export class ConfirmCancelModalComponent {
  @Input() title: string = 'Cancelar pedido';
  @Input() requireReason: boolean = false;
  @Output() confirm = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  reason: string = '';

  doConfirm() {
    if (this.requireReason && !this.reason.trim()) return;
    this.confirm.emit(this.reason || '');
  }

  doCancel() {
    this.cancel.emit();
  }
}
