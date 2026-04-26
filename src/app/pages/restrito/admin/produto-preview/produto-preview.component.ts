import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductCardRendererComponent } from '../../../../product-cards/product-card-renderer.component';
import { ShopProduct, StoreService, StoreMeta } from '../../../../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../../../../constants/card.constants';
import { inject } from '@angular/core';

@Component({
  selector: 'app-produto-preview',
  standalone: true,
  imports: [CommonModule, ProductCardRendererComponent],
  templateUrl: './produto-preview.component.html',
  styleUrls: ['./produto-preview.component.scss']
})
export class ProdutoPreviewComponent implements OnInit {
  product: ShopProduct | null = null;
  themeConfig: Record<string, unknown> | null = null;
  public readonly defaultCardWidth = DEFAULT_PRODUCT_CARD_WIDTH;
  private store = inject(StoreService);

  ngOnInit() {
    this.store.meta$.subscribe((m: StoreMeta | null) => {
      this.themeConfig = (m?.activeTheme?.config as Record<string, unknown> | undefined) ?? null;
    });
    try {
      const raw = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('admin:product_preview') : null;
      if (raw) this.product = JSON.parse(raw) as ShopProduct;
    } catch (err) {
      console.error('Erro ao carregar preview do produto', err);
      this.product = null;
    }
  }
}
