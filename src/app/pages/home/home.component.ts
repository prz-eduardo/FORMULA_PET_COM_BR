import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { StoreService, ShopProduct } from '../../services/store.service';
import { Router, RouterLink } from '@angular/router';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { MARCA_NOME } from '../../constants/loja-public';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    BannerSlotComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroVideo') heroVideoRef?: ElementRef<HTMLVideoElement>;

  readonly marcaNome = MARCA_NOME;
  produtos: ShopProduct[] = [];
  loading = false;
  prefersReducedMotion = false;

  private motionMql?: MediaQueryList;
  private onMotionChange?: (e: MediaQueryListEvent) => void;

  constructor(
    public store: StoreService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.matchMedia) {
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    const loadHighlights = async () => {
      try {
        this.loading = true;
        const items = await this.store.loadHomeHighlights();
        this.produtos = Array.isArray(items) ? (items.slice(0, 8) as ShopProduct[]) : [];
      } catch {
        // fail silently; keep produtos empty
      } finally {
        this.loading = false;
      }
    };

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => void loadHighlights());
      } else {
        setTimeout(() => void loadHighlights(), 50);
      }
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    this.motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.applyReducedMotion(this.motionMql.matches);
    this.onMotionChange = (e: MediaQueryListEvent) => this.applyReducedMotion(e.matches);
    this.motionMql.addEventListener('change', this.onMotionChange);
  }

  ngOnDestroy(): void {
    if (this.motionMql && this.onMotionChange) {
      this.motionMql.removeEventListener('change', this.onMotionChange);
    }
  }

  private applyReducedMotion(reduce: boolean): void {
    const on = !!reduce;
    this.prefersReducedMotion = on;

    const syncVideo = (): void => {
      const el = this.heroVideoRef?.nativeElement;
      if (!el) {
        return;
      }
      if (on) {
        el.pause();
        el.removeAttribute('autoplay');
      } else {
        el.setAttribute('muted', '');
        const p = el.play();
        if (p && typeof (p as Promise<void>).catch === 'function') {
          (p as Promise<void>).catch(() => {});
        }
      }
    };

    if (!on && isPlatformBrowser(this.platformId)) {
      setTimeout(() => syncVideo(), 0);
    } else {
      syncVideo();
    }
  }

  goToStore() {
    this.router.navigate(['/loja'], { queryParams: { src: 'home' } }).then(() => {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    });
  }
}
