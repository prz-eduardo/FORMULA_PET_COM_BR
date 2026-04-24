export type SupportTicketStatus = 'queued' | 'active' | 'closed';

export interface SupportMeta {
  clienteUid: string;
  clienteLabel: string;
  status: SupportTicketStatus;
  createdAt: number;
  enqueuedAt: number;
  adminUid: string | null;
}

export interface SupportMessage {
  id: string;
  text: string;
  senderRole: 'cliente' | 'admin';
  senderUid: string;
  ts: number;
}

export type SupportChatMode = 'cliente' | 'admin';

/** Erro RTDB com contexto (fila global vs atendimentos ativos do admin). */
export class SupportRtdbSubscriptionError extends Error {
  constructor(
    public readonly stream: 'queue' | 'admin_active',
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options?.cause != null ? { cause: options.cause } : undefined);
    this.name = 'SupportRtdbSubscriptionError';
  }
}

/** Item da lista do painel admin: fila global + atendimentos assumidos por este admin. */
export interface AdminQueueRow {
  ticketId: string;
  enqueuedAt: number;
  lane: 'queued' | 'active';
  clienteLabel: string;
}
