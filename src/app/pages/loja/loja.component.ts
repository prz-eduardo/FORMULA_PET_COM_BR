import { Component, OnInit, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService, ShopProduct } from '../../services/store.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { FooterComponent } from '../../footer/footer.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-loja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, NavmenuComponent, FooterComponent],
  templateUrl: './loja.component.html',
  styleUrls: ['./loja.component.scss']
})
export class LojaComponent implements OnInit {
  categorias: string[] = [];
  produtos: ShopProduct[] = [];
  filtro = '';
  categoria = '';
  sort: 'relevance' | 'price-asc' | 'price-desc' | 'name' = 'relevance';
  onlyFavorites = false;
  // Pagination
  page = 1;
  pageSize = 20;
  // Auth UI
  showLogin = false;
  showEmailLogin = false;
  email = '';
  senha = '';
  me: any = null;
  popoverTop = 0;
  popoverLeft = 0;
  private pendingProduct: ShopProduct | null = null;

  @ViewChild('cartBtn', { static: true }) cartBtn?: ElementRef<HTMLAnchorElement>;
  @ViewChild('profileBtn') profileBtn?: ElementRef<HTMLButtonElement>;

  constructor(private store: StoreService, private toast: ToastService, private renderer: Renderer2, private api: ApiService, private auth: AuthService, private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    await this.store.loadProducts();
    this.store.products$.subscribe(p => this.produtos = p);
    this.store.categories$.subscribe(c => this.categorias = c);
    // try fetch me silently
    await this.fetchMe();
    // If not logged in, clear cart as requested
    if (!this.me) this.store.clearCart();
    // read query params to prefill filters
    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q');
      const cat = params.get('cat');
      const login = params.get('login');
      const fav = params.get('fav');
      if (q !== null) this.filtro = q;
      if (cat !== null) this.categoria = cat;
      if (login === '1') this.openLoginNearProfile();
      this.onlyFavorites = fav === '1';
    });
  }

  get filtered(): ShopProduct[] {
    const f = this.filtro.trim().toLowerCase();
    const cat = this.categoria;
    let base = this.produtos.filter(p =>
      (!cat || p.category === cat) &&
      (!f || p.name.toLowerCase().includes(f) || p.description.toLowerCase().includes(f))
    );
    if (this.onlyFavorites) base = base.filter(p => this.isFav(p));

    switch (this.sort) {
      case 'price-asc':
        return [...base].sort((a,b) => this.price(a) - this.price(b));
      case 'price-desc':
        return [...base].sort((a,b) => this.price(b) - this.price(a));
      case 'name':
        return [...base].sort((a,b) => a.name.localeCompare(b.name));
      default:
        return base; // relevance placeholder
    }
  }

  // Paginated slice of filtered
  get paginated(): ShopProduct[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filtered.slice(start, end);
  }
  totalPages(): number { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }
  pageStart(): number { return (this.page - 1) * this.pageSize + 1; }
  pageEnd(): number { return Math.min(this.page * this.pageSize, this.filtered.length); }
  canPrev(): boolean { return this.page > 1; }
  canNext(): boolean { return this.page < this.totalPages(); }
  prevPage() { if (this.canPrev()) this.page--; }
  nextPage() { if (this.canNext()) this.page++; }
  goToPage(p: number) { const t = this.totalPages(); this.page = Math.min(Math.max(1, p), t); }
  onChangePageSize(ev: Event) { const v = Number((ev.target as HTMLSelectElement).value) || 20; this.pageSize = v; this.page = 1; }

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

  async onAddToCart(p: ShopProduct, ev: MouseEvent) {
    // If not logged in, clicking cart should trigger login
    if (!this.me) { this.openLoginNearProfile(); return; }
    const ok = await this.addToCart(p);
    if (ok) this.flyToCart(ev);
  }

  // If user clicks cart link and is not logged in, intercept to open login
  onCartClick(ev: MouseEvent) {
    if (!this.me) { ev.preventDefault(); this.openLoginNearProfile(); }
  }

  toggleFavoritesOnly() {
    this.onlyFavorites = !this.onlyFavorites;
    // reflect in query params without reloading component
    const queryParams: any = { ...this.route.snapshot.queryParams };
    if (this.onlyFavorites) queryParams.fav = '1'; else delete queryParams.fav;
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private flyToCart(ev: MouseEvent) {
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
      const token = localStorage.getItem('token');
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
