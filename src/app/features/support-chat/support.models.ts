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
