import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, LojaTemaDto } from '../../../../services/admin-api.service';
import { ShopProduct } from '../../../../services/store.service';
import { ProductCardRendererComponent } from '../../../../product-cards/product-card-renderer.component';
import { AdminToolbarComponent } from '../../../../shared/admin-page';
import { normalizeCatalogConfig, normalizeThemeConfig } from '../../../../constants/loja-tema-card.config';

const DEFAULT_CONFIG: Record<string, unknown> = {
  version: 2,
  colors: { primary: '#b45309', accent: '#f5a700', surface: '#ffffff' },
  cardSales: {
    imageRatio: '4/5',
    showMarca: true,
    showSku: true,
    variant: 'variant1',
  },
  catalog: { columnsMobile: 2, columnsDesktop: 4 },
  store: { showCouponBadgesOnListing: false },
};

const MOCK_SALES: ShopProduct = {
  id: 999001,
  name: 'Ração premium frango e arroz 10kg',
  description: '',
  price: 189.9,
  image: 'https://placehold.co/400x500/e2e8f0/334155?text=Preview',
  category: 'Rações',
  tipo: 'pronto',
  discount: 15,
  promoPrice: 160.9,
  strikePrice: 189.9,
  marca: 'Fórmula Pet',
  sku: 'FP-RAC-10K',
  cardLayout: 'sales',
  rating: 4.5,
};

@Component({
  selector: 'app-admin-loja-temas',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminToolbarComponent, ProductCardRendererComponent],
  templateUrl: './loja-temas.component.html',
  styleUrls: ['./loja-temas.component.scss'],
})
export class LojaTemasAdminComponent implements OnInit {
  readonly mockSales = MOCK_SALES;
  readonly mobileColumnsOptions = [1, 2, 3, 4];
  readonly desktopColumnsOptions = [4, 5, 6];
  readonly variantOptions: Array<{ id: string; label: string }> = [
    { id: 'legacy', label: 'Card antigo (legacy)' },
    { id: 'variant1', label: 'Variação 1' },
    { id: 'variant2', label: 'Variação 2' },
    { id: 'variant3', label: 'Variação 3' },
    { id: 'variant4', label: 'Variação 4' },
  ];
  readonly previewItems: ShopProduct[] = [
    MOCK_SALES,
    { ...MOCK_SALES, id: 999002, name: 'Tapete higiênico 30 un', category: 'Higiene', promoPrice: 69.9, discount: 8 },
    { ...MOCK_SALES, id: 999003, name: 'Shampoo pele sensível 500ml', category: 'Banho', promoPrice: 42.9, discount: 10 },
    { ...MOCK_SALES, id: 999004, name: 'Anti pulgas spot-on', category: 'Cuidados', promoPrice: 88.5, discount: 12 },
    { ...MOCK_SALES, id: 999005, name: 'Petisco natural 500g', category: 'Petiscos', promoPrice: 28.9, discount: 6 },
    { ...MOCK_SALES, id: 999006, name: 'Areia biodegradável 4kg', category: 'Areia', promoPrice: 49.9, discount: 9 },
  ];

  items = signal<LojaTemaDto[]>([]);
  activeThemeId = signal<number | null>(null);
  selectedThemeId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  toast = signal<{ kind: 'ok' | 'error'; message: string } | null>(null);

  drawerMode = signal<'closed' | 'create' | 'edit'>('closed');
  editingId = signal<number | null>(null);

  draftNome = '';
  draftSlug = '';
  draftPrimary = '#b45309';
  draftAccent = '#f5a700';
  draftSurface = '#ffffff';
  draftAtivo = true;
  draftJson = '';
  searchQuery = '';

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listLojaTemas().subscribe({
      next: (res) => {
        this.items.set(res.data || []);
        this.activeThemeId.set(res.activeThemeId ?? null);
        const picked = this.selectedThemeId();
        if (picked == null || !(res.data || []).some((t) => t.id === picked)) {
          const fallback = (res.data || []).find((t) => t.id === res.activeThemeId) || (res.data || [])[0] || null;
          this.selectedThemeId.set(fallback?.id ?? null);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('error', 'Não foi possível carregar os temas.');
      },
    });
  }

  previewVars(t: LojaTemaDto): Record<string, string> {
    const normalized = normalizeThemeConfig(t.config);
    const accent = normalized.colors.accent;
    const primary = normalized.colors.primary;
    const catalog = normalized.catalog;
    return {
      '--fp-store-primary': primary,
      '--fp-store-accent': accent,
      '--fp-store-surface': normalized.colors.surface,
      '--brand-yellow': accent,
      '--brand-yellow-700': primary,
      '--fp-catalog-cols-mobile': String(catalog.columnsMobile),
      '--fp-catalog-cols-desktop': String(catalog.columnsDesktop),
    };
  }

  temaCatalogConfig(t: LojaTemaDto) {
    return normalizeCatalogConfig((normalizeThemeConfig(t.config) as any)?.catalog);
  }

