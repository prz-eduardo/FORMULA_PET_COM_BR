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
  tipo?: 'manipulado'|'pronto';
  customizations?: Record<string, string[]>;
  discount?: number;
  rating?: number; // média 0-5
  ratingsCount?: number;
  stock?: number;
  tags?: string[];
  weight?: string;
  requiresPrescription?: boolean;
  isFavorited?: boolean;
  favoritesCount?: number;
}
export interface StoreCategory { id: number; nome: string; produtos: number; }
export interface StoreTag { id: number; nome: string; produtos: number; }
export interface StoreMeta {
  loggedIn?: boolean;
  userType?: string;
  favoritesPersonalization?: boolean;
  supports?: { images?: boolean; favorites?: boolean; ratings?: boolean; categories?: boolean; tags?: boolean };
  categories?: StoreCategory[];
  tags?: StoreTag[];
}

export interface CartItem {
  product: ShopProduct;
  quantity: number;
  // If the product requires prescription, these fields help enforce the flow
  prescriptionId?: string; // ID of a generated prescription from the system
  prescriptionFileName?: string; // Uploaded PDF name
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private productsSubject = new BehaviorSubject<ShopProduct[]>([]);
  products$ = this.productsSubject.asObservable();

  private categoriesSubject = new BehaviorSubject<StoreCategory[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  private metaSubject = new BehaviorSubject<StoreMeta | null>(null);
  meta$ = this.metaSubject.asObservable();

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

  private isBrowser(): boolean {
    try { return typeof window !== 'undefined' && typeof localStorage !== 'undefined'; } catch { return false; }
  }

  // Products - server-first with local fallback
  async loadProducts(params?: { page?: number; pageSize?: number; q?: string; tipo?: 'manipulado'|'pronto'; category?: string; categoryId?: string|number; categories?: string[]; tag?: string; tags?: (string|number)[]; minPrice?: number; maxPrice?: number; myFavorites?: boolean; sort?: 'relevance'|'newest'|'price_asc'|'price_desc'|'popularity'|'rating'|'my_favorites' }): Promise<{ total: number; totalPages: number; page: number; pageSize: number; meta?: StoreMeta }> {
    // Try server endpoint if available
    try {
      const token = this.isBrowser() ? (localStorage.getItem('token') || undefined) : undefined;
  const res = await this.api.listStoreProducts(params, token).toPromise();
      const list = (res?.data || []).map((it: any) => ({
        id: it.id,
        name: it.nome || it.name,
        description: it.descricao || it.description || '',
        price: Number(it.preco ?? it.price ?? 0),
        image: it.imagem_url || it.image || '',
        category: it.categoria || it.category || '',
        tipo: it.tipo === 'manipulado' || it.tipo === 'pronto' ? it.tipo : undefined,
        discount: it.desconto || 0,
        rating: typeof it.rating_media === 'number' ? it.rating_media : (typeof it.rating_media === 'string' ? parseFloat(it.rating_media) : undefined),
        ratingsCount: typeof it.rating_total === 'number' ? it.rating_total : undefined,
        isFavorited: typeof it.is_favorited === 'boolean' ? it.is_favorited : (it.is_favorited === 1 ? true : (it.is_favorited === 0 ? false : undefined)),
        favoritesCount: typeof it.favoritos === 'number' ? it.favoritos : undefined,
        stock: undefined,
        tags: undefined,
        weight: undefined,
        requiresPrescription: undefined
      })) as ShopProduct[];
  this.productsSubject.next(list);
  // Keep favorites list in sync with server flags
  const serverFavIds = list.filter(p => p.isFavorited === true).map(p => p.id);
  const isFavMode = !!params?.myFavorites;
  // If server returned only favorites but didn't flag is_favorited, fall back to treating all returned IDs as favorites
  const derivedFavIds = isFavMode && serverFavIds.length === 0 ? list.map(p => p.id) : serverFavIds;
  this.favoritesSubject.next(derivedFavIds);
  if (this.isBrowser()) localStorage.setItem('favorites', JSON.stringify(derivedFavIds));
      // Meta and categories/tags support
      const meta: StoreMeta | undefined = res?.meta ? {
        loggedIn: res.meta.loggedIn,
        userType: res.meta.userType,
        favoritesPersonalization: res.meta.favoritesPersonalization,
        supports: res.meta.supports,
        categories: res.meta.categories,
        tags: res.meta.tags,
      } : undefined;
      this.metaSubject.next(meta || null);
      const cats = meta?.categories || [];
      this.categoriesSubject.next(cats);
      return { total: res?.total || list.length, totalPages: res?.totalPages || 1, page: res?.page || (params?.page || 1), pageSize: res?.pageSize || (params?.pageSize || 20), meta };
    } catch {
      this.toast.error('Não foi possível carregar os produtos.', 'Erro');
      this.productsSubject.next([]);
      this.categoriesSubject.next([]);
      this.metaSubject.next(null);
      return { total: 0, totalPages: 1, page: params?.page || 1, pageSize: params?.pageSize || 20 };
    }
  }

  // Favorites
  async toggleFavorite(productId: number): Promise<boolean> {
    const ok = await this.ensureClienteSession();
    if (!ok) return false;
    try {
      const token = this.isBrowser() ? (localStorage.getItem('token') || '') : '';
      // Call backend toggle
      const resp = await this.api.toggleFavorite(productId, token).toPromise();
      const serverFavorited = typeof resp?.is_favorited === 'boolean'
        ? resp.is_favorited
        : (typeof resp?.favorited === 'boolean' ? resp.favorited : undefined);
      // Update local favorites set and product snapshot aligned to server
      const fav = new Set(this.favoritesSubject.value);
      const shouldBeFav = serverFavorited != null ? serverFavorited : !fav.has(productId);
      if (shouldBeFav) {
        fav.add(productId);
        this.toast.success('Adicionado aos favoritos');
      } else {
        fav.delete(productId);
        this.toast.info('Removido dos favoritos');
      }
      const arr = Array.from(fav);
      this.favoritesSubject.next(arr);
      if (this.isBrowser()) {
        localStorage.setItem('favorites', JSON.stringify(arr));
      }
      // Sync product snapshot with favoritesCount and isFavorited
      const list = this.productsSubject.value.map(p => {
        if (p.id !== productId) return p;
        const updated: ShopProduct = { ...p };
        if (typeof resp?.favoritos === 'number') {
          updated.favoritesCount = resp.favoritos;
        } else if (serverFavorited != null) {
          // Fallback: infer delta from previous state when server doesn't send count
          const prev = !!p.isFavorited;
          if (prev !== serverFavorited) {
            const delta = serverFavorited ? 1 : -1;
            const base = typeof p.favoritesCount === 'number' ? p.favoritesCount : 0;
            updated.favoritesCount = Math.max(0, base + delta);
          }
        }
        if (serverFavorited != null) updated.isFavorited = serverFavorited;
        return updated;
      });
      this.productsSubject.next(list);
      return true;
    } catch (e) {
      this.toast.error('Não foi possível atualizar favoritos no servidor.');
      return false;
    }
  }

  isFavorite(productId: number): boolean {
    return this.favoritesSubject.value.includes(productId);
  }

  /**
   * Refresh favorites list from server without replacing current products grid.
   * Useful right after login or when opening the favorites route directly.
   */
  async refreshFavorites(): Promise<void> {
    try {
      const token = this.isBrowser() ? (localStorage.getItem('token') || undefined) : undefined;
      if (!token) return;
      const res: any = await this.api.listStoreProducts({ myFavorites: true, page: 1, pageSize: 9999 }, token).toPromise();
      const list = (res?.data || []) as any[];
      const favIds = list.map((it: any) => Number(it.id)).filter((n: any) => Number.isFinite(n));
      this.favoritesSubject.next(favIds);
      if (this.isBrowser()) localStorage.setItem('favorites', JSON.stringify(favIds));
    } catch {
      // ignore; keep local favorites
    }
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
      const token = this.isBrowser() ? localStorage.getItem('token') : null;
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
      const token = this.isBrowser() ? localStorage.getItem('token') : null;
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
    if (!this.isBrowser()) return [];
    try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { return []; }
  }

  private readCart(): CartItem[] {
    if (!this.isBrowser()) return [];
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  }

  private persistCart(cart: CartItem[]) {
    if (!this.isBrowser()) return;
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  // Prescription helpers
  setItemPrescriptionById(productId: number, data: { prescriptionId?: string; prescriptionFileName?: string }) {
    const cart = this.cartSubject.value.map(ci =>
      ci.product.id === productId ? { ...ci, ...data } : ci
    );
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  /**
   * Returns true if all items that require prescription have either a linked
   * system prescription (prescriptionId) or an uploaded PDF (prescriptionFileName)
   */
  isCheckoutAllowed(): boolean {
    return this.cartSubject.value.every(ci => {
      if (!ci.product.requiresPrescription) return true;
      return Boolean(ci.prescriptionId || ci.prescriptionFileName);
    });
  }
}
