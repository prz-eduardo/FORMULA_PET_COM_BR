import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { signInWithCustomToken } from 'firebase/auth';
import { supportAuth } from '../../firebase-config';
import { SessionService } from '../../services/session.service';

@Injectable({ providedIn: 'root' })
export class SupportChatIdentityService {
  private inFlight: Promise<string> | null = null;

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
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = (async () => {
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
      await signInWithCustomToken(supportAuth, res.token);
      this.inFlight = null;
      return res.uid;
    })().catch((e) => {
      this.inFlight = null;
      throw e;
    });
    return this.inFlight;
  }

  getSupportUidOrThrow(): string {
    const u = supportAuth.currentUser?.uid;
    if (!u) {
      throw new Error('Não autenticado no chat');
    }
    return u;
  }
}
