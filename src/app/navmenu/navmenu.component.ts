import { Component, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnDestroy, ViewChild, ViewContainerRef, ElementRef, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { StoreService } from '../services/store.service';
import { AuthService } from '../services/auth.service';
import { gsap } from 'gsap';

export interface NavMainItem {
  id: string;
  label: string;
  /** Rótulo curto no dock móvel (opcional) */
  shortLabel?: string;
  link: string;
  icon: string;
}

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss']
})
export class NavmenuComponent implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Abas principais (desktop + dock móvel) em todas as páginas onde a navbar global existe.
   * Ocultas só em rotas sem nav global (admin / cadastro produto) — alinhado ao AppComponent.showNav.
   */
  get showSlideMenu(): boolean {
    const url = this.currentRoute || '';
    if (url.startsWith('/restrito/admin') || url.startsWith('/restrito/produto')) {
      return false;
    }
    return true;
  }

  get isAreaVetRoute(): boolean {
    return (this.currentRoute || '').includes('/area-vet');
  }

  user: any = null;
  userFoto: string | null = null;
  previousScroll: number = 0;
  isVisible = true;
  currentRoute: string = '';
  useGaleriaSvg = false;
  cartCount = 0;
  isCliente = false;
  showFullMenu = true;

  /** Itens principais da barra (sem Carrinho — entra só para cliente logado). */
  readonly mainNavItems: NavMainItem[] = [
    { id: 'loja', label: 'Loja', link: '/', icon: 'fas fa-store' },
    { id: 'institucional', label: 'Institucional', shortLabel: 'Instit.', link: '/institucional', icon: 'fas fa-house' },
    { id: 'sobre', label: 'Sobre', link: '/sobre-nos', icon: 'fas fa-circle-info' },
    { id: 'mapa', label: 'Mapa', link: '/mapa', icon: 'fas fa-map-location-dot' },
    { id: 'galeria', label: 'Galeria', link: '/galeria', icon: 'fas fa-images' },
  ];

  private readonly carrinhoNavItem: NavMainItem = {
    id: 'carrinho',
    label: 'Carrinho',
    shortLabel: 'Carrinho',
    link: '/carrinho',
    icon: 'fas fa-cart-shopping',
  };

  get visibleNavItems(): NavMainItem[] {
    if (this.isCliente) {
      return [...this.mainNavItems, this.carrinhoNavItem];
    }
    return this.mainNavItems;
  }
  showClienteModal = false;
  clienteLoading = false;
  /** True while this modal applied overflow lock on html/body (see releaseClienteModalScrollLock). */
  private clienteModalScrollLockActive = false;
  @ViewChild('clienteHost', { read: ViewContainerRef }) clienteHost?: ViewContainerRef;
  @ViewChild('userBtn', { read: ElementRef }) userBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('desktopTabsTrack', { read: ElementRef }) desktopTabsTrack?: ElementRef<HTMLElement>;
  private idleTimer: any = null;
  private readonly idleTimeoutMs = 5000; // 5s sem scroll

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private router: Router, private store: StoreService, private auth: AuthService) {}

  ngOnInit(): void {
    this.currentRoute = this.router.url;
    this.updateMenuMode();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.urlAfterRedirects;
        this.updateMenuMode();
        this.scheduleTabPillUpdate();
      });

    this.store.cart$.subscribe(items => {
      this.cartCount = items.reduce((n, it) => n + it.quantity, 0);
      this.scheduleTabPillUpdate();
    });

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
        this.scheduleTabPillUpdate();
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
        this.scheduleTabPillUpdate();
      });
    this.auth.isLoggedIn$.subscribe(async ok => {
      if (ok) {
        this.isCliente = await this.store.isClienteLoggedSilent().catch(() => false);
        this.scheduleTabPillUpdate();
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
        this.scheduleTabPillUpdate();
      }
    });
  }

  isNavActive(item: NavMainItem): boolean {
    const path = (this.currentRoute || '').split('?')[0] || '';
    switch (item.id) {
      case 'loja':
        return (
          path === '/' ||
          path.startsWith('/loja') ||
          path.startsWith('/produto/') ||
          path.startsWith('/favoritos') ||
          path.startsWith('/checkout')
        );
      case 'institucional':
        return path.startsWith('/institucional');
      case 'sobre':
        return path.startsWith('/sobre-nos');
      case 'mapa':
        return path.startsWith('/mapa');
      case 'galeria':
        return path.startsWith('/galeria');
      case 'carrinho':
        return path.startsWith('/carrinho');
      default:
        return false;
    }
  }

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
      this.initMetaBalls();
      this.resetIdleTimer();
      this.scheduleTabPillUpdate();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      const currentScroll = window.scrollY;
      this.isVisible = currentScroll < this.previousScroll || currentScroll <= 0;
      this.previousScroll = currentScroll;
      this.resetIdleTimer();
    }
  }

  @HostListener('window:resize', [])
  onWindowResize(): void {
    this.scheduleTabPillUpdate();
  }

  private updateMenuMode(): void {
    this.showFullMenu = this.showSlideMenu;
    this.scheduleTabPillUpdate();
  }

  private scheduleTabPillUpdate(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const run = () => this.updateDesktopTabPill();
    requestAnimationFrame(() => {
      run();
      if (this.showFullMenu) {
        setTimeout(run, 0);
      }
    });
  }

  /** Indicador “hori-selector”: posição da aba ativa no desktop (sem jQuery). */
  private updateDesktopTabPill(): void {
    const track = this.desktopTabsTrack?.nativeElement;
    if (!track || !this.showFullMenu) {
      return;
    }
    const selector = track.querySelector('.hori-selector') as HTMLElement | null;
    const active = track.querySelector('li.nav-tab-item.active a.nav-tab-link') as HTMLElement | null;
    if (!selector) {
      return;
    }
    if (!active) {
      selector.style.opacity = '0';
      return;
    }
    const tr = track.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const left = ar.left - tr.left + track.scrollLeft;
    const top = ar.top - tr.top + track.scrollTop;
    selector.style.left = `${left}px`;
    selector.style.top = `${top}px`;
    selector.style.width = `${ar.width}px`;
    selector.style.height = `${ar.height}px`;
    selector.style.opacity = '1';
  }

  private applyClienteModalScrollLock(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      this.clienteModalScrollLockActive = true;
    } catch {}
  }

  private releaseClienteModalScrollLock(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.clienteModalScrollLockActive) return;
    this.clienteModalScrollLockActive = false;
    try {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    } catch {}
  }

  async abrirClienteModal() {
    this.showClienteModal = true;
    this.applyClienteModalScrollLock();
    this.clienteLoading = true;
    requestAnimationFrame(() => {
      try {
        const btn = this.userBtn?.nativeElement;
        const modal = document.querySelector('.cliente-modal') as HTMLElement | null;
        if (btn && modal) {
          const br = btn.getBoundingClientRect();
          const mr = modal.getBoundingClientRect();
          const ox = (br.left + br.width / 2 - mr.left) / Math.max(mr.width, 1);
          const oy = (br.top + br.height / 2 - mr.top) / Math.max(mr.height, 1);
          modal.style.setProperty('--origin-x', `${Math.min(Math.max(ox, 0), 1)}`);
          modal.style.setProperty('--origin-y', `${Math.min(Math.max(oy, 0), 1)}`);
          modal.classList.add('anim-enter');
          setTimeout(() => modal.classList.remove('anim-enter'), 450);
        }
      } catch {}
    });
    try {
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
          this.releaseClienteModalScrollLock();
        }, 320);
        return;
      }
    } catch {}
    this.showClienteModal = false;
    this.clienteLoading = false;
    try { this.clienteHost?.clear(); } catch {}
    this.releaseClienteModalScrollLock();
  }

  ngOnDestroy(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.releaseClienteModalScrollLock();
  }

  private resetIdleTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const currentScroll = window.scrollY || 0;
    if (currentScroll <= 0){
      this.isVisible = true;
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.isVisible = false;
    }, this.idleTimeoutMs);
  }

  private initMetaBalls(): void {
  const wrapper = document.querySelector('.logo-container #wrapper') as HTMLElement | null;
  if (!wrapper) return;
  const ball = wrapper.querySelector('#ball') as HTMLElement | null;
    if (!ball) return;

    let i = 0;
    const raf = () => {
      if (i % 25 === 0) createBall();
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
