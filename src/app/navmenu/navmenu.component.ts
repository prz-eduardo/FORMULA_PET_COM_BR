import { Component, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnDestroy, ViewChild, ViewContainerRef, ElementRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { StoreService } from '../services/store.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [RouterLink, CommonModule], // precisa pro [routerLink] e *ngIf
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss']
})
export class NavmenuComponent implements AfterViewInit, OnDestroy {
  previousScroll: number = 0;
  isVisible = true;
  currentRoute: string = '';
  cartCount = 0;
  menuOpen = false;
  isCliente = false;
  showFullMenu = true;
  showClienteModal = false;
  @ViewChild('clienteHost', { read: ViewContainerRef }) clienteHost?: ViewContainerRef;
  @ViewChild('userBtn', { read: ElementRef }) userBtn?: ElementRef<HTMLButtonElement>;
  private idleTimer: any = null;
  private readonly idleTimeoutMs = 5000; // 5s sem scroll

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private router: Router, private store: StoreService) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Inicializa a rota atual
      this.currentRoute = this.router.url;

      // Atualiza a rota ao navegar
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event: any) => {
          this.currentRoute = event.urlAfterRedirects;
          this.updateMenuMode();
        });

      const iconMenu: HTMLElement | null = document.querySelector('.icon-menu');
      const menu: HTMLElement | null = document.querySelector('.menu');
      const menuLink: NodeListOf<HTMLElement> = document.querySelectorAll('.menu-link.sub');

      if (iconMenu && menu) {
        iconMenu.addEventListener('click', this.openMenu.bind(this, menu, iconMenu));
        menuLink.forEach((el) => {
          el.addEventListener('click', this.openSubmenu);
        });
      }

      // Subscribe to cart to update count badge
      this.store.cart$.subscribe(items => {
        this.cartCount = items.reduce((n, it) => n + it.quantity, 0);
      });

      // Detect cliente session to control UI visibility (cart etc.)
      this.store.isClienteLoggedSilent()
        .then(ok => this.isCliente = ok)
        .catch(() => this.isCliente = false);

  // Initialize metaballs animation behind logo (scoped to logo-container)
      this.initMetaBalls();

      // Inicia o timer de inatividade (sem scroll) para auto-ocultar a navbar
      this.resetIdleTimer();

      // Eval initial mode
      this.updateMenuMode();
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
    const isHomeHash = typeof window !== 'undefined' && (window.location.hash === '#0' || window.location.hash === '#');
    const isAreaVet = url.includes('/area-vet');
    const isHomeRoute = url === '/' || url.startsWith('/#') || url.includes('index.html');
    this.showFullMenu = isAreaVet || isHomeHash || isHomeRoute;
  }

  async abrirClienteModal() {
    this.showClienteModal = true;
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
        }
      });
    } catch (e) {
      console.error('Falha ao carregar Área do Cliente', e);
    }
  }
  fecharClienteModal() {
    try {
      const modal = document.querySelector('.cliente-modal') as HTMLElement | null;
      if (modal) {
        modal.classList.add('anim-exit');
        setTimeout(() => {
          modal.classList.remove('anim-exit');
          this.showClienteModal = false;
        }, 320);
        return;
      }
    } catch {}
    this.showClienteModal = false;
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
      try { document.body.style.overflow = ''; } catch {}
      // Clear any inline randomized durations/opacities
      const linksClose: NodeListOf<HTMLElement> = menu.querySelectorAll('.menu-link');
      linksClose.forEach(l => {
        l.style.removeProperty('animation-duration');
        l.style.removeProperty('opacity');
        l.style.removeProperty('transition');
      });
      setTimeout(() => menu.classList.remove('open'), 1300);
    } else {
      menu.classList.remove('close');
      menu.classList.add('open');
      iconMenu.classList.add('icon-closed');
      this.menuOpen = true;
  // Garante visibilidade enquanto o menu está aberto
  this.isVisible = true;
  if (this.idleTimer) clearTimeout(this.idleTimer);
      try { document.body.style.overflow = 'hidden'; } catch {}
      // Randomization (all devices): duration and opacity fade from 0 to 1
      const linksOpen: NodeListOf<HTMLElement> = menu.querySelectorAll('.menu-link');
      const min = 1.2; // slower min
      const max = 2.4; // slower max
      linksOpen.forEach(l => {
        const dur = (min + Math.random() * (max - min)).toFixed(2);
        l.style.animationDuration = `${dur}s`;
        l.style.opacity = '0';
        l.style.transition = `opacity ${dur}s ease`;
        requestAnimationFrame(() => { l.style.opacity = '1'; });
      });
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
