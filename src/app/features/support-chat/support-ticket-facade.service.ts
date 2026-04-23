import { Injectable } from '@angular/core';
import { get, onValue, orderByValue, push, query, ref, update } from 'firebase/database';
import { supportRtdb } from '../../firebase-config';
import { SupportChatIdentityService } from './support-chat-identity.service';
import { SupportChatApiService } from './support-chat-api.service';
import {
  AdminQueueRow,
  SupportMessage,
  SupportMeta,
  SupportChatMode,
  SupportTicketStatus,
} from './support.models';
import * as P from './support-paths';

@Injectable({ providedIn: 'root' })
export class SupportTicketFacadeService {
  constructor(
    private identity: SupportChatIdentityService,
    private supportApi: SupportChatApiService
  ) {}

  async getOrCreateTicketForCliente(clienteLabel: string): Promise<string> {
    await this.identity.ensureFirebaseForChat();
    const myUid = this.identity.getSupportUidOrThrow();
    const activeRef = ref(supportRtdb, P.pathClienteActive(myUid));
    const snap = await get(activeRef);
    const existing = snap.val() as string | null;
    if (existing) {
      const m = await this.getMeta(existing);
      if (m && (m.status === 'queued' || m.status === 'active')) {
        void this.supportApi.ensureSalaFireAndForget(existing, clienteLabel);
        return existing;
      }
    }
    const tid = push(ref(supportRtdb, P.SUPPORT_ROOT + '/tickets')).key;
    if (!tid) {
      throw new Error('Falha ao gerar id do atendimento');
    }
    const now = Date.now();
    const meta: SupportMeta = {
      clienteUid: myUid,
      clienteLabel: (clienteLabel || 'Cliente').trim().slice(0, 200),
      status: 'queued',
      createdAt: now,
      enqueuedAt: now,
      adminUid: null
    };
    // Meta primeiro: num único `update()` com fila, `root` nas regras ainda não vê o meta novo — queue falha (PERMISSION_DENIED).
    await update(ref(supportRtdb), {
      [`${P.SUPPORT_ROOT}/tickets/${tid}/meta`]: meta,
    });
    await update(ref(supportRtdb), {
      [`${P.SUPPORT_ROOT}/queue/${tid}`]: now,
      [`${P.SUPPORT_ROOT}/cliente_active/${myUid}`]: tid,
    });
    void this.supportApi.ensureSalaFireAndForget(tid, meta.clienteLabel);
    return tid;
  }

  async getMeta(ticketId: string): Promise<SupportMeta | null> {
    const s = await get(ref(supportRtdb, P.pathTicketMeta(ticketId)));
    return (s.val() as SupportMeta) || null;
  }

  subscribeMeta(ticketId: string, onNext: (m: SupportMeta | null) => void): () => void {
    return onValue(ref(supportRtdb, P.pathTicketMeta(ticketId)), (snap) => {
      onNext((snap.val() as SupportMeta) || null);
    });
  }

  subscribeQueueOrdered(onNext: (rows: { ticketId: string; enqueuedAt: number }[]) => void): () => void {
    const r = ref(supportRtdb, P.pathQueue());
    const q = query(r, orderByValue());
    return onValue(q, (snap) => {
      const val = snap.val() as Record<string, number> | null;
      if (!val) {
        onNext([]);
        return;
      }
      const rows = Object.keys(val)
        .map((ticketId) => ({ ticketId, enqueuedAt: val[ticketId] || 0 }))
        .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
      onNext(rows);
    });
  }

