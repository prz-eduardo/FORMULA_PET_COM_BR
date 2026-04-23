import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

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
export class AdminSummaryPanelComponent {
  @Input() summary?: SummaryData;

  collapsed: { [key: string]: boolean } = {};

  toggle(section: string) {
    this.collapsed[section] = !this.collapsed[section];
  }

  isCollapsed(section: string): boolean {
    return !!this.collapsed[section];
  }
}
