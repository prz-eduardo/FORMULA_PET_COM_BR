import { Component, AfterViewInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
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
export class NavmenuComponent implements AfterViewInit {
  previousScroll: number = 0;
  isVisible = true;
  currentRoute: string = '';
  cartCount = 0;
  menuOpen = false;

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

      // Initialize metaballs animation behind logo (scoped to logo-container)
      this.initMetaBalls();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      const currentScroll = window.scrollY;
      this.isVisible = currentScroll < this.previousScroll;
      this.previousScroll = currentScroll;
    }
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
