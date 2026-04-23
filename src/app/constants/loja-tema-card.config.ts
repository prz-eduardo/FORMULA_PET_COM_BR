/**
 * Contract JSON em loja_temas.config: cardSales / cardBanner (estrutura + ratio).
 * Valores desconhecidos fazem fallback sem quebrar a vitrine.
 */

export const LOJA_TEMA_ASPECT_RATIOS = new Set<string>(['1/1', '4/5', '3/4', '16/9', '4/3']);

export type LojaTemaCardSalesStructure =
  | 'stacked'
  | 'split'
  | 'inverted'
  | 'outlined'
  | 'compact'
  | 'priceHero';

export type LojaTemaCardBannerStructure = 'gradientBottom' | 'center' | 'minimal';

const SALES_ALIASES: Record<string, LojaTemaCardSalesStructure> = {
  stacked: 'stacked',
  split: 'split',
  inverted: 'inverted',
  outlined: 'outlined',
  compact: 'compact',
  pricehero: 'priceHero',
  'price-hero': 'priceHero',
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

export function normalizeCardSalesStructure(raw: unknown): LojaTemaCardSalesStructure {
  if (raw == null) return 'stacked';
  const k = normKey(String(raw));
  return SALES_ALIASES[k] ?? 'stacked';
}

export function normalizeCardBannerStructure(raw: unknown): LojaTemaCardBannerStructure {
  if (raw == null) return 'gradientBottom';
  const k = normKey(String(raw));
  return BANNER_ALIASES[k] ?? 'gradientBottom';
}

export function cardSalesClassMap(struct: LojaTemaCardSalesStructure): string {
  return `p-card--${struct}`;
}

export function cardBannerClassMap(struct: LojaTemaCardBannerStructure): string {
  return `pcb-root--${struct}`;
}
