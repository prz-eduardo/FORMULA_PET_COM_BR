import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { MARCA_NOME } from '../../constants/loja-public';

@Component({
  selector: 'app-pet-perfil-publico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pet-perfil-publico.component.html',
  styleUrls: ['./pet-perfil-publico.component.scss']
})
export class PetPerfilPublicoComponent implements OnInit {
  readonly marca = MARCA_NOME;
  petId: number | null = null;
  data: any = null;
  loading = true;
  error: string | null = null;
  comentarios: any[] = [];
  totalComentarios = 0;
  loadingComentarios = false;
  novoComentario = '';
  sendingComentario = false;
  reactionTypes = [
    { tipo: 'love', emoji: '❤️', label: 'Amei' },
    { tipo: 'haha', emoji: '😂', label: 'Haha' },
    { tipo: 'sad', emoji: '😢', label: 'Triste' },
    { tipo: 'angry', emoji: '😡', label: 'Grr' }
  ];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  get token() {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      this.petId = id ? parseInt(id, 10) : null;
      if (this.petId) this.load();
    });
  }

  load() {
    if (!this.petId) return;
    this.loading = true;
    this.error = null;
    this.api.getPetPerfilPublico(this.petId, this.token || undefined).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this._loadComentarios();
      },
      error: (e) => {
        this.error = e?.error?.error || 'Perfil não disponível.';
        this.loading = false;
      }
    });
  }

  get pet() {
    return this.data?.pet;
  }

  get userReactionTipo() {
    return this.data?.minha_reacao?.tipo ?? null;
  }

  getReactionCount(tipo: string): number {
    const k = `total_reacao_${tipo}` as const;
    return Number((this.data as any)?.[k] ?? 0);
  }

  getTotalReactions(): number {
    return Number(this.data?.total_reacoes_geral ?? 0);
  }

  async onReaction(tipo: string) {
    if (!this.token) {
      this.toast.info('Faça login para reagir.');
      return;
    }
    if (!this.petId) return;
    const prev = this.userReactionTipo;
    const same = prev === tipo;
    try {
      if (same) {
        const res: any = await this.api.deletePetReaction(this.petId, { tipo }, this.token).toPromise();
        this._mergeReactionsFrom(res);
        this.data.minha_reacao = null;
      } else {
        const res: any = await this.api.postPetReaction(this.petId, { tipo }, this.token).toPromise();
        this._mergeReactionsFrom(res);
        this.data.minha_reacao = { tipo: res?.tipo || tipo };
      }
    } catch (e) {
      console.error(e);
      this.toast.error('Não foi possível enviar a reação.');
    }
  }

  private _mergeReactionsFrom(res: any) {
    if (!res || !this.data) return;
    this.data.total_reacoes_geral = Number(res.total_reacoes_geral ?? 0);
    this.data.total_reacao_love = Number(res.total_reacao_love ?? 0);
    this.data.total_reacao_haha = Number(res.total_reacao_haha ?? 0);
    this.data.total_reacao_sad = Number(res.total_reacao_sad ?? 0);
    this.data.total_reacao_angry = Number(res.total_reacao_angry ?? 0);
  }

  private _loadComentarios() {
    if (!this.petId) return;
    this.loadingComentarios = true;
    this.api.getPetComentarios(this.petId, { page: 1, pageSize: 100 }).subscribe({
      next: (r: any) => {
        this.comentarios = Array.isArray(r) ? r : (r?.data || []);
        this.totalComentarios = Number(r?.total ?? this.comentarios.length);
        this.loadingComentarios = false;
      },
      error: () => { this.loadingComentarios = false; }
    });
  }

  async enviarComentario() {
    const t = (this.novoComentario || '').trim();
    if (!t || !this.petId || !this.token) return;
    this.sendingComentario = true;
    try {
      const res: any = await this.api.postPetComentario(this.petId, t, this.token).toPromise();
      if (res?.comentario) this.comentarios = [res.comentario, ...this.comentarios];
      this.totalComentarios = Number(res?.total_comentarios ?? this.totalComentarios + 1);
      this.novoComentario = '';
      this.toast.success('Comentário publicado!');
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Falha ao comentar');
    } finally {
      this.sendingComentario = false;
    }
  }
}
