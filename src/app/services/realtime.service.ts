import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private isBrowser: boolean;
  private socket: Socket | null = null;
  private lastToken: string | null = null;
  private reconnectTimer: any = null;

  public connected$ = new BehaviorSubject<boolean>(false);
  private events = new Subject<{ event: string; payload: any }>();

  constructor(@Inject(PLATFORM_ID) platformId: Object, private auth: AuthService) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (!this.isBrowser) return;

    this.auth.isLoggedIn$.subscribe((logged) => {
      if (logged) this.ensureConnection();
      else this.disconnect();
    });

    this.ensureConnection();
  }

  private ensureConnection() {
    if (!this.isBrowser) return;
    const token = this.auth.getToken();
    if (!token) { this.disconnect(); return; }
    if (this.socket && this.socket.connected && this.lastToken === token) return;
    if (this.socket) { try { this.socket.disconnect(); } catch {} this.socket = null; }

    this.lastToken = token;
    const url = environment.apiBaseUrl;
    this.socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
      withCredentials: true,
    });

    this.socket.on('connect', () => this.connected$.next(true));
    this.socket.on('disconnect', () => this.connected$.next(false));
    this.socket.on('connect_error', (err) => {
      this.connected$.next(false);
      console.warn('[realtime] connect_error:', (err as any)?.message || String(err));
    });

    this.socket.onAny((event: string, payload: any) => {
      this.events.next({ event, payload });
    });
  }

  /**
   * Emite um evento para o servidor e aguarda ack (Promise).
   * Retorna o conteúdo do ack ou um objeto { ok: false, error }
   */
  emit(event: string, payload: any = {}, timeoutMs = 10000): Promise<any> {
    if (!this.socket) return Promise.reject(new Error('Socket não conectado'));
    return new Promise((resolve) => {
      try {
        // socket.timeout retorna um emitter que aceita ack callback (err, resp)
        (this.socket as any).timeout(timeoutMs).emit(event, payload, (err: any, resp: any) => {
          if (err) {
              resolve({ ok: false, error: 'timeout_or_error', details: ((err as any)?.message) || String(err) });
            } else {
              resolve(resp);
            }
        });
      } catch (e) {
        resolve({ ok: false, error: 'emit_failed', details: ((e as any)?.message) || String(e) });
      }
    });
  }

  private disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket) {
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }
    this.lastToken = null;
    this.connected$.next(false);
  }

  /** Assina um evento específico. */
  on<T = any>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const sub = this.events.subscribe(({ event: e, payload }) => {
        if (e === event) subscriber.next(payload as T);
      });
      return () => sub.unsubscribe();
    });
  }

  /** Reconecta após mudança de token/login. */
  refreshToken() {
    if (!this.isBrowser) return;
    this.disconnect();
    this.ensureConnection();
  }

  ngOnDestroy(): void { this.disconnect(); }
}
