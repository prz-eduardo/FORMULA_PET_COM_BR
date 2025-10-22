import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter } from '@angular/core';
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
export class MeusPetsComponent {
  @Input() modal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Input() clienteMe: any | null = null;
  @Input() pets: any[] = [];
  carregando = true;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  private get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(){
    // If parent passed cliente/pets via @Input, use them and avoid extra API calls
    if (this.clienteMe && Array.isArray(this.pets) && this.pets.length > 0) {
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
          next: (res) => { this.pets = res || []; this.carregando = false; },
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
            next: (res) => { this.pets = res || []; this.carregando = false; },
            error: (err) => { this.toast.error('Erro ao carregar pets'); this.carregando = false; }
          });
        } else { this.carregando = false; }
      },
      error: () => { this.carregando = false; }
    });
  }

  voltar(){
    if (this.modal) this.close.emit();
  }

  // Fallback for broken or missing pet images
  onImgError(event: Event){
    const img = event?.target as HTMLImageElement | null;
    if (img) img.src = '/imagens/image.png';
  }
}
