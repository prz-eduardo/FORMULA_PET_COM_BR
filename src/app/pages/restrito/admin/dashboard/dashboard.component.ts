import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AdminApiService } from '../../../../services/admin-api.service';

// We'll render charts with Chart.js directly to avoid Angular wrapper peer conflicts
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, DatePipe],
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

  // Chart instances
  private receitas7Chart?: Chart;
  private receitas30Chart?: Chart;
  private topAtivosChart?: Chart;
  private topVetsChart?: Chart;
  private topClientesChart?: Chart;
  private topPetsChart?: Chart;
  private productsByCategoryChart?: Chart;

  ngOnInit(): void {
    this.load();
  }

  reload() { this.destroyCharts(); this.load(); }

  private load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getDashboard().subscribe({
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
    this.productsByCategoryChart?.destroy();
  }

  private renderCharts(res: any) {
    const get = (id: string) => document.getElementById(id) as HTMLCanvasElement | null;

    // receitas last 7 days
    if (res?.receitas_last7?.length) {
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
    if (res?.receitas_last30?.length) {
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
    if (res?.top_ativos?.length) {
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
    if (res?.top_entities?.vets?.length) {
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

    if (res?.top_entities?.clientes?.length) {
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

    if (res?.top_entities?.pets?.length) {
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

    // products breakdown by category
    if (res?.products_breakdown?.by_category?.length) {
      const ctx = get('chart-products-by-category');
      if (ctx) {
        const labels = res.products_breakdown.by_category.map((c: any) => c.category || c.nome || c.name || 'Categoria');
        const data = res.products_breakdown.by_category.map((c: any) => c.total || c.count || c.qtd || 0);
        this.productsByCategoryChart = new Chart(ctx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: this.palette(labels.length) }]},
          options: { responsive: true, maintainAspectRatio: false }
        });
      } else { console.warn('Canvas chart-products-by-category não encontrado'); }
    }
  }

  private palette(n: number): string[] {
    const base = ['#6366f1','#22c55e','#ef4444','#f59e0b','#06b6d4','#f97316','#a855f7','#84cc16','#eab308','#10b981'];
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }
}
