import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { signInWithCustomToken, signOut } from 'firebase/auth';
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
    const expectedUid = this.getExpectedChatUid();
    const existing = supportAuth.currentUser?.uid;
    if (existing && (!expectedUid || existing === expectedUid)) {
      this.debug('reuse_current_user', { existing, expectedUid });
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
        this.http.get<{
          token: string;
          uid: string;
          expiresIn?: number;
          claims?: { admin?: boolean; chat?: boolean; role?: string };
        }>(url, { headers })
      );
      if (!res?.token) {
        throw new Error('Resposta de token de chat inválida');
      }
      if (supportAuth.currentUser?.uid && supportAuth.currentUser.uid !== res.uid) {
        this.debug('uid_mismatch_before_signin', {
          currentUid: supportAuth.currentUser.uid,
          tokenUid: res.uid,
          expectedUid,
        });
        await signOut(supportAuth);
      }
      const cred = await signInWithCustomToken(supportAuth, res.token);
      this.debug('sign_in_success', {
        uid: cred.user.uid,
        tokenUid: res.uid,
        expectedUid,
        claims: res.claims || null,
      });
      if (expectedUid && cred.user.uid !== expectedUid) {
        throw new Error('Sessão de chat inconsistente com a sessão atual');
      }
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

  private getExpectedChatUid(): string | null {
    const decoded = this.session.decodeToken();
    const id = decoded?.id;
    const tipo = (decoded?.tipo || '').toString();
    if (id == null || !tipo) {
      return null;
    }
    if (tipo === 'admin') {
      return `admin_${id}`;
    }
    if (tipo === 'cliente') {
      return `cliente_${id}`;
    }
    return null;
  }

  private debug(event: string, payload: Record<string, unknown>) {
    if (!this.isDiagnosticsEnabled()) {
      return;
    }
    console.info(`[support-chat][identity] ${event}`, payload);
  }

  private isDiagnosticsEnabled(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    try {
      const forced = localStorage.getItem('support_chat_debug') === '1';
      const base = this.session.getBackendBaseUrl().toLowerCase();
      return forced || base.includes('hml') || base.includes('staging') || base.includes('homolog');
    } catch {
      return false;
    }
  }
}
