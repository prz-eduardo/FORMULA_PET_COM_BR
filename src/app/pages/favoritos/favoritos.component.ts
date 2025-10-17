import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StoreService, ShopProduct } from '../../services/store.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, NavmenuComponent],
  templateUrl: './favoritos.component.html',
  styleUrls: ['./favoritos.component.scss']
})
export class FavoritosComponent implements OnInit {
  produtos: ShopProduct[] = [];
  favoritos: number[] = [];

  constructor(private store: StoreService) {}

  async ngOnInit() {
    await this.store.loadProducts();
    this.store.products$.subscribe(p => this.produtos = p);
    this.store.favorites$.subscribe(f => this.favoritos = f);
  }

  isFav(p: ShopProduct) { return this.store.isFavorite(p.id); }
}
