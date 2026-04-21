import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective } from '../../../../shared/button';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import { OrderDetailsComponent } from '../../../../shared/order-details/order-details.component';
import { ConfirmCancelModalComponent } from '../../../../shared/confirm-cancel-modal/confirm-cancel-modal.component';
import { ApiService } from '../../../../services/api.service';
import { HttpClient } from '@angular/common/http';
import { SessionService } from '../../../../services/session.service';
import { OrderService } from '../../../../services/order.service';
import { normalizeOrder, extractCliente, extractShipping } from '../../../../shared/order-utils';
import { getNextStatus } from '../../../../constants/order-status.constants';

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminPaginationComponent, ButtonDirective, AdminCrudComponent, OrderDetailsComponent, ConfirmCancelModalComponent],
  
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit {
  // ...existing properties...

  // Ação rápida de status
  onCustomAction(evt: {action: string, item: any}) {
    if (!evt || !evt.action || !evt.item) return;
    this.selectedId = evt.item.id;
    if (evt.action === 'advance') {
      this.handleAdvanceStatus(evt.item);
    } else if (evt.action === 'cancel') {
      this.cancelarPedido();
    }
  }

  // Avança o status do pedido conforme o atual
  async handleAdvanceStatus(item: any) {
    const next = getNextStatus(item?.status || null);
    if (next) await this.setStatus(next);
    this.load();
  }
  // filters
  q = '';
  status = '';
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;
  loading = false;
  items: any[] = [];
  // summary
  summary: Record<string, number> = {};

  // selection/state
  view: 'list' | 'details' | 'payments' | 'shipping' | 'invoices' | 'edit' = 'list';
  selected: any | null = null;
  selectedId: number | null = null;
  // drawer full-screen state
  drawerFull = false;
  // derived details
  selectedCliente: { nome?: string|null; email?: string|null; cpf?: string|null; id?: string|number|null } | null = null;
  selectedFrete: any = null;
  shippingOptions: any[] = [];
  showCancelModal: boolean = false;

  // Columns for admin CRUD table
  ordersColumns = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'created_at', label: 'Criado', width: '180px' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'cliente_email', label: 'Email' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'total_liquido', label: 'Total', width: '110px' }
  ];

  constructor(private api: ApiService, private session: SessionService, private http: HttpClient, private orderService: OrderService) {}

  ngOnInit(): void {
    this.fetchSummary();
    this.load();
  }

  async fetchSummary() {
    this.loading = true;
    try {
      // Admin: hitting admin namespace
  const base = this.session.getBackendBaseUrl();
  const url = `${base}/admin/orders-summary`;
  const headers = this.session.getAuthHeaders();
  const data = await this.http.get(url, { headers }).toPromise() as any;
  this.summary = (data && (data as any).counts) || {};
    } finally { this.loading = false; }
  }

  async load(reset = false) {
    if (reset) this.page = 1;
    this.loading = true;
    try {
  const base = this.session.getBackendBaseUrl();
      const params = new URLSearchParams();
      if (this.q) params.set('q', this.q);
      if (this.status) params.set('status', this.status);
      params.set('page', String(this.page));
      params.set('pageSize', String(this.pageSize));
  const url = `${base}/admin/orders?${params.toString()}`;
  const headers = this.session.getAuthHeaders();
  const resp = await this.http.get(url, { headers }).toPromise() as any;
  this.items = (resp && resp.data) || [];
  this.page = (resp && resp.page) || 1;
  this.pageSize = (resp && resp.pageSize) || 20;
  this.total = (resp && resp.total) || 0;
  this.totalPages = (resp && resp.totalPages) || 1;
    } finally { this.loading = false; }
  }

  // Navigation in module
  async openDetails(o: any) {
    try {
      this.selectedId = o?.id ?? null;
      if (!this.selectedId) { this.selected = o || null; this.view = 'details'; return; }
      const base = this.session.getBackendBaseUrl();
      const headers = this.session.getAuthHeaders();
      const url = `${base}/admin/orders/${this.selectedId}`;
      this.selected = await this.http.get(url, { headers }).toPromise() as any;
      this.view = 'details';
      this.resolveDerived();
      // ensure drawer starts in compact mode
      this.drawerFull = false;
    } catch {
      this.selected = o || null;
      // drawer will open via binding
      this.resolveDerived();
      this.drawerFull = false;
    }
  }
  openPayments(o: any) { this.selected = o; this.view = 'payments'; }
  openShipping(o: any) { this.selected = o; this.view = 'shipping'; }
  openInvoices(o: any) { this.selected = o; this.view = 'invoices'; }
  backToList() { this.view = 'list'; this.selected = null; this.load(); }

  // Pagination
  nextPage() { if (this.page < this.totalPages) { this.page++; this.load(); } }
  prevPage() { if (this.page > 1) { this.page--; this.load(); } }

  // Helpers
  statusBadge(status: string | null | undefined): string {
    const s = String(status || '').toLowerCase();
    if (s === 'pago') return 'success';
    if (s === 'concluido') return 'success';
    if (s === 'enviado') return 'info';
    if (s === 'em_preparo') return 'warning';
    if (s === 'aguardando_pagamento') return 'warning';
    if (s === 'cancelado') return 'danger';
    return 'neutral';
  }

  private resolveDerived() {
    if (!this.selected) {
      this.selectedCliente = null;
      this.selectedFrete = null;
      this.shippingOptions = [];
      return;
    }
    this.selected = normalizeOrder(this.selected || {});
    this.selectedCliente = extractCliente(this.selected);
    const ship = extractShipping(this.selected);
    this.selectedFrete = ship.frete;
    this.shippingOptions = ship.opcoes || [];
  }

  async setStatus(status: string) {
    if (!this.selectedId) return;
    const resp = await this.orderService.setStatus(this.selectedId, status).toPromise() as any;
    this.selected = resp;
    this.resolveDerived();
  }

  async cancelarPedido() {
    if (!this.selectedId) return;
    this.showCancelModal = true;
  }

  async confirmCancel(motivo: string) {
    if (!this.selectedId) return;
    const resp = await this.orderService.cancel(this.selectedId, motivo).toPromise() as any;
    this.selected = resp;
    this.resolveDerived();
    this.showCancelModal = false;
  }

  async saveOrder(payload: any) {
    if (!this.selectedId) return;
    this.loading = true;
    try {
      const base = this.session.getBackendBaseUrl();
      const headers = this.session.getAuthHeaders();
      const url = `${base}/admin/orders/${this.selectedId}`;
      const resp = await this.http.put(url, payload, { headers }).toPromise() as any;
      this.selected = resp;
      this.resolveDerived();
      this.view = 'details';
      this.load();
    } finally { this.loading = false; }
  }

  onQuickSearch(q: string) {
    this.q = q || '';
    this.page = 1;
    this.load(true);
  }

  onDrawerOpenChange(open: boolean) {
    if (!open) {
      this.selected = null;
      this.selectedId = null;
      this.drawerFull = false;
    }
  }

  onExpandDetails() { this.drawerFull = true; }
  onCollapseDetails() { this.drawerFull = false; }
}
