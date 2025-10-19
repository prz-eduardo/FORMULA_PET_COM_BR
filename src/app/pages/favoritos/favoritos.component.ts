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
    // First, refresh the server favorites list so local store has the IDs
    await this.store.refreshFavorites();
    // Then, load products with myFavorites to get only those and also sync flags
    await this.store.loadProducts({ myFavorites: true, page: 1, pageSize: 60, sort: 'my_favorites' });
    this.store.products$.subscribe(p => this.produtos = p);
    this.store.favorites$.subscribe(f => this.favoritos = f);
  }

  isFav(p: ShopProduct) { return this.store.isFavorite(p.id); }
}
