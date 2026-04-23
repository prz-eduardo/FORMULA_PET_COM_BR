import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { signInWithCustomToken } from 'firebase/auth';
import { supportAuth } from '../../firebase-config';
import { SessionService } from '../../services/session.service';

@Injectable({ providedIn: 'root' })
export class SupportChatIdentityService {
  private signInFlight: Promise<string> | null = null;

  constructor(
    private http: HttpClient,
    private session: SessionService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  /**
   * Garante `supportAuth` com custom token (mesmo JWT de sessão, sem alterar Auth principal).
   */
  async ensureFirebaseForChat(): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return '';
    }
    const existing = supportAuth.currentUser?.uid;
    if (existing) {
      return existing;
    }
    if (this.signInFlight) {
      return this.signInFlight;
    }
    this.signInFlight = (async () => {
      const headers = this.session.getAuthHeaders();
      if (!headers) {
        throw new Error('Sessão necessária para o chat');
      }
      const url = `${this.session.getBackendBaseUrl()}/auth/chat/firebase-token`;
      const res = await firstValueFrom(
        this.http.get<{ token: string; uid: string }>(url, { headers })
      );
      if (!res?.token) {
        throw new Error('Resposta de token de chat inválida');
      }
      const cred = await signInWithCustomToken(supportAuth, res.token);
      return cred.user.uid;
    })();
    try {
      return await this.signInFlight;
    } finally {
      this.signInFlight = null;
    }
  }

  getSupportUidOrThrow(): string {
    const u = supportAuth.currentUser?.uid;
    if (!u) {
      throw new Error('Não autenticado no chat');
    }
    return u;
  }
}
