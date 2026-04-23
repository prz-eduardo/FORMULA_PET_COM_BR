import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';

export interface NotificationItem {
  id: number;
  audience: 'admin' | 'cliente';
  cliente_id: number | null;
  tipo: string;
  titulo: string;
  mensagem?: string | null;
  meta?: any | null;
  link?: string | null;
  lida: boolean | 0 | 1;
  lida_em?: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private isBrowser: boolean;
  notifications$ = new BehaviorSubject<NotificationItem[]>([]);
  unreadCount$ = new BehaviorSubject<number>(0);
  loading$ = new BehaviorSubject<boolean>(false);

  private initialized = false;
  private page = 1;
  private pageSize = 20;
  hasMore = false;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private api: ApiService,
    private auth: AuthService,
    private realtime: RealtimeService,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (!this.isBrowser) return;

    this.auth.isLoggedIn$.subscribe((logged) => {
      if (logged) this.init();
      else this.reset();
    });

    this.realtime.on<NotificationItem>('notification:new').subscribe((n) => {
      if (!n) return;
      const list = [n, ...this.notifications$.value].slice(0, 200);
      this.notifications$.next(list);
      if (!n.lida) this.unreadCount$.next(this.unreadCount$.value + 1);
      this.playSound();
    });

    if (this.auth.getToken()) this.init();
  }

  private reset() {
    this.initialized = false;
    this.page = 1;
    this.hasMore = false;
    this.notifications$.next([]);
    this.unreadCount$.next(0);
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.load(true);
  }

  load(reset = false) {
    if (!this.isBrowser) return;
    const token = this.auth.getToken();
    if (!token) return;
    if (reset) { this.page = 1; this.notifications$.next([]); }
    this.loading$.next(true);
    this.api.listNotifications(token, { page: this.page, pageSize: this.pageSize }).subscribe({
      next: (res) => {
        const current = reset ? [] : this.notifications$.value;
        const list = [...current, ...(res.data || [])].map(n => ({ ...n, lida: !!n.lida }));
        this.notifications$.next(list);
        this.unreadCount$.next(res.unread || 0);
        this.hasMore = this.page < (res.totalPages || 0);
        this.loading$.next(false);
      },
      error: () => { this.loading$.next(false); },
    });
  }

  loadMore() {
    if (!this.hasMore) return;
    this.page += 1;
    this.load(false);
  }

  refreshUnread() {
    const token = this.auth.getToken();
    if (!token) return;
    this.api.getUnreadCount(token).subscribe({
      next: (r) => this.unreadCount$.next(r?.unread || 0),
      error: () => { /* noop */ },
    });
  }

  markRead(id: number | string) {
    const token = this.auth.getToken();
    if (!token) return;
    this.api.markNotificationRead(token, id).subscribe({
      next: () => {
        const list = this.notifications$.value.map(n => n.id === Number(id) ? { ...n, lida: true } : n);
        this.notifications$.next(list);
        this.unreadCount$.next(Math.max(0, this.unreadCount$.value - 1));
      },
      error: () => { /* noop */ },
    });
  }

  markAllRead() {
    const token = this.auth.getToken();
    if (!token) return;
    this.api.markAllNotificationsRead(token).subscribe({
      next: () => {
        const list = this.notifications$.value.map(n => ({ ...n, lida: true as any }));
        this.notifications$.next(list);
        this.unreadCount$.next(0);
      },
      error: () => { /* noop */ },
    });
  }

  remove(id: number | string) {
    const token = this.auth.getToken();
    if (!token) return;
    this.api.deleteNotification(token, id).subscribe({
      next: () => {
        const removed = this.notifications$.value.find(n => n.id === Number(id));
        const list = this.notifications$.value.filter(n => n.id !== Number(id));
        this.notifications$.next(list);
        if (removed && !removed.lida) this.unreadCount$.next(Math.max(0, this.unreadCount$.value - 1));
      },
      error: () => { /* noop */ },
    });
  }

  private playSound() {
    if (!this.isBrowser) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch { /* noop */ }
  }
}
