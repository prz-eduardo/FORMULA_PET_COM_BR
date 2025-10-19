import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService } from '../../../../services/admin-api.service';

// We'll render charts with Chart.js directly to avoid Angular wrapper peer conflicts
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private router = inject(Router);
  private date = inject(DatePipe);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<any | null>(null);
  // modular sections
  section = signal<'resumo'|'vendas'|'marketplace'|'clientes'|'promocoes'|'cupons'>('resumo');
  // filters
  from = signal<string | null>(null);
  to = signal<string | null>(null);
  sortDir = signal<'asc'|'desc'|null>('desc');
  limit = signal<number | null>(null);
  // theme
  theme = signal<'light' | 'dark'>('light');

  // Chart instances
  private receitas7Chart?: Chart;
  private receitas30Chart?: Chart;
  private topAtivosChart?: Chart;
  private topVetsChart?: Chart;
  private topClientesChart?: Chart;
  private topPetsChart?: Chart;
  private marketplaceTipoChart?: Chart;
  private salesByDayChart?: Chart;
  private salesByTipoChart?: Chart;
  private salesTopPromoProductsChart?: Chart;
  private customersByStateChart?: Chart;
  private couponsTopChart?: Chart;
  private salesByPaymentChart?: Chart;
  private salesByStatusChart?: Chart;
  private salesTopProductsChart?: Chart;
  private salesTopCategoriesChart?: Chart;
  private salesTopTagsChart?: Chart;

  // show/hide toggles for charts
  show = signal<Record<string, boolean>>({
    receitas7: true,
    receitas30: true,
    topAtivos: true,
    topVets: true,
    topClientes: true,
    topPets: true,
    marketplaceTipo: true,
    salesByDay: true,
    salesByTipo: true,
    salesTopPromoProducts: true,
    customersByState: true,
    couponsTop: true,
    salesByPayment: true,
    salesByStatus: true,
    salesTopProducts: true,
    salesTopCategories: true,
    salesTopTags: true,
    customersMap: true,
  });

  ngOnInit(): void {
    this.restoreToggles();
    this.restoreTheme();
    this.load();
  }

  reload() { this.destroyCharts(); this.load(); }

  private load() {
    this.loading.set(true);
    this.error.set(null);
    const params: any = {};
    if (this.from()) params.from = this.from();
    if (this.to()) params.to = this.to();
    if (this.sortDir()) params.sortDir = this.sortDir();
    if (this.limit()) params.limit = this.limit();

    const sec = this.section();
    const req$ = sec === 'resumo' ? this.api.getAdminDashboardSummary(params)
               : sec === 'vendas' ? this.api.getAdminDashboardSales(params)
               : sec === 'marketplace' ? this.api.getAdminDashboardMarketplace(params)
               : sec === 'clientes' ? this.api.getAdminDashboardCustomers(params)
               : sec === 'promocoes' ? this.api.getAdminDashboardPromotions(params)
               : this.api.getAdminDashboardCoupons(params);

    req$.subscribe({
      next: (res) => {
        this.data.set(res);
        if (this.isBrowser) {
          setTimeout(() => this.renderCharts(res));
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error', err);
        this.error.set('Não foi possível carregar o dashboard.');
        this.loading.set(false);
      }
    });
  }

  private destroyCharts() {
    this.receitas7Chart?.destroy();
    this.receitas30Chart?.destroy();
    this.topAtivosChart?.destroy();
    this.topVetsChart?.destroy();
    this.topClientesChart?.destroy();
    this.topPetsChart?.destroy();
    this.marketplaceTipoChart?.destroy();
    this.salesByDayChart?.destroy();
    this.salesByTipoChart?.destroy();
    this.salesTopPromoProductsChart?.destroy();
    this.customersByStateChart?.destroy();
    this.couponsTopChart?.destroy();
    this.salesByPaymentChart?.destroy();
    this.salesByStatusChart?.destroy();
    this.salesTopProductsChart?.destroy();
    this.salesTopCategoriesChart?.destroy();
    this.salesTopTagsChart?.destroy();
  }

  private renderCharts(res: any) {
    // Clear previous charts when switching section
    this.destroyCharts();
    const get = (id: string) => document.getElementById(id) as HTMLCanvasElement | null;

    // Summary: sales_30d.by_day
    if (this.section() === 'resumo' && res?.sales_30d?.by_day?.length) {
      const ctx = get('chart-resumo-sales-30d');
      if (ctx) {
        const labels = res.sales_30d.by_day.map((d: any) => this.date.transform(d.dia, 'dd/MM') || d.dia);
        const receita = res.sales_30d.by_day.map((d: any) => Number(d.receita) || 0);
        const pedidos = res.sales_30d.by_day.map((d: any) => Number(d.pedidos) || 0);
        this.salesByDayChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [
            { type: 'bar', label: 'Receita', data: receita, backgroundColor: 'rgba(37,99,235,.6)', yAxisID: 'y' },
            { type: 'line', label: 'Pedidos', data: pedidos, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.2)', yAxisID: 'y1', tension: .3 }
          ]},
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, y1: { position: 'right', beginAtZero: true } } }
        });
      }
    }

    // receitas last 7 days
    if (this.isOn('receitas7') && res?.receitas_last7?.length) {
      const ctx = get('chart-receitas7');
      if (ctx) {
        const labels = res.receitas_last7.map((d: any) => {
          const raw = (d.dia || d.data || d.date);
          const fmt = this.date.transform(raw, 'dd/MM');
          return fmt || raw;
        });
        const data = res.receitas_last7.map((d: any) => d.total);
        this.receitas7Chart = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets: [{ label: 'Receitas (7 dias)', data, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.2)', fill: true, tension: .3 }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-receitas7 não encontrado'); }
    }

    // receitas last 30 days
    if (this.isOn('receitas30') && res?.receitas_last30?.length) {
      const ctx = get('chart-receitas30');
      if (ctx) {
        const labels = res.receitas_last30.map((d: any) => {
          const raw = (d.dia || d.data || d.date);
          const fmt = this.date.transform(raw, 'dd/MM');
          return fmt || raw;
        });
        const data = res.receitas_last30.map((d: any) => d.total);
        this.receitas30Chart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Receitas (30 dias)', data, backgroundColor: 'rgba(16,185,129,.6)' }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-receitas30 não encontrado'); }
    }

    // top ativos (top 10)
    if (this.isOn('topAtivos') && res?.top_ativos?.length) {
      const ctx = get('chart-top-ativos');
      if (ctx) {
        const labels = res.top_ativos.map((a: any) => a.ativo_nome || a.nome || a.name || a.ativo || a.id);
        const data = res.top_ativos.map((a: any) => a.usos || a.total || a.qtd || a.count || 0);
        this.topAtivosChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Top Ativos', data, backgroundColor: 'rgba(234,88,12,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-top-ativos não encontrado'); }
    }

    // top entities: vets, clientes, pets por receitas
    if (this.isOn('topVets') && res?.top_entities?.vets?.length) {
      const ctx = get('chart-top-vets');
      if (ctx) {
        const labels = res.top_entities.vets.map((v: any) => v.nome || v.name || v.vet_nome || v.id);
        const data = res.top_entities.vets.map((v: any) => v.receitas || v.total || v.qtd || v.count || 0);
        this.topVetsChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Top Veterinários', data, backgroundColor: 'rgba(99,102,241,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-top-vets não encontrado'); }
    }

    if (this.isOn('topClientes') && res?.top_entities?.clientes?.length) {
      const ctx = get('chart-top-clientes');
      if (ctx) {
        const labels = res.top_entities.clientes.map((v: any) => v.nome || v.name || v.cliente_nome || v.id);
        const data = res.top_entities.clientes.map((v: any) => v.receitas || v.total || v.qtd || v.count || 0);
        this.topClientesChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Top Clientes', data, backgroundColor: 'rgba(20,184,166,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-top-clientes não encontrado'); }
    }

    if (this.isOn('topPets') && res?.top_entities?.pets?.length) {
      const ctx = get('chart-top-pets');
      if (ctx) {
        const labels = res.top_entities.pets.map((v: any) => v.nome || v.name || v.pet_nome || v.id);
        const data = res.top_entities.pets.map((v: any) => v.receitas || v.total || v.qtd || v.count || 0);
        this.topPetsChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Top Pets', data, backgroundColor: 'rgba(244,63,94,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-top-pets não encontrado'); }
    }

    // marketplace: produtos por tipo
    if (this.isOn('marketplaceTipo') && res?.marketplace?.totals?.por_tipo?.length) {
      const ctx = get('chart-marketplace-por-tipo');
      if (ctx) {
        const labels = res.marketplace.totals.por_tipo.map((c: any) => c.tipo);
        const data = res.marketplace.totals.por_tipo.map((c: any) => Number(c.total) || 0);
        this.marketplaceTipoChart = new Chart(ctx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: this.palette(labels.length) }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // sales by day
    if (this.isOn('salesByDay') && res?.sales?.by_day?.length) {
      const ctx = get('chart-sales-by-day');
      if (ctx) {
        const labels = res.sales.by_day.map((d: any) => this.date.transform(d.dia, 'dd/MM') || d.dia);
        const receita = res.sales.by_day.map((d: any) => Number(d.receita) || 0);
        const pedidos = res.sales.by_day.map((d: any) => Number(d.pedidos) || 0);
        this.salesByDayChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [
            { type: 'bar', label: 'Receita', data: receita, backgroundColor: 'rgba(37,99,235,.6)', yAxisID: 'y' },
            { type: 'line', label: 'Pedidos', data: pedidos, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.2)', yAxisID: 'y1', tension: .3 }
          ]},
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, y1: { position: 'right', beginAtZero: true } } }
        });
      }
    }

    // sales by tipo
    if (this.isOn('salesByTipo') && res?.sales?.by_tipo?.length) {
      const ctx = get('chart-sales-by-tipo');
      if (ctx) {
        const labels = res.sales.by_tipo.map((t: any) => t.tipo);
        const data = res.sales.by_tipo.map((t: any) => Number(t.receita) || 0);
        this.salesByTipoChart = new Chart(ctx, {
          type: 'pie',
          data: { labels, datasets: [{ data, backgroundColor: this.palette(labels.length) }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // top promo products
    if (this.isOn('salesTopPromoProducts') && res?.sales?.top_promo_products?.length) {
      const ctx = get('chart-sales-top-promo-products');
      if (ctx) {
        const labels = res.sales.top_promo_products.map((p: any) => p.nome || p.produto_id);
        const data = res.sales.top_promo_products.map((p: any) => Number(p.receita) || 0);
        this.salesTopPromoProductsChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Receita por produto (promo)', data, backgroundColor: 'rgba(234,179,8,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // customers by state
    if (this.isOn('customersByState') && res?.customers_geo?.by_state?.length) {
      const ctx = get('chart-customers-by-state');
      if (ctx) {
        const labels = res.customers_geo.by_state.map((s: any) => s.estado);
        const data = res.customers_geo.by_state.map((s: any) => Number(s.clientes) || 0);
        this.customersByStateChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Clientes por estado', data, backgroundColor: 'rgba(59,130,246,.7)' }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // coupons top
    if (this.isOn('couponsTop') && res?.coupons?.top?.length) {
      const ctx = get('chart-coupons-top');
      if (ctx) {
        const labels = res.coupons.top.map((c: any) => c.codigo);
        const data = res.coupons.top.map((c: any) => Number(c.desconto) || 0);
        this.couponsTopChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Desconto total por cupom', data, backgroundColor: 'rgba(244,63,94,.7)' }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // sales by payment
    if (this.isOn('salesByPayment') && res?.sales?.by_payment?.length) {
      const ctx = get('chart-sales-by-payment');
      if (ctx) {
        const labels = res.sales.by_payment.map((p: any) => p.pagamento_forma);
        const receita = res.sales.by_payment.map((p: any) => Number(p.receita) || 0);
        const pedidos = res.sales.by_payment.map((p: any) => Number(p.pedidos) || 0);
        this.salesByPaymentChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [
            { type: 'bar', label: 'Receita', data: receita, backgroundColor: 'rgba(99,102,241,.7)', yAxisID: 'y' },
            { type: 'line', label: 'Pedidos', data: pedidos, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.2)', yAxisID: 'y1', tension: .3 }
          ]},
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, y1: { position: 'right', beginAtZero: true } } }
        });
      }
    }

    // sales by status
    if (this.isOn('salesByStatus') && res?.sales?.by_status?.length) {
      const ctx = get('chart-sales-by-status');
      if (ctx) {
        const labels = res.sales.by_status.map((s: any) => s.status);
        const pedidos = res.sales.by_status.map((s: any) => Number(s.pedidos) || 0);
        this.salesByStatusChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Pedidos por status', data: pedidos, backgroundColor: 'rgba(16,185,129,.7)' }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // top products (all)
    if (this.isOn('salesTopProducts') && res?.sales?.top_products?.length) {
      const ctx = get('chart-sales-top-products');
      if (ctx) {
        const labels = res.sales.top_products.map((p: any) => p.nome || p.produto_id);
        const data = res.sales.top_products.map((p: any) => Number(p.receita) || 0);
        this.salesTopProductsChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Receita por produto (geral)', data, backgroundColor: 'rgba(2,132,199,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // top categories
    if (this.isOn('salesTopCategories') && res?.sales?.top_categories?.length) {
      const ctx = get('chart-sales-top-categories');
      if (ctx) {
        const labels = res.sales.top_categories.map((c: any) => c.nome || c.id);
        const data = res.sales.top_categories.map((c: any) => Number(c.receita) || 0);
        this.salesTopCategoriesChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Receita por categoria', data, backgroundColor: 'rgba(234,88,12,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      }
    }

    // top tags
    if (this.isOn('salesTopTags') && res?.sales?.top_tags?.length) {
      const ctx = get('chart-sales-top-tags');
      if (ctx) {
        const labels = res.sales.top_tags.map((t: any) => t.nome || t.id);
        const data = res.sales.top_tags.map((t: any) => Number(t.receita) || 0);
        this.salesTopTagsChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Receita por tag', data, backgroundColor: 'rgba(147,51,234,.7)' }]},
          options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false }
        });
      }
    }
  }

  private palette(n: number): string[] {
    const base = ['#6366f1','#22c55e','#ef4444','#f59e0b','#06b6d4','#f97316','#a855f7','#84cc16','#eab308','#10b981'];
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  // toggles helpers
  toggle(key: keyof ReturnType<typeof this.show> | string) {
    const state = { ...this.show() } as any;
    state[key] = !state[key];
    this.show.set(state);
    this.persistToggles();
    if (this.isBrowser) {
      // re-render only affected charts by rebuilding all for simplicity
      this.destroyCharts();
      const d = this.data();
      if (d) this.renderCharts(d);
    }
  }
  isOn(key: string) { return !!this.show()[key]; }

  private persistToggles() {
    if (!this.isBrowser) return;
    try { localStorage.setItem('admin_dash_show', JSON.stringify(this.show())); } catch {}
  }
  private restoreToggles() {
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem('admin_dash_show');
      if (raw) { const parsed = JSON.parse(raw); this.show.set({ ...this.show(), ...parsed }); }
    } catch {}
  }

  // Theme helpers
  toggleTheme() {
    const next = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(next);
    this.applyTheme(next);
    this.persistTheme();
  }
  private applyTheme(t: 'light'|'dark') {
    if (!this.isBrowser) return;
    const el = document.documentElement;
    el.dataset['theme'] = t;
  }
  private persistTheme() {
    if (!this.isBrowser) return;
    try { localStorage.setItem('admin_theme', this.theme()); } catch {}
  }
  private restoreTheme() {
    if (!this.isBrowser) return;
    try {
      const saved = localStorage.getItem('admin_theme') as 'light'|'dark'|null;
      const pref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const t = saved || pref;
      this.theme.set(t);
      this.applyTheme(t);
    } catch {}
  }

  // Filter change handlers (avoid template typing issues)
  onFromChange(v: any) { this.from.set(v || null); this.reload(); }
  onToChange(v: any) { this.to.set(v || null); this.reload(); }
  onSortDirChange(v: any) { this.sortDir.set((v as 'asc'|'desc') || 'desc'); this.reload(); }
  onLimitChange(v: any) { const n = (v === null || v === 'null' || v === '') ? null : Number(v); this.limit.set(n as any); this.reload(); }

  // ====== Brazil tile map helpers ======
  private mapRows: string[][] = [
    ['RR','AP'],
    ['AM','PA'],
    ['AC','RO','TO','MA','PI','CE','RN'],
    ['MT','GO','DF','BA','PB','PE','AL','SE'],
    ['MS','MG','ES'],
    ['SP','RJ'],
    ['PR'],
    ['SC'],
    ['RS']
  ];
  private ufName(uf: string): string {
    const d: Record<string,string> = { AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul', MT:'Mato Grosso', PA:'Pará', PB:'Paraíba', PE:'Pernambuco', PI:'Piauí', PR:'Paraná', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RO:'Rondônia', RR:'Roraima', RS:'Rio Grande do Sul', SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo', TO:'Tocantins' };
    return d[uf] || uf;
  }
  byUF(d: any): Record<string, { pedidos: number; clientes?: number; receita?: number }> {
    const out: Record<string, { pedidos: number; clientes?: number; receita?: number }> = {};
    const arr = d?.customers_geo?.by_state || [];
    for (const x of arr) {
      const uf = x.estado; if (!uf) continue;
      out[uf] = { pedidos: Number(x.pedidos) || 0, clientes: Number(x.clientes) || 0, receita: Number(x.receita) || 0 };
    }
    return out;
  }
  colorFor(value: number, max: number): string {
    if (!max || max <= 0) return '#e5e7eb';
    const t = Math.max(0, Math.min(1, value / max));
    // interpolate between light and dark blue
    const start = [219, 234, 254]; // #DBEAFE
    const end = [37, 99, 235];     // #2563EB
    const c = start.map((s, i) => Math.round(s + (end[i] - s) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }
  maxPedidos(d: any): number {
    const arr = d?.customers_geo?.by_state || [];
    let max = 0;
    for (const x of arr) {
      const v = Number(x?.pedidos) || 0;
      if (v > max) max = v;
    }
    return max;
  }
  getMapRows(): string[][] { return this.mapRows; }
}
