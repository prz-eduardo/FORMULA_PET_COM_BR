import { Component, ElementRef, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { StoreService, ShopProduct } from '../services/store.service';
import { NavmenuComponent } from '../navmenu/navmenu.component';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, NavmenuComponent],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss'
})
export class ProductDetailsComponent implements OnInit {
  product: ShopProduct | null = null;
  loading = true;
  qty = 1;
  cameFromHighlights = false;
  isFavLocal?: boolean;
  @ViewChild('cartBtn', { static: false }) cartBtn?: ElementRef<HTMLButtonElement>;
  selectedImageIndex = 0;

  constructor(private route: ActivatedRoute, private store: StoreService, private api: ApiService, private router: Router, private renderer: Renderer2) {}

  async ngOnInit(): Promise<void> {
    const productId = this.route.snapshot.paramMap.get('id')!;
    this.cameFromHighlights = this.route.snapshot.queryParamMap.get('src') === 'home';
    const p = await this.store.loadProductDetails(productId);
    this.product = p;
    this.isFavLocal = p?.isFavorited;
    this.selectedImageIndex = 0;
    this.loading = false;
  }

  priceNow(): number {
    if (!this.product) return 0;
    if (typeof this.product.promoPrice === 'number') return this.product.promoPrice;
    return this.store.getPriceWithDiscount(this.product);
  }

  get displayImageUrl(): string {
    if (!this.product) return '/imagens/image.png';
    const imgs = this.product.images || [];
    if (imgs.length && imgs[this.selectedImageIndex]) return imgs[this.selectedImageIndex].url;
    return (this.product.imageUrl || this.product.image || '/imagens/image.png');
  }

  selectImage(i: number) {
    this.selectedImageIndex = i;
  }

  async toggleFav() {
    if (!this.product) return;
    const ok = await this.store.toggleFavorite(this.product.id);
    if (ok) this.isFavLocal = !this.isFavLocal;
  }

  async addToCart(ev: Event) {
    if (!this.product) return;
    const ok = await this.store.addToCart(this.product, this.qty);
    if (ok) this.flyToCart(ev);
  }

  buyNow(ev: Event) {
    this.addToCart(ev).then(() => this.router.navigate(['/carrinho']));
  }

  back() {
    if (this.cameFromHighlights) {
      this.router.navigate(['/loja']);
    } else {
      window.history.length > 1 ? window.history.back() : this.router.navigate(['/loja']);
    }
  }

  private flyToCart(ev: Event) {
    try {
      if (!this.cartBtn) return;
      const target = ev.currentTarget as HTMLElement;
      const srcRect = target.getBoundingClientRect();
      const cartRect = this.cartBtn.nativeElement.getBoundingClientRect();
      const centerX = srcRect.left + srcRect.width / 2;
      const centerY = srcRect.top + srcRect.height / 2;
      const destX = cartRect.left + cartRect.width / 2;
      const destY = cartRect.top + cartRect.height / 2;
      const translateX = destX - centerX;
      const translateY = destY - centerY;

      const spawn = (cls: string, size: number, scaleStart: number, opacity: number, delayMs: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        if (cls) this.renderer.addClass(el, cls);
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `${opacity}`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(${scaleStart})`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms cubic-bezier(.22,.61,.36,1), opacity ${durationMs}ms ease`);
        this.renderer.setStyle(el, 'transition-delay', `${delayMs}ms`);
        document.body.appendChild(el);
        // Force layout then animate
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(${translateX}px, ${translateY}px) scale(0.22)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + delayMs + 240);
      };

      const spawnRing = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        document.body.appendChild(el);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'opacity', `0`);
        this.renderer.setStyle(el, 'transform', `scale(1.8)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        setTimeout(() => el.remove(), durationMs + 160);
      };

      // Visuals similar to loja
      spawnRing(26, 700);
      spawn('', 22, 1.35, 1, 0, 1400);
      spawn('ghost', 16, 1.2, 0.85, 100, 1600);
      spawn('tail', 12, 1.08, 0.7, 220, 1800);

      const pulseDelay = 1300;
      setTimeout(() => {
        this.renderer.addClass(this.cartBtn!.nativeElement, 'pulse');
        setTimeout(() => this.renderer.removeClass(this.cartBtn!.nativeElement, 'pulse'), 800);
      }, pulseDelay);
    } catch {}
  }

  get availabilityLabel(): string {
    const v = this.product?.inStock as any;
    if (v === true) return 'Em estoque';
    if (typeof v === 'number' && v > 0) return 'Em estoque';
    return 'Consulte';
  }
}
