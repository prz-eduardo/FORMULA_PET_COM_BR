import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { HeroComponent } from './hero/hero.component';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { TestimonialsComponent } from './testimonials/testimonials.component';
import { ProductPreviewComponent } from './product-preview/product-preview.component';
import { ToastContainerComponent } from './shared/toast/toast-container.component';
import { LoginClienteComponent } from './pages/restrito/area-cliente/login-cliente/login-cliente.component';
import { StoreService } from './services/store.service';
import { RastreioLojaService } from './services/rastreio-loja.service';
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastContainerComponent,
    NavmenuComponent,
    FooterComponent,
    LoginClienteComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'FORMULA_PET_COM_BR';
  deviceType: string = 'desktop';
  showFooter: boolean = true;
  showNav: boolean = true;
  private routerSub?: Subscription;
  showLoginModal = false;
  private openLoginHandler?: EventListenerOrEventListenerObject;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private zone: NgZone,
    private router: Router,
    private store: StoreService,
    private rastreio: RastreioLojaService
  ) {
    register(); // Swiper
  }

  ngOnInit(): void {
    this.detectDevice();
    if (isPlatformBrowser(this.platformId)) {
      try {
        document.documentElement.classList.add('force-light');
        document.body.classList.add('force-light');
      } catch (e) {}
    }
    // Hide global footer and nav on admin routes and product registration page
    try {
      const current = (this.router && (this.router.url || '')) as string;
      const hide = current.startsWith('/restrito/admin') || current.startsWith('/restrito/produto');
      this.showFooter = !hide;
      this.showNav = !hide;
      this.routerSub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((ev: any) => {
        const u = ev.urlAfterRedirects || ev.url || '';
        const hideNow = u.startsWith('/restrito/admin') || u.startsWith('/restrito/produto');
        this.showFooter = !hideNow;
        this.showNav = !hideNow;
      });
    } catch (e) {}
    try {
      this.rastreio.start();
    } catch (e) {}
    // Global listener for programmatic login requests (from other components)
    if (typeof window !== 'undefined') {
      this.openLoginHandler = () => { this.showLoginModal = true; };
      window.addEventListener('open-login', this.openLoginHandler as EventListener);
    }
  }

  ngOnDestroy(): void {
    try {
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.classList.remove('force-light');
        document.body.classList.remove('force-light');
      }
    } catch (e) {}
    try { if (this.routerSub) this.routerSub.unsubscribe(); } catch (e) {}
    try { if (this.openLoginHandler && typeof window !== 'undefined') window.removeEventListener('open-login', this.openLoginHandler as EventListener); } catch {}

  }

  closeLoginModal() {
    this.showLoginModal = false;
  }

  onClienteLoggedIn() {
    this.closeLoginModal();
    this.store.resetClienteGate();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadElfsightScript();
    }
    if (isPlatformBrowser(this.platformId)) {
      // Remove o badge de branding do Elfsight depois que o widget carregar
      // Tentando várias vezes porque o widget pode demorar pra renderizar
      // Run the polling outside Angular so it doesn't keep the app unstable during hydration
      this.zone.runOutsideAngular(() => {
        let tries = 0;
        const maxTries = 25;
        let loadingTestimonials = true;
        const intervalId = setInterval(() => {
          const badge = document.querySelector('a[href*="elfsight.com/google-reviews-widget"]');
          if (badge) {
            badge.remove();
            console.log('Badge Elfsight removido.');
            loadingTestimonials = false;
            clearInterval(intervalId);
          } else if (++tries >= maxTries) {
            loadingTestimonials = false;
            clearInterval(intervalId);
            console.warn('Não encontrou o badge Elfsight após várias tentativas.');
          }
        }, 2000);
      });
    }
  }

  detectDevice(): void {
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;

      if (width < 768) {
        this.deviceType = 'mobile';
      } else if (width >= 768 && width < 1024) {
        this.deviceType = 'tablet';
      } else {
        this.deviceType = 'desktop';
      }
    }
  }

  loadElfsightScript(): void {
    const existingScript = document.getElementById('elfsight-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'elfsight-script';
      script.src = 'https://static.elfsight.com/platform/platform.js';
      script.defer = true;
      document.body.appendChild(script);
    }
  }
}
