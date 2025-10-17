import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';

export interface ShopProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  customizations?: Record<string, string[]>;
  discount?: number;
  rating?: number;
  stock?: number;
  tags?: string[];
  weight?: string;
}

export interface CartItem {
  product: ShopProduct;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private productsSubject = new BehaviorSubject<ShopProduct[]>([]);
  products$ = this.productsSubject.asObservable();

  private categoriesSubject = new BehaviorSubject<string[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  private favoritesSubject = new BehaviorSubject<number[]>(this.readFavorites());
  favorites$ = this.favoritesSubject.asObservable();

  private cartSubject = new BehaviorSubject<CartItem[]>(this.readCart());
  cart$ = this.cartSubject.asObservable();

  private clienteChecked = false;
  private isCliente = false;

  constructor(
    private http: HttpClient,
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  // Products
  async loadProducts(): Promise<void> {
    try {
      const products = await this.http.get<ShopProduct[]>('/products.json').toPromise();
      const list = products || [];
      this.productsSubject.next(list);
      const cats = Array.from(new Set(list.map(p => p.category).filter(Boolean))).sort();
      this.categoriesSubject.next(cats);
    } catch (err) {
      this.toast.error('Não foi possível carregar os produtos.', 'Erro');
      this.productsSubject.next([]);
      this.categoriesSubject.next([]);
    }
  }

  // Favorites
  async toggleFavorite(productId: number): Promise<boolean> {
    const ok = await this.ensureClienteSession();
    if (!ok) return false;
    const fav = new Set(this.favoritesSubject.value);
    if (fav.has(productId)) {
      fav.delete(productId);
      this.toast.info('Removido dos favoritos');
    } else {
      fav.add(productId);
      this.toast.success('Adicionado aos favoritos');
    }
    const arr = Array.from(fav);
    this.favoritesSubject.next(arr);
    localStorage.setItem('favorites', JSON.stringify(arr));
    return true;
  }

  isFavorite(productId: number): boolean {
    return this.favoritesSubject.value.includes(productId);
  }

  // Cart
  get cartSnapshot() { return this.cartSubject.value; }

  async addToCart(product: ShopProduct, quantity: number = 1): Promise<boolean> {
    if (quantity <= 0) return false;
    const ok = await this.ensureClienteSession();
    if (!ok) return false;
    const cart = [...this.cartSubject.value];
    const idx = cart.findIndex(ci => ci.product.id === product.id);
    if (idx >= 0) cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + quantity };
    else cart.push({ product, quantity });
    this.cartSubject.next(cart);
    this.persistCart(cart);
    this.toast.success('Produto adicionado ao carrinho');
    return true;
  }

  removeFromCart(productId: number) {
    const cart = this.cartSubject.value.filter(ci => ci.product.id !== productId);
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) return this.removeFromCart(productId);
    const cart = this.cartSubject.value.map(ci =>
      ci.product.id === productId ? { ...ci, quantity } : ci
    );
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  clearCart() {
    this.cartSubject.next([]);
    this.persistCart([]);
  }

  getCartTotals() {
    const items = this.cartSubject.value;
    const subtotal = items.reduce((sum, it) => sum + this.getPriceWithDiscount(it.product) * it.quantity, 0);
    const total = subtotal; // frete/impostos no futuro
    const count = items.reduce((n, it) => n + it.quantity, 0);
    return { count, subtotal, total };
  }

  getPriceWithDiscount(p: ShopProduct) {
    const price = p.price || 0;
    const disc = p.discount || 0;
    return Math.max(0, price - price * disc / 100);
  }

  // Session helpers
  async isClienteLoggedSilent(): Promise<boolean> {
    if (this.clienteChecked) return this.isCliente;
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Sem token');
      const resp = await this.api.getClienteMe(token).toPromise();
      if (resp && resp.user && resp.user.tipo === 'cliente') {
        this.clienteChecked = true;
        this.isCliente = true;
        return true;
      }
      this.clienteChecked = true;
      this.isCliente = false;
      return false;
    } catch {
      this.clienteChecked = true;
      this.isCliente = false;
      return false;
    }
  }

  resetClienteGate() {
    this.clienteChecked = false;
    this.isCliente = false;
  }

  private async ensureClienteSession(): Promise<boolean> {
    if (this.clienteChecked) return this.isCliente;
    // Tenta validar via backend (clientes/me). Se falhar, redireciona para login de cliente.
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Sem token');
      const resp = await this.api.getClienteMe(token).toPromise();
      if (resp && resp.user && resp.user.tipo === 'cliente') {
        this.clienteChecked = true;
        this.isCliente = true;
        return true;
      }
      throw new Error('Não é cliente');
    } catch {
      this.clienteChecked = true;
      this.isCliente = false;
      this.toast.info('Faça login de cliente para usar favoritos e carrinho.', 'Login necessário');
      return false;
    }
  }

  // Persistence
  private readFavorites(): number[] {
    try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { return []; }
  }

  private readCart(): CartItem[] {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  }

  private persistCart(cart: CartItem[]) {
    localStorage.setItem('cart', JSON.stringify(cart));
  }
}
