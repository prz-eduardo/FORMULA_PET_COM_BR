import { Component, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnDestroy, ViewChild, ViewContainerRef, ElementRef, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { StoreService } from '../services/store.service';
import { AuthService } from '../services/auth.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [RouterLink, CommonModule], // precisa pro [routerLink] e *ngIf
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss']
})
export class NavmenuComponent implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Retorna true se a rota atual for uma das que devem ocultar o ícone do menu
   */
  isMenuHiddenOnRoute(): boolean {
    return (
      this.currentRoute.includes('/mapa') ||
      this.currentRoute.includes('/galeria') ||
      this.currentRoute.includes('/loja') ||
      this.currentRoute.includes('/carrinho')
    );
  }
  toggleMenu(): void {
    const menu: HTMLElement | null = document.querySelector('.menu');
    const iconMenu: HTMLElement | null = document.querySelector('.icon-menu');
    if (menu && iconMenu) {
      this.openMenu(menu, iconMenu);
    }
  }
  user: any = null;
  userFoto: string | null = null;
  previousScroll: number = 0;
  isVisible = true;
  currentRoute: string = '';
  useGaleriaSvg = false;
  cartCount = 0;
  menuOpen = false;
  isCliente = false;
  showFullMenu = true;
  showClienteModal = false;
  clienteLoading = false;
  @ViewChild('clienteHost', { read: ViewContainerRef }) clienteHost?: ViewContainerRef;
  @ViewChild('userBtn', { read: ElementRef }) userBtn?: ElementRef<HTMLButtonElement>;
  private idleTimer: any = null;
  private readonly idleTimeoutMs = 5000; // 5s sem scroll
  private metaballsPaused = false;
  private menuScrollTop: number | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private router: Router, private store: StoreService, private auth: AuthService) {}

  ngOnInit(): void {
    // Rota atual e modo do menu devem ser definidos antes da primeira verificação de mudanças
    this.currentRoute = this.router.url;
    this.updateMenuMode();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.urlAfterRedirects;
        this.updateMenuMode();
      });

    // Assina carrinho para badge
    this.store.cart$.subscribe(items => {
      this.cartCount = items.reduce((n, it) => n + it.quantity, 0);
    });

    // Detecta sessão de cliente e busca dados do usuário apenas se necessário
    this.isCliente = false;
    this.user = null;
    this.userFoto = null;
    let localUserLoaded = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = localStorage.getItem('cliente_me');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          this.user = userObj;
          this.userFoto = userObj?.user?.foto || null;
          localUserLoaded = true;
        } catch {}
      }
    }
    this.store.isClienteLoggedSilent()
      .then(ok => {
        this.isCliente = ok;
        // Só busca do backend se não tiver no localStorage
        if (ok && !localUserLoaded) {
          this.store.getClienteMe().then(u => {
            this.user = u;
            this.userFoto = u?.foto || null;
            if (typeof window !== 'undefined' && window.localStorage && u) {
              localStorage.setItem('cliente_me', JSON.stringify(u));
            }
          }).catch(() => {
            this.user = null;
            this.userFoto = null;
          });
        }
      })
      .catch(() => {
        this.isCliente = false;
        this.user = null;
        this.userFoto = null;
      });
    // Cross-sync: atualiza ícones/estado quando login/logout ocorrer em qualquer lugar
    this.auth.isLoggedIn$.subscribe(async ok => {
      if (ok) {
        this.isCliente = await this.store.isClienteLoggedSilent().catch(() => false);
        let localUserLoaded = false;
        if (typeof window !== 'undefined' && window.localStorage) {
          const userStr = localStorage.getItem('cliente_me');
          if (userStr) {
            try {
              const userObj = JSON.parse(userStr);
              this.user = userObj;
              this.userFoto = userObj?.user?.foto || null;
              localUserLoaded = true;
            } catch {}
          }
        }
        if (this.isCliente && !localUserLoaded) {
          this.store.getClienteMe().then(u => {
            this.user = u;
            this.userFoto = u?.foto || null;
            if (typeof window !== 'undefined' && window.localStorage && u) {
              localStorage.setItem('cliente_me', JSON.stringify(u));
            }
          }).catch(() => {
            this.user = null;
            this.userFoto = null;
          });
        }
      } else {
        this.isCliente = false;
        this.user = null;
        this.userFoto = null;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('cliente_me');
        }
      }
    });
  }

  // Função para forçar atualização dos dados do cliente e localStorage
  async atualizarClienteMe() {
    if (this.isCliente) {
      try {
        const u = await this.store.getClienteMe();
        this.user = u;
        this.userFoto = u?.foto || null;
        if (typeof window !== 'undefined' && window.localStorage && u) {
          localStorage.setItem('cliente_me', JSON.stringify(u));
        }
      } catch {
        this.user = null;
        this.userFoto = null;
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const iconMenu: HTMLElement | null = document.querySelector('.icon-menu');
      const menu: HTMLElement | null = document.querySelector('.menu');
      const menuLink: NodeListOf<HTMLElement> = document.querySelectorAll('.menu-link.sub');

      if (iconMenu && menu) {
        iconMenu.addEventListener('click', this.openMenu.bind(this, menu, iconMenu));
        menuLink.forEach((el) => {
          el.addEventListener('click', this.openSubmenu);
        });
      }

      // Initialize metaballs animation behind logo (scoped to logo-container)
      this.initMetaBalls();

      // Inicia o timer de inatividade (sem scroll) para auto-ocultar a navbar
      this.resetIdleTimer();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      const currentScroll = window.scrollY;
      // Mostra ao rolar para cima ou quando está no topo; esconde ao rolar para baixo
      this.isVisible = currentScroll < this.previousScroll || currentScroll <= 0;
      this.previousScroll = currentScroll;
      // Reinicia o timer de ociosidade sempre que houver scroll
      this.resetIdleTimer();
    }
  }

  private updateMenuMode() {
    // Menu completo na home (ancora #0) e na área vet; nas demais páginas, ícone que abre modal
    // Considera URLs com hash (#0) e rotas /area-vet
    const url = this.currentRoute || '';
    const isHomeHash = isPlatformBrowser(this.platformId) && (window.location.hash === '#0' || window.location.hash === '#');
    const isAreaVet = url.includes('/area-vet');
    const isHomeRoute = url === '/' || url.startsWith('/#') || url.includes('index.html');
    this.showFullMenu = isAreaVet || isHomeHash || isHomeRoute;
  }

  async abrirClienteModal() {
    this.showClienteModal = true;
    this.clienteLoading = true;
    // Prepare animation origin based on user button position
    requestAnimationFrame(() => {
      try {
        const btn = this.userBtn?.nativeElement;
        const modal = document.querySelector('.cliente-modal') as HTMLElement | null;
        if (btn && modal) {
          const br = btn.getBoundingClientRect();
          const mr = modal.getBoundingClientRect();
          // Compute relative origin inside modal box (0-1)
          const ox = (br.left + br.width / 2 - mr.left) / Math.max(mr.width, 1);
          const oy = (br.top + br.height / 2 - mr.top) / Math.max(mr.height, 1);
          modal.style.setProperty('--origin-x', `${Math.min(Math.max(ox, 0), 1)}`);
          modal.style.setProperty('--origin-y', `${Math.min(Math.max(oy, 0), 1)}`);
          modal.classList.add('anim-enter');
          // clean-up the class after animation
          setTimeout(() => modal.classList.remove('anim-enter'), 450);
        }
      } catch {}
    });
    // Carrega AreaCliente de forma dinâmica para evitar dependência circular
    try {
      // Aguarda o container do modal estar na tela
      setTimeout(async () => {
        if (!this.clienteHost) return;
        this.clienteHost.clear();
        const mod = await import('../pages/restrito/area-cliente/area-cliente.component');
        const Cmp = (mod as any).AreaClienteComponent;
        if (Cmp) {
          const ref = this.clienteHost.createComponent(Cmp);
          if (ref?.instance) {
            (ref.instance as any).modal = true;
          }
          // Quando o conteúdo for resolvido/renderizado, removemos o loader em um próximo tick
          setTimeout(() => { this.clienteLoading = false; }, 0);
        }
      });
    } catch (e) {
      console.error('Falha ao carregar Área do Cliente', e);
      this.clienteLoading = false;
    }
  }
  fecharClienteModal() {
    try {
      const modal = document.querySelector('.cliente-modal') as HTMLElement | null;
      const overlay = document.querySelector('.cliente-overlay') as HTMLElement | null;
      if (modal) {
        modal.classList.add('anim-exit');
        if (overlay) overlay.classList.add('anim-exit');
        setTimeout(() => {
          modal.classList.remove('anim-exit');
          if (overlay) overlay.classList.remove('anim-exit');
          this.showClienteModal = false;
          this.clienteLoading = false;
          try { this.clienteHost?.clear(); } catch {}
        }, 320);
        return;
      }
    } catch {}
    this.showClienteModal = false;
    this.clienteLoading = false;
    try { this.clienteHost?.clear(); } catch {}
  }

  ngOnDestroy(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  private resetIdleTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.menuOpen) return; // não oculta se o menu estiver aberto
    const currentScroll = window.scrollY || 0;
    // Nunca oculte quando estiver no topo da página
    if (currentScroll <= 0){
      this.isVisible = true;
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.isVisible = false;
    }, this.idleTimeoutMs);
  }

  private openMenu(menu: HTMLElement, iconMenu: HTMLElement): void {
    if (!menu) return;
    if (menu.classList.contains('open')) {
      menu.classList.add('close');
      iconMenu.classList.remove('icon-closed');
      this.menuOpen = false;
      try {
        // restore body/html scroll
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        // restore fixed positioning if we set it
        if (document.body.style.position === 'fixed') {
          const prev = this.menuScrollTop || 0;
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.width = '';
          window.scrollTo(0, prev);
        }
        this.menuScrollTop = null;
      } catch {}
      // Resume metaballs when menu is closed
      this.metaballsPaused = false;
      setTimeout(() => menu.classList.remove('open'), 1300);
    } else {
      menu.classList.remove('close');
      menu.classList.add('open');
      iconMenu.classList.add('icon-closed');
      this.menuOpen = true;
  // Garante visibilidade enquanto o menu está aberto
  this.isVisible = true;
  if (this.idleTimer) clearTimeout(this.idleTimer);
      try {
        // freeze background scroll: hide overflow on html/body and lock body position
        this.menuScrollTop = window.scrollY || window.pageYOffset || 0;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        // lock body positioning to avoid content jump
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.menuScrollTop}px`;
        document.body.style.width = '100%';
      } catch {}
      // Pause metaballs while menu is open to reduce paint/layout work
      this.metaballsPaused = true;
    }
  }

  closeMenu(): void {
    const menu: HTMLElement | null = document.querySelector('.menu');
    const iconMenu: HTMLElement | null = document.querySelector('.icon-menu');
    if (menu && iconMenu && menu.classList.contains('open')) {
      this.openMenu(menu, iconMenu);
    }
    // Reinicia o timer de ocultar após fechar o menu
    this.menuOpen = false;
    this.resetIdleTimer();
  }

  private openSubmenu(event: MouseEvent): void {
    const currentTarget = event.currentTarget as HTMLElement;
    currentTarget.classList.toggle('active');
  }

  // --- Metaballs (adapted from provided snippet) ---
  private initMetaBalls(): void {
  const wrapper = document.querySelector('.logo-container #wrapper') as HTMLElement | null;
  if (!wrapper) return;
  const ball = wrapper.querySelector('#ball') as HTMLElement | null;
    if (!ball) return;

    let i = 0;
    const self = this;
    const raf = () => {
      if (!self.metaballsPaused && i % 25 === 0) createBall();
      i++;
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    function createBall() {
      if (!wrapper) return;
      const ball1 = document.createElement('div');
      ball1.classList.add('ball1');
      ball1.style.left = '50%';
      ball1.style.top = '50%';
      ball1.style.transform = 'translate(-50%, -50%)';
      ball1.style.willChange = 'transform';
      setTimeout(() => {
        wrapper.appendChild(ball1);
        const aleaY = Math.round(Math.random() * 200 - 100);
        const aleaX = Math.round(Math.random() * 200 - 100);
        const a = Math.abs(aleaX);
        const b = Math.abs(aleaY);
        let c = Math.sqrt(a * a + b * b);
        c = (c * 100 / 150) / 100;
        c = 1 - c;
        gsap.set(ball1, { x: 0, y: 0, scale: 1 });
        gsap.to(ball1, {
          duration: 3,
          x: aleaX,
          y: aleaY,
          scale: c,
          ease: 'bounce.in',
          delay: 0.5,
          onComplete: () => ballMove(ball1)
        });
      }, 300);
    }

    function destroy(elem: HTMLElement) {
      if (!wrapper) return;
      if (elem.parentElement === wrapper) wrapper.removeChild(elem);
    }

    function ballMove(elem: HTMLElement) {
      gsap.to(elem, {
        duration: 2,
        x: 0,
        y: 0,
        scale: 0.7,
        ease: 'power2.inOut',
        onComplete: () => destroy(elem)
      });
    }
  }
}
