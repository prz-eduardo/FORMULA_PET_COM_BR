import { Component, EventEmitter, Inject, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { MARCA_NOME } from '../../../constants/loja-public';

export interface PetLightboxReaction { tipo: string; }

/** Estado da foto visível (galeria v2) — não mistura com o cartão quando slide !== 0 */
interface ImagemEngState {
  userReactionTipo: string | null;
  likes: number;
  reactionTotals: Record<string, number>;
  totalComentarios: number;
}

@Component({
  selector: 'app-pet-lightbox',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pet-lightbox.component.html',
  styleUrls: ['./pet-lightbox.component.scss']
})
export class PetLightboxComponent implements OnChanges, OnDestroy {
  @Input() pet: any = null;
  @Input() isOpen = false;
  @Input() inlineMode = false;

  @Output() close = new EventEmitter<void>();
  @Output() reactionSelect = new EventEmitter<PetLightboxReaction>();

  reactionTypes = [
    { tipo: 'love', emoji: '❤️', label: 'Amei' },
    { tipo: 'haha', emoji: '😂', label: 'Haha' },
    { tipo: 'sad', emoji: '😢', label: 'Triste' },
    { tipo: 'angry', emoji: '😡', label: 'Grr' }
  ];

  comentarios: any[] = [];
  loadingComentarios = false;
  sendingComentario = false;
  novoComentario = '';
  commentsExpanded = false;
  totalComentarios = 0;
  comentariosError: string | null = null;
  lightboxImgIndex = 0;
  /** Reações e totais da foto visível (v2) */
  imagemState: ImagemEngState = { userReactionTipo: null, likes: 0, reactionTotals: { love: 0, haha: 0, sad: 0, angry: 0 }, totalComentarios: 0 };
  private pointerStartX: number | null = null;
  private pointerStartY: number | null = null;
  private pointerId: number | null = null;
  private readonly swipeThresholdPx = 52;

  private _escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') this.onClose();
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  galeriaFotoV2(): boolean {
    return !!(this.pet && (this.pet.kind === 'photo' || this.pet.kind === 'collection') && this.pet.pet_id);
  }

  private _initImagemStateFromPet() {
    const p = this.pet;
    const m = p?.minha_reacao;
    this.imagemState = {
      userReactionTipo: p?.userReactionTipo ?? m?.tipo ?? null,
      likes: Number(p?.likes ?? p?.total_reacoes_geral ?? 0),
      reactionTotals: {
        love: Number(p?.reactionTotals?.love ?? p?.total_reacao_love ?? 0),
        haha: Number(p?.reactionTotals?.haha ?? p?.total_reacao_haha ?? 0),
        sad: Number(p?.reactionTotals?.sad ?? p?.total_reacao_sad ?? 0),
        angry: Number(p?.reactionTotals?.angry ?? p?.total_reacao_angry ?? 0)
      },
      totalComentarios: Number(p?.total_comentarios ?? 0)
    };
  }

  activeImagemId(): number | null {
    if (!this.pet) return null;
    if (this.pet.kind === 'photo') {
      return this.pet.pet_imagem_id != null ? Number(this.pet.pet_imagem_id) : null;
    }
    if (this.pet.kind === 'collection') {
      const ft = this.pet.fotos;
      if (Array.isArray(ft) && ft[this.lightboxImgIndex]) {
        return Number(ft[this.lightboxImgIndex].id);
      }
    }
    return this.pet.pet_imagem_id != null ? Number(this.pet.pet_imagem_id) : null;
  }

  private _applyEngajamentoRes(res: any) {
    if (!res) return;
    const rt = res.reactionTotals || (res ? {
      love: Number(res.total_reacao_love ?? 0),
      haha: Number(res.total_reacao_haha ?? 0),
      sad: Number(res.total_reacao_sad ?? 0),
      angry: Number(res.total_reacao_angry ?? 0)
    } : { love: 0, haha: 0, sad: 0, angry: 0 });
    this.imagemState = {
      userReactionTipo: res.minha_reacao ? (res.minha_reacao.tipo ?? null) : null,
      likes: Number(res.likes ?? res.total_reacoes_geral ?? 0),
      reactionTotals: {
        love: Number(rt.love ?? 0),
        haha: Number(rt.haha ?? 0),
        sad: Number(rt.sad ?? 0),
        angry: Number(rt.angry ?? 0)
      },
      totalComentarios: Number(res.total_comentarios ?? this.imagemState?.totalComentarios ?? 0)
    };
  }

  private _syncCardIfCover() {
    if (this.galeriaFotoV2() && this.pet && this.lightboxImgIndex === 0) {
      this.pet.likes = this.imagemState.likes;
      this.pet.reactionTotals = { ...this.imagemState.reactionTotals };
      this.pet.userReactionTipo = this.imagemState.userReactionTipo;
      this.pet.minha_reacao = this.imagemState.userReactionTipo
        ? { tipo: this.imagemState.userReactionTipo }
        : null;
      this.pet.total_comentarios = this.imagemState.totalComentarios;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this._onOpen();
      } else {
        this._onClose();
      }
    } else if (changes['pet'] && this.isOpen) {
      this.commentsExpanded = false;
      if (this.galeriaFotoV2()) {
        this._loadSlideFoto();
      } else {
        this._loadComentarios();
      }
    }
  }

  ngOnDestroy(): void {
    this._onClose();
  }

  private _onOpen() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.inlineMode) {
      try { document.body.style.overflow = 'hidden'; } catch {}
      try { document.addEventListener('keydown', this._escHandler); } catch {}
    }
    this.novoComentario = '';
    this.commentsExpanded = false;
    this.comentariosError = null;
    this.lightboxImgIndex = 0;
    if (this.galeriaFotoV2()) {
      this._initImagemStateFromPet();
      this._loadSlideFoto();
    } else {
      this._loadComentarios();
    }
  }

  private _onClose() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.inlineMode) {
      try { document.body.style.overflow = ''; } catch {}
      try { document.removeEventListener('keydown', this._escHandler); } catch {}
    }
    this._resetPointerSwipe();
  }

  onClose() {
    this.close.emit();
  }

  onOverlayClick(ev: MouseEvent) {
    if (this.inlineMode) return;
    const target = ev.target as HTMLElement;
    if (target && target.classList && target.classList.contains('pet-lightbox-overlay')) {
      this.onClose();
    }
  }

  getGaleriaShareUrl(): string {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return '';
    return `${window.location.origin}/galeria`;
  }

  getPetPerfilPath(): string {
    if (!this.pet?.pet_id) return '/galeria';
    return `/galeria/pet/${this.pet.pet_id}`;
  }

  getPetShareText(): string {
    const nome = (this.pet?.nome || this.pet?.name || 'este pet').toString();
    return `Conheça o ${nome} na galeria da comunidade ${MARCA_NOME}!`;
  }

  getPetShareMessage(): string {
    const u = this.getGaleriaShareUrl();
    return u ? `${this.getPetShareText()}\n${u}` : this.getPetShareText();
  }

  async copyPetShare(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const text = this.getPetShareMessage();
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

  openWhatsAppPetShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `https://wa.me/?text=${encodeURIComponent(this.getPetShareMessage())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openFacebookPetShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const u = this.getGaleriaShareUrl();
    if (!u) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async shareThisPet(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const nome = (this.pet?.nome || this.pet?.name || 'Pet').toString();
    const title = `${MARCA_NOME} — ${nome}`;
    const text = this.getPetShareText();
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
    await this.copyPetShare();
  }

  isLogged(): boolean {
    try { return !!this.auth.getToken(); } catch { return false; }
  }

  getGalleryUrls(): string[] {
    const p = this.pet;
    if (!p) return [];
    if (p.kind === 'photo') {
      const u = (Array.isArray(p.galeria_urls) && p.galeria_urls[0]) || p.foto || p.photo || '';
      const s = typeof u === 'string' ? u.trim() : '';
      return s ? [s] : [];
    }
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
  }

  showCarouselNav(): boolean {
    if (!this.pet) return false;
    if (this.pet.kind === 'photo') return false;
    if (this.pet.kind === 'collection') {
      return this.getGalleryUrls().length > 1;
    }
    return this.getGalleryUrls().length > 1;
  }

  lbDots(): number[] {
    if (!this.showCarouselNav()) return [];
    const n = this.getGalleryUrls().length;
    return n > 1 ? Array.from({ length: n }, (_, i) => i) : [];
  }

  resolveImage(): string {
    try {
      const urls = this.getGalleryUrls();
      const idx = Math.min(Math.max(0, this.lightboxImgIndex), Math.max(0, urls.length - 1));
      const raw = urls[idx] || urls[0] || '';
      return this.api.resolveMediaUrl(raw);
    } catch { return '/imagens/image.png'; }
  }

  prevLb(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.goPrevSlide();
  }

  nextLb(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.goNextSlide();
  }

  private goPrevSlide() {
    const urls = this.getGalleryUrls();
    if (urls.length < 2) return;
    let i = this.lightboxImgIndex - 1;
    if (i < 0) i = urls.length - 1;
    this.lightboxImgIndex = i;
    this._afterSlideChange();
  }

  private goNextSlide() {
    const urls = this.getGalleryUrls();
    if (urls.length < 2) return;
    let i = this.lightboxImgIndex + 1;
    if (i >= urls.length) i = 0;
    this.lightboxImgIndex = i;
    this._afterSlideChange();
  }

  goLb(i: number, ev?: Event) {
    if (ev) ev.stopPropagation();
    this.lightboxImgIndex = i;
    this._afterSlideChange();
  }

  toggleComments() {
    this.commentsExpanded = !this.commentsExpanded;
  }

  onMediaPointerDown(ev: PointerEvent) {
    if (!this.showCarouselNav()) return;
    if (!this.isSwipeCandidateTarget(ev.target)) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    this.pointerId = ev.pointerId;
    this.pointerStartX = ev.clientX;
    this.pointerStartY = ev.clientY;
  }

  onMediaPointerUp(ev: PointerEvent) {
    if (!this.showCarouselNav()) {
      this._resetPointerSwipe();
      return;
    }
    if (this.pointerId == null || ev.pointerId !== this.pointerId || this.pointerStartX == null || this.pointerStartY == null) {
      return;
    }
    const dx = ev.clientX - this.pointerStartX;
    const dy = ev.clientY - this.pointerStartY;
    if (Math.abs(dx) >= this.swipeThresholdPx && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) this.goNextSlide();
      else this.goPrevSlide();
    }
    this._resetPointerSwipe();
  }

  onMediaPointerCancel() {
    this._resetPointerSwipe();
  }

  onMediaWheel(ev: WheelEvent) {
    if (!this.showCarouselNav()) return;
    const ax = Math.abs(ev.deltaX);
    const ay = Math.abs(ev.deltaY);
    if (ax < 18 || ax <= ay) return;
    ev.preventDefault();
    if (ev.deltaX > 0) this.goNextSlide();
    else this.goPrevSlide();
  }

  private isSwipeCandidateTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return true;
    return !target.closest('button, a, textarea, input, [data-no-swipe]');
  }

  private _resetPointerSwipe() {
    this.pointerId = null;
    this.pointerStartX = null;
    this.pointerStartY = null;
  }

  private _afterSlideChange() {
    if (this.galeriaFotoV2()) {
      this._loadSlideFoto();
    }
  }

  private async _loadSlideFoto() {
    if (!isPlatformBrowser(this.platformId) || !this.pet) return;
    const iid = this.activeImagemId();
    if (!iid) return;
    this.loadingComentarios = true;
    this.comentariosError = null;
    const token = this.auth.getToken() || undefined;
    try {
      const [eng, com] = await Promise.all([
        this.api.getFotoEngajamento(iid, token).toPromise() as Promise<any>,
        this.api.getFotoComentarios(iid, { page: 1, pageSize: 50 }).toPromise() as Promise<any>
      ]);
      this._applyEngajamentoRes(eng);
      this._syncCardIfCover();
      const data = Array.isArray(com) ? com : (com?.data || []);
      this.comentarios = data || [];
      this.totalComentarios = Number(eng?.total_comentarios ?? com?.total ?? this.comentarios.length);
    } catch (e) {
      console.warn('load slide foto', e);
      this.comentariosError = 'Não foi possível carregar os dados desta foto.';
    } finally {
      this.loadingComentarios = false;
    }
  }

  onImgError(ev: Event) {
    try {
      const el = ev.target as HTMLImageElement;
      if (el && el.src && el.src.indexOf('/imagens/image.png') === -1) el.src = '/imagens/image.png';
    } catch {}
  }

  getReactionEmoji(tipo: string): string {
    const r = this.reactionTypes.find(x => x.tipo === tipo);
    return r ? r.emoji : '❤️';
  }

  getReactionCount(tipo: string): number {
    try {
      if (this.galeriaFotoV2()) {
        return Number(this.imagemState.reactionTotals[tipo] ?? 0);
      }
      const totals = this.pet?.reactionTotals || {};
      return Number(totals[tipo] ?? 0);
    } catch { return 0; }
  }

  getTotalReactions(): number {
    if (this.galeriaFotoV2()) {
      return Number(this.imagemState.likes ?? 0) || (
        this.getReactionCount('love') + this.getReactionCount('haha') +
        this.getReactionCount('sad') + this.getReactionCount('angry')
      );
    }
    return Number(this.pet?.likes ?? 0) || (
      this.getReactionCount('love') + this.getReactionCount('haha') +
      this.getReactionCount('sad') + this.getReactionCount('angry')
    );
  }

  get userReactionForUi(): string | null {
    if (this.galeriaFotoV2()) {
      return this.imagemState.userReactionTipo;
    }
    return this.pet?.userReactionTipo ?? this.pet?.minha_reacao?.tipo ?? null;
  }

  getTopReactions(limit = 3) {
    const list = this.reactionTypes
      .map(r => ({ ...r, count: this.getReactionCount(r.tipo) }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return list;
  }

  async onSelectReaction(tipo: string) {
    if (!this.isLogged()) {
      try { this.toast.info('Faça login para reagir às fotos.'); } catch {}
      return;
    }
    if (this.galeriaFotoV2()) {
      const iid = this.activeImagemId();
      if (!iid) return;
      const token = this.auth.getToken();
      if (!token) return;
      const prev = this.userReactionForUi;
      const same = prev === tipo;
      try {
        if (same) {
          const res: any = await this.api.deleteFotoReacao(iid, { tipo }, token).toPromise();
          this._applyEngajamentoRes(
            { ...res, minha_reacao: null, total_comentarios: this.imagemState.totalComentarios, reactionTotals: res?.reactionTotals }
          );
        } else {
          const res: any = await this.api.postFotoReacao(iid, { tipo }, token).toPromise();
          this._applyEngajamentoRes(res);
        }
        this._syncCardIfCover();
      } catch (err) {
        console.error(err);
        this.toast.error('Não foi possível enviar a reação.');
      }
      return;
    }
    this.reactionSelect.emit({ tipo });
  }

  private _loadComentarios() {
    if (!this.pet) { this.comentarios = []; this.totalComentarios = 0; return; }
    const petId = this.pet.pet_id ?? this.pet.id;
    if (petId == null || petId === '') { this.comentarios = []; this.totalComentarios = 0; return; }
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadingComentarios = true;
    this.comentariosError = null;
    this.api.getPetComentarios(petId, { page: 1, pageSize: 50 }).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res?.data || []);
        this.comentarios = data || [];
        this.totalComentarios = Number(res?.total ?? this.comentarios.length);
        if (this.pet) this.pet.total_comentarios = this.totalComentarios;
        this.loadingComentarios = false;
      },
      error: (err) => {
        console.warn('Erro ao carregar comentários', err);
        this.comentariosError = 'Não foi possível carregar os comentários.';
        this.loadingComentarios = false;
      }
    });
  }

  async enviarComentario() {
    const texto = (this.novoComentario || '').trim();
    if (!texto) return;
    if (texto.length > 500) {
      try { this.toast.error('Comentário muito longo (máx 500 caracteres).'); } catch {}
      return;
    }
    const token = this.auth.getToken();
    if (!token) {
      try { this.toast.info('Faça login para comentar.'); } catch {}
      return;
    }
    this.sendingComentario = true;
    try {
      if (this.galeriaFotoV2()) {
        const iid = this.activeImagemId();
        if (!iid) return;
        const res: any = await this.api.postFotoComentario(iid, texto, token).toPromise();
        if (res && res.comentario) {
          this.comentarios = [res.comentario, ...this.comentarios];
        }
        this.totalComentarios = Number(res?.total_comentarios ?? (this.totalComentarios + 1));
        this.imagemState.totalComentarios = this.totalComentarios;
        this._syncCardIfCover();
        this.novoComentario = '';
        this.toast.success('Comentário publicado!');
        return;
      }
      const petId = this.pet.pet_id ?? this.pet.id;
      const res: any = await this.api.postPetComentario(petId, texto, token).toPromise();
      if (res && res.comentario) {
        this.comentarios = [res.comentario, ...this.comentarios];
      }
      if (res && typeof res.total_comentarios === 'number') {
        this.totalComentarios = Number(res.total_comentarios);
      } else {
        this.totalComentarios = (this.totalComentarios || 0) + 1;
      }
      if (this.pet) this.pet.total_comentarios = this.totalComentarios;
      this.novoComentario = '';
      try { this.toast.success('Comentário publicado!'); } catch {}
    } catch (err: any) {
      console.error('Erro ao enviar comentário', err);
      const msg = err?.error?.error || 'Não foi possível enviar seu comentário.';
      try { this.toast.error(msg); } catch {}
    } finally {
      this.sendingComentario = false;
    }
  }

  async removerComentario(c: any) {
    if (!c || !c.id) return;
    const token = this.auth.getToken();
    if (!token) return;
    if (!confirm('Remover este comentário?')) return;
    try {
      if (this.galeriaFotoV2()) {
        const iid = this.activeImagemId();
        if (!iid) return;
        const res: any = await this.api.deleteFotoComentario(iid, c.id, token).toPromise();
        this.comentarios = this.comentarios.filter(x => x.id !== c.id);
        this.totalComentarios = Number(res?.total_comentarios ?? Math.max(0, (this.totalComentarios || 0) - 1));
        this.imagemState.totalComentarios = this.totalComentarios;
        this._syncCardIfCover();
        return;
      }
      const petId = this.pet.pet_id ?? this.pet.id;
      const res: any = await this.api.deletePetComentario(petId, c.id, token).toPromise();
      this.comentarios = this.comentarios.filter(x => x.id !== c.id);
      if (res && typeof res.total_comentarios === 'number') {
        this.totalComentarios = Number(res.total_comentarios);
      } else {
        this.totalComentarios = Math.max(0, (this.totalComentarios || 0) - 1);
      }
      if (this.pet) this.pet.total_comentarios = this.totalComentarios;
    } catch (err) {
      console.error('Erro ao remover comentário', err);
      try { this.toast.error('Não foi possível remover o comentário.'); } catch {}
    }
  }

  canDeleteComment(c: any): boolean {
    try {
      return this.isLogged();
    } catch { return false; }
  }

  typeEmoji(tipo?: string) {
    if (!tipo) return '🐾';
    const t = (tipo || '').toLowerCase();
    if (t.includes('cach') || t.includes('dog') || t.includes('cao') || t.includes('cão')) return '🐶';
    if (t.includes('gat') || t.includes('cat')) return '🐱';
    if (t.includes('ave') || t.includes('bird') || t.includes('pássar') || t.includes('passar')) return '🐦';
    return '🐾';
  }

  formatDate(d: any): string {
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const now = new Date();
      const diff = Math.floor((now.getTime() - dt.getTime()) / 1000);
      if (diff < 60) return 'agora';
      if (diff < 3600) return `${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d`;
      return dt.toLocaleDateString('pt-BR');
    } catch { return ''; }
  }

  trackComentario = (_: number, c: any) => c?.id ?? _;
  trackReaction = (_: number, r: any) => r?.tipo ?? _;
}
