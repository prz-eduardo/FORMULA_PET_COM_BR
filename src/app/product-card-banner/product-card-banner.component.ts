import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShopProduct } from '../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../constants/card.constants';
import {
  cardBannerClassMap,
  normalizeCardBannerStructure,
} from '../constants/loja-tema-card.config';

@Component({
  selector: 'app-product-card-banner',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './product-card-banner.component.html',
  styleUrls: ['./product-card-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardBannerComponent {
  @Input() product!: ShopProduct;
  @Input() themeConfig: Record<string, unknown> | null = null;
  @Input() supportsFavorites = true;
  @Input() favoriteActive?: boolean;
  @Input() disableLink = false;
  @Input() cardWidth = DEFAULT_PRODUCT_CARD_WIDTH;

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

  get priceNow(): number {
    if (this.product.promoPrice != null) return this.product.promoPrice;
    const price = this.product.price || 0;
    const disc = this.product.discount || 0;
    return Math.max(0, price - price * disc / 100);
  }

  get oldPriceDisplay(): number | null {
    const strike = this.product.strikePrice;
    if (strike != null && Number.isFinite(strike) && strike > this.priceNow + 0.009) return strike;
    const orig = this.product?.price ?? 0;
    if (Number.isFinite(orig) && orig > this.priceNow + 0.009) return orig;
    return null;
  }

  get overlayOpacity(): number {
    const o = (this.themeConfig as any)?.cardBanner?.overlayOpacity;
    return typeof o === 'number' && o >= 0 && o <= 1 ? o : 0.45;
  }

  get minHeightPx(): number {
    const h = (this.themeConfig as any)?.cardBanner?.minHeightPx;
    return typeof h === 'number' && h > 80 ? h : 220;
  }

  get titleLines(): number {
    const n = (this.themeConfig as any)?.cardBanner?.titleLines;
    return n === 3 ? 3 : 2;
  }

  get bannerStructure() {
    return normalizeCardBannerStructure((this.themeConfig as any)?.cardBanner?.structure);
  }

  get bannerRootClass(): string {
    return cardBannerClassMap(this.bannerStructure);
  }
}
