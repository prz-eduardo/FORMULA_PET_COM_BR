// Centralized order status definitions and helpers
export const ORDER_STATUSES = [
  'criado',
  'aguardando_pagamento',
  'pago',
  'aceito',
  'recusado',
  'em_preparo',
  'enviado',
  'concluido',
  'cancelado'
];

// Canonical order used for timeline/stepper (primary flow)
export const STATUS_ORDER = ['criado','aguardando_pagamento','pago','aceito','em_preparo','enviado','concluido'];

export const STATUS_LABELS: Record<string,string> = {
  criado: 'Criado',
  aguardando_pagamento: 'Aguardando pagamento',
  aceito: 'Aceito',
  recusado: 'Recusado',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  enviado: 'Enviado',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};

// Allowed transitions from each status (backed by business rules)
export const STATUS_TRANSITIONS: Record<string,string[]> = {
  criado: ['aguardando_pagamento','aceito','cancelado'],
  aguardando_pagamento: ['pago','cancelado'],
  aceito: ['em_preparo','recusado','cancelado'],
  recusado: [],
  pago: ['em_preparo','cancelado'],
  em_preparo: ['enviado','cancelado'],
  enviado: ['concluido'],
  concluido: [],
  cancelado: []
};

export function statusLabel(key?: string | null): string {
  if (!key) return '—';
  const k = String(key).toLowerCase();
  return STATUS_LABELS[k] || k;
}

export function getAllowedTransitions(status?: string | null): string[] {
  if (!status) return [];
  return STATUS_TRANSITIONS[String(status).toLowerCase()] || [];
}

export function isTerminal(status?: string | null): boolean {
  const k = String(status || '').toLowerCase();
  return k === 'concluido' || k === 'cancelado' || k === 'recusado';
}

// Heuristic to pick the "next" recommended status following STATUS_ORDER and allowed transitions.
export function getNextStatus(status?: string | null): string | null {
  const s = String(status || '').toLowerCase();
  if (!s) return null;
  const allowed = getAllowedTransitions(s);
  if (!allowed || !allowed.length) return null;
  // Prefer transitions that appear later in the canonical STATUS_ORDER
  const idx = STATUS_ORDER.indexOf(s);
  if (idx >= 0) {
    for (let i = idx + 1; i < STATUS_ORDER.length; i++) {
      const candidate = STATUS_ORDER[i];
      if (allowed.includes(candidate)) return candidate;
    }
  }
  // Fallback to first allowed
  return allowed[0] || null;
}
