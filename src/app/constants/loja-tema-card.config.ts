/**
 * Contract JSON em loja_temas.config para catálogo unificado em grelha.
 * Mantém compatibilidade com temas legados (version 1).
 */

export const LOJA_TEMA_ASPECT_RATIOS = new Set<string>(['1/1', '4/5', '3/4', '16/9', '4/3']);
export const LOJA_TEMA_MOBILE_COLUMNS = [1, 2, 3, 4] as const;
export const LOJA_TEMA_DESKTOP_COLUMNS = [4, 5, 6] as const;
export const LOJA_TEMA_DEFAULT_MOBILE_COLUMNS = 2;
export const LOJA_TEMA_DEFAULT_DESKTOP_COLUMNS = 4;

export type LojaTemaCardBannerStructure = 'gradientBottom' | 'center' | 'minimal';
export type LojaTemaCatalogMobileColumns = (typeof LOJA_TEMA_MOBILE_COLUMNS)[number];
export type LojaTemaCatalogDesktopColumns = (typeof LOJA_TEMA_DESKTOP_COLUMNS)[number];

export interface LojaTemaCatalogConfig {
  columnsMobile: LojaTemaCatalogMobileColumns;
  columnsDesktop: LojaTemaCatalogDesktopColumns;
}

export interface LojaTemaCardSalesConfig {
  imageRatio: string;
  showMarca: boolean;
  showSku: boolean;
  variant: LojaTemaCardVariant;
  fallbackImageUrl?: string;
}
export type LojaTemaCardVariant = 'legacy' | 'variant1' | 'variant2' | 'variant3' | 'variant4';

export interface LojaTemaColorsConfig {
  primary: string;
  accent: string;
  surface: string;
}

export interface LojaTemaConfigNormalized {
  version: number;
  colors: LojaTemaColorsConfig;
  catalog: LojaTemaCatalogConfig;
  cardSales: LojaTemaCardSalesConfig;
}

const CARD_VARIANT_ALIASES: Record<string, LojaTemaCardVariant> = {
  legacy: 'legacy',
  antigo: 'legacy',
  old: 'legacy',
  variant1: 'variant1',
  variant2: 'variant2',
  variant3: 'variant3',
  variant4: 'variant4',
  '0': 'legacy',
  '1': 'variant1',
  '2': 'variant2',
  '3': 'variant3',
  '4': 'variant4',
};

const BANNER_ALIASES: Record<string, LojaTemaCardBannerStructure> = {
  gradientbottom: 'gradientBottom',
  'gradient-bottom': 'gradientBottom',
  center: 'center',
  minimal: 'minimal',
};

function normKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

export function normalizeImageRatio(raw: unknown, fallback: string = '4/5'): string {
  if (raw == null) return fallback;
  const s = String(raw).replace(/\s+/g, '');
  if (LOJA_TEMA_ASPECT_RATIOS.has(s)) return s;
  return fallback;
}

export function normalizeCardBannerStructure(raw: unknown): LojaTemaCardBannerStructure {
  if (raw == null) return 'gradientBottom';
  const k = normKey(String(raw));
  return BANNER_ALIASES[k] ?? 'gradientBottom';
}

function normalizeColumns(raw: unknown, allowed: readonly number[], fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && allowed.includes(n as any) ? n : fallback;
}

export function cardBannerClassMap(struct: LojaTemaCardBannerStructure): string {
  return `pcb-root--${struct}`;
}

export function normalizeCatalogConfig(raw: unknown): LojaTemaCatalogConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    columnsMobile: normalizeColumns(cfg['columnsMobile'], LOJA_TEMA_MOBILE_COLUMNS, LOJA_TEMA_DEFAULT_MOBILE_COLUMNS) as LojaTemaCatalogMobileColumns,
    columnsDesktop: normalizeColumns(cfg['columnsDesktop'], LOJA_TEMA_DESKTOP_COLUMNS, LOJA_TEMA_DEFAULT_DESKTOP_COLUMNS) as LojaTemaCatalogDesktopColumns,
  };
}

export function normalizeThemeConfig(raw: unknown): LojaTemaConfigNormalized {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const sales = ((cfg['cardSales'] && typeof cfg['cardSales'] === 'object') ? cfg['cardSales'] : {}) as Record<string, unknown>;
  const colors = ((cfg['colors'] && typeof cfg['colors'] === 'object') ? cfg['colors'] : {}) as Record<string, string>;
  const version = Number(cfg['version']);

  return {
    version: Number.isFinite(version) && version > 0 ? version : 2,
    colors: {
      primary: String(colors['primary'] ?? '#b45309'),
      accent: String(colors['accent'] ?? '#f5a700'),
      surface: String(colors['surface'] ?? '#ffffff'),
    },
    catalog: normalizeCatalogConfig(cfg['catalog']),
    cardSales: {
      imageRatio: '1/1',
      showMarca: sales['showMarca'] !== false,
      showSku: !!sales['showSku'],
      variant: CARD_VARIANT_ALIASES[normKey(String(sales['variant'] ?? 'variant1'))] ?? 'variant1',
      fallbackImageUrl: String(sales['fallbackImageUrl'] || '').trim() || undefined,
    },
  };
}
