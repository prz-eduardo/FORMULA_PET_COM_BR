import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../services/api.service';
import { HttpClient } from '@angular/common/http';
import { SessionService } from '../../../../services/session.service';

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit {
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
  view: 'list' | 'details' | 'payments' | 'shipping' | 'invoices' = 'list';
  selected: any | null = null;
  selectedId: number | null = null;
  // derived details
  selectedCliente: { nome?: string|null; email?: string|null; cpf?: string|null; id?: string|number|null } | null = null;
  selectedFrete: any = null;
  shippingOptions: any[] = [];

  constructor(private api: ApiService, private session: SessionService, private http: HttpClient) {}

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
    } catch {
      this.selected = o || null;
      this.view = 'details';
      this.resolveDerived();
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
    const o = this.selected || {};
    this.selectedCliente = this.extractCliente(o);
    const ship = this.extractShipping(o);
    this.selectedFrete = ship.frete;
    this.shippingOptions = ship.opcoes || [];
  }

  private extractCliente(o: any) {
    const top = {
      nome: o?.cliente_nome ?? null,
      email: o?.cliente_email ?? null,
      cpf: o?.cliente_cpf ?? null,
      id: o?.cliente_id ?? null,
    };
    const rs = o?.raw_snapshot || {};
    const candidate = rs?.cliente || rs?.customer || rs?.input?.cliente || rs?.input?.customer || rs?.input?.cliente_dados || rs?.input?.dados_cliente || rs?.input?.user || rs?.user || {};
    // Direct fields possibly present at snapshot level
    const rsNome = rs?.input?.cliente_nome || rs?.cliente_nome || rs?.input?.nome || rs?.nome || null;
    const rsEmail = rs?.input?.cliente_email || rs?.cliente_email || rs?.input?.email || rs?.email || null;
    const rsCpf = rs?.input?.cliente_cpf || rs?.cliente_cpf || rs?.input?.cpf || rs?.cpf || null;
    const rp = o?.raw_payment || {};
    const payer = rp?.payer || rp?.pagador || rp?.customer || {};
    const payerFirst = payer.first_name || payer.given_name || null;
    const payerLast = payer.last_name || payer.surname || null;
    const payerName = payer.name || payer.full_name || [payerFirst, payerLast].filter(Boolean).join(' ').trim() || null;
    return {
      nome: top.nome || candidate.nome || candidate.name || rsNome || payerName || null,
      email: top.email || candidate.email || rsEmail || payer.email || null,
      cpf: top.cpf || candidate.cpf || candidate.documento || candidate.document || candidate.tax_id || rsCpf || payer.cpf || payer.document || payer.tax_id || null,
      id: top.id || candidate.id || null,
    };
  }

  private extractShipping(o: any) {
    const raw = o?.raw_shipping || {};
    const frete = raw?.frete || (o?.frete_valor != null ? { nome: 'Frete', valor: o.frete_valor } : null);
    const opcoes = Array.isArray(raw?.opcoes) ? raw.opcoes : [];
    return { frete, opcoes };
  }

  async setStatus(status: 'em_preparo' | 'enviado' | 'concluido') {
    if (!this.selectedId) return;
    const base = this.session.getBackendBaseUrl();
    const headers = this.session.getAuthHeaders();
    const url = `${base}/admin/orders/${this.selectedId}/status`;
    const resp = await this.http.post(url, { status }, { headers }).toPromise() as any;
    this.selected = resp;
    this.resolveDerived();
  }

  async cancelarPedido() {
    if (!this.selectedId) return;
    const motivo = window.prompt('Informe o motivo do cancelamento (opcional):') || '';
    const base = this.session.getBackendBaseUrl();
    const headers = this.session.getAuthHeaders();
    const url = `${base}/admin/orders/${this.selectedId}/cancelar`;
    const resp = await this.http.post(url, { motivo }, { headers }).toPromise() as any;
    this.selected = resp;
    this.resolveDerived();
  }
}