  temaVariant(t: LojaTemaDto): string {
    return normalizeThemeConfig(t.config).cardSales.variant;
  }

  get filteredItems(): LojaTemaDto[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((t) =>
      `${t.nome || ''} ${t.slug || ''}`.toLowerCase().includes(q),
    );
  }

  get selectedTheme(): LojaTemaDto | null {
    const sid = this.selectedThemeId();
    const list = this.items();
    if (sid != null) {
      const found = list.find((t) => t.id === sid);
      if (found) return found;
    }
    const active = this.activeThemeId();
    if (active != null) {
      const foundActive = list.find((t) => t.id === active);
      if (foundActive) return foundActive;
    }
    return list[0] || null;
  }

  selectThemeById(rawId: number | string | null): void {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return;
    this.selectedThemeId.set(id);
  }

  previewDesktopItems(t: LojaTemaDto | null): ShopProduct[] {
    const cols = this.temaCatalogConfig(t || ({} as LojaTemaDto)).columnsDesktop;
    return this.previewItems.slice(0, cols);
  }

  previewMobileItems(t: LojaTemaDto | null): ShopProduct[] {
    const cols = this.temaCatalogConfig(t || ({} as LojaTemaDto)).columnsMobile;
    const count = cols <= 2 ? 4 : cols;
    return this.previewItems.slice(0, count);
  }

  isLive(t: LojaTemaDto): boolean {
    const aid = this.activeThemeId();
    return aid != null && t.id === aid;
  }

  openCreate(): void {
    this.editingId.set(null);
    this.draftNome = 'Novo tema';
    this.draftSlug = '';
    const baseColors = DEFAULT_CONFIG['colors'] as Record<string, unknown>;
    const cfg: Record<string, unknown> = {
      ...DEFAULT_CONFIG,
      colors: { ...(typeof baseColors === 'object' && baseColors ? { ...baseColors } : {}) },
    };
    this.draftJson = JSON.stringify(cfg, null, 2);
    const col = cfg['colors'] as Record<string, string>;
    this.draftPrimary = col['primary'] || '#b45309';
    this.draftAccent = col['accent'] || '#f5a700';
    this.draftSurface = col['surface'] || '#ffffff';
    this.draftAtivo = true;
    this.drawerMode.set('create');
  }

  openEdit(t: LojaTemaDto): void {
    if (t.id == null) return;
    this.editingId.set(t.id);
    this.draftNome = t.nome || '';
    this.draftSlug = t.slug || '';
    this.draftAtivo = !!t.ativo;
    const cfg = { ...(t.config || {}) } as Record<string, unknown>;
    this.draftJson = JSON.stringify(cfg, null, 2);
    const col = (cfg['colors'] as Record<string, unknown> | undefined) || {};
    this.draftPrimary = String(col['primary'] ?? '#b45309');
    this.draftAccent = String(col['accent'] ?? '#f5a700');
    this.draftSurface = String(col['surface'] ?? '#ffffff');
    this.drawerMode.set('edit');
  }

  closeDrawer(): void {
    this.drawerMode.set('closed');
    this.editingId.set(null);
  }

