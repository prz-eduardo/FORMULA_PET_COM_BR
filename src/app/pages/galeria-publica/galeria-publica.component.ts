import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { FooterComponent } from '../../footer/footer.component';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { StoreService } from '../../services/store.service';
import { PetLightboxComponent, PetLightboxReaction } from './pet-lightbox/pet-lightbox.component';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';

@Component({
  selector: 'app-galeria-publica',
  standalone: true,
  imports: [CommonModule, RouterModule, NavmenuComponent, FooterComponent, PetLightboxComponent, BannerSlotComponent],
  templateUrl: './galeria-publica.component.html',
  styleUrls: ['./galeria-publica.component.scss']
})
export class GaleriaPublicaComponent {
  pets: any[] = [];
  // timers for auto preview/confirm sequence when opening picker for first-time like
  // We store an array of timeout ids per key so we can clear them all when needed.
  private _autoPickerTimers: Map<string | number, any[]> = new Map();
  // client-side UID counter for rendered cards to guarantee uniqueness per instance
  private _uidCounter = 1;
  loading = true; // initial load
  error: string | null = null;

  // pagination / infinite scroll
  page = 1;
  pageSize = 20;
  loadingMore = false;
  hasMore = true;

  private observer?: IntersectionObserver;
  @ViewChild('sentinel', { static: false }) sentinel?: ElementRef;
  constructor(@Inject(PLATFORM_ID) private platformId: Object, private api: ApiService, private auth: AuthService, private toast: ToastService, private store: StoreService) {}
  // placeholder mode when API returns empty: show curated random pet images
  placeholderMode = false;
  placeholderImages: string[] = [];
  private placeholderPage = 0;

  /** Chave do card (`_uid`) com popover de reação aberto */
  reactionPickerOpenFor: number | string | null = null;
  /** Referência ao pet do popover (mesmo objeto do card) */
  pickerAnchorPet: any | null = null;
  /** Posição em px (viewport) do popover `position: fixed` */
  popoverPos = { left: 0, top: 0 };

  // Lightbox: currently-open pet reference (or null). We keep a direct reference so
  // mutations made inside the lightbox (reaction/comment totals) reflect in the card.
  lightboxPet: any = null;

  // available reaction types (emoji + tipo)
  reactionTypes = [
    { tipo: 'love', emoji: '❤️' },
    { tipo: 'haha', emoji: '😂' },
    { tipo: 'sad', emoji: '😢' },
    { tipo: 'angry', emoji: '😡' }
  ];

  // throttle for showing the login toast when unauthenticated
  private _lastLoginToastAt: number | null = null;
  private _loginToastCooldown = 1500; // ms

  private _maybeShowLoginToast() {
    try {
      const now = Date.now();
      if (this._lastLoginToastAt && (now - this._lastLoginToastAt) < this._loginToastCooldown) return;
      this._lastLoginToastAt = now;
      try { this.toast.info('Faça login para reagir às fotos.'); } catch (e) {}
    } catch (e) {}
  }

  // template-friendly lookup for an emoji by tipo
  getReactionEmoji(tipo: string) {
    const r = this.reactionTypes.find(x => x.tipo === tipo);
    return r ? r.emoji : '❤️';
  }

  getTotalReactions(): number {
    try {
      return (this.pets || []).reduce((acc: number, p: any) => acc + Number(p?.likes ?? 0), 0);
    } catch (e) { return 0; }
  }

  getGaleriaShareUrl(): string {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return '';
    return `${window.location.origin}/galeria`;
  }

  getGaleriaShareText(): string {
    return 'Galeria da comunidade Loja Pet — veja os pets e reaja!';
  }

  getGaleriaFullShareMessage(): string {
    const u = this.getGaleriaShareUrl();
    return u ? `${this.getGaleriaShareText()}\n${u}` : this.getGaleriaShareText();
  }