  /**
   * Lista para o admin: pedidos na fila global + conversas já assumidas por este usuário
   * (permanecem visíveis após «Atender», quando saem de `queue`).
   */
  subscribeAdminWorkload(onNext: (rows: AdminQueueRow[]) => void): () => void {
    const adminUid = this.identity.getSupportUidOrThrow();
    let queueMap: Record<string, number> = {};
    let activeMap: Record<string, number> = {};
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let seq = 0;

    const flush = () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        const mySeq = ++seq;
        const queuedRows = Object.keys(queueMap)
          .map((ticketId) => ({
            ticketId,
            enqueuedAt: queueMap[ticketId] || 0,
            lane: 'queued' as const,
          }))
          .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
        const activeRows = Object.keys(activeMap)
          .map((ticketId) => ({
            ticketId,
            enqueuedAt: activeMap[ticketId] || 0,
            lane: 'active' as const,
          }))
          .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
        const seen = new Set<string>();
        const merged: { ticketId: string; enqueuedAt: number; lane: 'queued' | 'active' }[] = [];
        for (const r of queuedRows) {
          if (!seen.has(r.ticketId)) {
            seen.add(r.ticketId);
            merged.push(r);
          }
        }
        for (const r of activeRows) {
          if (!seen.has(r.ticketId)) {
            seen.add(r.ticketId);
            merged.push(r);
          }
        }
        const metas = await Promise.all(merged.map((row) => this.getMeta(row.ticketId)));
        if (mySeq !== seq) {
          return;
        }
        onNext(
          merged.map((row, i) => ({
            ...row,
            clienteLabel: metas[i]?.clienteLabel || 'Cliente',
          }))
        );
      }, 60);
    };

    const offQueue = this.subscribeQueueOrdered((rows) => {
      queueMap = {};
      for (const r of rows) {
        queueMap[r.ticketId] = r.enqueuedAt;
      }
      flush();
    });

    const offActive = onValue(ref(supportRtdb, P.pathAdminActive(adminUid)), (snap) => {
      activeMap = (snap.val() as Record<string, number>) || {};
      flush();
    });

    return () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      try {
        offQueue();
      } catch {
        // ignore
      }
      try {
        offActive();
      } catch {
        // ignore
      }
    };
  }

  /** Posição 1 = próximo a ser atendido (fila 1-based). 0 = não está na fila. */
  subscribeQueuePosition(
    ticketId: string,
    onNext: (position: number, totalInQueue: number) => void
  ): () => void {
    const r = ref(supportRtdb, P.pathQueue());
    const q = query(r, orderByValue());
    return onValue(q, (snap) => {
      const val = snap.val() as Record<string, number> | null;
      if (!val || !(ticketId in val)) {
        onNext(0, Object.keys(val || {}).length);
        return;
      }
      const keys = Object.keys(val).sort((a, b) => (val[a] || 0) - (val[b] || 0));
      const pos = keys.indexOf(ticketId) + 1;
      onNext(pos, keys.length);
    });
  }

  async acceptTicket(ticketId: string): Promise<void> {
    await this.identity.ensureFirebaseForChat();
    const adminUid = this.identity.getSupportUidOrThrow();
    const meta = await this.getMeta(ticketId);
    if (!meta) {
      throw new Error('Atendimento não encontrado');
    }
    if (meta.status === 'active' && meta.adminUid) {
      return;
    }
    const updates: Record<string, unknown> = {
      [`${P.SUPPORT_ROOT}/tickets/${ticketId}/meta/status`]: 'active' as SupportTicketStatus,
      [`${P.SUPPORT_ROOT}/tickets/${ticketId}/meta/adminUid`]: adminUid,
      [`${P.pathAdminActive(adminUid)}/${ticketId}`]: Date.now(),
    };
    const qref = ref(supportRtdb, P.pathTicketQueue(ticketId));
    const qsnap = await get(qref);
    if (qsnap.exists()) {
      updates[`${P.SUPPORT_ROOT}/queue/${ticketId}`] = null;
    }
    await update(ref(supportRtdb), updates);
    void this.supportApi.patchSalaFireAndForget(ticketId, { status: 'active' });
  }

  async closeTicket(ticketId: string, clienteChatUid: string): Promise<void> {
    await this.identity.ensureFirebaseForChat();
    const meta = await this.getMeta(ticketId);
    const updates: Record<string, unknown> = {
      [`${P.SUPPORT_ROOT}/tickets/${ticketId}/meta/status`]: 'closed' as SupportTicketStatus,
      [`${P.SUPPORT_ROOT}/queue/${ticketId}`]: null,
      [`${P.SUPPORT_ROOT}/cliente_active/${clienteChatUid}`]: null,
    };
    if (meta?.adminUid) {
      updates[`${P.pathAdminActive(meta.adminUid)}/${ticketId}`] = null;
    }
    await update(ref(supportRtdb), updates);
    void this.supportApi.patchSalaFireAndForget(ticketId, { status: 'closed' });
  }

  async sendMessage(
    mode: SupportChatMode,
    ticketId: string,
    text: string
  ): Promise<void> {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return;
    }
    await this.identity.ensureFirebaseForChat();
    const uid = this.identity.getSupportUidOrThrow();
    const role: 'cliente' | 'admin' = mode === 'admin' ? 'admin' : 'cliente';
    const msg: Omit<SupportMessage, 'id'> = {
      text: trimmed.slice(0, 4000),
      senderRole: role,
      senderUid: uid,
      ts: Date.now()
    };
    const mid = push(ref(supportRtdb, P.pathTicketMessages(ticketId))).key;
    if (!mid) {
      throw new Error('Falha ao enviar');
    }
    await update(ref(supportRtdb), {
      [`${P.SUPPORT_ROOT}/tickets/${ticketId}/messages/${mid}`]: msg
    });
    void this.supportApi.logMensagemFireAndForget({
      ticketId,
      firebaseMessageId: mid,
      text: msg.text,
      senderRole: role,
      ts: msg.ts
    });
  }

  subscribeMessages(
    ticketId: string,
    onNext: (list: SupportMessage[]) => void
  ): () => void {
    const mref = ref(supportRtdb, P.pathTicketMessages(ticketId));
    return onValue(mref, (snap) => {
      const v = snap.val() as Record<string, Omit<SupportMessage, 'id'>> | null;
      if (!v) {
        onNext([]);
        return;
      }
      const list: SupportMessage[] = Object.keys(v)
        .map((id) => ({ id, ...v[id]! }))
        .sort((a, b) => a.ts - b.ts);
      onNext(list);
    });
  }
}
