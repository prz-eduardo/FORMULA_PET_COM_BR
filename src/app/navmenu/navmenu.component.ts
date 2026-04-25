import { Component, AfterViewInit, ChangeDetectorRef, Inject, PLATFORM_ID, HostListener, OnDestroy, ViewChild, ViewContainerRef, ElementRef, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, NavigationCancel, NavigationError, RouterLink } from '@angular/router';
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
  /** Pulso do badge móvel quando a quantidade no carrinho sobe. */
  cartBadgeBumping = false;
  isCliente = false;
  showFullMenu = true;
  /** Aba que o utilizador acabou de escolher (clique síncrono); limpa-se no fim da navegação. */
  selectedMainTabId: string | null = null;

  /**
   * Ordem: Galeria → Mapa → Loja → (Carrinho se cliente) → Sobre.
   * Carrinho é inserido em `visibleNavItems` após Loja.
   */
  readonly mainNavItems: NavMainItem[] = [
    { id: 'galeria', label: 'Galeria', link: '/galeria', icon: 'fas fa-images' },
    { id: 'mapa', label: 'Mapa', link: '/mapa', icon: 'fas fa-map-location-dot' },
    { id: 'loja', label: 'Loja', link: '/', icon: 'fas fa-store' },
    { id: 'sobre', label: 'Sobre', link: '/sobre-nos', icon: 'fas fa-circle-info' },
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
      const i = this.mainNavItems.findIndex(x => x.id === 'loja') + 1;
      return [...this.mainNavItems.slice(0, i), this.carrinhoNavItem, ...this.mainNavItems.slice(i)];
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
  /** Invalida timers de settle (ex.: após trocar de rota de novo). */
  private tabPillLayoutGen = 0;
  private trackResize: ResizeObserver | null = null;
  private pillLayoutDebounce: ReturnType<typeof setTimeout> | null = null;
  private menubarSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private pillFlipClearTimer: ReturnType<typeof setTimeout> | null = null;
  private cartBadgeBumpTimer: ReturnType<typeof setTimeout> | null = null;
  private cartCountSeenFromStore = false;
  /** Última geometria aplicada ao hori-selector (para diff + FLIP). */
  private lastPillMetrics: { left: number; top: number; width: number; height: number; key: string } | null = null;
  private static readonly PILL_DIFF_PX = 0.85;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private store: StoreService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setCurrentRoutePath(this.router.url);
    this.updateMenuMode();
    // NavigationStart: atualiza aba e pill logo ao clicar, sem esperar chunk lazy nem APIs da página.
    this.router.events
      .pipe(
        filter(
          e =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError
        )
      )
      .subscribe(event => {
        if (event instanceof NavigationCancel || event instanceof NavigationError) {
          this.selectedMainTabId = null;
          return;
        }
        if (event instanceof NavigationStart) {
          this.setCurrentRoutePath(event.url);
          this.updateMenuMode();
          this.cdr.detectChanges();
          this.scheduleTabPillUpdate();
        } else {
          const ne = event as NavigationEnd;
          this.setCurrentRoutePath(ne.urlAfterRedirects);
          this.updateMenuMode();
          this.selectedMainTabId = null;
          this.scheduleTabPillUpdate();
        }
      });

    this.store.cart$.subscribe(items => {
      const next = items.reduce((n, it) => n + it.quantity, 0);
      const prev = this.cartCount;
      if (this.cartCountSeenFromStore && next > prev) {
        this.triggerCartBadgeBump();
      }
      this.cartCount = next;
      this.cartCountSeenFromStore = true;
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

  /** path sem query; usado no Start e no End para a navbar não depender do fim do carregamento. */
  private setCurrentRoutePath(url: string): void {
    this.currentRoute = (url || '').split('?')[0] || '';
  }

  /** Clique síncrono na aba: destaque e pill antes do lazy load / API da página. */
  onMainTabClick(tabId: string): void {
    this.selectedMainTabId = tabId;
    this.cdr.detectChanges();
    this.scheduleTabPillUpdate();
  }

  private triggerCartBadgeBump(): void {
    if (this.cartBadgeBumpTimer) {
      clearTimeout(this.cartBadgeBumpTimer);
    }
    this.cartBadgeBumping = true;
    this.cdr.detectChanges();
    this.cartBadgeBumpTimer = setTimeout(() => {
      this.cartBadgeBumping = false;
      this.cartBadgeBumpTimer = null;
      this.cdr.detectChanges();
    }, 500);
  }

  /** Destaque da aba: intenção do utilizador tem prioridade sobre isNavActive até NavigationEnd. */
  isTabHighlighted(item: NavMainItem): boolean {
    if (this.selectedMainTabId != null && this.selectedMainTabId !== '') {
      return item.id === this.selectedMainTabId;
    }
    return this.isNavActive(item);
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
      this.rebindTabsTrackResizeObserver();
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
      this.requestPillLayoutFromScroll();
    }
  }

  @HostListener('window:resize', [])
  onWindowResize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.requestPillLayoutFromScroll();
  }

  private updateMenuMode(): void {
    this.showFullMenu = this.showSlideMenu;
    this.scheduleTabPillUpdate();
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.rebindTabsTrackResizeObserver(), 0);
    }
  }

  /** Chamar quando o track de desktop for criado/destroi (ex. *ngIf="showFullMenu"). */
  private rebindTabsTrackResizeObserver(): void {
    this.trackResize?.disconnect();
    this.trackResize = null;
    if (!isPlatformBrowser(this.platformId) || typeof ResizeObserver === 'undefined') return;
    const track = this.desktopTabsTrack?.nativeElement;
    if (!track) return;
    this.trackResize = new ResizeObserver(() => {
      this.requestPillLayoutFromScroll();
    });
    this.trackResize.observe(track);
  }

  /**
   * Scroll/resize/ResizeObserver: um único passo (debounce) e sem FLIP, para não reatribuir left/width
   * ponto a ponto (evitava “recomeçar” a animação a cada 1px).
   */
  private requestPillLayoutFromScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.pillLayoutDebounce) clearTimeout(this.pillLayoutDebounce);
    this.pillLayoutDebounce = setTimeout(() => {
      this.pillLayoutDebounce = null;
      this.applyDesktopPillFromDom({ allowFlip: false, force: false });
    }, 24);
  }

  private scheduleTabPillUpdate(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const session = ++this.tabPillLayoutGen;
    if (this.menubarSettleTimer) {
      clearTimeout(this.menubarSettleTimer);
      this.menubarSettleTimer = null;
    }
    if (this.pillLayoutDebounce) {
      clearTimeout(this.pillLayoutDebounce);
      this.pillLayoutDebounce = null;
    }
    if (this.pillFlipClearTimer) {
      clearTimeout(this.pillFlipClearTimer);
      this.pillFlipClearTimer = null;
    }
    setTimeout(() => {
      if (session !== this.tabPillLayoutGen) return;
      this.cdr.detectChanges();
      this.applyDesktopPillFromDom({ allowFlip: true, force: true });
    }, 0);
    // Pós-anim. da menubar (.hidden) — re-medida com force, sem FLIP, para Sobre>Mapa etc.
    this.menubarSettleTimer = setTimeout(() => {
      this.menubarSettleTimer = null;
      if (session !== this.tabPillLayoutGen) return;
      this.applyDesktopPillFromDom({ allowFlip: false, force: true });
    }, 360);
  }

  /**
   * Posiciona o hori-selector: diff guard, FLIP em troca de aba, sem varrer left/width em rajada.
   */
  private applyDesktopPillFromDom(opts: { allowFlip: boolean; force: boolean }): void {
    const track = this.desktopTabsTrack?.nativeElement;
    if (!track || !this.showFullMenu) {
      this.lastPillMetrics = null;
      return;
    }
    const selector = track.querySelector('.hori-selector') as HTMLElement | null;
    if (!selector) {
      return;
    }
    const active = track.querySelector('li.nav-tab-item.active a.nav-tab-link') as HTMLElement | null;
    if (!active) {
      if (this.lastPillMetrics) {
        selector.style.opacity = '0';
      }
      this.lastPillMetrics = null;
      return;
    }
    const tr = track.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const left = ar.left - tr.left + track.scrollLeft;
    const top = ar.top - tr.top + track.scrollTop;
    const heightToTrackBottom = Math.max(0, tr.bottom - ar.top);
    const w = ar.width;
    const h = heightToTrackBottom;
    const li = active.closest('li') as HTMLElement | null;
    const key = (li?.getAttribute('data-nav-id') || '').trim();

    const last = this.lastPillMetrics;
    if (last) {
      const d = Math.max(
        Math.abs(last.left - left),
        Math.abs(last.top - top),
        Math.abs(last.width - w),
        Math.abs(last.height - h)
      );
      if (!opts.force && d < NavmenuComponent.PILL_DIFF_PX && last.key === key) {
        return;
      }
    }

    if (!opts.allowFlip) {
      if (this.pillFlipClearTimer) {
        clearTimeout(this.pillFlipClearTimer);
        this.pillFlipClearTimer = null;
      }
      try {
        selector.style.removeProperty('transform');
        selector.style.removeProperty('transition');
      } catch {
        // ignore
      }
    }

    if (
      opts.allowFlip &&
      last &&
      key &&
      last.key &&
      key !== last.key
    ) {
      const dx = last.left - left;
      const dy = last.top - top;
      if (Math.hypot(dx, dy) > 1) {
        if (this.pillFlipClearTimer) {
          clearTimeout(this.pillFlipClearTimer);
          this.pillFlipClearTimer = null;
        }
        selector.style.transition = 'none';
        selector.style.left = `${left}px`;
        selector.style.top = `${top}px`;
        selector.style.width = `${w}px`;
        selector.style.height = `${h}px`;
        selector.style.opacity = '1';
        selector.style.transform = `translate(${dx}px, ${dy}px)`;
        this.lastPillMetrics = { left, top, width: w, height: h, key };
        void selector.offsetWidth;
        requestAnimationFrame(() => {
          selector.style.transition = 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)';
          selector.style.transform = 'translate(0, 0)';
          this.pillFlipClearTimer = setTimeout(() => {
            this.pillFlipClearTimer = null;
            try {
              selector.style.removeProperty('transform');
              selector.style.removeProperty('transition');
            } catch {
              // ignore
            }
          }, 500);
        });
        return;
      }
    }

    if (this.pillFlipClearTimer) {
      clearTimeout(this.pillFlipClearTimer);
      this.pillFlipClearTimer = null;
    }
    try {
      selector.style.removeProperty('transform');
      selector.style.removeProperty('transition');
    } catch {
      // ignore
    }
    selector.style.left = `${left}px`;
    selector.style.top = `${top}px`;
    selector.style.width = `${w}px`;
    selector.style.height = `${h}px`;
    selector.style.opacity = '1';
    this.lastPillMetrics = { left, top, width: w, height: h, key: key || last?.key || '' };
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
    if (this.pillLayoutDebounce) clearTimeout(this.pillLayoutDebounce);
    if (this.menubarSettleTimer) clearTimeout(this.menubarSettleTimer);
    if (this.pillFlipClearTimer) clearTimeout(this.pillFlipClearTimer);
    if (this.cartBadgeBumpTimer) {
      clearTimeout(this.cartBadgeBumpTimer);
      this.cartBadgeBumpTimer = null;
    }
    this.trackResize?.disconnect();
    this.trackResize = null;
    this.tabPillLayoutGen += 1;
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
