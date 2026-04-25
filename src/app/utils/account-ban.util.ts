/** Resposta do backend quando cliente está banido/desativado (ativo = 0). */
export function isAccountBannedHttpError(err: unknown): boolean {
  const e = err as { status?: number; error?: { code?: string; error?: string; message?: string } };
  if (e?.error?.code === 'account_banned') return true;
  const msg = `${e?.error?.error ?? ''} ${e?.error?.message ?? ''}`.toLowerCase();
  if (e?.status === 403 && /desativad/.test(msg)) return true;
  return false;
}
