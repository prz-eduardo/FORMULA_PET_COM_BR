import { Component, Inject, PLATFORM_ID } from '@angular/core';
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
  clienteMe: ClienteMeResponse | null = null;
  pets: any[] = [];
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
    const t = this.token;
    if (!t) { this.carregando = false; return; }
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
}
