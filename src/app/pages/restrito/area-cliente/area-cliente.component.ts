import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ElementRef, ViewChild, Input, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  @Input() modal: boolean = false;
  @ViewChild('internalHost', { read: ViewContainerRef }) internalHost?: ViewContainerRef;
  @ViewChild('overlayHost', { read: ViewContainerRef }) overlayHost?: ViewContainerRef;
  // Render gating and auth state (storage-based)
  ready = false;
  hasAuth = false;
  titulo = 'Bem-vindo!';
  clienteData: any = null;
  pets: Pet[] = [];
  private sub?: Subscription;

  // Internal navigation state when in modal
  internalView: 'meus-pedidos' | 'meus-pets' | 'novo-pet' | 'perfil' | null = null;

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
  private router: Router,
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

  // ---- Internal modal navigation helpers ----
  async open(view: 'meus-pedidos' | 'meus-pets' | 'novo-pet' | 'consultar-pedidos' | 'loja' | 'perfil') {
    if (!this.modal) {
      // Navigate normally when not in modal
      if (view === 'meus-pedidos') return this.router.navigateByUrl('/meus-pedidos');
      if (view === 'meus-pets') return this.router.navigateByUrl('/meus-pets');
      if (view === 'novo-pet') return this.router.navigateByUrl('/novo-pet');
      if (view === 'perfil') return this.router.navigateByUrl('/editar-perfil');
      if (view === 'loja') return this.router.navigateByUrl('/loja');
      if (view === 'consultar-pedidos') {
        return this.router.navigate([{ outlets: { modal: ['consultar-pedidos'] } }], { relativeTo: this.route });
      }
      return;
    }
    if (view === 'loja') {
      // Close modal entirely and go to loja
      window.location.href = '/loja';
      return;
    }
    if (view === 'consultar-pedidos') {
      this.titulo = 'Histórico de receitas';
      return this.openConsultarPedidosOverlay();
    }
    this.internalView = view as any;
    // Update title by selection
    const titles: Record<string,string> = {
      'meus-pedidos': 'Meus Pedidos',
      'meus-pets': 'Meus Pets',
      'novo-pet': 'Cadastrar Pet',
      'perfil': 'Perfil',
    };
    this.titulo = titles[view] || 'Área do Cliente';
    if (!this.internalHost) return;
    this.internalHost.clear();
    try {
      if (view === 'meus-pedidos') {
        const mod = await import('../../../pages/meus-pedidos/meus-pedidos.component');
        const Cmp = (mod as any).MeusPedidosComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
          if ((ref.instance as any).openStatus) {
            (ref.instance as any).openStatus.subscribe((codigo: string) => {
              this.openConsultarPedidosOverlayWithCode(codigo);
            });
          }
        }
      } else if (view === 'meus-pets') {
        const mod = await import('../../../pages/meus-pets/meus-pets.component');
        const Cmp = (mod as any).MeusPetsComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
        }
      } else if (view === 'novo-pet') {
        const mod = await import('../../../pages/novo-pet/novo-pet.component');
        const Cmp = (mod as any).NovoPetComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
        }
      } else if (view === 'perfil') {
        const mod = await import('../../../pages/perfil/perfil.component');
        const Cmp = (mod as any).PerfilComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          (ref.instance as any).readOnly = true;
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
        }
      }
    } catch (e) {
      console.error('Falha ao abrir view interna', e);
      this.toast.error('Não foi possível abrir agora');
    }
  }

  async openConsultarPedidosOverlay() {
    if (!this.modal) return;
    if (!this.overlayHost) return;
    try {
      const mod = await import('./consultar-pedidos/consultar-pedidos.component');
      const Cmp = (mod as any).ConsultarPedidosComponent;
      this.overlayHost.clear();
      const ref = this.overlayHost.createComponent(Cmp);
      // Mark as embedded modal so it hides own overlay and emits close
      if (ref?.instance) {
        (ref.instance as any).modal = true;
        if ((ref.instance as any).close) {
          (ref.instance as any).close.subscribe(() => this.overlayHost?.clear());
        }
      }
    } catch (e) {
      console.error('Falha ao abrir status do pedido', e);
    }
  }

  async openConsultarPedidosOverlayWithCode(codigo: string) {
    await this.openConsultarPedidosOverlay();
    // Try to pass initial code by setting the input directly
    try {
      const view = this.overlayHost as ViewContainerRef;
      const compRef: any = (view && (view as any)._lView && (view as any)._viewRef) ? null : null; // placeholder: not reliable
    } catch {}
    // As a simpler approach, after component is created, search last created and set property
    try {
      // this.overlayHost?.get would require index; easiest: recreate and set immediately
      if (!this.overlayHost) return;
      this.overlayHost.clear();
      const mod = await import('./consultar-pedidos/consultar-pedidos.component');
      const Cmp = (mod as any).ConsultarPedidosComponent;
      const ref = this.overlayHost.createComponent(Cmp);
      if (ref?.instance) {
        (ref.instance as any).modal = true;
        (ref.instance as any).codigo = (codigo || '').toUpperCase();
        if (typeof (ref.instance as any).consultar === 'function') {
          setTimeout(() => (ref.instance as any).consultar());
        }
        if ((ref.instance as any).close) {
          (ref.instance as any).close.subscribe(() => this.overlayHost?.clear());
        }
      }
    } catch (e) {
      console.error('Falha ao prefilling código do status', e);
    }
  }

  goBack(){
    if (this.overlayHost) {
      try { this.overlayHost.clear(); } catch {}
    }
    if (this.internalHost) {
      try { this.internalHost.clear(); } catch {}
    }
    this.internalView = null;
    this.titulo = 'Bem-vindo!';
  }
}
