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

/** Item da lista do painel admin: fila global + atendimentos assumidos por este admin. */
export interface AdminQueueRow {
  ticketId: string;
  enqueuedAt: number;
  lane: 'queued' | 'active';
  clienteLabel: string;
}
