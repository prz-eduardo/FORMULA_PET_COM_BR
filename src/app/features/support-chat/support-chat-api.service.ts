import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../services/session.service';

@Injectable({ providedIn: 'root' })
export class SupportChatApiService {
  constructor(
    private http: HttpClient,
    private session: SessionService
  ) {}

  private base(): string {
    return `${this.session.getBackendBaseUrl()}/support/chat`;
  }

  private headers() {
    const h = this.session.getAuthHeaders();
    if (!h) {
      throw new Error('Sem sessão');
    }
    return h;
  }

  /** Cria / confirma a sala no MySQL e devolve chave (só em created=true) para cripto futura. */
  ensureSala(ticketId: string, clienteLabel: string) {
    return this.http.post<{
      ok: boolean;
      created?: boolean;
      roomKeyB64?: string;
      sala?: { id: number; keyFingerprint: string; keyVersion: number; status: string };
    }>(`${this.base()}/salas/ensure`, { ticketId, clienteLabel }, { headers: this.headers() });
  }

  postMensagem(p: {
    ticketId: string;
    firebaseMessageId: string;
    text: string;
    senderRole: 'cliente' | 'admin';
    ts: number;
  }) {
    return this.http.post(`${this.base()}/mensagens`, p, { headers: this.headers() });
  }

  patchSala(ticketId: string, body: { status?: 'active' | 'closed'; closed?: boolean }) {
    return this.http.patch(`${this.base()}/salas/${encodeURIComponent(ticketId)}`, body, { headers: this.headers() });
  }

  async ensureSalaFireAndForget(ticketId: string, clienteLabel: string) {
    try {
      await firstValueFrom(this.ensureSala(ticketId, clienteLabel));
    } catch (e) {
      console.warn('[support-chat] ensureSala (histórico MySQL) falhou', e);
    }
  }

  async logMensagemFireAndForget(p: Parameters<SupportChatApiService['postMensagem']>[0]) {
    try {
      await firstValueFrom(this.postMensagem(p));
    } catch (e) {
      console.warn('[support-chat] log mensagem MySQL falhou', e);
    }
  }

  async patchSalaFireAndForget(ticketId: string, body: { status?: 'active' | 'closed'; closed?: boolean }) {
    try {
      await firstValueFrom(this.patchSala(ticketId, body));
    } catch (e) {
      console.warn('[support-chat] patchSala (MySQL) falhou', e);
    }
  }
}
