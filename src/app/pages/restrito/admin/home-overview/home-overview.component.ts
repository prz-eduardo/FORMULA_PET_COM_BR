import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { RealtimeService } from '../../../../services/realtime.service';
import {
  statusLabel,
  getNextStatus,
  STATUS_LABELS,
} from '../../../../constants/order-status.constants';

@Component({
  selector: 'app-admin-home-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-overview.component.html',
  styleUrls: ['./home-overview.component.scss'],
})
export class AdminHomeOverviewComponent implements OnInit, OnDestroy, AfterViewInit {
  loading = true;
  data: any = null;

  @ViewChild('salesChart', { static: false }) salesChartRef?: ElementRef<HTMLCanvasElement>;
  private chart: any = null;

  private refreshHandle: any = null;
  private subs: Subscription[] = [];
  private isBrowser = false;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private realtime: RealtimeService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.load();
    if (this.isBrowser) {
      this.refreshHandle = setInterval(() => this.load(true), 30_000);

      const reactive = ['order:created', 'order:status_changed', 'order:payment_received', 'order:canceled', 'notification:new'];
      for (const ev of reactive) {
        this.subs.push(this.realtime.on(ev).subscribe(() => this.load(true)));
      }
    }
  }

  ngAfterViewInit() { /* chart is drawn after data loads */ }

  ngOnDestroy() {
    if (this.refreshHandle) clearInterval(this.refreshHandle);
    this.subs.forEach(s => s.unsubscribe());
    try { this.chart?.destroy(); } catch {}
  }

  load(silent = false) {
    const token = this.auth.getToken();
    if (!token) { this.loading = false; return; }
    if (!silent) this.loading = true;
    this.api.getAdminHomeOverview(token).subscribe({
      next: (res) => {
        this.data = res || null;
        this.loading = false;
        setTimeout(() => this.drawChart(), 50);
      },
      error: () => { this.loading = false; },
    });
  }

  private async drawChart() {
    if (!this.isBrowser) return;
    const canvas = this.salesChartRef?.nativeElement;
    if (!canvas) return;
    const byDay = this.data?.sales_7d?.by_day || [];
    const { default: Chart } = await import('chart.js/auto');
    const labels = byDay.map((r: any) => {
      const d = new Date(r.dia);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const receita = byDay.map((r: any) => Number(r.receita || 0));
    const pedidos = byDay.map((r: any) => Number(r.pedidos || 0));
    try { this.chart?.destroy(); } catch {}
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Receita (R$)',
            data: receita,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,.15)',
            tension: 0.35,
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'Pedidos',
            data: pedidos,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,.15)',
            tension: 0.35,
            fill: false,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { beginAtZero: true, position: 'left', title: { display: true, text: 'R$' } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Pedidos' } },
        },
      },
    });
  }

  // ---------- Helpers usados pelo template ----------

  get kpis() { return this.data?.kpis || { receita_hoje: 0, pedidos_hoje: 0, ticket_medio_hoje: 0, aguardando_pagamento: 0 }; }
  get statuses(): string[] { return this.data?.queue?.statuses || []; }
  ordersOf(status: string): any[] { return this.data?.queue?.orders?.[status] || []; }
  get alerts() { return this.data?.alerts || []; }

  statusLabel(key: string) { return statusLabel(key); }

  formatCurrency(v: number | string | null | undefined) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  relativeTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const day = Math.floor(h / 24);
    return `${day}d`;
  }

  nextStatus(pedido: any): string | null { return getNextStatus(pedido?.status); }
  nextStatusLabel(pedido: any): string {
    const n = this.nextStatus(pedido);
    return n ? (STATUS_LABELS[n] || n) : '';
  }

  advance(pedido: any, ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    const next = this.nextStatus(pedido);
    if (!next) return;
    const token = this.auth.getToken();
    this.api.adminSetOrderStatus(token, pedido.id, next).subscribe({
      next: () => { this.toast?.success?.(`Pedido #${pedido.id} → ${STATUS_LABELS[next] || next}`); this.load(true); },
      error: (e) => { this.toast?.error?.(e?.error?.error || 'Não foi possível atualizar o pedido.'); },
    });
  }

  cancel(pedido: any, ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    if (!confirm(`Cancelar pedido #${pedido.id}?`)) return;
    const token = this.auth.getToken();
    this.api.adminCancelOrder(token, pedido.id, 'Cancelado pelo admin').subscribe({
      next: () => { this.toast?.success?.(`Pedido #${pedido.id} cancelado.`); this.load(true); },
      error: (e) => { this.toast?.error?.(e?.error?.error || 'Não foi possível cancelar o pedido.'); },
    });
  }

  openOrder(pedido: any) {
    this.router.navigate(['/restrito/admin/pedidos'], { queryParams: { highlight: pedido.id } });
  }

  openAlert(alert: any) {
    if (alert?.link) {
      try {
        const url = new URL(alert.link, window.location.origin);
        this.router.navigateByUrl(url.pathname + url.search);
      } catch {
        this.router.navigateByUrl(alert.link);
      }
    }
  }

  iconFor(tipo: string): string {
    const map: Record<string, string> = {
      'order.created': 'fa-solid fa-cart-plus',
      'order.status_changed': 'fa-solid fa-truck-fast',
      'order.payment_received': 'fa-solid fa-dollar-sign',
      'order.canceled': 'fa-solid fa-ban',
      'inventory.low': 'fa-solid fa-boxes-stacked',
      'vet.pending': 'fa-solid fa-user-doctor',
      'partner.pending': 'fa-solid fa-briefcase',
      'coupon.expiring': 'fa-solid fa-ticket',
      'review.new': 'fa-solid fa-star',
      'error.critical': 'fa-solid fa-triangle-exclamation',
    };
    return map[tipo] || 'fa-solid fa-bell';
  }
}
