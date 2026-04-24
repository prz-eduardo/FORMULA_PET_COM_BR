import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShopProduct } from '../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../constants/card.constants';
import { normalizeThemeConfig } from '../constants/loja-tema-card.config';
import { CardVariant1Component } from './variants/card-variant-1.component';
import { CardVariant2Component } from './variants/card-variant-2.component';
import { CardVariant3Component } from './variants/card-variant-3.component';
import { CardVariant4Component } from './variants/card-variant-4.component';
import { ProductCardSalesComponent } from '../product-card-sales/product-card-sales.component';

@Component({
  selector: 'app-product-card-renderer',
  standalone: true,
  imports: [CommonModule, CardVariant1Component, CardVariant2Component, CardVariant3Component, CardVariant4Component, ProductCardSalesComponent],
  templateUrl: './product-card-renderer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardRendererComponent {
  @Input() product!: ShopProduct;
  @Input() themeConfig: Record<string, unknown> | null = null;
  @Input() supportsFavorites = true;
  @Input() supportsRatings = true;
  @Input() favoriteActive?: boolean;
  @Input() disableLink = false;
  @Input() cardWidth: string = DEFAULT_PRODUCT_CARD_WIDTH;

  @Output() add = new EventEmitter<MouseEvent>();
  @Output() toggleFav = new EventEmitter<void>();

  get variant(): string {
    return normalizeThemeConfig(this.themeConfig).cardSales.variant;
  }
}
