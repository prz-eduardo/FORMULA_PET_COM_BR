import { Component, ElementRef, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { StoreService, ShopProduct, ProductDetailsLoadError } from '../services/store.service';
import { NavmenuComponent } from '../navmenu/navmenu.component';
import { ApiService } from '../services/api.service';
import { BannerSlotComponent } from '../shared/banner-slot/banner-slot.component';

function youtubeVideoId(u: string): string | null {
  try {
    const s = u.trim();
    const m1 = s.match(/(?:youtu\.be\/|embed\/|v=)([a-zA-Z0-9_-]{6,})/);
    if (m1) return m1[1];
    return null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, NavmenuComponent, BannerSlotComponent],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss']
})
export class ProductDetailsComponent implements OnInit {
  product: ShopProduct | null = null;
  /** Erro de carregamento (404 / 5xx) quando product é null. */
  loadError: ProductDetailsLoadError | null = null;
  loading = true;
  qty = 1;
  cameFromHighlights = false;
  isFavLocal?: boolean;
  @ViewChild('cartBtn', { static: false }) cartBtn?: ElementRef<HTMLButtonElement>;
  selectedImageIndex = 0;
  selectedVariant: NonNullable<ShopProduct['variantes']>[number] | null = null;
  activeTab: 'composicao' | 'modo_uso' | 'indicacoes' | 'contraindicacoes' | 'documentos' = 'composicao';

  /** Alerta de receita antes de adicionar (produto exige receita). */
  receitaModalOpen = false;
  private pendingAddEvent?: Event;
  private pendingBuyAfterAdd = false;

