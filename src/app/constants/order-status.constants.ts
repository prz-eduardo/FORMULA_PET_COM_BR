// Centralized order status definitions and helpers (alinhado ao backend: admin não avança pré-pagamento)
export const ORDER_STATUSES = [
  'criado',
  'aguardando_pagamento',
  'pago',
  'aceito',
  'recusado',
  'em_preparo',
  'pronto_para_envio',
  'enviado',
  'concluido',
  'cancelado'
];

export const STATUS_ORDER = ['criado','aguardando_pagamento','pago','aceito','em_preparo','pronto_para_envio','enviado','concluido'];

/** Colunas do Kanban «Fila de pedidos» no painel admin (em andamento, sem concluído/cancelado). */
export const ADMIN_QUEUE_STATUSES = [
  'criado',
  'aguardando_pagamento',
  'pago',
  'aceito',
  'em_preparo',
  'pronto_para_envio',
  'enviado',
] as const;

export const STATUS_LABELS: Record<string,string> = {
  criado: 'Criado',
  aguardando_pagamento: 'Aguardando pagamento',
  aceito: 'Aceito',
  recusado: 'Recusado',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  pronto_para_envio: 'Pronto para envio',
  enviado: 'Enviado',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};

/** Transições que o admin pode pedir (pago só via gateway — não listado aqui). */
export const STATUS_TRANSITIONS: Record<string,string[]> = {
  criado: [],
  aguardando_pagamento: [],
  pago: ['aceito', 'em_preparo', 'cancelado'],
  aceito: ['em_preparo', 'recusado', 'cancelado'],
  recusado: [],
  em_preparo: ['pronto_para_envio', 'cancelado'],
  pronto_para_envio: ['enviado', 'cancelado'],
  enviado: ['concluido', 'cancelado'],
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

export function getNextStatus(status?: string | null): string | null {
  const s = String(status || '').toLowerCase();
  if (!s) return null;
  const allowed = getAllowedTransitions(s);
  if (!allowed || !allowed.length) return null;
  const idx = STATUS_ORDER.indexOf(s);
  if (idx >= 0) {
    for (let i = idx + 1; i < STATUS_ORDER.length; i++) {
      const candidate = STATUS_ORDER[i];
      if (allowed.includes(candidate)) return candidate;
    }
  }
  return allowed[0] || null;
}
