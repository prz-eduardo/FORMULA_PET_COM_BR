import { Component, OnInit, Inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
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
import { CookiePreferencesService, CookiePreferences } from './services/cookie-preferences.service';
import { CookieConsentComponent } from './shared/cookie-consent/cookie-consent.component';
import { BannedUserModalComponent } from './shared/banned-user-modal/banned-user-modal.component';
import { MARCA_NOME } from './constants/loja-public';
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
    CookieConsentComponent,
    BannedUserModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = MARCA_NOME;
  deviceType: string = 'desktop';
  showFooter: boolean = true;
  showNav: boolean = true;
  private routerSub?: Subscription;
  showLoginModal = false;
  private openLoginHandler?: EventListenerOrEventListenerObject;
  private cookiePreferencesSub?: Subscription;
  private elfsightBadgeInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private zone: NgZone,
    private router: Router,
    private store: StoreService,
    private rastreio: RastreioLojaService,
    private cookiePreferences: CookiePreferencesService,
    private titleService: Title
  ) {
    register(); // Swiper
  }

  ngOnInit(): void {
    this.detectDevice();
    if (isPlatformBrowser(this.platformId)) {
      try {
        this.titleService.setTitle(MARCA_NOME);
      } catch (e) {}
      try {
        document.documentElement.classList.add('force-light');
        document.body.classList.add('force-light');
      } catch (e) {}
      try {
        this.syncCookieDefaultsIfLoggedInClienteOrVet();
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
      this.cookiePreferencesSub = this.cookiePreferences.preferences$
        .pipe(
          filter(
            (p): p is CookiePreferences =>
              p != null && this.cookiePreferences.isValid(p)
          )
        )
        .subscribe((p) => this.applyCookiePreferences(p));
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
    try { this.cookiePreferencesSub?.unsubscribe(); } catch (e) {}
    try { if (this.elfsightBadgeInterval) { clearInterval(this.elfsightBadgeInterval); } } catch (e) {}
    try { if (this.openLoginHandler && typeof window !== 'undefined') window.removeEventListener('open-login', this.openLoginHandler as EventListener); } catch {}

  }

  /** Cliente/vet já autenticado (token em storage) mas sem decisão de cookies ainda — alinha ao pós-login/cadastro. */
  private syncCookieDefaultsIfLoggedInClienteOrVet(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const rawType = localStorage.getItem('userType') || sessionStorage.getItem('userType');
      const userType = (rawType || '').toLowerCase();
      if (token && userType && (userType === 'cliente' || userType === 'vet')) {
        this.cookiePreferences.applyDefaultsIfNoConsentYet();
      }
    } catch {
      /* */
    }
  }

  private applyCookiePreferences(p: CookiePreferences): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      this.rastreio.start(p.analytics);
    } catch (e) {}
    if (p.thirdParty) {
      this.loadElfsightScript();
    } else {
      this.removeElfsightScript();
    }
  }

  closeLoginModal() {
    this.showLoginModal = false;
  }

  onClienteLoggedIn() {
    this.closeLoginModal();
    this.store.resetClienteGate();
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
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.elfsightBadgeInterval) {
      clearInterval(this.elfsightBadgeInterval);
      this.elfsightBadgeInterval = null;
    }
    const existingScript = document.getElementById('elfsight-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'elfsight-script';
      script.src = 'https://static.elfsight.com/platform/platform.js';
      script.defer = true;
      document.body.appendChild(script);
    }
    this.startElfsightBadgeStripper();
  }

  private startElfsightBadgeStripper(): void {
    this.zone.runOutsideAngular(() => {
      let tries = 0;
      const maxTries = 25;
      this.elfsightBadgeInterval = setInterval(() => {
        const badge = document.querySelector('a[href*="elfsight.com/google-reviews-widget"]');
        if (badge) {
          badge.remove();
          if (this.elfsightBadgeInterval) {
            clearInterval(this.elfsightBadgeInterval);
            this.elfsightBadgeInterval = null;
          }
        } else if (++tries >= maxTries) {
          if (this.elfsightBadgeInterval) {
            clearInterval(this.elfsightBadgeInterval);
            this.elfsightBadgeInterval = null;
          }
        }
      }, 2000);
    });
  }

  private removeElfsightScript(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.elfsightBadgeInterval) {
      try {
        clearInterval(this.elfsightBadgeInterval);
      } catch {
        /* */
      }
      this.elfsightBadgeInterval = null;
    }
    const s = document.getElementById('elfsight-script');
    try {
      s?.remove();
    } catch {
      /* */
    }
  }
}
