import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { StoreService } from '../../services/store.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NavmenuComponent],
  templateUrl: './carrinho.component.html',
  styleUrls: ['./carrinho.component.scss']
})
export class CarrinhoComponent {
  constructor(public store: StoreService) {}

  inc(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    if (item) this.store.updateQuantity(id, item.quantity + 1);
  }
  dec(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    if (item && item.quantity > 1) this.store.updateQuantity(id, item.quantity - 1);
  }
  remove(id: number) { this.store.removeFromCart(id); }
  clear() { this.store.clearCart(); }
  total() { return this.store.getCartTotals(); }
}
