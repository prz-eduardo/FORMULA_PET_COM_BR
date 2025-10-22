import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, ClienteMeResponse } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

@Component({
  selector: 'app-meus-pets',
  standalone: true,
  imports: [CommonModule, RouterModule, NavmenuComponent],
  templateUrl: './meus-pets.component.html',
  styleUrls: ['./meus-pets.component.scss']
})
export class MeusPetsComponent implements OnChanges {
  @Input() modal: boolean = false;
  @Output() close = new EventEmitter<void>();
  // Emit when user requests to edit a pet (id or full pet object)
  @Output() editPet = new EventEmitter<string | number>();
  @Input() clienteMe: any | null = null;
  @Input() pets: any[] = [];
  carregando = true;
  // track image loaded state per pet (key by id when available, otherwise by index fallback)
  petImageLoaded: Record<string, boolean> = {};

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  // When edit is requested from a pet card
  onEditClick(pet: any) {
    if (!pet) return;
    const id = pet.id || pet._id || null;
    if (this.modal) {
      // emit so parent modal can open the edit form inside itself
      if (id) this.editPet.emit(id);
    } else {
      // when not in modal, navigate normally to the edit route
      try { (window as any).location.href = '/editar-pet/' + encodeURIComponent(String(id)); } catch { }
    }
  }

  private get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(){
    // If parent passed cliente/pets via @Input, use them and avoid extra API calls
    if (this.clienteMe && Array.isArray(this.pets) && this.pets.length > 0) {
      // initialize image load and allergy state for provided pets
      this.initImageLoadState();
      this.carregando = false;
      return;
    }

    const t = this.token;
    if (!t) { this.carregando = false; return; }

    // If we have cliente but no pets, fetch only pets
    if (this.clienteMe && !this.pets?.length) {
      const id = Number(this.clienteMe?.user?.id || this.clienteMe?.id || 0);
      if (!isNaN(id) && id > 0) {
        this.api.getPetsByCliente(id, t).subscribe({
          next: (res) => { this.pets = res || []; this.initImageLoadState(); this.carregando = false; },
          error: () => { this.toast.error('Erro ao carregar pets'); this.carregando = false; }
        });
        return;
      }
    }

    // Fallback: fetch cliente and pets
    this.api.getClienteMe(t).subscribe({
      next: (me) => {
        this.clienteMe = me;
        const id = Number(me?.user?.id);
        if (!isNaN(id)) {
          this.api.getPetsByCliente(id, t).subscribe({
            next: (res) => { this.pets = res || []; this.initImageLoadState(); this.carregando = false; },
            error: (err) => { this.toast.error('Erro ao carregar pets'); this.carregando = false; }
          });
        } else { this.carregando = false; }
      },
      error: () => { this.carregando = false; }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pets']) {
      // Reinitialize image/allergy state when parent provides or updates the pets list
      this.initImageLoadState();
    }
  }

  voltar(){
    if (this.modal) this.close.emit();
  }

  // Fallback for broken or missing pet images
  onImgError(event: Event){
    const img = event?.target as HTMLImageElement | null;
    if (img) img.src = '/imagens/image.png';
  }

  // Called when an image finishes loading
  onImgLoad(pet: any, index: number) {
    const key = this.imageKey(pet, index);
    this.petImageLoaded[key] = true;
  }

  // Return a normalized list of allergy names for a pet
  alergiasFor(pet: any): string[] {
    if (!pet) return [];
    const out: string[] = [];
    // Primary allergy array (various shapes)
    if (Array.isArray(pet.alergias)) {
      pet.alergias.forEach((a: any) => {
        if (!a) return;
        if (typeof a === 'string') out.push(a);
        else if (typeof a === 'object') out.push(a.nome || a.nome_alergia || a.name || String(a));
      });
    }
    // Predefined allergies from API shape
    if (Array.isArray(pet.alergias_predefinidas)) {
      pet.alergias_predefinidas.forEach((a: any) => {
        if (!a) return;
        out.push(a.nome || a.name || String(a));
      });
    }
    // Deduplicate and filter empties
    return Array.from(new Set(out.filter(Boolean)));
  }

  // Helper to generate a stable key for a pet
  private imageKey(pet: any, index: number) {
    return (pet && (pet.id || pet._id)) ? String(pet.id || pet._id) : `i_${index}`;
  }

  isImageLoaded(pet: any, index: number): boolean {
    const key = this.imageKey(pet, index);
    return !!this.petImageLoaded[key];
  }

  // Initialize tracking state for current pets list
  private initImageLoadState() {
    this.petImageLoaded = {};
    (this.pets || []).forEach((p, idx) => {
      const key = this.imageKey(p, idx);
      // If there's no photo URL, mark as loaded to avoid stuck loader
      if (!p || !p.photoURL) this.petImageLoaded[key] = true;
      else this.petImageLoaded[key] = false;
      // normalize and attach allergy list to pet for easier template binding
      try { p._alergiasNormalized = this.alergiasFor(p); } catch { p._alergiasNormalized = []; }
    });
  }
}
