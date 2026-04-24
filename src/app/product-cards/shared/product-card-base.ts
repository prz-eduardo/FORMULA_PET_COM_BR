import { Directive, EventEmitter, Input, Output } from '@angular/core';
import { ShopProduct } from '../../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../../constants/card.constants';
import { normalizeImageRatio } from '../../constants/loja-tema-card.config';

@Directive()
export abstract class ProductCardBase {
  @Input() product!: ShopProduct;
  @Input() themeConfig: Record<string, unknown> | null = null;
  @Input() supportsFavorites = true;
  @Input() supportsRatings = true;
  @Input() favoriteActive?: boolean;
  @Input() disableLink = false;
  @Input() cardWidth: string = DEFAULT_PRODUCT_CARD_WIDTH;

  @Output() add = new EventEmitter<MouseEvent>();
  @Output() toggleFav = new EventEmitter<void>();

  stars = [1, 2, 3, 4, 5];

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
    const fallbackFromTheme = String((this.themeConfig as any)?.cardSales?.fallbackImageUrl || '').trim();
    const u = (this.product.image || this.product.imageUrl || fromGallery || '').toString().trim();
    return u || fallbackFromTheme || '/imagens/image.png';
  }

  get priceNow(): number {
    if (this.product.promoPrice != null) return this.product.promoPrice;
    const base = this.product.price ?? 0;
    if (this.product.priceFinal != null && this.product.priceFinal < base - 0.009) return this.product.priceFinal;
    const disc = this.product.discount || 0;
    return Math.max(0, base - base * disc / 100);
  }

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
}