  constructor(
    private route: ActivatedRoute,
    private store: StoreService,
    private api: ApiService,
    private router: Router,
    private renderer: Renderer2,
    private pageTitle: Title,
    private meta: Meta,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit(): Promise<void> {
    this.cameFromHighlights = this.route.snapshot.queryParamMap.get('src') === 'home';
    const productId = this.route.snapshot.paramMap.get('id')!;
    await this.loadProduct(productId);
  }

  async loadProduct(productId: string): Promise<void> {
    this.loading = true;
    this.loadError = null;
    const { product, error } = await this.store.loadProductDetails(productId);
    this.product = product;
    this.loadError = error ?? null;
    this.isFavLocal = product?.isFavorited;
    this.selectedImageIndex = 0;
    const variantes = product?.variantes ?? [];
    const vs = variantes.filter(
      (v: NonNullable<ShopProduct['variantes']>[number]) => v.ativo !== false
    );
    this.selectedVariant = vs.length ? vs[0] : null;
    if (product?.composicao) this.activeTab = 'composicao';
    else if (product?.modo_uso) this.activeTab = 'modo_uso';
    else if (product?.indicacoes) this.activeTab = 'indicacoes';
    else if (product?.contraindicacoes) this.activeTab = 'contraindicacoes';
    else if (product?.documentos?.length) this.activeTab = 'documentos';
    this.applySeo(product);
    this.loading = false;
  }

  retryLoad(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.loadProduct(id);
  }

  private applySeo(p: ShopProduct | null) {
    if (!p) return;
    const t = p.meta_title?.trim() || p.name;
    this.pageTitle.setTitle(t);
    if (p.meta_description?.trim()) {
      this.meta.updateTag({ name: 'description', content: p.meta_description.slice(0, 320) });
    }
    const og = p.og_image_url?.trim();
    if (og) {
      const abs = /^https?:\/\//i.test(og)
        ? og
        : (typeof window !== 'undefined' ? new URL(og, window.location.origin).href : og);
      this.meta.updateTag({ property: 'og:image', content: abs });
      this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
      this.meta.updateTag({ name: 'twitter:image', content: abs });
    }
  }

  hasPresentationInfo(): boolean {
    return this.dosagemLabels.length > 0 || this.embalagemLabels.length > 0;
  }

  /** SKU da variante selecionada ou do produto. */
  displaySku(): string | null {
    const p = this.product;
    if (!p) return null;
    const v = this.selectedVariant;
    if (v?.sku != null && String(v.sku).trim() !== '') return String(v.sku).trim();
    if (p.sku != null && String(p.sku).trim() !== '') return String(p.sku).trim();
    return null;
  }

  get composicaoExcerpt(): string | null {
    const c = this.product?.composicao?.trim();
    if (!c) return null;
    const oneLine = c.replace(/\s+/g, ' ');
    if (oneLine.length <= 220) return oneLine;
    return `${oneLine.slice(0, 220).trim()}…`;
  }

  get showComposicaoMore(): boolean {
    const c = this.product?.composicao?.trim();
    if (!c) return false;
    return c.length > 220 || /\n/.test(c);
  }

  goToComposicaoTab(): void {
    if (!this.product?.composicao) return;
    this.activeTab = 'composicao';
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      document.getElementById('pd-ficha-tecnica')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  get dosagemLabels(): string[] {
    const p = this.product;
    if (!p) return [];
    if (p.dosagens?.length) return p.dosagens.map((d) => d.nome);
    const d = p.customizations?.dosage;
    return Array.isArray(d) && d.length ? d.map(String) : [];
  }

  get embalagemLabels(): string[] {
    const p = this.product;
    if (!p) return [];
    if (p.embalagens?.length) return p.embalagens.map((e) => e.nome);
    const e = p.customizations?.packaging;
    return Array.isArray(e) && e.length ? e.map(String) : [];
  }

  get compostosLabels(): string[] {
    const p = this.product;
    if (!p?.compostosAtivos?.length) return [];
    return p.compostosAtivos.map((c) => (c.label != null ? String(c.label).trim() : '')).filter(Boolean);
  }

  hasTechnicalInfo(): boolean {
    const p = this.product;
    if (!p) return false;
    return !!(
      p.composicao ||
      p.modo_uso ||
      p.indicacoes ||
      p.contraindicacoes ||
      (p.documentos && p.documentos.length)
    );
  }

  selectVariant(v: NonNullable<ShopProduct['variantes']>[number]) {
    if (v && (v.ativo === false || v.ativo === 0)) return;
    this.selectedVariant = v;
  }

  lojaQueryForCategory(cat: { nome: string; slug?: string }): Record<string, string> {
    const v = (cat.slug || cat.nome || '').trim();
    return v ? { cat: v } : {};
  }

  formatDate(value: string | Date | null | undefined): string {
    if (value == null || value === '') return '';
    const d = typeof value === 'string' ? new Date(value.includes('T') ? value : value.replace(' ', 'T')) : value;
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  exigeReceitaSim(): boolean {
    const e = this.product?.exige_receita;
    return e === true || e === 1;
  }

  private static readonly PLACEHOLDER = '/imagens/image.png';

  /** URLs únicas da galeria (evita miniaturas duplicadas se a BD tiver a mesma URL duas vezes). */
  get dedupedImages(): NonNullable<ShopProduct['images']> {
    const p = this.product;
    if (!p?.images?.length) return [];
    const seen = new Set<string>();
    const out: NonNullable<ShopProduct['images']> = [];
    for (const im of p.images) {
      const u = (im.url || '').trim();
      if (!u) continue;
      const k = u.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(im);
    }
    return out;
  }

  /** Número de fotos distintas alinhado ao que a galeria representa. */
  get effectiveImageCount(): number {
    const p = this.product;
    if (!p) return 0;
    const n = this.dedupedImages.length;
    if (n > 0) return n;
    const fallback = (p.imageUrl || p.image || '').toString().trim();
    if (fallback && !this.isPlaceholderPath(fallback)) return 1;
    return 0;
  }

  get showGalleryThumbs(): boolean {
    return this.dedupedImages.length > 1;
  }

  private isPlaceholderPath(u: string): boolean {
    try {
      return u.trim().toLowerCase().endsWith('/imagens/image.png');
    } catch {
      return false;
    }
  }

  get hasApiPromotionBlock(): boolean {
    const p = this.product;
    if (!p) return false;
    return !!(p.activePromotion && p.activePromotion.id) || !!(p.apiDiscount && (p.apiDiscount.percent > 0 || p.apiDiscount.value > 0));
  }

  /**
   * Texto “preço tabela / promo” só quando a linha de preço principal não
   * já exibe a mesma informação (evita três blocos com os mesmos números).
   */
  get showPriceTableExplainer(): boolean {
    const p = this.product;
    if (!p || p.priceFinal == null || p.priceOriginal == null) return false;
    if (p.priceFinal >= p.priceOriginal) return false;
    const n = (a: number, b: number) => Math.abs(a - b) < 0.02;
    const now = this.priceNow();
    const ref = this.referenceListPrice();
    if (ref != null && n(now, p.priceFinal) && n(ref, p.priceOriginal)) {
      return false;
    }
    return true;
  }

  formatPromoDate(iso: string | null | undefined): string {
    if (iso == null || String(iso).trim() === '') return '';
    const s = String(iso).trim();
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  get promotionCardDiscountText(): string | null {
    const p = this.product;
    if (!p?.activePromotion?.id) {
      if (p?.apiDiscount && p.apiDiscount.percent > 0) {
        return `${p.apiDiscount.percent % 1 === 0 ? p.apiDiscount.percent : p.apiDiscount.percent.toFixed(1)}% de desconto`;
      }
      return null;
    }
    const pr = p.activePromotion;
    const t = (pr.tipo || '').toString().toLowerCase();
    const v = pr.valor != null && Number.isFinite(Number(pr.valor)) ? Number(pr.valor) : 0;
    if (t === 'percentual' || t === 'porcentagem' || t === 'percentage' || t.includes('percent')) {
      if (v > 0) {
        return v % 1 === 0 ? `${v}% de desconto` : `${v.toFixed(1).replace(/\.0$/, '')}% de desconto`;
      }
    }
    if (t.includes('valor') || t === 'fixed' || t === 'valor') {
      if (v > 0) return `R$ ${v.toFixed(2).replace('.', ',')} de desconto`;
    }
    if (p.apiDiscount && p.apiDiscount.percent > 0) {
      return `${p.apiDiscount.percent % 1 === 0 ? p.apiDiscount.percent : p.apiDiscount.percent.toFixed(1)}% de desconto`;
    }
    if (p.apiDiscount && p.apiDiscount.value > 0) {
      return `R$ ${p.apiDiscount.value.toFixed(2).replace('.', ',')} a menos no total`;
    }
    return v > 0 ? `Desconto de ${v}` : null;
  }

  priceNow(): number {
    if (!this.product) return 0;
    if (this.selectedVariant && this.selectedVariant.preco != null) return Number(this.selectedVariant.preco);
    if (typeof this.product.promoPrice === 'number') return this.product.promoPrice;
    return this.store.getPriceWithDiscount(this.product);
  }

  get discountPercent(): number | null {
    if (!this.product) return null;
    if (typeof this.product.discount === 'number' && this.product.discount > 0) return Math.round(this.product.discount);
    const orig = this.product.price;
    const now = this.priceNow();
    if (orig && now && orig > now) return Math.round((1 - now / orig) * 100);
    return null;
  }

  /** Preço de referência a riscar: base quando há promo, ou preco_de (strike) quando acima do preço atual. */
  referenceListPrice(): number | null {
    if (!this.product) return null;
    if (this.product.promoPrice != null) return this.product.price;
    const now = this.priceNow();
    const s = this.product.strikePrice;
    if (s != null && Number.isFinite(s) && s > now + 0.009) return s;
    return null;
  }

  hasRating(): boolean {
    return !!this.product && typeof this.product.rating === 'number' && this.product.rating > 0;
  }

  get displayImageUrl(): string {
    if (!this.product) return ProductDetailsComponent.PLACEHOLDER;
    const imgs = this.dedupedImages;
    if (imgs.length && imgs[this.selectedImageIndex]) return imgs[this.selectedImageIndex].url;
    return (this.product.imageUrl || this.product.image || ProductDetailsComponent.PLACEHOLDER);
  }

  selectImage(i: number) {
    this.selectedImageIndex = i;
  }

  async toggleFav() {
    if (!this.product) return;
    const logged = await this.store.isClienteLoggedSilent();
    if (!logged) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-login'));
      return;
    }
    const ok = await this.store.toggleFavorite(this.product.id);
    if (ok) {
      this.isFavLocal = !this.isFavLocal;
      if (this.product) {
        const base = typeof this.product.favoritesCount === 'number' ? this.product.favoritesCount : 0;
        const delta = this.isFavLocal ? 1 : -1;
        this.product.favoritesCount = Math.max(0, base + delta);
      }
    }
  }

  async addToCart(ev?: Event): Promise<boolean> {
    if (!this.product) return false;
    const ok = await this.store.addToCart(this.product, this.qty);
    if (ok && ev) this.flyToCart(ev);
    return !!ok;
  }

  /** Adiciona ao carrinho; se exigir receita, abre o alerta antes. */
  async onClickAddToCart(ev: Event): Promise<void> {
    if (!this.product) return;
    if (this.exigeReceitaSim()) {
      this.pendingAddEvent = ev;
      this.pendingBuyAfterAdd = false;
      this.receitaModalOpen = true;
      return;
    }
    await this.addToCart(ev);
  }

  /** Compra agora; se exigir receita, abre o alerta antes. */
  async onClickBuyNow(ev: Event): Promise<void> {
    if (!this.product) return;
    if (this.exigeReceitaSim()) {
      this.pendingAddEvent = ev;
      this.pendingBuyAfterAdd = true;
      this.receitaModalOpen = true;
      return;
    }
    const ok = await this.addToCart(ev);
    if (ok) void this.router.navigate(['/carrinho']);
  }

  confirmReceitaModal(): void {
    this.receitaModalOpen = false;
    const ev = this.pendingAddEvent;
    const goCarrinho = this.pendingBuyAfterAdd;
    this.pendingAddEvent = undefined;
    this.pendingBuyAfterAdd = false;
    void (async () => {
      if (!this.product) return;
      const ok = await this.addToCart(ev);
      if (ok && goCarrinho) void this.router.navigate(['/carrinho']);
    })();
  }

  dismissReceitaModal(): void {
    this.receitaModalOpen = false;
    this.pendingAddEvent = undefined;
    this.pendingBuyAfterAdd = false;
  }

  decrease() {
    if (this.qty > 1) this.qty -= 1;
  }

  increase() {
    this.qty += 1;
  }

  goToCart() {
    this.router.navigate(['/carrinho']);
  }

  back() {
    if (this.cameFromHighlights) {
      this.router.navigate(['/loja']);
    } else {
      window.history.length > 1 ? window.history.back() : this.router.navigate(['/loja']);
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
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `${opacity}`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(${scaleStart})`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms cubic-bezier(.22,.61,.36,1), opacity ${durationMs}ms ease`);
        this.renderer.setStyle(el, 'transition-delay', `${delayMs}ms`);
        document.body.appendChild(el);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(${translateX}px, ${translateY}px) scale(0.22)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + delayMs + 240);
      };

      const spawnRing = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        document.body.appendChild(el);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'opacity', `0`);
        this.renderer.setStyle(el, 'transform', `scale(1.8)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        setTimeout(() => el.remove(), durationMs + 160);
      };

      const spawnDestBurst = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${destX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${destY - size / 2}px`);
        document.body.appendChild(el);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'opacity', `0`);
        this.renderer.setStyle(el, 'transform', `scale(1.7)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        setTimeout(() => el.remove(), durationMs + 120);
      };

      spawnRing(30, 900);
      spawn('spark', 26, 1.35, 1, 0, 2000);
      spawn('ghost', 20, 1.24, 0.92, 120, 2200);
      spawn('tail', 16, 1.14, 0.84, 240, 2350);
      spawn('ghost', 14, 1.10, 0.76, 360, 2450);
      spawn('tail', 12, 1.06, 0.68, 480, 2550);
      spawn('ghost', 10, 1.04, 0.6, 600, 2650);

      const pulseDelay = 2000;
      setTimeout(() => {
        this.renderer.addClass(this.cartBtn!.nativeElement, 'pulse');
        setTimeout(() => this.renderer.removeClass(this.cartBtn!.nativeElement, 'pulse'), 800);
      }, pulseDelay);
      setTimeout(() => spawnDestBurst(30, 700), pulseDelay - 120);
    } catch { /* empty */ }
  }

  get availabilityLabel(): string {
    const v = this.product?.inStock as any;
    if (v === true) return 'Em estoque';
    if (v === false) return 'Estoque sob consulta';
    if (typeof v === 'number' && v > 0) return `Em estoque (${v} un.)`;
    if (typeof v === 'number' && v === 0) return 'Indisponível';
    if (this.product?.stock != null) {
      const n = Number(this.product.stock);
      if (n > 0) return `Em estoque (${n} un.)`;
      if (n === 0) return 'Indisponível';
    }
    return 'Consulte disponibilidade';
  }

  get weightLabel(): string | null {
    const p = this.product;
    if (!p) return null;
    if (p.peso_valor == null) return null;
    const u = p.peso_unidade?.toString().trim() || 'g';
    return `${p.peso_valor} ${u}`;
  }

  get videoEmbedUrl(): SafeResourceUrl | null {
    const u = this.product?.video_url;
    if (!u?.trim()) return null;
    const id = youtubeVideoId(u);
    if (!id) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`);
  }
}
