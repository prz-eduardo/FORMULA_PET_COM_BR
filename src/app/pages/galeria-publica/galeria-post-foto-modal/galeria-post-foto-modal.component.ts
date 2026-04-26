import { Component, EventEmitter, Inject, Input, OnChanges, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-galeria-post-foto-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria-post-foto-modal.component.html',
  styleUrls: ['./galeria-post-foto-modal.component.scss'],
})
export class GaleriaPostFotoModalComponent implements OnChanges {
  @Input() open = false;
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
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['open'] && this.open && isPlatformBrowser(this.platformId)) {
      this.loadPets();
    }
    if (ch['open'] && !this.open) {
      this.resetForm();
    }
  }

  private loadPets(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Sessão expirada. Faça login novamente.');
      this.close();
      return;
    }
    this.loadingPets = true;
    this.pets = [];
    this.clienteId = null;
    this.api.getClienteMe(token).subscribe({
      next: (me) => {
        const cid = Number((me as any)?.user?.id ?? (me as any)?.id);
        if (isNaN(cid) || cid <= 0) {
          this.loadingPets = false;
          this.toast.error('Não foi possível identificar o seu cadastro.');
          this.close();
          return;
        }
        this.clienteId = cid;
        this.api.getPetsByCliente(cid, token).subscribe({
          next: (list) => {
            this.pets = list || [];
            this.selectedOrder = [];
            this.loadingPets = false;
            if (!this.pets.length) {
              this.toast.info('Cadastre um pet em Meus Pets para publicar fotos.');
            }
          },
          error: () => {
            this.loadingPets = false;
            this.toast.error('Não foi possível carregar seus pets.');
          },
        });
      },
      error: () => {
        this.loadingPets = false;
        this.toast.error('Não foi possível carregar o perfil.');
      },
    });
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

  onFileInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files && input.files[0];
    this.file = f || null;
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
        this.toast.success('Foto enviada! Ela pode aparecer na galeria após moderação.');
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
