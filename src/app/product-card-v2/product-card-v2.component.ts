import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ShopProduct } from '../services/store.service';

@Component({
  selector: 'app-product-card-v2',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './product-card-v2.component.html',
  styleUrls: ['./product-card-v2.component.scss']
})
export class ProductCardV2Component {
  @Input() product!: ShopProduct;
  @Input() supportsFavorites = true;
  @Input() supportsRatings = true;
  @Input() favoriteActive?: boolean;

  @Output() add = new EventEmitter<MouseEvent>();
  @Output() toggleFav = new EventEmitter<void>();

  get priceNow() {
    const price = this.product.price || 0;
    const disc = this.product.discount || 0;
    return Math.max(0, price - price * disc / 100);
  }

  get ratingValue(): number {
    const r = this.product.rating ?? 0;
    if (isNaN(r)) return 0;
    // Clamp to 0..5
    return Math.max(0, Math.min(5, r));
  }

  // Quick array to render stars (5)
  stars = [1,2,3,4,5];
}
