import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, LojaTemaDto } from '../../../../services/admin-api.service';
import { ShopProduct } from '../../../../services/store.service';
import { ProductCardSalesComponent } from '../../../../product-card-sales/product-card-sales.component';
import { ProductCardBannerComponent } from '../../../../product-card-banner/product-card-banner.component';
import { AdminToolbarComponent } from '../../../../shared/admin-page';

const DEFAULT_CONFIG: Record<string, unknown> = {
  version: 1,
  colors: { primary: '#b45309', accent: '#f5a700', surface: '#ffffff' },
  cardSales: { imageRatio: '4/5', showMarca: true, showSku: true, density: 'comfortable' },
  cardBanner: { overlayOpacity: 0.45, minHeightPx: 220, titleLines: 2 },
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

const MOCK_BANNER: ShopProduct = {
  ...MOCK_SALES,
  id: 999002,
  cardLayout: 'banner',
};

@Component({
  selector: 'app-admin-loja-temas',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminToolbarComponent, ProductCardSalesComponent, ProductCardBannerComponent],
  templateUrl: './loja-temas.component.html',
  styleUrls: ['./loja-temas.component.scss'],
})
export class LojaTemasAdminComponent implements OnInit {
  readonly mockSales = MOCK_SALES;
  readonly mockBanner = MOCK_BANNER;

  items = signal<LojaTemaDto[]>([]);
  activeThemeId = signal<number | null>(null);
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
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('error', 'Não foi possível carregar os temas.');
      },
    });
  }

  previewVars(t: LojaTemaDto): Record<string, string> {
    const raw = t.config as Record<string, unknown> | undefined;
    const c = (raw?.['colors'] as Record<string, unknown> | undefined) || {};
    const accent = String(c['accent'] ?? '#f5a700');
    const primary = String(c['primary'] ?? '#b45309');
    return {
      '--fp-store-primary': primary,
      '--fp-store-accent': accent,
      '--fp-store-surface': String(c['surface'] ?? '#ffffff'),
      '--brand-yellow': accent,
      '--brand-yellow-700': primary,
    };
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
    return cfg;
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
}
