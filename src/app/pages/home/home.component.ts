import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { StoreService, ShopProduct } from '../../services/store.service';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';

// import { HeroComponent } from '../hero/hero.component';
// import { ProductPreviewComponent } from '../product-preview/product-preview.component';
// import { TestimonialsComponent } from '../testimonials/testimonials.component';
// import { AboutComponent } from '../about/about.component';
// import { ContactComponent } from '../contact/contact.component';

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
export class HomeComponent implements OnInit {
  produtos: ShopProduct[] = [];
  loading = false;
  constructor(public store: StoreService, private router: Router) {}

  async ngOnInit() {
    const loadHighlights = async () => {
      try {
        this.loading = true;
        // Prefer the dedicated highlights endpoint for Home so we display the
        // curated items the backend provides (fall back to empty array).
        const items = await this.store.loadHomeHighlights();
        this.produtos = Array.isArray(items) ? (items.slice(0, 8) as ShopProduct[]) : [];
      } catch {
        // fail silently; keep produtos empty
      } finally {
        this.loading = false;
      }
    };

    // Avoid running data fetches on the server to keep SSR fast.
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => void loadHighlights());
      } else {
        setTimeout(() => void loadHighlights(), 50);
      }
    }
  }

  goToStore() {
    this.router.navigate(['/loja'], { queryParams: { src: 'home' } }).then(() => {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    });
  }
}
