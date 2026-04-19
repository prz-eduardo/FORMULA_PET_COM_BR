import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductCardV2Component } from '../../../../product-card-v2/product-card-v2.component';
import { ShopProduct } from '../../../../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../../../../constants/card.constants';

@Component({
  selector: 'app-produto-preview',
  standalone: true,
  imports: [CommonModule, ProductCardV2Component],
  templateUrl: './produto-preview.component.html',
  styleUrls: ['./produto-preview.component.scss']
})
export class ProdutoPreviewComponent implements OnInit {
  product: ShopProduct | null = null;
  public readonly defaultCardWidth = DEFAULT_PRODUCT_CARD_WIDTH;

  ngOnInit() {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('admin:product_preview') : null;
      if (raw) this.product = JSON.parse(raw) as ShopProduct;
    } catch (err) {
      console.error('Erro ao carregar preview do produto', err);
      this.product = null;
    }
  }
}
