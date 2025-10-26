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
      // otherwise close
      this.reactionPickerOpenFor = null;
    } catch (e) {
      this.reactionPickerOpenFor = null;
    }
  };

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
      } else {
        pet.userReacted = true;
        pet.likes = (pet.likes ?? pet.reacoes_count ?? 0) + 1;
        await this.api.postPetReaction(petId, { tipo: 'love' }, token).toPromise();
      }
    } catch (err) {
      console.error('Erro ao reagir', err);
      this.toast.error('Não foi possível enviar sua reação. Tente novamente.');
      // rollback optimistic
      if (pet.userReacted) {
        pet.userReacted = false;
        pet.likes = Math.max(0, (pet.likes ?? 1) - 1);
      } else {
        pet.userReacted = true;
        pet.likes = (pet.likes ?? 0) + 1;
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
    } else {
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
    try {
      if (alreadySame) {
        // optimistic removal
        pet.userReactionTipo = null;
        pet.userReacted = false;
        pet.reactionTotals[tipo] = Math.max(0, Number(pet.reactionTotals[tipo] ?? 0) - 1);
        pet.likes = Math.max(0, Number(pet.likes ?? 0) - 1);
        await this.api.deletePetReaction(pet.id, { tipo }, token).toPromise();
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
        await this.api.postPetReaction(pet.id, { tipo }, token).toPromise();
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
      } else {
        // we attempted to add/switch but failed -> revert changes
        if (prevTipo) {
          pet.reactionTotals[prevTipo] = Number(pet.reactionTotals[prevTipo] ?? 0) + 1;
        }
        pet.reactionTotals[tipo] = Math.max(0, Number(pet.reactionTotals[tipo] ?? 1) - 1);
        if (!prevTipo) pet.likes = Math.max(0, Number(pet.likes ?? 1) - 1);
        pet.userReactionTipo = prevTipo;
        pet.userReacted = !!prevTipo;
      }
    } finally {
      // close picker after action
      this.reactionPickerOpenFor = null;
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
        likes: Number(it.likes ?? it.reacoes_count ?? it.total_reacoes_geral ?? 0),
        // minha_reacao may be null or an object { tipo }
        userReactionTipo: it.minha_reacao?.tipo ?? (it.userReactionTipo ?? it.user_reaction_tipo ?? null),
        userReacted: !!(it.minha_reacao || it.liked || it.liked === true || it.userReacted || it.user_reacted || false),
        // detailed reaction totals (coerce strings to numbers)
        reactionTotals: {
          love: Number(it.total_reacao_love ?? it.total_reacao_love ?? 0),
          haha: Number(it.total_reacao_haha ?? 0),
          sad: Number(it.total_reacao_sad ?? 0),
          angry: Number(it.total_reacao_angry ?? 0)
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
