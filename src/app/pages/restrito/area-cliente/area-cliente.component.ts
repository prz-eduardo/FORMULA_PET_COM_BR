import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NavmenuComponent } from '../../../navmenu/navmenu.component';
import { LoginClienteComponent } from './login-cliente/login-cliente.component';
import { CrieSuaContaClienteComponent } from './crie-sua-conta-cliente/crie-sua-conta-cliente.component';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { StoreService } from '../../../services/store.service';
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
  popoverTop = 0;
  popoverLeft = 0;

  @ViewChild('gearBtn') gearBtn?: ElementRef<HTMLButtonElement>;

  abrirModalLogin() { this.modalLoginAberto = true; }
  fecharModalLogin() { this.modalLoginAberto = false; }
  abrirModalCadastro() { this.modalCadastroAberto = true; }
  fecharModalCadastro() { this.modalCadastroAberto = false; }

  toggleMenu(event?: Event) {
    if (event) event.stopPropagation();
    this.menuAberto = !this.menuAberto;
    if (this.menuAberto) {
      this.positionPopover();
    }
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
    // Limpa a sacola ao sair
    try { this.store.clearCart(); } catch {}
  }

  private onDocClick = (_e: MouseEvent) => {
    if (this.menuAberto) this.menuAberto = false;
  };

  constructor(
    private toast: ToastService,
    public auth: AuthService,
    private api: ApiService,
    private route: ActivatedRoute,
    private el: ElementRef,
    private store: StoreService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('click', this.onDocClick);
    }
  }

  private positionPopover() {
    try {
      const btn = this.gearBtn?.nativeElement;
      if (!btn) { this.popoverTop = 100; this.popoverLeft = 100; return; }
      const rect = btn.getBoundingClientRect();
      // valores aproximados; o container tem padding e pode crescer, usamos clamp no CSS e aqui
      const popW = 240;
      const popH = 160;
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.right + window.scrollX - popW; // alinhar à direita do botão
      const maxLeft = window.scrollX + window.innerWidth - popW - 8;
      const maxTop = window.scrollY + window.innerHeight - popH - 8;
      this.popoverLeft = Math.max(window.scrollX + 8, Math.min(left, maxLeft));
      this.popoverTop = Math.max(window.scrollY + 8, Math.min(top, maxTop));
    } catch {
      this.popoverTop = 100; this.popoverLeft = 100;
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

    // Abrir modais conforme query params
    if (this.isBrowser) {
      this.route.queryParamMap.subscribe(pm => {
        const cadastro = pm.get('cadastro');
        const login = pm.get('login');
        if (cadastro === '1') {
          this.modalCadastroAberto = true;
          this.modalLoginAberto = false;
        } else if (login === '1') {
          this.modalLoginAberto = true;
          this.modalCadastroAberto = false;
        }
      });
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
