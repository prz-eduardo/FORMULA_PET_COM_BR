import { Component, OnInit, ElementRef, ViewChild, Renderer2, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService, ShopProduct, StoreCategory, StoreMeta } from '../../services/store.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { FooterComponent } from '../../footer/footer.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ProductCardV2Component } from '../../product-card-v2/product-card-v2.component';

@Component({
  selector: 'app-loja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavmenuComponent, FooterComponent, ProductCardV2Component],
  templateUrl: './loja.component.html',
  styleUrls: ['./loja.component.scss']
})
export class LojaComponent implements OnInit, AfterViewInit, OnDestroy {
  categorias: StoreCategory[] = [];
  produtos: ShopProduct[] = [];
  // Infinite scroll accumulation
  private accum: ShopProduct[] = [];
  private chunks: Array<{ items: ShopProduct[]; banners?: ShopProduct[] }> = [];
  private usedFeatured = new Set<number>();
  // Memoized render lists to avoid recomputation on every change detection
  interleavedList: Array<{ type: 'product'|'banner'; product: ShopProduct }> = [];
  featuredTopList: ShopProduct[] = [];
  featuredRowList: ShopProduct[] = [];
  storeMeta: StoreMeta | null = null;
  filtro = '';
  categoria = '';
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'my_favorites' = 'relevance';
  onlyFavorites = false;
  // Pagination
  page = 1;
  pageSize = 20;
  total = 0;
  totalPagesSrv = 1;
  loading = false;
  // Auth UI
  showLogin = false;
  closingLogin = false;
  showEmailLogin = false;
  email = '';
  senha = '';
  me: any = null;
  popoverTop = 0;
  popoverLeft = 0;
  private pendingProduct: ShopProduct | null = null;
  // Filters modal state
  showFilters = false;
  filtroDraft = '';
  categoriaDraft = '';
  sortDraft: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'my_favorites' = 'relevance';
  // Extra filters (applied)
  minPrice?: number;
  maxPrice?: number;
  promoOnly = false;
  inStockOnly = false;
  minRating?: number;
  // Drafts for modal
  minPriceDraft?: number;
  maxPriceDraft?: number;
  promoOnlyDraft = false;
  inStockOnlyDraft = false;
  minRatingDraft?: number;

  @ViewChild('cartBtn', { static: true }) cartBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('profileBtn') profileBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('infiniteAnchor') infiniteAnchor?: ElementRef<HTMLDivElement>;
  private io?: IntersectionObserver;
  private lastLoggedIn?: boolean;
  private lastFetchKey: string | null = null;
  private initializedFromParams = false;

  constructor(private store: StoreService, private toast: ToastService, private renderer: Renderer2, private api: ApiService, private auth: AuthService, private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    this.store.products$.subscribe(p => this.produtos = p);
  this.store.categories$.subscribe(c => this.categorias = c);
  this.store.meta$.subscribe(m => this.storeMeta = m);
    // React to global auth changes: apenas atualiza perfil; não refaz produtos
    this.auth.isLoggedIn$.subscribe(async ok => {
      if (this.lastLoggedIn === ok) return; // ignore duplicate emissions
      this.lastLoggedIn = ok ?? false;
      if (ok) {
        await this.fetchMe();
      }
    });
    // try fetch me silently
    await this.fetchMe();
    // If not logged in, clear cart as requested
    if (!this.me) this.store.clearCart();
  // read query params to prefill filters
    this.route.queryParamMap.subscribe(async params => {
      const q = params.get('q');
      const cat = params.get('cat');
      const login = params.get('login');
      const fav = params.get('fav');
      const srt = params.get('sort');
      const prom = params.get('promo');
      if (q !== null) this.filtro = q;
      if (cat !== null) this.categoria = cat;
      // promo flag from URL
      this.promoOnly = prom === '1';
      if (login === '1') this.openLoginNearProfile();
      this.onlyFavorites = fav === '1';
      if (srt) {
        const valid = ['relevance','newest','price_asc','price_desc','rating','popularity','my_favorites'] as const;
        if ((valid as readonly string[]).includes(srt)) this.sort = srt as any;
      }
      // Chama produtos somente no primeiro carregamento; demais filtros acionam fetch explicitamente
      if (!this.initializedFromParams) {
        this.initializedFromParams = true;
        await this.fetchProducts(true);
      }
    });
    // removido: evitamos fetch duplicado; o subscribe de params já chama fetchProducts(true)
  }

