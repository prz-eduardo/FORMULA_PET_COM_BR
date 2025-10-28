import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { FooterComponent } from '../../footer/footer.component';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-galeria-publica',
  standalone: true,
  imports: [CommonModule, RouterModule, NavmenuComponent, FooterComponent],
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
  constructor(@Inject(PLATFORM_ID) private platformId: Object, private api: ApiService, private auth: AuthService, private toast: ToastService) {}
  // placeholder mode when API returns empty: show curated random pet images
  placeholderMode = false;
  placeholderImages: string[] = [];
  private placeholderPage = 0;

  // UI: track which pet has the reaction picker open (store pet id)
  reactionPickerOpenFor: number | string | null = null;
  // track when the picker should flip below the button to avoid viewport clipping
  pickerFlippedFor: number | string | null = null;

  // available reaction types (emoji + tipo)
  reactionTypes = [
    { tipo: 'love', emoji: '❤️' },
    { tipo: 'haha', emoji: '😂' },
    { tipo: 'sad', emoji: '😢' },
    { tipo: 'angry', emoji: '😡' }
  ];

  // template-friendly lookup for an emoji by tipo
  getReactionEmoji(tipo: string) {
    const r = this.reactionTypes.find(x => x.tipo === tipo);
    return r ? r.emoji : '❤️';
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
    // remove document click listener if attached
    try {
      if (isPlatformBrowser(this.platformId)) {
        document.removeEventListener('click', this._docClickHandler as any);
      }
      // also remove any picker listeners
      this._removePickerListeners();
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
      if (el.closest && (el.closest('.reaction-wrapper') || el.closest('.reaction-picker') || el.closest('.btn-like'))) return;
      // otherwise close and clear any preview timers
      this.reactionPickerOpenFor = null;
      try { this._clearAllAutoTimers(); } catch (e) {}
    } catch (e) {
      this.reactionPickerOpenFor = null;
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
      this.toast.info('Faça login para reagir às fotos.');
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

  // Open/close reaction picker; clicking the heart toggles the picker instead
  // We accept the pet object and the client _uid so the picker is unique per card instance
  openReactionPicker(pet: any, uid?: string, ev?: Event) {
    // Positioning is handled via CSS (absolute inside the card). We only toggle state here.
    const key = uid ?? pet?._uid ?? pet?.id;
      if (this.reactionPickerOpenFor === key) {
      this.reactionPickerOpenFor = null;
      (this as any)._suppressDocClose = false;
      this._removePickerListeners();
      // clear any pending auto-preview timers
      this._clearAutoTimerFor(key, pet);
    } else {
      // If the user hasn't reacted yet, clicking the heart should open the picker, play
      // an animated sequence (emojis in, highlight love, confirm animation), then submit
      // a 'love' reaction and close the picker. If the user already reacted, just open the picker.
      if (!pet.userReacted) {
        // open the picker UI first so animations are visible
        this.reactionPickerOpenFor = key;
        // ensure listeners and positioning are set
        (this as any)._suppressDocClose = true;
        setTimeout(() => { (this as any)._suppressDocClose = false; }, 120);
        setTimeout(() => { try { this.adjustPickerPositionById(key); } catch (e) {} }, 40);
        this._attachPickerListeners();

        // clear any previously scheduled timers for this key
        this._clearAutoTimerFor(key, pet);

        // Sequence timings
        const timers: any[] = [];
        // base values (keep in sync with CSS)
        const openDelay = 120; // ms to allow the picker to open
        const perEmojiDelay = 100; // matches --d incremental delay in template
        const emojiAnimMs = 280; // matches .28s animation duration for emojiIn in CSS
        const numEmojis = Array.isArray(this.reactionTypes) ? this.reactionTypes.length : 4;

        // mark as auto-flow so selectReaction knows to play the 'love' animation
        // only after the server confirms. Avoid setting visual highlight before
        // the increment so the love button doesn't get a white background early.
        try { pet._autoFlowPending = true; } catch (e) {}

        // compute when the last emoji will finish its entrance animation and
        // then trigger the request. We do NOT set _pickerAutoHighlight or
        // _pickerConfirm here; selectReaction will set them only after server
        // confirmation so the animation happens after increment.
        const lastEmojiEnd = openDelay + (perEmojiDelay * numEmojis) + emojiAnimMs;
        const confirmDelay = lastEmojiEnd + 80; // small buffer after animations complete
        const t2 = setTimeout(() => {
          try { this.selectReaction(pet, 'love'); } catch (e) { console.warn('auto-like via sequence failed', e); }
        }, confirmDelay);
        timers.push(t2 as any);
        this._autoPickerTimers.set(key, timers);
        return;
      }
      // user already reacted -> open normally
      this.reactionPickerOpenFor = key;
      // briefly suppress document-level click closure so the opener click doesn't close it
      (this as any)._suppressDocClose = true;
      setTimeout(() => { (this as any)._suppressDocClose = false; }, 120);
      // after the picker is rendered, adjust its position to avoid clipping
      setTimeout(() => { try { this.adjustPickerPositionById(key); } catch (e) {} }, 40);
      // attach scroll/resize handlers while picker is open
      this._attachPickerListeners();
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

  // Start the exit animation sequence for the picker: play icons disappearing
  // one-by-one (staggered by 100ms) and then close the picker. Timers are
  // recorded in _autoPickerTimers so they can be cleared if needed.
  private _startPickerExitSequence(pet: any, key?: string | number) {
    try {
      const k = key ?? pet?._uid ?? pet?.id;
      // clear existing timers for this key
      try { this._clearAutoTimerFor(k, pet); } catch (e) {}
      const timers: any[] = [];
      const numEmojis = Array.isArray(this.reactionTypes) ? this.reactionTypes.length : 4;
      const perExitDelay = 100; // ms between each icon disappearing
      const exitAnimMs = 280; // match emojiIn duration

      // small kickoff delay then mark exiting so CSS animation runs with per-button --exit-d
      const tStart = setTimeout(() => {
        try { pet._pickerExiting = true; } catch (e) {}
      }, 40);
      timers.push(tStart as any);

      // compute final close after last icon finishes its exit animation
      const finalDelay = 40 + (perExitDelay * numEmojis) + exitAnimMs + 40;
      const tClose = setTimeout(() => {
        try { delete pet._pickerAutoHighlight; } catch (e) {}
        try { delete pet._pickerConfirm; } catch (e) {}
        try { delete pet._pickerExiting; } catch (e) {}
        try { this.reactionPickerOpenFor = null; } catch (e) {}
        try { this._autoPickerTimers.delete(k); } catch (e) {}
        try { this._removePickerListeners(); } catch (e) {}
      }, finalDelay);
      timers.push(tClose as any);
      this._autoPickerTimers.set(k, timers);
    } catch (e) {
      // swallow; nothing critical
    }
  }

  // User selects a reaction from the picker
  async selectReaction(pet: any, tipo: string) {
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Faça login para reagir às fotos.');
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
  // ensure visual highlight reflects confirmed deletion
  try { pet._visualActive = false; } catch (e) {}
  // If this was an auto-flow we may want to play the 'love' animation now that
  // the server confirmed. Set transient picker flags but keep the picker open;
  // the user will close it by clicking outside or scrolling.
  try {
    if (pet && pet._autoFlowPending) {
      try { pet._pickerAutoHighlight = 'love'; } catch (e) {}
      try { pet._pickerConfirm = true; } catch (e) {}
      try { delete pet._autoFlowPending; } catch (e) {}
      try { this._clearAutoTimerFor(pet._uid ?? pet.id, pet); } catch (e) {}
    }
  } catch (e) {}
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
  // ensure visual highlight reflects confirmed addition/switch
  try { pet._visualActive = true; } catch (e) {}
  // If this was an auto-flow we triggered earlier, play the 'love' animation
  // now that the server confirmed the reaction. Keep the picker open.
  try {
    if (pet && pet._autoFlowPending) {
      try { pet._pickerAutoHighlight = 'love'; } catch (e) {}
      try { pet._pickerConfirm = true; } catch (e) {}
      try { delete pet._autoFlowPending; } catch (e) {}
      try { this._clearAutoTimerFor(pet._uid ?? pet.id, pet); } catch (e) {}
    }
  } catch (e) {}
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
    } finally {
      // Keep the picker open after any reaction. Users can close it by
      // clicking outside or by scrolling (existing handlers).
      try {
        // clear any transient auto timers (already attempted elsewhere) to be safe
        try { this._clearAutoTimerFor(pet?._uid ?? pet?.id, pet); } catch (e) {}
      } catch (e) {}
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

  // Normalize/validate image URLs returned by the API. This helps with
  // protocol-relative URLs (//host/path) and occasional missing-protocol
  // strings that fail to load when navigating client-side.
  resolveImage(p: any) {
    try {
      const raw = (p && (p.foto || p.photo || p.photoURL || p.url)) || '';
      if (!raw || typeof raw !== 'string') return '/imagens/image.png';
      let url = raw.trim();
      // If protocol-relative (//example.com/...), prefix with current page protocol
      if (url.startsWith('//')) {
        url = window.location.protocol + url;
      }
      // If missing protocol but looks like a host (example.com/...), try https
      if (!/^https?:\/\//i.test(url) && /^[\w\-]+\.[\w\-]+/.test(url)) {
        url = 'https://' + url;
      }
      // else allow relative paths (/imagens/...) and data: URIs through
      return url || '/imagens/image.png';
    } catch (e) {
      return '/imagens/image.png';
    }
  }

  // When user clicks the photo: if they haven't reacted, send a 'love' reaction automatically.
  // If they already reacted, open the reaction picker (so they can change/remove).
  onPhotoClick(pet: any, ev?: Event) {
    try {
      if (ev && (ev as Event).stopPropagation) (ev as Event).stopPropagation();
      // If user already reacted, open picker
      if (pet.userReacted) {
        try { this.openReactionPicker(pet, pet._uid, ev); } catch (e) {}
        return;
      }
      // otherwise, submit a 'love' reaction immediately
      try { this.selectReaction(pet, 'love'); } catch (e) { console.warn('auto-like failed', e); }
    } catch (e) {}
  }

  // --- Picker position helpers (avoid clipping at top of viewport) ---
  private _boundRecalc = () => {
    if (this.reactionPickerOpenFor) {
      try { this.adjustPickerPositionById(this.reactionPickerOpenFor); } catch (e) {}
    }
  }

  // Close picker on any page scroll; keep resize for recalculation
  private _onScrollClose = (ev: Event) => {
    try {
      if (this.reactionPickerOpenFor) {
        this.reactionPickerOpenFor = null;
        (this as any)._suppressDocClose = false;
        this._removePickerListeners();
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
    this.pickerFlippedFor = null;
    try { this._clearAllAutoTimers(); } catch (e) {}
  }

  // Compute if the picker would be clipped by the top of the viewport and flip it below the button
  adjustPickerPositionById(id: number | string) {
    try {
      const wrapper = document.querySelector(`.reaction-wrapper[data-pet-id="${id}"]`) as HTMLElement | null;
      if (!wrapper) { this.pickerFlippedFor = null; return; }
      const picker = wrapper.querySelector('.reaction-picker') as HTMLElement | null;
      if (!picker) { this.pickerFlippedFor = null; return; }
      const rect = picker.getBoundingClientRect();
      const topThreshold = 8; // px from top of viewport
      if (rect.top < topThreshold) {
        this.pickerFlippedFor = id;
      } else {
        this.pickerFlippedFor = null;
      }
    } catch (e) {
      this.pickerFlippedFor = null;
    }
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
      const sizeVariants = ['small', 'medium', 'large'];
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
        // pseudo-random but stable per session: use index to pick variant
        size: sizeVariants[(idx + this.page + (this.placeholderPage || 0)) % sizeVariants.length]
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
