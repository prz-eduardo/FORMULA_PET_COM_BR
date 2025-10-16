import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NavmenuComponent } from '../../../navmenu/navmenu.component';
import { LoginClienteComponent } from './login-cliente/login-cliente.component';
import { CrieSuaContaClienteComponent } from './crie-sua-conta-cliente/crie-sua-conta-cliente.component';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
interface Pet {
  id: string;
  nome: string;
  tipo: string;
  photoURL?: string;
}

@Component({
  selector: 'app-area-cliente',
  standalone: true, // <-- importante
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent, LoginClienteComponent, CrieSuaContaClienteComponent], // <-- importa o que usa no template
  templateUrl: './area-cliente.component.html',
  styleUrls: ['./area-cliente.component.scss']
})
export class AreaClienteComponent implements OnInit, OnDestroy {
  // Render gating and auth state (storage-based)
  ready = false;
  hasAuth = false;
  clienteData: any = null;
  pets: Pet[] = [];
  private sub?: Subscription;

  modalLoginAberto = false;
  modalCadastroAberto = false;
  menuAberto = false;

  abrirModalLogin() { this.modalLoginAberto = true; }
  fecharModalLogin() { this.modalLoginAberto = false; }
  abrirModalCadastro() { this.modalCadastroAberto = true; }
  fecharModalCadastro() { this.modalCadastroAberto = false; }

  toggleMenu(event?: Event) {
    if (event) event.stopPropagation();
    this.menuAberto = !this.menuAberto;
  }
  fecharMenu() {
    this.menuAberto = false;
  }

  onLogin() {
    this.hasAuth = !!this.auth.getToken() && !!this.getStoredUserType();
    if (this.hasAuth) this.loadProfile(this.auth.getToken()!);
  }

  logout() {
    this.auth.logout();
    this.hasAuth = false;
    this.clienteData = null;
    this.pets = [];
    if (this.isBrowser) {
      localStorage.removeItem('userType');
      sessionStorage.removeItem('userType');
    }
  }

  private onDocClick = (_e: MouseEvent) => {
    if (this.menuAberto) this.menuAberto = false;
  };

  constructor(
    private toast: ToastService,
    public auth: AuthService,
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('click', this.onDocClick);
    }
  }

  ngOnInit(): void {
    // In SSR, avoid rendering logged-out card to prevent flicker; compute only on browser
    if (!this.isBrowser) {
      this.ready = false;
      return;
    }
    // Check storage synchronously before rendering on client
    const token = this.auth.getToken();
    const utype = this.getStoredUserType();
    this.hasAuth = !!token && !!utype;
    this.ready = true;
    if (this.hasAuth && token) {
      this.loadProfile(token);
    }
  }
  private get isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  private getStoredUserType(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('userType') || sessionStorage.getItem('userType');
  }

  private loadProfile(token: string) {
    // silent load; if it fails, disconnect
    this.api.getClienteMe(token).subscribe({
      next: (res) => {
        if (res && res.user) {
          this.clienteData = res.user;
          // carregar pets em seguida
          const id = Number(res.user.id);
          if (!isNaN(id)) {
            this.api.getPetsByCliente(id, token).subscribe({
              next: (pets) => this.pets = pets || [],
              error: (err) => {
                const msg = (err && err.error && (err.error.message || err.error.error)) || err.message || 'Erro ao buscar pets';
                this.toast.error(msg, 'Erro');
                this.pets = [];
              }
            });
          }
        } else {
          // resposta inesperada
          this.toast.error('Resposta inesperada do servidor', 'Erro');
          this.logout();
        }
      },
      error: (err) => {
        const msg = (err && err.error && (err.error.message || err.error.error)) || err.message || 'Erro ao validar sessão';
        this.toast.error(msg, 'Sessão inválida');
        // desconecta ao falhar validação
        this.logout();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.isBrowser) {
      document.removeEventListener('click', this.onDocClick);
    }
  }

  abrirCadastroPet() {
    this.toast.info('Abrir modal de cadastro de pet');
  }

  verDetalhesPet(pet: Pet) {
    this.toast.info(`Detalhes do pet: ${pet.nome}`);
  }

}