  ngAfterViewInit(): void {
    // Set up infinite scroll observer in browser only
    if (typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) return;
    this.io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          this.loadNextPageIfNeeded();
        }
      }
    }, { rootMargin: '240px' });
    if (this.infiniteAnchor?.nativeElement) this.io.observe(this.infiniteAnchor.nativeElement);
  }

  ngOnDestroy(): void {
    try { this.io?.disconnect(); } catch {}
  }

  // Base list to display: accumulated (infinite) if present, else latest page
  private baseList(): ShopProduct[] {
    return (this.accum.length ? this.accum : this.produtos) || [];
  }

  get filtered(): ShopProduct[] {
    // Deixe o servidor cuidar de categoria, busca e ordenação.
    // Mantemos a lista como veio do backend; local só faz favoritos quando necessário.
    let base = this.baseList();
    if (this.onlyFavorites) {
      // Em modo favoritos, ainda assim buscamos no servidor, mas caso venha tudo, garantimos estado local coerente
      base = base.filter(p => this.isFav(p));
    }
    // Local filters (complementares ao servidor)
    const minP = typeof this.minPrice === 'number' ? this.minPrice : undefined;
    const maxP = typeof this.maxPrice === 'number' ? this.maxPrice : undefined;
    if (minP != null) base = base.filter(p => this.price(p) >= minP);
    if (maxP != null) base = base.filter(p => this.price(p) <= maxP);
    if (this.promoOnly) base = base.filter(p => (p.discount || 0) > 0);
    if (typeof this.minRating === 'number' && this.minRating > 0) base = base.filter(p => (p.rating || 0) >= this.minRating!);
    if (this.inStockOnly) base = base.filter(p => p.stock != null && p.stock > 0);
    return base;
  }

  // Paginated slice of filtered (server paginates; local slice only if we truly filtered local-only)
  get paginated(): ShopProduct[] {
    return this.filtered;
  }

  // Rebuild memoized lists when data or filters change
  private rebuildInterleavedAndFeatured() {
    // Interleaved list from chunks
    const out: Array<{ type: 'product'|'banner'; product: ShopProduct }> = [];
    for (const ch of this.chunks) {
      const items = [...ch.items];
      const banners = ch.banners || [];
      if (!items.length && banners.length) {
        for (const b of banners) out.push({ type: 'banner', product: b });
        continue;
      }
      const insertIndex = Math.max(1, Math.floor(items.length / 2));
      const before = items.slice(0, insertIndex);
      const after = items.slice(insertIndex);
      for (const p of before) out.push({ type: 'product', product: p });
      for (const b of banners) out.push({ type: 'banner', product: b });
      for (const p of after) out.push({ type: 'product', product: p });
    }
    this.interleavedList = out;

    // Featured lists
    const feats = this.baseList().filter(p => (p as any).featured && this.passesLocalFilters(p));
    const sorted = feats.length ? [...feats].sort((a, b) => (b.discount || 0) - (a.discount || 0)) : [];
    this.featuredTopList = sorted.slice(0, 5);
    this.featuredRowList = this.featuredTopList.slice(0, 3);
  }

  // trackBy helpers to avoid DOM re-creation and image flicker
  trackInterleaved = (_: number, it: { type: 'product'|'banner'; product: ShopProduct }) => `${it.type}:${it.product.id}`;
  trackProduct = (_: number, p: ShopProduct) => p.id;
  trackCategory = (_: number, c: StoreCategory) => c.id ?? c.nome;
  trackFilter = (_: number, f: { key: string; label: string }) => f.key;

  onToggleFavFromCard(p: ShopProduct, ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    this.toggleFav(p);
  }
  onAddToCartFromCard(p: ShopProduct, ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    this.onAddToCart(p, ev);
  }
  totalPages(): number { return this.totalPagesSrv; }
  pageStart(): number { return (this.page - 1) * this.pageSize + 1; }
  pageEnd(): number { const totalLocal = this.total; return Math.min(this.page * this.pageSize, totalLocal); }
  canPrev(): boolean { return this.page > 1; }
  canNext(): boolean { return this.page < this.totalPages(); }
  async prevPage() { if (this.canPrev()) { this.page--; await this.fetchProducts(); } }
  async nextPage() { if (this.canNext()) { this.page++; await this.fetchProducts(); } }
  async goToPage(p: number) { const t = this.totalPages(); this.page = Math.min(Math.max(1, p), t); await this.fetchProducts(); }
  async onChangePageSize(ev: Event) { const v = Number((ev.target as HTMLSelectElement).value) || 20; this.pageSize = v; this.page = 1; await this.fetchProducts(); }

  // Active filters summary for UI badges
  get activeFilters(): string[] {
    const out: string[] = [];
    if (this.filtro?.trim()) out.push(`Busca: ${this.filtro.trim()}`);
    // Categoria selecionada não deve aparecer nos badges
    if (typeof this.minPrice === 'number') out.push(`Min: ${this.formatBRL(this.minPrice)}`);
    if (typeof this.maxPrice === 'number') out.push(`Max: ${this.formatBRL(this.maxPrice)}`);
    if (this.promoOnly) out.push('Promoção');
    if (this.inStockOnly) out.push('Com estoque');
    if (typeof this.minRating === 'number' && this.minRating > 0) out.push(`Nota: ${this.minRating}+`);
    if (this.sort && this.sort !== 'relevance') {
      const labelMap: any = { newest: 'Mais recentes', price_asc: 'Menor preço', price_desc: 'Maior preço', rating: 'Melhor avaliação', popularity: 'Mais populares', my_favorites: 'Favoritos' };
      out.push(`Ordenação: ${labelMap[this.sort] || this.sort}`);
    }
    return out;
  }

  // Structured filters for dismissible badges outside the modal
  get activeFiltersDetailed(): Array<{ key: string; label: string }> {
    const out: Array<{ key: string; label: string }> = [];
    if (this.filtro?.trim()) out.push({ key: 'q', label: `Busca: ${this.filtro.trim()}` });
    if (typeof this.minPrice === 'number') out.push({ key: 'min', label: `Min: ${this.formatBRL(this.minPrice)}` });
    if (typeof this.maxPrice === 'number') out.push({ key: 'max', label: `Max: ${this.formatBRL(this.maxPrice)}` });
    if (this.promoOnly) out.push({ key: 'promo', label: 'Promoção' });
    if (this.inStockOnly) out.push({ key: 'stock', label: 'Com estoque' });
    if (typeof this.minRating === 'number' && this.minRating > 0) out.push({ key: 'rating', label: `Nota: ${this.minRating}+` });
    if (this.sort && this.sort !== 'relevance') {
      const labelMap: any = { newest: 'Mais recentes', price_asc: 'Menor preço', price_desc: 'Maior preço', rating: 'Melhor avaliação', popularity: 'Mais populares', my_favorites: 'Favoritos' };
      out.push({ key: 'sort', label: `Ordenação: ${labelMap[this.sort] || this.sort}` });
    }
    return out;
  }

  async clearSearch() {
    if (!this.filtro) return;
    this.filtro = '';
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
    this.rebuildInterleavedAndFeatured();
  }

  async onClearSearch(ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    await this.clearSearch();
  }

  async clearFilterByKey(key: string) {
    switch (key) {
      case 'q':
        this.filtro = '';
        break;
      case 'min':
        this.minPrice = undefined;
        this.minPriceDraft = undefined;
        break;
      case 'max':
        this.maxPrice = undefined;
        this.maxPriceDraft = undefined;
        break;
      case 'promo':
        this.promoOnly = false;
        this.promoOnlyDraft = false;
        break;
      case 'stock':
        this.inStockOnly = false;
        this.inStockOnlyDraft = false;
        break;
      case 'rating':
        this.minRating = undefined;
        this.minRatingDraft = undefined;
        break;
      case 'sort':
        this.sort = 'relevance';
        this.sortDraft = 'relevance';
        break;
      case 'fav':
        this.onlyFavorites = false;
        break;
    }
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
    this.rebuildInterleavedAndFeatured();
  }

  async onClearFilter(ev: MouseEvent, key: string) {
    ev.preventDefault();
    ev.stopPropagation();
    await this.clearFilterByKey(key);
  }

  // Event delegation for badges container to improve click reliability on desktop
  onBadgesContainerClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    // If click lands on the inner X span or the button itself
    const badge = (target.closest('button.mini-badge.closable') as HTMLElement | null);
    const key = badge?.getAttribute('data-key');
    if (key) {
      ev.preventDefault();
      ev.stopPropagation();
      this.clearFilterByKey(key);
    }
  }

  

  private formatBRL(n: number): string {
    try { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${n}`; }
  }

  async onCategoryChange(val: string) {
    this.categoria = val;
    // Selecting a normal category disables promo-only mode
    this.promoOnly = false;
    this.page = 1;
    await this.fetchProducts(true);
    this.rebuildInterleavedAndFeatured();
    this.persistQueryParams();
  }
  async selectPromotions() {
    // Fixed "Promoções" category behavior
    this.promoOnly = true;
    this.categoria = '';
    this.page = 1;
    await this.fetchProducts(true);
    this.rebuildInterleavedAndFeatured();
    this.persistQueryParams();
  }
  async onSortChange(val: 'relevance'|'newest'|'price_asc'|'price_desc'|'rating'|'popularity') { this.sort = val; this.page = 1; await this.fetchProducts(true); this.rebuildInterleavedAndFeatured(); this.persistQueryParams(); }
  private queryDebounce?: any;
  async onQueryChange(val: string) {
    this.filtro = val;
    this.page = 1;
    // debounce quick typing to avoid spamming server
    if (this.queryDebounce) clearTimeout(this.queryDebounce);
    await new Promise<void>(resolve => {
      this.queryDebounce = setTimeout(async () => { await this.fetchProducts(true); this.rebuildInterleavedAndFeatured(); resolve(); }, 250);
    });
    this.persistQueryParams();
  }

  isFav(p: ShopProduct) { return this.store.isFavorite(p.id); }
  async toggleFav(p: ShopProduct) {
    // Require login
    const logged = await this.store.isClienteLoggedSilent();
    if (!logged) { this.openLoginNearProfile(); return; }
    // Optimistic toggle
    const wasFav = this.store.isFavorite(p.id);
    this.store.optimisticFavorite(p.id, !wasFav);
    const ok = await this.store.toggleFavorite(p.id);
    if (!ok) {
      // revert
      this.store.optimisticFavorite(p.id, wasFav);
    }
  }
  openFilters() {
    // seed drafts with current
    this.filtroDraft = this.filtro;
    this.categoriaDraft = this.categoria;
    this.sortDraft = this.sort;
    this.minPriceDraft = this.minPrice;
    this.maxPriceDraft = this.maxPrice;
    this.promoOnlyDraft = this.promoOnly;
    this.inStockOnlyDraft = this.inStockOnly;
    this.minRatingDraft = this.minRating;
    this.showFilters = true;
  }
  closeFilters() { this.showFilters = false; }
  clearFilters() {
    this.filtroDraft = '';
    this.categoriaDraft = '';
    this.sortDraft = 'relevance';
    this.minPriceDraft = undefined;
    this.maxPriceDraft = undefined;
    this.promoOnlyDraft = false;
    this.inStockOnlyDraft = false;
    this.minRatingDraft = undefined;
  }
  async applyFilters() {
    this.filtro = this.filtroDraft;
    this.categoria = this.categoriaDraft;
    this.sort = this.sortDraft;
    this.minPrice = this.minPriceDraft;
    this.maxPrice = this.maxPriceDraft;
    this.promoOnly = this.promoOnlyDraft;
    this.inStockOnly = this.inStockOnlyDraft;
    this.minRating = this.minRatingDraft;
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
    this.closeFilters();
  }
  async addToCart(p: ShopProduct): Promise<boolean> {
    const ok = await this.store.addToCart(p, 1);
    if (!ok) {
      this.pendingProduct = p;
      this.openLoginNearProfile();
    }
    return ok;
  }
  price(p: ShopProduct) { return this.store.getPriceWithDiscount(p); }

  // Exibe a quantidade total de itens no carrinho no botão do topo
  get cartCount(): number {
    return this.store.getCartTotals().count;
  }

  async onAddToCart(p: ShopProduct, ev: Event) {
    // If not logged in, clicking cart should trigger login
    if (!this.me) { this.openLoginNearProfile(); return; }
    const ok = await this.addToCart(p);
    if (ok) this.flyToCart(ev);
  }

  // If user clicks cart link and is not logged in, intercept to open login
  onCartClick(ev: MouseEvent) {
    ev.preventDefault();
    if (!this.me) { this.openLoginNearProfile(); return; }
    this.router.navigate(['/carrinho']);
  }

  toggleFavoritesOnly() {
    this.onlyFavorites = !this.onlyFavorites;
    // reflect in query params and refetch when toggled off
    this.persistQueryParams();
    // Favoritos é um filtro: sempre refaz a consulta
    this.page = 1;
    this.fetchProducts(true).then(() => this.rebuildInterleavedAndFeatured());
  }

  private flyToCart(ev: Event) {
    try {
      if (!this.cartBtn) return;
      const target = ev.currentTarget as HTMLElement;
      const srcRect = target.getBoundingClientRect();
      const cartRect = this.cartBtn.nativeElement.getBoundingClientRect();
      const centerX = srcRect.left + srcRect.width / 2;
      const centerY = srcRect.top + srcRect.height / 2;
      const destX = cartRect.left + cartRect.width / 2;
      const destY = cartRect.top + cartRect.height / 2;
      const translateX = destX - centerX;
      const translateY = destY - centerY;

      const spawn = (cls: string, size: number, scaleStart: number, opacity: number, delayMs: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        if (cls) this.renderer.addClass(el, cls);
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        // position centered at source
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `${opacity}`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(${scaleStart})`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms cubic-bezier(.22,.61,.36,1), opacity ${durationMs}ms ease`);
        this.renderer.setStyle(el, 'transition-delay', `${delayMs}ms`);
        document.body.appendChild(el);

        // Force layout then animate
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(${translateX}px, ${translateY}px) scale(0.2)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + delayMs + 240);
      };

      // Origin ring for extra feedback
      const spawnRing = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `0.9`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(0.4)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        document.body.appendChild(el);
        // Force layout
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(1.6)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + 120);
      };

      // Destination burst near the cart
      const spawnDestBurst = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${destX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${destY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `0.95`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(0.4)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        document.body.appendChild(el);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(1.7)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + 120);
      };

  // Spawn a subtle ring at origin
  spawnRing(30, 900);
  // Main dot (bigger, brighter) - slower
  spawn('spark', 26, 1.35, 1, 0, 2000);
  // Trail dots - longer and more visible (extra clones for longer "rastro")
  spawn('ghost', 20, 1.24, 0.92, 120, 2200);
  spawn('tail', 16, 1.14, 0.84, 240, 2350);
  spawn('ghost', 14, 1.10, 0.76, 360, 2450);
  spawn('tail', 12, 1.06, 0.68, 480, 2550);
  spawn('ghost', 10, 1.04, 0.6, 600, 2650);

      // Pulse cart button on arrival
      const pulseDelay = 2000;
      setTimeout(() => {
        this.renderer.addClass(this.cartBtn!.nativeElement, 'pulse');
        setTimeout(() => this.renderer.removeClass(this.cartBtn!.nativeElement, 'pulse'), 800);
      }, pulseDelay);

      // Destination burst close to arrival for extra visibility
      setTimeout(() => spawnDestBurst(30, 700), pulseDelay - 120);
    } catch {
      // ignore animation errors silently
    }
  }

  // Inline auth
  async fetchMe() {
    try {
      const token = (typeof window !== 'undefined' && typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
      if (!token) { this.me = null; return; }
      const resp = await this.api.getClienteMe(token).toPromise();
      this.me = resp?.user || null;
    } catch { this.me = null; }
  }

  toggleLogin(ev?: MouseEvent) {
    if (this.showLogin || this.closingLogin) {
      this.closeLogin();
    } else {
      this.showLogin = true;
      this.closingLogin = false;
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => this.positionPopover());
      } else {
        this.positionPopover();
      }
    }
    ev?.stopPropagation();
  }

  toggleEmailLogin() {
    this.showEmailLogin = !this.showEmailLogin;
    // Ensure popover stays within viewport when content height changes
    this.positionPopover();
  }

  private positionPopover() {
    try {
      const btn = this.profileBtn?.nativeElement;
      if (!btn) { this.popoverTop = 100; this.popoverLeft = 100; return; }
      const rect = btn.getBoundingClientRect();
      // initial estimate
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX;
      // First clamp with rough size, then refine after render using actual element size
      const roughW = 300; const roughH = 260;
      const clamp = (w: number, h: number) => {
        const maxLeft = window.scrollX + window.innerWidth - w - 8;
        const maxTop = window.scrollY + window.innerHeight - h - 8;
        this.popoverLeft = Math.max(window.scrollX + 8, Math.min(left, maxLeft));
        // On mobile we slide in from right; align top to the login button with small offset
        const desiredTop = rect.top + window.scrollY - 8; // slightly above button center
        this.popoverTop = Math.max(window.scrollY + 8, Math.min(desiredTop, maxTop));
      };
      clamp(roughW, roughH);
      // next tick: measure and re-clamp
      setTimeout(() => {
        const el = document.querySelector('.login-popover') as HTMLElement | null;
        if (!el) return;
        const w = el.offsetWidth || roughW;
        const h = el.offsetHeight || roughH;
        clamp(w, h);
      }, 0);
    } catch { this.popoverTop = 100; this.popoverLeft = 100; }
  }

  closeLogin() {
    if (!this.showLogin || this.closingLogin) return;
    this.closingLogin = true;
    this.showEmailLogin = false;
  // Match the CSS mobile closing duration (.9s). Desktop closes immediately visually.
  const durationMs = 900;
    setTimeout(() => {
      this.showLogin = false;
      this.closingLogin = false;
    }, durationMs);
  }

  private openLoginNearProfile() {
    this.showLogin = true;
    this.closingLogin = false;
    this.positionPopover();
  }

  private persistQueryParams() {
    const queryParams: any = {};
    if (this.filtro) queryParams.q = this.filtro; else queryParams.q = null;
    if (this.categoria) queryParams.cat = this.categoria; else queryParams.cat = null;
    if (this.onlyFavorites) queryParams.fav = '1'; else queryParams.fav = null;
    if (this.promoOnly) queryParams.promo = '1'; else queryParams.promo = null;
    if (this.sort && this.sort !== 'relevance') queryParams.sort = this.sort; else queryParams.sort = null;
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private buildFetchKey(extra?: any): string {
    const base = {
      page: this.page,
      pageSize: this.pageSize,
      categoria: this.categoria || undefined,
      filtro: this.filtro || undefined,
      onlyFavorites: this.onlyFavorites || undefined,
      sort: this.sort,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      promoOnly: this.promoOnly || undefined,
      inStockOnly: this.inStockOnly || undefined,
      minRating: this.minRating,
      ...extra
    };
    return JSON.stringify(base);
  }

  private async fetchProducts(reset: boolean = false) {
    const sortMap = { relevance: 'relevance', newest: 'newest', price_asc: 'price_asc', price_desc: 'price_desc', rating: 'rating', popularity: 'popularity', my_favorites: 'my_favorites' } as const;
    try {
  const key = this.buildFetchKey({ reset });
  if (key === this.lastFetchKey) return; // de-dupe identical requests even if 'reset' is same
      this.lastFetchKey = key;
      this.loading = true;
      if (reset) {
        this.accum = [];
        this.chunks = [];
        this.usedFeatured.clear();
        this.page = 1;
      }
      const useFavs = this.onlyFavorites ? true : undefined;
      const effectiveSort = this.onlyFavorites ? 'my_favorites' : sortMap[this.sort];
      const selected = this.categorias.find(c => c.nome === this.categoria);
      const res = await this.store.loadProducts({
        page: this.page,
        pageSize: this.pageSize,
        category: this.categoria || undefined,
        categoryId: selected?.id,
        q: this.filtro || undefined,
        myFavorites: useFavs,
        sort: effectiveSort,
        minPrice: typeof this.minPrice === 'number' ? this.minPrice : undefined,
        maxPrice: typeof this.maxPrice === 'number' ? this.maxPrice : undefined,
        promoOnly: this.promoOnly || undefined
      });
      this.total = res.total;
      this.totalPagesSrv = res.totalPages;
      this.page = res.page; // in case server adjusted
      this.pageSize = res.pageSize;
      // Current page items as provided by store
      const current = (this.produtos || []).slice();
      // Append to accumulation (dedupe by id)
      const seen = new Set(this.accum.map(p => p.id));
      for (const p of current) { if (!seen.has(p.id)) { this.accum.push(p); seen.add(p.id); } }
      // Build chunk: normal products (non-featured) with local filters applied
  const items = current.filter(p => !((p as any).featured) && this.passesLocalFilters(p));
  const banners = this.pickBanners(current);
  this.chunks.push({ items, banners });
      // Rebuild memoized lists after mutating chunks/accum
      this.rebuildInterleavedAndFeatured();
    } finally {
      this.loading = false;
    }
  }

  private async loadNextPageIfNeeded() {
    if (this.loading) return;
    if (!this.canNext()) return;
    this.loading = true;
    this.page++;
    try {
      await this.fetchProducts(false);
      this.rebuildInterleavedAndFeatured();
    } finally {
      this.loading = false;
    }
  }

  private passesLocalFilters(p: ShopProduct): boolean {
    const minP = typeof this.minPrice === 'number' ? this.minPrice : undefined;
    const maxP = typeof this.maxPrice === 'number' ? this.maxPrice : undefined;
    if (minP != null && this.price(p) < minP) return false;
    if (maxP != null && this.price(p) > maxP) return false;
    if (this.promoOnly && !((p.discount || 0) > 0)) return false;
    if (typeof this.minRating === 'number' && this.minRating > 0 && (p.rating || 0) < this.minRating) return false;
    if (this.inStockOnly && !(p.stock != null && p.stock > 0)) return false;
    if (this.onlyFavorites && !this.isFav(p)) return false;
    return true;
  }

  private pickBanners(pageItems: ShopProduct[]): ShopProduct[] {
    // Prefer ALL featured in this page that pass local filters and are not used yet, sorted by higher discount
    const candidates = pageItems.filter(p => (p as any).featured && this.passesLocalFilters(p) && !this.usedFeatured.has(p.id));
    const sorted = candidates.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    if (sorted.length) {
      for (const p of sorted) this.usedFeatured.add(p.id);
      return sorted;
    }
    // Fallback: pull from global accumulation if none in current page
    const global = this.accum.filter(p => (p as any).featured && this.passesLocalFilters(p) && !this.usedFeatured.has(p.id));
    const sortedGlobal = global.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    for (const p of sortedGlobal) this.usedFeatured.add(p.id);
    return sortedGlobal;
  }

  async doLogin() {
    try {
      const resp = await this.api.loginCliente({ email: this.email, senha: this.senha }).toPromise();
      if (resp?.token) {
        localStorage.setItem('token', resp.token);
        localStorage.setItem('userType', 'cliente');
        this.toast.success('Login realizado com sucesso');
        this.showLogin = false;
        this.email = '';
        this.senha = '';
        this.store.resetClienteGate();
        await this.fetchMe();
        // Não recarregamos produtos aqui para evitar chamadas extras; ícones usam flags do servidor nos cards carregados
        if (this.pendingProduct) {
          await this.store.addToCart(this.pendingProduct, 1);
          this.pendingProduct = null;
        }
      } else {
        this.toast.error('Não foi possível fazer login');
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Falha no login');
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.me = null;
    this.store.clearCart();
    this.store.resetClienteGate();
    this.toast.info('Você saiu da conta');
  }

  async resetSenha() {
    try {
      const email = this.email?.trim();
      if (!email) { this.toast.info('Informe seu e-mail para recuperar a senha'); return; }
      await this.auth.sendPasswordReset(email);
      this.toast.success('Enviamos um e-mail para redefinir sua senha.');
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Não foi possível enviar o e-mail de redefinição');
    }
  }

  async doLoginGoogle() {
    try {
      // Realiza login no Firebase para obter idToken e trocar no backend
      const res = await this.auth.loginGoogle();
      const idToken = await res.user.getIdToken();
      const resp = await this.api.loginCliente({ idToken }).toPromise();
      if (resp?.token) {
        localStorage.setItem('token', resp.token);
        localStorage.setItem('userType', 'cliente');
        this.toast.success('Login com Google realizado');
        this.showLogin = false;
        this.store.resetClienteGate();
        await this.fetchMe();
        // Evita recarregar produtos aqui; manter comportamento de uma única chamada inicial
        if (this.pendingProduct) {
          await this.store.addToCart(this.pendingProduct, 1);
          this.pendingProduct = null;
        }
      } else {
        this.toast.error('Não foi possível logar com Google');
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Falha no login com Google');
    }
  }
}
