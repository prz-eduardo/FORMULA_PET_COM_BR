import { Component, EventEmitter, Inject, Input, OnChanges, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { ClienteAreaModalService } from '../../../services/cliente-area-modal.service';

@Component({
  selector: 'app-galeria-post-foto-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria-post-foto-modal.component.html',
  styleUrls: ['./galeria-post-foto-modal.component.scss'],
})
export class GaleriaPostFotoModalComponent implements OnChanges {
  @Input() open = false;
  @Input() embedded = false;
  @Input() initialPets: any[] | null = null;
  @Input() initialClienteId: number | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() posted = new EventEmitter<void>();

  pets: any[] = [];
  private clienteId: number | null = null;
  /** Ordem = pet principal (primeiro) + tags. */
  selectedOrder: number[] = [];
  file: File | null = null;
  loadingPets = false;
  submitting = false;
  fileInputReset = 0;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private clienteAreaModal: ClienteAreaModalService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['open'] && this.open && isPlatformBrowser(this.platformId)) {
      void this.loadPets();
    }
    if (ch['open'] && !this.open) {
      this.resetForm();
    }
  }

  private async loadPets(): Promise<void> {
    if (this.applyInitialPets()) {
      return;
    }
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Sessão expirada. Faça login novamente.');
      this.close();
      return;
    }
    this.loadingPets = true;
    this.pets = [];
    this.clienteId = null;
    try {
      const cid = await this.resolveClienteId(token);
      if (!cid) {
        this.toast.error('Não foi possível identificar o seu cadastro.');
        this.close();
        return;
      }
      this.clienteId = cid;
      const list = await this.api.getPetsByCliente(cid, token).toPromise();
      this.pets = Array.isArray(list) ? list : [];
      this.selectedOrder = [];
      if (!this.pets.length) {
        this.toast.info('Cadastre um pet em Meus Pets para publicar fotos.');
      }
    } catch (error) {
      console.warn('Falha ao carregar pets para postagem na galeria', error);
      this.toast.error('Não foi possível carregar seus pets.');
    } finally {
      this.loadingPets = false;
    }
  }

  private applyInitialPets(): boolean {
    if (!Array.isArray(this.initialPets) || !this.initialPets.length) {
      return false;
    }
    this.pets = [...this.initialPets];
    this.clienteId = this.initialClienteId ?? this.clienteId;
    this.selectedOrder = [];
    this.loadingPets = false;
    return true;
  }

  private async resolveClienteId(token: string): Promise<number | null> {
    const me: any = await this.api.getClienteMe(token).toPromise();
    const cid = Number(me?.user?.id ?? me?.id ?? 0);
    return !isNaN(cid) && cid > 0 ? cid : null;
  }

  isSelected(petId: number): boolean {
    return this.selectedOrder.indexOf(petId) >= 0;
  }

  togglePet(petId: number): void {
    const i = this.selectedOrder.indexOf(petId);
    if (i >= 0) {
      this.selectedOrder = this.selectedOrder.filter((id) => id !== petId);
    } else {
      this.selectedOrder = [...this.selectedOrder, petId];
    }
  }

  resolvePetAvatar(pet: any): string | null {
    try {
      const raw = String(pet?.photoURL || pet?.foto || pet?.photo || pet?.photo_url || '').trim();
      return raw ? this.normalizeImgUrl(raw) : null;
    } catch {
      return null;
    }
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

  petInitials(nome?: string): string {
    const base = String(nome || 'Pet').trim();
    if (!base) return 'P';
    const parts = base.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  petMeta(pet: any): string {
    return String(pet?.raca || pet?.especie || pet?.tipo || '').trim();
  }

  selectionIndex(petId: number): number {
    return this.selectedOrder.indexOf(petId) + 1;
  }

  openNovoPet(): void {
    this.close();
    setTimeout(() => this.clienteAreaModal.open('novo-pet'), 0);
  }

  onFileInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files && input.files[0];
    this.file = f || null;
  }

  fileInputId(): string {
    return `gpf-file-${this.fileInputReset}`;
  }

  fileLabel(): string {
    return this.file?.name || 'Nenhum arquivo escolhido';
  }

  private resetForm(): void {
    this.selectedOrder = [];
    this.file = null;
    this.clienteId = null;
    this.fileInputReset++;
  }

  close(): void {
    this.closeModal.emit();
  }

  orderNames(): string {
    if (!this.selectedOrder.length) return '';
    const byId = new Map(this.pets.map((p) => [p.id, p.nome || `#${p.id}`]));
    return this.selectedOrder.map((id) => byId.get(id) || `#${id}`).join(' → ');
  }

  submit(ev?: Event): void {
    if (ev) ev.preventDefault();
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Faça login para postar.');
      this.close();
      return;
    }
    const cid = this.clienteId;
    if (cid == null) {
      this.toast.error('Sessão inválida.');
      return;
    }
    if (this.selectedOrder.length < 1) {
      this.toast.info('Selecione ao menos um pet que aparece na foto.');
      return;
    }
    if (!this.file) {
      this.toast.info('Escolha uma imagem.');
      return;
    }
    this.submitting = true;
    const fd = new FormData();
    fd.append('foto', this.file, this.file.name);
    fd.append('pet_ids', JSON.stringify(this.selectedOrder));
    this.api.postGaleriaFoto(cid, fd, token).subscribe({
      next: () => {
        this.submitting = false;
        this.toast.success('Foto publicada na galeria com sucesso.');
        this.resetForm();
        this.posted.emit();
        this.close();
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.error || 'Não foi possível enviar a foto.';
        this.toast.error(msg);
      },
    });
  }
}