  async copyGaleriaLink(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const text = this.getGaleriaFullShareMessage();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* empty */ }
        document.body.removeChild(ta);
      }
      this.toast.success('Link copiado');
    } catch {
      this.toast.info('Não foi possível copiar o link');
    }
  }

  openWhatsAppShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const msg = this.getGaleriaFullShareMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openFacebookShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const u = this.getGaleriaShareUrl();
    if (!u) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async shareGaleria(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const title = 'Galeria Loja Pet';
    const text = this.getGaleriaShareText();
    const url = this.getGaleriaShareUrl();
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({ title, text, url });
        return;
      } catch (e: unknown) {
        const name = e && typeof e === 'object' && 'name' in e ? (e as { name?: string }).name : '';
        if (name === 'AbortError') return;
      }
    }
    await this.copyGaleriaLink();
  }

  // Return the dominant reaction (tipo, emoji, count) for a pet based on
  // aggregated totals. If all counts are zero, return null.
  getDominantReaction(pet: any) {
    try {
      const totals = pet?.reactionTotals || {
        love: Number(pet?.total_reacao_love ?? pet?.total_reacoes_love ?? 0),
        haha: Number(pet?.total_reacao_haha ?? pet?.total_reacoes_haha ?? 0),
        sad: Number(pet?.total_reacao_sad ?? pet?.total_reacoes_sad ?? 0),
        angry: Number(pet?.total_reacao_angry ?? pet?.total_reacoes_angry ?? 0)
      };
      const order = ['love', 'haha', 'sad', 'angry'];
      let maxTipo: string | null = null;
      let maxVal = -1;
      for (const t of order) {
        const v = Number(totals[t] ?? 0);
        if (v > maxVal) {
          maxVal = v;
          maxTipo = t;
        }
      }
      if (!maxTipo || maxVal <= 0) return null;
      return { tipo: maxTipo, emoji: this.getReactionEmoji(maxTipo), count: maxVal };
    } catch (e) {
      return null;
    }
  }

  ngOnInit(): void {
    // only perform fetches in the browser; avoids SSR Node fetch with relative URL
    if (isPlatformBrowser(this.platformId)) {
      // reset uid counter on fresh client render
      this._uidCounter = 1;
      this.loadPage(1);
    } else {
      // on server render, skip fetching and let client load after hydration
      this.loading = false;
    }
  }

  ngAfterViewInit(): void {
    // Only run IntersectionObserver in the browser and when the API exists.
    try {
      if (!isPlatformBrowser(this.platformId) || typeof (IntersectionObserver) === 'undefined') {
        // not in a browser or IntersectionObserver not supported
        return;
      }
      // setup IntersectionObserver to load next page
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && this.hasMore && !this.loadingMore && !this.loading) {
            this.loadNext();
          }
        }
      }, { rootMargin: '200px' });
      // observe later when view child appears
      setTimeout(() => {
        if (this.sentinel && this.sentinel.nativeElement && this.observer) {
          this.observer.observe(this.sentinel.nativeElement);
        }
      }, 200);
      // attach document click listener to close reaction picker when clicking outside
      try {
        document.addEventListener('click', this._docClickHandler as any);
      } catch (e) {
        // ignore in strict environments
      }
      // (resize/scroll listeners are attached dynamically when the picker opens)
    } catch (e) {
      // IntersectionObserver might not be available in some browsers/environments
      console.warn('IntersectionObserver not available', e);
    }
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    try {
      if (isPlatformBrowser(this.platformId)) {
        document.removeEventListener('click', this._docClickHandler as any);
      }
      this.closeReactionPopover();
    } catch (e) {}
  }

  // internal document click handler reference for add/remove
  private _docClickHandler = (ev: any) => {
    try {
      // if click occurred inside a reaction-wrapper, ignore
      const el = ev.target as HTMLElement | null;
      if (!el) return;
      // If suppression is active, ignore this click (used right after opening)
      if ((this as any)._suppressDocClose) return;
      if (
        el.closest &&
        (el.closest('.reaction-wrapper') ||
          el.closest('.reaction-quick-popover') ||
          el.closest('.reaction-quick-backdrop') ||
          el.closest('.btn-like') ||
          el.closest('.menu') ||
          el.closest('.icon-menu') ||
          el.closest('.nav-overlay'))
      ) {
        return;
      }
      this.closeReactionPopover();
    } catch (e) {
      this.closeReactionPopover();
    }
  };

  private _clearAllAutoTimers() {
    try {
      this._autoPickerTimers.forEach((t, k) => {
        try {
          if (Array.isArray(t)) {
            for (const id of t) { try { clearTimeout(id); } catch (e) {} }
          } else {
            try { clearTimeout(t as any); } catch (e) {}
          }
        } catch (e) {}
      });
      this._autoPickerTimers.clear();
      // remove transient preview/confirm flags on any pets
      try { (this.pets || []).forEach(p => { if (p && (p._pickerAutoHighlight || p._pickerConfirm)) { try { delete p._pickerAutoHighlight; } catch (e) {} try { delete p._pickerConfirm; } catch (e) {} } }); } catch (e) {}
    } catch (e) {}
  }

  // Reactions: basic 'love' toggle
  async toggleLove(pet: any) {
    // require auth
    const token = this.auth.getToken();
    if (!token) {
      this._maybeShowLoginToast();
      return;
    }
    const petId = pet.id;
    try {
      if (pet.userReacted) {
        // optimistic UI
        pet.userReacted = false;
        pet.likes = Math.max(0, (pet.likes ?? pet.reacoes_count ?? 0) - 1);
        await this.api.deletePetReaction(petId, { tipo: 'love' }, token).toPromise();
        // clear visual highlight only after server confirms deletion
        try { pet._visualActive = false; } catch (e) {}
      } else {
        pet.userReacted = true;
        pet.likes = (pet.likes ?? pet.reacoes_count ?? 0) + 1;
        await this.api.postPetReaction(petId, { tipo: 'love' }, token).toPromise();
        // set visual highlight only after server confirms the reaction
        try { pet._visualActive = true; } catch (e) {}
      }
    } catch (err) {
      console.error('Erro ao reagir', err);
      this.toast.error('Não foi possível enviar sua reação. Tente novamente.');
      // rollback optimistic
      if (pet.userReacted) {
        pet.userReacted = false;
        pet.likes = Math.max(0, (pet.likes ?? 1) - 1);
        try { pet._visualActive = false; } catch (e) {}
      } else {
        pet.userReacted = true;
        pet.likes = (pet.likes ?? 0) + 1;
        try { pet._visualActive = true; } catch (e) {}
      }
    }
  }

  /** Fecha o popover de reação rápida e limpa estado auxiliar */
  closeReactionPopover() {
    const key = this.reactionPickerOpenFor;
    const pet = this.pickerAnchorPet;
    if (key != null) this._clearAutoTimerFor(key, pet || undefined);
    this.reactionPickerOpenFor = null;
    this.pickerAnchorPet = null;
    (this as any)._suppressDocClose = false;
    this._removePickerListeners();
    try {
      (this.pets || []).forEach((p) => {
        if (p && (p._pickerAutoHighlight || p._pickerConfirm || p._pickerExiting)) {
          try {
            delete p._pickerAutoHighlight;
            delete p._pickerConfirm;
            delete p._pickerExiting;
          } catch (e) {}
        }
      });
    } catch (e) {}
  }

  async onPopoverSelectReaction(tipo: string) {
    const pet = this.pickerAnchorPet;
    if (!pet) return;
    await this.selectReaction(pet, tipo);
  }

  /** Posiciona o popover fixo junto ao botão do card (sempre linha horizontal). */
  private _layoutReactionPopover(key: string | number) {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(key)) : String(key);
      const wrap = document.querySelector(`.reaction-wrapper[data-pet-id="${safeId}"]`) as HTMLElement | null;
      const btn = wrap?.querySelector('.btn-like') as HTMLElement | null;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const margin = 10;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let popW = 236;
      let popH = 56;
      const el = document.querySelector('.reaction-quick-popover') as HTMLElement | null;
      if (el) {
        const pr = el.getBoundingClientRect();
        if (pr.width > 0) popW = pr.width;
        if (pr.height > 0) popH = pr.height;
      }
      let left = Math.round(rect.right - popW);
      let top = Math.round(rect.top - popH - margin);
      if (top < margin) top = Math.round(rect.bottom + margin);
      if (top + popH > vh - margin) top = Math.max(margin, vh - popH - margin);
      left = Math.max(margin, Math.min(left, vw - popW - margin));
      top = Math.max(margin, Math.min(top, vh - popH - margin));
      this.popoverPos = { left, top };
    } catch (e) {
      this.popoverPos = { left: 16, top: 16 };
    }
  }

  private _schedulePopoverLayout(key: string | number) {
    requestAnimationFrame(() => {
      this._layoutReactionPopover(key);
      requestAnimationFrame(() => this._layoutReactionPopover(key));
    });
  }

  // Abre/fecha o popover de reações; posicionamento só via fixed + getBoundingClientRect
  async openReactionPicker(pet: any, uid?: string, ev?: Event) {
    try {
      ev?.stopPropagation?.();
    } catch (e) {}
    try {
      const isCliente = await this.store.isClienteLoggedSilent();
      if (!isCliente) return;
    } catch (e) {}
    const key = uid ?? pet?._uid ?? pet?.id;

    if (this.reactionPickerOpenFor === key) {
      this.closeReactionPopover();
      return;
    }

    this.reactionPickerOpenFor = key;
    this.pickerAnchorPet = pet;
    (this as any)._suppressDocClose = true;
    setTimeout(() => {
      (this as any)._suppressDocClose = false;
    }, 150);

    this._schedulePopoverLayout(key);
    this._attachPickerListeners();

    if (!pet.userReacted) {
      this._clearAutoTimerFor(key, pet);
      try {
        pet._autoFlowPending = true;
      } catch (e) {}
      const timers: any[] = [];
      const confirmDelay = 420;
      const t2 = setTimeout(() => {
        try {
          this.selectReaction(pet, 'love');
        } catch (e) {
          console.warn('auto-like via sequence failed', e);
        }
      }, confirmDelay);
      timers.push(t2);
      this._autoPickerTimers.set(key, timers);
    } else {
      setTimeout(() => this._schedulePopoverLayout(key), 0);
    }
  }

  private _clearAutoTimerFor(key: string | number, pet?: any) {
    try {
      const t = this._autoPickerTimers.get(key);
      if (t) {
        if (Array.isArray(t)) {
          for (const id of t) { try { clearTimeout(id); } catch (e) {} }
        } else {
          try { clearTimeout(t as any); } catch (e) {}
        }
        this._autoPickerTimers.delete(key);
      }
      if (pet) {
        try { delete pet._pickerAutoHighlight; } catch (e) {}
        try { delete pet._pickerConfirm; } catch (e) {}
      }
    } catch (e) {}
  }

  // User selects a reaction from the picker
  async selectReaction(pet: any, tipo: string) {
    const token = this.auth.getToken();
    if (!token) {
      this._maybeShowLoginToast();
      return;
    }

    // If user already reacted with same tipo, remove it
    const prevTipo = pet.userReactionTipo ?? null;
    const alreadySame = prevTipo === tipo;

  // ensure reactionTotals exists
    pet.reactionTotals = pet.reactionTotals || { love: 0, haha: 0, sad: 0, angry: 0 };
  // cancel any preview timer if user interacts
  try { this._clearAutoTimerFor(pet._uid ?? pet.id, pet); } catch (e) {}
    try {
      if (alreadySame) {
        // optimistic removal
        pet.userReactionTipo = null;
        pet.userReacted = false;
        pet.reactionTotals[tipo] = Math.max(0, Number(pet.reactionTotals[tipo] ?? 0) - 1);
        pet.likes = Math.max(0, Number(pet.likes ?? 0) - 1);
        // send delete and prefer server response to reconcile counts
        const res: any = await this.api.deletePetReaction(pet.id, { tipo }, token).toPromise();
        try {
          if (res && typeof res === 'object') {
            pet.likes = Number(res.total_reacoes_geral ?? res.total_reacoes ?? pet.likes ?? 0);
            pet.reactionTotals = {
              love: Number(res.total_reacao_love ?? res.total_reacoes_love ?? pet.reactionTotals?.love ?? 0),
              haha: Number(res.total_reacao_haha ?? res.total_reacoes_haha ?? pet.reactionTotals?.haha ?? 0),
              sad: Number(res.total_reacao_sad ?? res.total_reacoes_sad ?? pet.reactionTotals?.sad ?? 0),
              angry: Number(res.total_reacao_angry ?? res.total_reacoes_angry ?? pet.reactionTotals?.angry ?? 0)
            };
          }
        } catch (e) { /* ignore server parse errors and keep optimistic state */ }
        try {
          pet._visualActive = false;
        } catch (e) {}
        try {
          delete pet._autoFlowPending;
        } catch (e) {}
        this.closeReactionPopover();
      } else {
        // optimistic change/add
        if (prevTipo) {
          // switching reaction: move counts
          pet.reactionTotals[prevTipo] = Math.max(0, Number(pet.reactionTotals[prevTipo] ?? 0) - 1);
        }
        const wasReactedBefore = !!prevTipo;
        pet.reactionTotals[tipo] = (Number(pet.reactionTotals[tipo] ?? 0) + 1);
        // if user had no previous reaction, increment overall likes
        if (!wasReactedBefore) pet.likes = Number(pet.likes ?? 0) + 1;
        pet.userReactionTipo = tipo;
        pet.userReacted = true;
        // send post and reconcile with server response when possible
        const res: any = await this.api.postPetReaction(pet.id, { tipo }, token).toPromise();
        try {
          if (res && typeof res === 'object') {
            // server may return the tipo, totals and overall
            pet.userReactionTipo = res.tipo ?? tipo;
            pet.userReacted = !!(res.minha_reacao || pet.userReactionTipo);
            pet.likes = Number(res.total_reacoes_geral ?? res.total_reacoes ?? pet.likes ?? 0);
            pet.reactionTotals = {
              love: Number(res.total_reacao_love ?? res.total_reacoes_love ?? pet.reactionTotals?.love ?? 0),
              haha: Number(res.total_reacao_haha ?? res.total_reacoes_haha ?? pet.reactionTotals?.haha ?? 0),
              sad: Number(res.total_reacao_sad ?? res.total_reacoes_sad ?? pet.reactionTotals?.sad ?? 0),
              angry: Number(res.total_reacao_angry ?? res.total_reacoes_angry ?? pet.reactionTotals?.angry ?? 0)
            };
          }
        } catch (e) { /* ignore server parse errors */ }
        try {
          pet._visualActive = true;
        } catch (e) {}
        try {
          delete pet._autoFlowPending;
        } catch (e) {}
        this.closeReactionPopover();
      }
    } catch (err) {
      console.error('Erro ao enviar reação', err);
      this.toast.error('Não foi possível enviar sua reação.');
      // rollback naive: if we removed, restore; if we added, revert
      if (alreadySame) {
        // we attempted to remove but failed -> restore
        pet.userReactionTipo = prevTipo;
        pet.userReacted = !!prevTipo;
        pet.reactionTotals[tipo] = Number(pet.reactionTotals[tipo] ?? 0) + 1;
        pet.likes = Number(pet.likes ?? 0) + 1;
        try { pet._visualActive = !!prevTipo; } catch (e) {}
      } else {
        // we attempted to add/switch but failed -> revert changes
        if (prevTipo) {
          pet.reactionTotals[prevTipo] = Number(pet.reactionTotals[prevTipo] ?? 0) + 1;
        }
        pet.reactionTotals[tipo] = Math.max(0, Number(pet.reactionTotals[tipo] ?? 1) - 1);
        if (!prevTipo) pet.likes = Math.max(0, Number(pet.likes ?? 1) - 1);
        pet.userReactionTipo = prevTipo;
        pet.userReacted = !!prevTipo;
        try { pet._visualActive = !!prevTipo; } catch (e) {}
      }
    }
  }

  // Small helper: map pet type (portuguese) to emoji for MVP
  typeEmoji(tipo?: string) {
    if (!tipo) return '🐾';
    const t = (tipo || '').toLowerCase();
    if (t.includes('cach') || t.includes('dog') || t.includes('cao') || t.includes('cão')) return '🐶';
    if (t.includes('gat') || t.includes('cat')) return '🐱';
    if (t.includes('ave') || t.includes('bird') || t.includes('pássar') || t.includes('passar')) return '🐦';
    return '🐾';
  }

  // Safe image error handler used from templates. Accepts the event target or element
  // and sets a fallback src only if the element exists and isn't already the fallback
  onImgError(target: any, fallback: string) {
    try {
      const el = target as HTMLImageElement | null;
      if (!el) return;
      if (!el.src || el.src.indexOf(fallback) !== -1) return;
      el.src = fallback;
    } catch (e) {
      // swallow errors — failing to set fallback shouldn't break UI
    }
  }

  // Called when an <img> load event fires. We keep a small flag on the pet
  // in case callers want to animate/mark loaded images. Also useful for debug.
  onImgLoad(ev: Event, pet?: any) {
    try {
      if (pet) pet._imgLoaded = true;
    } catch (e) {}
  }

  getGalleryUrls(p: any): string[] {
    try {
      if (!p || p.type === 'vet_ad') return [];
      const out: string[] = [];
      const direct = p.galeria_urls;
      if (Array.isArray(direct) && direct.length) {
        out.push(...direct.map((u: string) => String(u).trim()).filter(Boolean));
      } else {
        const fotos = p.fotos;
        if (Array.isArray(fotos) && fotos.length) {
          out.push(...fotos.map((x: any) => (typeof x === 'string' ? x : x?.url)).filter(Boolean));
        }
      }
      const main = p.foto || p.photo || p.photoURL || p.url || '';
      const s = typeof main === 'string' ? main.trim() : '';
      if (s && !out.some((u) => u.toLowerCase() === s.toLowerCase())) {
        out.unshift(s);
      }
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const u of out) {
        const k = u.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          deduped.push(u);
        }
      }
      return deduped;
    } catch {
      return [];
    }
  }

  galleryIndices(p: any): number[] {
    const n = this.getGalleryUrls(p).length;
    return n > 1 ? Array.from({ length: n }, (_, i) => i) : [];
  }

  gallerySlideCount(p: any): number {
    return this.getGalleryUrls(p).length;
  }

  private normalizeImgUrl(raw: string): string {
    if (!raw || typeof raw !== 'string') return '/imagens/image.png';
    let url = raw.trim();
    if (url.startsWith('//')) {
      url = (typeof window !== 'undefined' ? window.location.protocol : 'https:') + url;
    }
    if (!/^https?:\/\//i.test(url) && /^[\w\-]+\.[\w\-]+/.test(url)) {
      url = 'https://' + url;
    }
    return url || '/imagens/image.png';
  }

  // Normalize/validate image URLs returned by the API. This helps with
  // protocol-relative URLs (//host/path) and occasional missing-protocol
  // strings that fail to load when navigating client-side.
  resolveImage(p: any) {
    try {
      const urls = this.getGalleryUrls(p);
      const idx = Math.min(Math.max(0, p._galIdx || 0), Math.max(0, urls.length - 1));
      const raw = urls[idx] || urls[0] || '';
      if (!raw) return '/imagens/image.png';
      return this.normalizeImgUrl(raw);
    } catch (e) {
      return '/imagens/image.png';
    }
  }

  onGalleryDotClick(p: any, idx: number, ev: Event) {
    ev.stopPropagation();
    p._galIdx = idx;
  }

  cycleGallery(p: any, delta: number, ev: Event) {
    ev.stopPropagation();
    const urls = this.getGalleryUrls(p);
    if (urls.length < 2) return;
    let i = (p._galIdx || 0) + delta;
    if (i < 0) i = urls.length - 1;
    if (i >= urls.length) i = 0;
    p._galIdx = i;
  }

  // Clicar na foto abre o lightbox com foto grande, detalhes, reações e comentários.
  onPhotoClick(pet: any, ev?: Event) {
    try {
      if (ev && (ev as Event).stopPropagation) (ev as Event).stopPropagation();
      this.openLightbox(pet);
    } catch (e) {}
  }

  // --- Lightbox control ---
  openLightbox(pet: any) {
    if (!pet) return;
    // close any open reaction picker so it doesn't conflict with the modal
    try {
      this.closeReactionPopover();
      this._clearAllAutoTimers();
    } catch (e) {}
    this.lightboxPet = pet;
  }

  closeLightbox() {
    this.lightboxPet = null;
  }

  // Lightbox emits reaction selections: reuse the existing selectReaction to keep
  // optimistic UI, auth checks and server reconciliation in one place.
  onLightboxReaction(ev: PetLightboxReaction) {
    if (!this.lightboxPet || !ev?.tipo) return;
    try { this.selectReaction(this.lightboxPet, ev.tipo); } catch (e) {}
  }

  // Top N non-zero reactions (for the card reactions-summary strip)
  getTopReactionList(pet: any, limit = 3) {
    try {
      const totals = pet?.reactionTotals || {};
      const list = this.reactionTypes
        .map(r => ({ ...r, count: Number(totals[r.tipo] ?? 0) }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      return list;
    } catch (e) { return []; }
  }

  trackReaction = (_: number, r: any) => r?.tipo ?? _;

  // --- Picker position helpers (avoid clipping at top of viewport) ---
  private _boundRecalc = () => {
    if (this.reactionPickerOpenFor) {
      try {
        this._layoutReactionPopover(this.reactionPickerOpenFor);
      } catch (e) {}
    }
  }

  // Close picker on any page scroll; keep resize for recalculation
  private _onScrollClose = (ev: Event) => {
    try {
      if (this.reactionPickerOpenFor) {
        this.closeReactionPopover();
      }
    } catch (e) {}
  }

  private _attachPickerListeners() {
    try {
      // scroll should immediately close an open picker (user intent)
      window.addEventListener('scroll', this._onScrollClose, true);
      // resize needs to recalc position if picker remains open
      window.addEventListener('resize', this._boundRecalc);
    } catch (e) {}
  }

  private _removePickerListeners() {
    try {
      window.removeEventListener('scroll', this._onScrollClose, true);
      window.removeEventListener('resize', this._boundRecalc);
    } catch (e) {}
  }

  private async loadPage(pageNum: number) {
    if (pageNum === 1) {
      this.loading = true;
      this.error = null;
    } else {
      this.loadingMore = true;
    }
    try {
      // use ApiService so baseUrl and headers are handled consistently
      // pass JWT when available so the gallery can return auth-aware data
  const token = this.auth.getToken() ?? undefined;
  const data = await this.api.getGaleriaPublica({ page: pageNum, pageSize: this.pageSize }, token).toPromise();
      // support API returning { data: [], page, totalPages } or plain array
      const items = Array.isArray(data) ? data : (data?.data || []);
      // normalize items: ensure likes and userReacted fields exist
      const normalized = (items || []).map((it: any, idx: number) => ({
        ...it,
        // assign a client-unique uid to each rendered card so duplicate server ids don't collide
        _uid: `g-${Date.now()}-${this._uidCounter++}`,
        // normalize reaction fields
        // Prefer explicit aggregated totals from API when available (total_reacoes_geral),
        // otherwise fall back to legacy fields like reacoes_count or likes.
        likes: Number(it.total_reacoes_geral ?? it.total_reacoes ?? it.reacoes_count ?? it.likes ?? 0),
        // minha_reacao may be null or an object { tipo }
        userReactionTipo: it.minha_reacao?.tipo ?? (it.userReactionTipo ?? it.user_reaction_tipo ?? null),
  userReacted: !!(it.minha_reacao || it.liked || it.liked === true || it.userReacted || it.user_reacted || false),
  // visual highlight for the heart should reflect confirmed server state.
  // Initialize visual-only flag from server-provided reaction. Optimistic
  // client changes should NOT flip this flag until the server confirms.
  _visualActive: !!(it.minha_reacao || it.liked || it.liked === true || it.userReacted || it.user_reacted || false),
        // detailed reaction totals (coerce strings to numbers). Also accept alternate field names.
        reactionTotals: {
          love: Number(it.total_reacao_love ?? it.total_reacoes_love ?? 0),
          haha: Number(it.total_reacao_haha ?? it.total_reacoes_haha ?? 0),
          sad: Number(it.total_reacao_sad ?? it.total_reacoes_sad ?? 0),
          angry: Number(it.total_reacao_angry ?? it.total_reacoes_angry ?? 0)
        },
        // Pet extras (used by the enriched card and lightbox)
        sexo: it.sexo ?? null,
        pesoKg: it.pesoKg ?? it.peso_kg ?? null,
        observacoes: it.observacoes ?? null,
        tutor_nome: it.tutor_nome ?? null,
        tutor_foto: it.tutor_foto ?? null,
        total_comentarios: Number(it.total_comentarios ?? it.comentarios_count ?? 0),
        _galIdx: 0,
        // size removed: visual sizing now handled by CSS and original image dimensions
      }));

      // When appending pages, avoid exact duplicate ids and distribute incoming items
      // across the existing list so similar items don't cluster together.
      if (pageNum === 1) {
        this.pets = normalized;
      } else {
        const existing = this.pets || [];
        const incoming = normalized; // do NOT drop duplicates; keep all incoming items

        // If no existing content, just set pets to incoming
        if (!existing.length) {
          this.pets = incoming;
        } else if (!incoming.length) {
          // nothing to append
        } else if (incoming.length >= existing.length) {
          // If incoming is large, interleave to avoid clustering
          const merged: any[] = [];
          const max = Math.max(existing.length, incoming.length);
          for (let i = 0; i < max; i++) {
            if (existing[i]) merged.push(existing[i]);
            if (incoming[i]) {
              // try to avoid placing identical id right after the same id
              if (merged.length > 0 && String(merged[merged.length - 1].id ?? merged[merged.length - 1]._id ?? '') === String(incoming[i].id ?? incoming[i]._id ?? '')) {
                // attempt to find a later incoming item with different id and swap
                let found = -1;
                for (let j = i + 1; j < incoming.length; j++) {
                  if (String(incoming[j].id ?? incoming[j]._id ?? '') !== String(incoming[i].id ?? incoming[i]._id ?? '')) {
                    found = j;
                    break;
                  }
                }
                if (found !== -1) {
                  const tmp = incoming[i];
                  incoming[i] = incoming[found];
                  incoming[found] = tmp;
                }
              }
              merged.push(incoming[i]);
            }
          }
          this.pets = merged;
        } else {
          // Distribute incoming items evenly among existing items, but try to avoid adjacent identical ids
          const merged: any[] = [];
          const gap = Math.ceil((existing.length + 1) / (incoming.length + 1));
          let pos = 0;
          for (let i = 0; i < incoming.length; i++) {
            const slice = existing.slice(pos, pos + gap);
            merged.push(...slice);
            pos += gap;

            // Before pushing incoming[i], try to avoid duplicate adjacency with last merged
            if (merged.length > 0 && String(merged[merged.length - 1].id ?? merged[merged.length - 1]._id ?? '') === String(incoming[i].id ?? incoming[i]._id ?? '')) {
              // Find a later incoming item with different id to swap with
              let found = -1;
              for (let j = i + 1; j < incoming.length; j++) {
                if (String(incoming[j].id ?? incoming[j]._id ?? '') !== String(incoming[i].id ?? incoming[i]._id ?? '')) {
                  found = j;
                  break;
                }
              }
              if (found !== -1) {
                const tmp = incoming[i];
                incoming[i] = incoming[found];
                incoming[found] = tmp;
              }
            }

            merged.push(incoming[i]);
          }
          if (pos < existing.length) merged.push(...existing.slice(pos));
          this.pets = merged;
        }
      }

      // If the API returned no items on page 1, switch to placeholder mode
      if (pageNum === 1 && Array.isArray(items) && items.length === 0) {
        this.placeholderMode = true;
        // seed first batch of placeholders so user sees something
        this.loadPlaceholderBatch();
      }

      // determine hasMore
      if (!Array.isArray(data)) {
        // try to use totalPages or total
        const totalPages = data?.totalPages ?? data?.total_pages ?? null;
        if (totalPages != null) {
          this.hasMore = (pageNum < totalPages);
        } else if (Array.isArray(items)) {
          this.hasMore = items.length === this.pageSize;
        }
      } else {
        this.hasMore = items.length === this.pageSize;
      }
  this.page = pageNum;
    } catch (err) {
      console.error(err);
      this.error = 'Não foi possível carregar a galeria.';
    } finally {
      this.loading = false;
      this.loadingMore = false;
    }
  }

  loadNext() {
    if (!this.hasMore) return;
    this.loadPage(this.page + 1);
  }

  // placeholder images batch (uses loremflickr for pet images)
  private loadPlaceholderBatch() {
    this.placeholderPage++;
    const batchSize = this.pageSize;
    const urls: string[] = [];
    for (let i = 0; i < batchSize; i++) {
      // size 400x300 and randomize by adding cache buster
      urls.push(`https://loremflickr.com/420/320/dog?random=${Date.now()}-${this.placeholderPage}-${i}`);
    }
    this.placeholderImages = this.placeholderImages.concat(urls);
  }
}
