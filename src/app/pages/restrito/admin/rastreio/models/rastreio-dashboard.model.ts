/** Resposta de GET /admin/rastreio/dashboard */
export interface RastreioDashboardDto {
  period: { from: string; to: string };
  totals: {
    all: number;
    logins: number;
    identify: number;
    page_views: number;
  };
  byTipo: Array<{ tipo: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
  visitantesUnicos: number;
  clientesComEvento: number;
  cartSnapshotsComItens: number;
}
