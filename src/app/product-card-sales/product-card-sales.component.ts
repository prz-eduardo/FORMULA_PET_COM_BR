import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShopProduct } from '../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../constants/card.constants';
import {
  normalizeImageRatio,
} from '../constants/loja-tema-card.config';

@Component({
  selector: 'app-product-card-sales',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './product-card-sales.component.html',
  styleUrls: ['./product-card-sales.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardSalesComponent {
  @Input() product!: ShopProduct;
  @Input() themeConfig: Record<string, unknown> | null = null;
  @Input() supportsFavorites = true;
  @Input() supportsRatings = true;
  @Input() favoriteActive?: boolean;
  @Input() disableLink = false;
  @Input() cardWidth: string = DEFAULT_PRODUCT_CARD_WIDTH;
  @Input() extraClass = '';

  @Output() add = new EventEmitter<MouseEvent>();
  @Output() toggleFav = new EventEmitter<void>();

  onFavClick(ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.toggleFav.emit();
  }

  onAddClick(ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.add.emit(ev);
  }

  get displayImage(): string {
    const fromGallery = this.product.images?.[0]?.url;
    const u = (this.product.image || this.product.imageUrl || fromGallery || '').toString().trim();
    return u || '/imagens/image.png';
  }

  get priceNow(): number {
    if (this.product.promoPrice != null) return this.product.promoPrice;
    const base = this.product.price ?? 0;
    if (this.product.priceFinal != null && this.product.priceFinal < base - 0.009) {
      return this.product.priceFinal;
    }
    const disc = this.product.discount || 0;
    return Math.max(0, base - base * disc / 100);
  }

  /** Preço riscado: strike do servidor (promo ou preco_de) ou fallback promo local. */
  get oldPriceDisplay(): number | null {
    const strike = this.product.strikePrice;
    if (strike != null && Number.isFinite(strike) && strike > this.priceNow + 0.009) return strike;
    const orig = this.product?.price ?? 0;
    if (Number.isFinite(orig) && orig > this.priceNow + 0.009) return orig;
    return null;
  }

  get showMarca(): boolean {
    const v = (this.themeConfig as any)?.cardSales?.showMarca;
    return v !== false && !!this.product.marca?.trim?.();
  }

  get showSku(): boolean {
    return !!(this.themeConfig as any)?.cardSales?.showSku && !!this.product.sku?.trim?.();
  }

  get imageAspect() {
    return normalizeImageRatio((this.themeConfig as any)?.cardSales?.imageRatio, '1/1');
  }

  get ratingValue(): number {
    const r = this.product.rating ?? 0;
    if (isNaN(r)) return 0;
    return Math.max(0, Math.min(5, r));
  }

  stars = [1, 2, 3, 4, 5];
}
