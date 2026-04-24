import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter, debounceTime } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { StoreService, CartItem } from './store.service';
import { jwtDecode } from 'jwt-decode';

const LS_VID = 'fp_rastreio_vid';
const SS_TOUCH = 'fp_rastreio_first_touch_v1';

function makeUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

@Injectable({ providedIn: 'root' })
export class RastreioLojaService implements OnDestroy {
  private base = environment.apiBaseUrl;
  private queue: Array<Record<string, unknown>> = [];
  private flushHandle: ReturnType<typeof setTimeout> | null = null;
  private pageTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPath = '';
  private routerSub?: Subscription;
  private cartSub?: Subscription;
  private started = false;
  private enabled = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private http: HttpClient,
    private auth: AuthService,
    private store: StoreService,
    private router: Router
  ) {}

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.cartSub?.unsubscribe();
    if (this.flushHandle) clearTimeout(this.flushHandle);
    if (this.pageTimer) clearTimeout(this.pageTimer);
  }

  /** Chamar uma vez no bootstrap da aplicação (ex.: app.component) no browser. */
  start(): void {
    if (!isPlatformBrowser(this.platformId) || this.started) return;
    this.started = true;
    this.refreshEnabledFromUrl(this.router.url || '');
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.refreshEnabledFromUrl(e.urlAfterRedirects || e.url);
        this.schedulePageView(e.urlAfterRedirects || e.url);
      });
    this.cartSub = this.store.cart$
      .pipe(debounceTime(2000))
      .subscribe((items) => this.enqueueCartSnapshot(items));
    if (this.enabled) {
      this.syncVisitante();
      this.schedulePageView(this.router.url || '');
    }
  }

  /** UUID persistente; usado no login (merge com o cliente). */
  getVisitanteId(): string {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
      return makeUuidV4();
    }
    try {
      let v = localStorage.getItem(LS_VID);
      if (!v || v.length < 32) {
        v = makeUuidV4();
        localStorage.setItem(LS_VID, v);
      }
      return v;
    } catch {
      return makeUuidV4();
    }
  }

  /** Após login com sucesso, força evento com JWT para o merge no backend. */
  afterClienteLogin(): void {
    this.enqueue({ tipo: 'identify' as const, path: this.sanitizePath(this.router.url) });
    this.flushSoon();
  }

  private refreshEnabledFromUrl(u: string): void {
    const was = this.enabled;
    this.enabled = !u.includes('/restrito/admin') && !u.startsWith('/restrito/produto');
    if (was && !this.enabled) {
      this.flushSoon();
    }
  }

  private isAdminPath(u: string): boolean {
    return u.includes('/restrito/admin') || u.startsWith('/restrito/produto');
  }

  private clientAuthHeaders(): HttpHeaders | null {
    const t = this.auth.getToken();
    if (!t) return null;
    try {
      const d = jwtDecode<{ tipo?: string }>(t);
      if (d.tipo === 'cliente') {
        return new HttpHeaders({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
      }
    } catch {
      return null;
    }
    return null;
  }

  private syncVisitante(): void {
    if (!isPlatformBrowser(this.platformId) || !this.enabled) return;
    const id = this.getVisitanteId();
    let landing_path: string;
    let document_referrer: string | null;
    let utm: Record<string, string> | null = null;
    let gclid: string | null = null;
    let fbclid: string | null = null;
    try {
      landing_path = window.location.pathname + window.location.search;
      document_referrer = document.referrer || null;
      const p = new URLSearchParams(window.location.search);
      const u: Record<string, string> = {};
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
        const v = p.get(k);
        if (v) u[k] = v;
      }
      utm = Object.keys(u).length ? u : null;
      gclid = p.get('gclid');
      fbclid = p.get('fbclid');
    } catch {
      landing_path = '/';
      document_referrer = null;
    }
    const firstTouch = !sessionStorage.getItem(SS_TOUCH);
    this.http
      .post<{ id: string; created: boolean }>(`${this.base}/rastreio/visitante`, {
        id,
        landing_path,
        document_referrer,
        utm,
        gclid,
        fbclid
      })
      .subscribe({
        next: (r) => {
          try {
            if (r?.id) localStorage.setItem(LS_VID, r.id);
            if (firstTouch) sessionStorage.setItem(SS_TOUCH, '1');
          } catch { /* */ }
        },
        error: () => {
          /* silencioso */
        }
      });
  }

  private schedulePageView(url: string): void {
    if (this.isAdminPath(url) || !this.enabled) return;
    if (this.pageTimer) clearTimeout(this.pageTimer);
    this.pageTimer = setTimeout(() => {
      this.pageTimer = null;
      const p = this.sanitizePath(url);
      if (p === this.lastPath) return;
      this.lastPath = p;
      let title: string | undefined;
      try {
        title = typeof document !== 'undefined' ? document.title?.slice(0, 200) : undefined;
      } catch { /* */ }
      this.enqueue({
        tipo: 'page_view' as const,
        path: p,
        meta: title ? { title } : undefined
      });
    }, 400);
  }

  private sanitizePath(url: string): string {
    if (!url) return '/';
    const q = url.indexOf('?');
    if (q === -1) return url.length > 500 ? url.slice(0, 500) : url;
    return url.slice(0, q).length > 500 ? url.slice(0, 500) : url.slice(0, q);
  }

  private enqueueCartSnapshot(items: CartItem[]): void {
    if (!this.enabled) return;
    const itemCount = items.reduce((a, c) => a + c.quantity, 0);
    let subtotal = 0;
    for (const c of items) {
      const pr = c.product?.price != null ? Number(c.product.price) : 0;
      subtotal += pr * c.quantity;
    }
    this.enqueue({
      tipo: 'cart_snapshot' as const,
      path: this.sanitizePath(this.router.url || ''),
      meta: {
        itemCount,
        subtotal: Math.round(subtotal * 100) / 100,
        productIds: items.slice(0, 20).map((x) => x.product?.id)
      }
    });
  }

  private enqueue(ev: { tipo: string; path?: string; meta?: unknown; route_id?: string }): void {
    this.queue.push({
      tipo: ev.tipo,
      path: ev.path,
      route_id: ev.route_id,
      meta: ev.meta
    });
    if (this.queue.length >= 8) {
      this.flushSoon();
    } else {
      this.flushSoon(1200);
    }
  }

  private flushSoon(ms = 600): void {
    if (this.flushHandle) clearTimeout(this.flushHandle);
    this.flushHandle = setTimeout(() => {
      this.flushHandle = null;
      this.flush();
    }, ms);
  }

  private flush(): void {
    if (!isPlatformBrowser(this.platformId) || this.queue.length === 0) return;
    if (this.isAdminPath(this.router.url)) {
      this.queue = [];
      return;
    }
    const visitante_id = this.getVisitanteId();
    const events = this.queue.splice(0, 40);
    const headers = this.clientAuthHeaders();
    const body = { visitante_id, events, session_id: this.makeSessionId() };
    this.http
      .post(`${this.base}/rastreio/eventos`, body, {
        headers: headers || new HttpHeaders({ 'Content-Type': 'application/json' })
      })
      .subscribe({ next: () => {}, error: () => {} });
  }

  private makeSessionId(): string {
    const k = 'fp_rastreio_sid';
    try {
      if (typeof sessionStorage === 'undefined') return '';
      let s = sessionStorage.getItem(k);
      if (!s) {
        s = makeUuidV4();
        sessionStorage.setItem(k, s);
      }
      return s;
    } catch {
      return '';
    }
  }
}
