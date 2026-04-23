import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SmartStatusButtonComponent } from '../smart-status-button/smart-status-button.component';
import { extractItems, extractCliente, extractShipping, extractTotals, formatCurrency } from '../order-utils';
import { ORDER_STATUSES, STATUS_ORDER, statusLabel as statusLabelConst, getAllowedTransitions, getNextStatus, isTerminal } from '../../constants/order-status.constants';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, SmartStatusButtonComponent],
  templateUrl: './order-details.component.html',
  styleUrls: ['./order-details.component.scss']
})
export class OrderDetailsComponent implements OnChanges {
  @Input() order: any;
  @Input() mode: 'compact' | 'full' = 'compact';
  @Input() hideHeader: boolean = false;
  @Output() expand = new EventEmitter<void>();
  @Output() collapse = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  get items() { return extractItems(this.order); }
  get cliente() { return extractCliente(this.order); }
  shipping: any;
    ngOnChanges(changes: SimpleChanges) {
      if (changes['order']) {
        this.shipping = extractShipping(this.order);
      }
    }
  get totals() { return extractTotals(this.order); }
  formatCurrency = formatCurrency;

  // expose centralized status options to the template
  statusOptions = ORDER_STATUSES;
  // canonical stepper order for timeline UI
  stepperOrder = STATUS_ORDER;

  get payments() { return this.order?.pagamentos || this.order?.payments || this.order?.pagamentos || []; }


  // Helpers for template
  itemImage(it: any) {
    return it?.produto_snapshot?.imagem_principal || it?.raw?.produto?.imagem_principal || it?.imagem_principal || null;
  }

  hasCliente() {
    return !!(this.cliente?.nome || this.cliente?.email || this.cliente?.cpf || this.order?.cliente_nome || this.order?.cliente_email || this.order?.cliente_cpf);
  }

  hasShippingAddress() {
    return !!(this.order?.endereco_entrega || this.order?.raw_snapshot?.input?.entrega?.endereco || this.shipping?.frete);
  }

  isCompact() { return this.mode === 'compact'; }
  isFull() { return this.mode === 'full'; }

  statusClass(s: any) {
    const st = String(s || '').toLowerCase();
    if (st === 'cancelado') return 'status--cancelado';
    if (st === 'concluido') return 'status--concluido';
    if (st === 'pago' || st === 'pago') return 'status--paid';
    if (st === 'enviado') return 'status--enviado';
    return 'status--default';
  }

  statusLabel(s: any) { return statusLabelConst(s); }
  isCurrentStatus(s: string) { return String(this.order?.status || '').toLowerCase() === s; }

  get nextStatus(): string | null {
    return getNextStatus(this.order?.status);
  }

  canChangeStatus() {
    const s = String(this.order?.status || '').toLowerCase();
    return !!s && !isTerminal(s);
  }

  onSetStatus(next: string) { this.statusChange.emit(next); }
  onCancel() { this.cancel.emit(); }
  onClose() { this.close.emit(); }
  onExpand() { this.expand.emit(); }
  onCollapse() { this.collapse.emit(); }
  onEdit() { this.edit.emit(); }

  // Accordion/collapse state for cards (items, cliente, shipping, totals, payments, obs)
  collapsedState: Record<string, boolean> = {
    items: false,
    cliente: false,
    shipping: false,
    totals: false,
    payments: false,
    obs: false
  };

  toggleCollapse(key: string) {
    this.collapsedState[key] = !this.collapsedState[key];
  }

  // (shipping options UI removed) 

  isCollapsed(key: string) {
    return !!this.collapsedState[key];
  }

  getStepInfo(key: string) {
    const flow = this.stepperOrder || [];
    const cur = String(this.order?.status || '').toLowerCase();
    const idx = Math.max(0, flow.indexOf(cur));
    const i = Math.max(0, flow.indexOf(key));
    const done = cur && idx >= i;
    const active = cur && idx === i;
    const clickable = !!cur && !isTerminal(cur) && getAllowedTransitions(cur).includes(key);
    return { done, active, clickable };
  }
}
