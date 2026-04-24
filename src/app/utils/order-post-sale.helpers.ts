/** Itens vindos de pedido_itens ou snapshot normalizado */
export function pedidoTemManipulado(p: { itens_manipulado_count?: number; itens?: any[] } | null | undefined): boolean {
  if (!p) return false;
  const n = Number((p as any).itens_manipulado_count);
  if (Number.isFinite(n) && n > 0) return true;
  const itens = Array.isArray(p.itens) ? p.itens : [];
  for (const it of itens) {
    if (it?.formula_id != null && it.formula_id !== '') return true;
    const tipo = String(it?.tipo || '').toLowerCase();
    if (tipo === 'manipulado') return true;
  }
  return false;
}

export function dentroJanelaArrependimento7d(concluidoEm: string | Date | null | undefined): boolean {
  if (!concluidoEm) return false;
  const t = new Date(concluidoEm).getTime();
  if (Number.isNaN(t)) return false;
  const limite = t + 7 * 24 * 60 * 60 * 1000;
  return Date.now() <= limite;
}

export function dataReferenciaConclusao(p: { concluido_em?: string; updated_at?: string } | null | undefined): string | null {
  if (!p) return null;
  const c = p.concluido_em;
  if (c) return typeof c === 'string' ? c : String(c);
  const st = String((p as any).status || '').toLowerCase();
  if (st === 'concluido' && p.updated_at) return String(p.updated_at);
  return null;
}

export function podeArrependimentoArt49(p: any): boolean {
  const st = String(p?.status || '').toLowerCase();
  if (st !== 'concluido') return false;
  if (pedidoTemManipulado(p)) return false;
  const ref = dataReferenciaConclusao(p);
  return dentroJanelaArrependimento7d(ref);
}

export function podeDefeitoQualidade(p: any): boolean {
  const st = String(p?.status || '').toLowerCase();
  return st === 'enviado' || st === 'concluido';
}

export function podeCancelamentoPreEnvio(p: any): boolean {
  const st = String(p?.status || '').toLowerCase();
  return !['concluido', 'cancelado', 'recusado'].includes(st);
}

export function podeRelato(p: any): boolean {
  const st = String(p?.status || '').toLowerCase();
  return st !== 'cancelado' && st !== 'recusado';
}
