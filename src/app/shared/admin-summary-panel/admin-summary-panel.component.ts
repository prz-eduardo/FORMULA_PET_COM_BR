import { Component, Inject, Input, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

const ADMIN_SUMMARY_PANEL_COLLAPSED_KEY = 'admin_summary_panel_collapsed';

export interface SummaryTotals {
  total_pedidos: number;
  receita_total: number;
  descontos_total: number;
  ticket_medio: number;
}

export interface StatusBreakdown {
  [status: string]: number;
}

export interface FormaPagamento {
  forma: string;
  quantidade: number;
  valor_total: number;
}

export interface TopCliente {
  id: number;
  nome: string;
  email: string;
  foto: string | null;
  total_pedidos: number;
  valor_total: number;
}

export interface TopCupom {
  id: number;
  codigo: string;
  descricao: string;
  vezes_usado: number;
  desconto_gerado: number;
}

export interface PedidoResumido {
  id: number;
  status: string;
  total_liquido: number;
  created_at: string;
  updated_at: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_foto: string | null;
}

export interface SummaryData {
  totals: SummaryTotals;
  statusBreakdown: StatusBreakdown;
  formasPagamento: FormaPagamento[];
  topClientes: TopCliente[];
  topCupons: TopCupom[];
  pedidosRecentes: PedidoResumido[];
}

@Component({
  selector: 'app-admin-summary-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-summary-panel.component.html',
  styleUrls: ['./admin-summary-panel.component.scss']
})
export class AdminSummaryPanelComponent implements OnInit {
  @Input() summary?: SummaryData;

  collapsed: { [key: string]: boolean } = {};

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem(ADMIN_SUMMARY_PANEL_COLLAPSED_KEY);
      if (raw) this.collapsed = { ...this.collapsed, ...JSON.parse(raw) };
    } catch {}
  }

  toggle(section: string) {
    this.collapsed[section] = !this.collapsed[section];
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(ADMIN_SUMMARY_PANEL_COLLAPSED_KEY, JSON.stringify(this.collapsed));
    } catch {}
  }

  isCollapsed(section: string): boolean {
    return !!this.collapsed[section];
  }
}
