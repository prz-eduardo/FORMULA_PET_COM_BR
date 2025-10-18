import { Component, OnInit, ElementRef, ViewChild, Renderer2 } from '@angular/core';
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
export class LojaComponent implements OnInit {
  categorias: StoreCategory[] = [];
  produtos: ShopProduct[] = [];
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
  showEmailLogin = false;
  email = '';
  senha = '';
  me: any = null;
  popoverTop = 0;
  popoverLeft = 0;
  private pendingProduct: ShopProduct | null = null;

  @ViewChild('cartBtn', { static: true }) cartBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('profileBtn') profileBtn?: ElementRef<HTMLButtonElement>;

  constructor(private store: StoreService, private toast: ToastService, private renderer: Renderer2, private api: ApiService, private auth: AuthService, private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    this.store.products$.subscribe(p => this.produtos = p);
  this.store.categories$.subscribe(c => this.categorias = c);
  this.store.meta$.subscribe(m => this.storeMeta = m);
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
      if (q !== null) this.filtro = q;
      if (cat !== null) this.categoria = cat;
      if (login === '1') this.openLoginNearProfile();
      this.onlyFavorites = fav === '1';
      if (srt) {
        const valid = ['relevance','newest','price_asc','price_desc','rating','popularity','my_favorites'] as const;
        if ((valid as readonly string[]).includes(srt)) this.sort = srt as any;
      }
      // fetch with current params
      await this.fetchProducts();
    });
    // initial fetch (in case there are no query params)
    await this.fetchProducts();
  }

  get filtered(): ShopProduct[] {
    // Deixe o servidor cuidar de categoria, busca e ordenação.
    // Mantemos a lista como veio do backend; local só faz favoritos quando necessário.
    let base = this.produtos;
    if (this.onlyFavorites) {
      // Em modo favoritos, ainda assim buscamos no servidor, mas caso venha tudo, garantimos estado local coerente
      base = base.filter(p => this.isFav(p));
    }
    return base;
  }

  // Paginated slice of filtered (server paginates; local slice only if we truly filtered local-only)
  get paginated(): ShopProduct[] {
    return this.filtered;
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

  async onCategoryChange(val: string) {
    this.categoria = val;
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
  }
  async onSortChange(val: 'relevance'|'newest'|'price_asc'|'price_desc'|'rating'|'popularity') { this.sort = val; this.page = 1; await this.fetchProducts(); this.persistQueryParams(); }
  async onQueryChange(val: string) { this.filtro = val; this.page = 1; await this.fetchProducts(); this.persistQueryParams(); }

  isFav(p: ShopProduct) { return this.store.isFavorite(p.id); }
  async toggleFav(p: ShopProduct) {
    const ok = await this.store.toggleFavorite(p.id);
    if (!ok) this.openLoginNearProfile();
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
    if (!this.onlyFavorites) {
      // back to server pagination
      this.page = 1;
      this.fetchProducts();
    }
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
        setTimeout(() => el.remove(), durationMs + delayMs + 120);
      };

      // Main dot (bigger, brighter)
      spawn('', 18, 1.25, 1, 0, 1100);
      // Trail dots
      spawn('ghost', 14, 1.15, 0.8, 60, 1200);
      spawn('tail', 10, 1.05, 0.6, 120, 1300);

      // Pulse cart button on arrival
      const pulseDelay = 900;
      setTimeout(() => {
        this.renderer.addClass(this.cartBtn!.nativeElement, 'pulse');
        setTimeout(() => this.renderer.removeClass(this.cartBtn!.nativeElement, 'pulse'), 500);
      }, pulseDelay);
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
    this.showLogin = !this.showLogin;
    if (!this.showLogin) this.showEmailLogin = false; // reset when closing
    if (this.showLogin) this.positionPopover();
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
        this.popoverTop = Math.max(window.scrollY + 8, Math.min(top, maxTop));
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

  closeLogin() { this.showLogin = false; }

  private openLoginNearProfile() {
    this.showLogin = true;
    this.positionPopover();
  }

  private persistQueryParams() {
    const queryParams: any = {};
    if (this.filtro) queryParams.q = this.filtro; else queryParams.q = null;
    if (this.categoria) queryParams.cat = this.categoria; else queryParams.cat = null;
    if (this.onlyFavorites) queryParams.fav = '1'; else queryParams.fav = null;
    if (this.sort && this.sort !== 'relevance') queryParams.sort = this.sort; else queryParams.sort = null;
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private async fetchProducts() {
    const sortMap = { relevance: 'relevance', newest: 'newest', price_asc: 'price_asc', price_desc: 'price_desc', rating: 'rating', popularity: 'popularity', my_favorites: 'my_favorites' } as const;
    try {
      this.loading = true;
      const useFavs = this.onlyFavorites ? true : undefined;
      const effectiveSort = this.onlyFavorites ? 'my_favorites' : sortMap[this.sort];
  const selected = this.categorias.find(c => c.nome === this.categoria);
  const res = await this.store.loadProducts({ page: this.page, pageSize: this.pageSize, category: this.categoria || undefined, categoryId: selected?.id, q: this.filtro || undefined, myFavorites: useFavs, sort: effectiveSort });
      this.total = res.total;
      this.totalPagesSrv = res.totalPages;
      this.page = res.page; // in case server adjusted
      this.pageSize = res.pageSize;
    } finally {
      this.loading = false;
    }
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