  private buildConfig(): Record<string, unknown> {
    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(this.draftJson.trim() || '{}') as Record<string, unknown>;
    } catch {
      throw new Error('JSON de configuração inválido.');
    }
    const prevRaw = cfg['colors'];
    const prevColors = (typeof prevRaw === 'object' && prevRaw && !Array.isArray(prevRaw)
      ? prevRaw
      : {}) as Record<string, string>;
    cfg['colors'] = {
      ...prevColors,
      primary: this.draftPrimary,
      accent: this.draftAccent,
      surface: this.draftSurface,
    };
    const draftCatalog = normalizeCatalogConfig((cfg['catalog'] as Record<string, unknown> | undefined) ?? {});
    cfg['version'] = 2;
    cfg['catalog'] = {
      columnsMobile: draftCatalog.columnsMobile,
      columnsDesktop: draftCatalog.columnsDesktop,
    };
    const salesRaw = cfg['cardSales'];
    const sales = (typeof salesRaw === 'object' && salesRaw && !Array.isArray(salesRaw))
      ? { ...(salesRaw as Record<string, unknown>) }
      : {};
    const variant = String(sales['variant'] || 'variant1');
    sales['variant'] = ['legacy', 'variant1', 'variant2', 'variant3', 'variant4'].includes(variant) ? variant : 'variant1';
    cfg['cardSales'] = sales;
    return cfg;
  }

  private getDraftConfigUnsafe(): Record<string, unknown> {
    try {
      const parsed = JSON.parse(this.draftJson.trim() || '{}');
      return (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  get draftCatalogMobile(): number {
    return normalizeCatalogConfig(this.getDraftConfigUnsafe()['catalog']).columnsMobile;
  }

  get draftCatalogDesktop(): number {
    return normalizeCatalogConfig(this.getDraftConfigUnsafe()['catalog']).columnsDesktop;
  }

  get draftCardVariant(): string {
    const cfg = this.getDraftConfigUnsafe();
    const sales = (cfg['cardSales'] && typeof cfg['cardSales'] === 'object') ? cfg['cardSales'] as Record<string, unknown> : {};
    const v = String(sales['variant'] || 'variant1');
    return ['legacy', 'variant1', 'variant2', 'variant3', 'variant4'].includes(v) ? v : 'variant1';
  }

  updateDraftCatalogColumns(kind: 'mobile' | 'desktop', value: number): void {
    const cfg = this.getDraftConfigUnsafe();
    const catalog = normalizeCatalogConfig(cfg['catalog']);
    const next = {
      columnsMobile: kind === 'mobile' ? value : catalog.columnsMobile,
      columnsDesktop: kind === 'desktop' ? value : catalog.columnsDesktop,
    };
    cfg['catalog'] = normalizeCatalogConfig(next);
    cfg['version'] = 2;
    this.draftJson = JSON.stringify(cfg, null, 2);
  }

  updateDraftVariant(value: string): void {
    const cfg = this.getDraftConfigUnsafe();
    const sales = (cfg['cardSales'] && typeof cfg['cardSales'] === 'object') ? { ...(cfg['cardSales'] as Record<string, unknown>) } : {};
    sales['variant'] = ['legacy', 'variant1', 'variant2', 'variant3', 'variant4'].includes(value) ? value : 'variant1';
    cfg['cardSales'] = sales;
    cfg['version'] = 2;
    this.draftJson = JSON.stringify(cfg, null, 2);
  }

  save(): void {
    let cfg: Record<string, unknown>;
    try {
      cfg = this.buildConfig();
    } catch (e: any) {
      this.showToast('error', e?.message || 'Revise o JSON.');
      return;
    }
    const nome = this.draftNome.trim();
    if (!nome) {
      this.showToast('error', 'Informe o nome do tema.');
      return;
    }
    this.saving.set(true);
    const slug = this.draftSlug.trim();
    const mode = this.drawerMode();
    if (mode === 'create') {
      this.api
        .createLojaTema({
          nome,
          slug: slug || undefined,
          config: cfg,
          ativo: this.draftAtivo,
          is_preset: false,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.showToast('ok', 'Tema criado.');
            this.closeDrawer();
            this.load();
          },
          error: () => {
            this.saving.set(false);
            this.showToast('error', 'Não foi possível criar o tema.');
          },
        });
      return;
    }
    const id = this.editingId();
    if (id == null) {
      this.saving.set(false);
      return;
    }
    this.api
      .updateLojaTema(id, {
        nome,
        slug: slug || undefined,
        config: cfg,
        ativo: this.draftAtivo,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showToast('ok', 'Tema atualizado.');
          this.closeDrawer();
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.showToast('error', 'Não foi possível salvar.');
        },
      });
  }

  duplicate(t: LojaTemaDto): void {
    if (!t.config) return;
    this.api
      .createLojaTema({
        nome: `${t.nome} (cópia)`,
        config: { ...t.config },
        ativo: true,
        is_preset: false,
      })
      .subscribe({
        next: () => {
          this.showToast('ok', 'Tema duplicado.');
          this.load();
        },
        error: () => this.showToast('error', 'Não foi possível duplicar.'),
      });
  }

  activate(t: LojaTemaDto): void {
    if (t.id == null) return;
    this.api.activateLojaTema(t.id).subscribe({
      next: (res) => {
        if (res.activeTheme?.id != null) {
          this.activeThemeId.set(Number(res.activeTheme.id));
        }
        this.showToast('ok', 'Tema definido como ativo na vitrine.');
        this.load();
      },
      error: (err) => {
        const msg = err?.error?.error || '';
        if (String(msg).toLowerCase().includes('ative o tema')) {
          this.showToast('error', 'Marque o tema como ativo no cadastro antes de publicar na loja.');
        } else {
          this.showToast('error', 'Não foi possível ativar o tema.');
        }
      },
    });
  }

  remove(t: LojaTemaDto): void {
    if (t.is_preset) {
      this.showToast('error', 'Presets do sistema não podem ser excluídos.');
      return;
    }
    if (t.id == null) return;
    if (!confirm(`Excluir o tema "${t.nome}"? Esta ação não pode ser desfeita.`)) return;
    this.api.deleteLojaTema(t.id).subscribe({
      next: () => {
        this.showToast('ok', 'Tema removido.');
        this.load();
      },
      error: () => this.showToast('error', 'Não foi possível excluir.'),
    });
  }

  private showToast(kind: 'ok' | 'error', message: string): void {
    this.toast.set({ kind, message });
    setTimeout(() => this.toast.set(null), 4200);
  }

  trackById(_i: number, t: LojaTemaDto): number {
    return Number(t.id ?? _i);
  }

  trackByPreviewProduct(_i: number, p: ShopProduct): number {
    return Number(p.id ?? _i);
  }
}
