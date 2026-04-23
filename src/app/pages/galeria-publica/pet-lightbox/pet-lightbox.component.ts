import { Component, EventEmitter, Inject, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

export interface PetLightboxReaction { tipo: string; }

@Component({
  selector: 'app-pet-lightbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pet-lightbox.component.html',
  styleUrls: ['./pet-lightbox.component.scss']
})
export class PetLightboxComponent implements OnChanges, OnDestroy {
  @Input() pet: any = null;
  @Input() isOpen = false;

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
  totalComentarios = 0;
  comentariosError: string | null = null;

  private _escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') this.onClose();
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this._onOpen();
      } else {
        this._onClose();
      }
    } else if (changes['pet'] && this.isOpen) {
      this._loadComentarios();
    }
  }

  ngOnDestroy(): void {
    this._onClose();
  }

  private _onOpen() {
    if (!isPlatformBrowser(this.platformId)) return;
    try { document.body.style.overflow = 'hidden'; } catch {}
    try { document.addEventListener('keydown', this._escHandler); } catch {}
    this.novoComentario = '';
    this.comentariosError = null;
    this._loadComentarios();
  }

  private _onClose() {
    if (!isPlatformBrowser(this.platformId)) return;
    try { document.body.style.overflow = ''; } catch {}
    try { document.removeEventListener('keydown', this._escHandler); } catch {}
  }

  onClose() {
    this.close.emit();
  }

  onOverlayClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (target && target.classList && target.classList.contains('pet-lightbox-overlay')) {
      this.onClose();
    }
  }

  isLogged(): boolean {
    try { return !!this.auth.getToken(); } catch { return false; }
  }

  resolveImage(): string {
    try {
      const raw = this.pet?.foto || this.pet?.photo || this.pet?.photoURL || this.pet?.url || '';
      if (!raw || typeof raw !== 'string') return '/imagens/image.png';
      let url = raw.trim();
      if (url.startsWith('//')) url = (typeof window !== 'undefined' ? window.location.protocol : 'https:') + url;
      if (!/^https?:\/\//i.test(url) && /^[\w\-]+\.[\w\-]+/.test(url)) url = 'https://' + url;
      return url || '/imagens/image.png';
    } catch { return '/imagens/image.png'; }
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
      const totals = this.pet?.reactionTotals || {};
      return Number(totals[tipo] ?? 0);
    } catch { return 0; }
  }

  getTotalReactions(): number {
    return Number(this.pet?.likes ?? 0) || (
      this.getReactionCount('love') + this.getReactionCount('haha') +
      this.getReactionCount('sad') + this.getReactionCount('angry')
    );
  }

  // Top N reactions with count > 0 for the summary bar
  getTopReactions(limit = 3) {
    const list = this.reactionTypes
      .map(r => ({ ...r, count: this.getReactionCount(r.tipo) }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return list;
  }

  onSelectReaction(tipo: string) {
    if (!this.isLogged()) {
      try { this.toast.info('Faça login para reagir às fotos.'); } catch {}
      return;
    }
    this.reactionSelect.emit({ tipo });
  }

  private _loadComentarios() {
    if (!this.pet || !this.pet.id) { this.comentarios = []; this.totalComentarios = 0; return; }
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadingComentarios = true;
    this.comentariosError = null;
    this.api.getPetComentarios(this.pet.id, { page: 1, pageSize: 50 }).subscribe({
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
      const res: any = await this.api.postPetComentario(this.pet.id, texto, token).toPromise();
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
      const res: any = await this.api.deletePetComentario(this.pet.id, c.id, token).toPromise();
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
      // only allow if user is logged; actual server-side check will reject if not allowed
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
