import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getNextStatus, statusLabel as statusLabelConst, isTerminal } from '../../constants/order-status.constants';

@Component({
  selector: 'app-smart-status-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './smart-status-button.component.html',
  styleUrls: ['./smart-status-button.component.scss']
})
export class SmartStatusButtonComponent {
  @Input() order: any;
  @Output() statusChange = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  get nextStatus(): string | null { return getNextStatus(this.order?.status); }
  get canChange(): boolean { const s = String(this.order?.status || '').toLowerCase(); return !!s && !isTerminal(s); }

  onAdvance() { const n = this.nextStatus; if (n) this.statusChange.emit(n); }
  onCancelClick() { this.cancel.emit(); }

  statusLabel(s: any) { return statusLabelConst(s); }
}
