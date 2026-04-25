import { Injectable } from '@angular/core';
import { normalizeThemeConfig } from '../constants/loja-tema-card.config';

export interface LojaThemeActive {
  id: number;
  nome: string;
  slug: string;
  config: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class StoreThemeService {
  /** Aplica variáveis CSS no :root a partir do tema ativo (loja pública). */
  applyTheme(theme: LojaThemeActive | null | undefined): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const normalized = normalizeThemeConfig(theme?.config);
    const colors = normalized.colors;
    if (colors?.['primary']) {
      root.style.setProperty('--fp-store-primary', colors['primary']);
      root.style.setProperty('--brand-yellow-700', colors['primary']);
    }
    if (colors?.['accent']) {
      root.style.setProperty('--fp-store-accent', colors['accent']);
      root.style.setProperty('--brand-yellow', colors['accent']);
    }
    if (colors?.['surface']) {
      root.style.setProperty('--fp-store-surface', colors['surface']);
    }
    root.style.setProperty('--fp-catalog-cols-mobile', String(normalized.catalog.columnsMobile));
    root.style.setProperty('--fp-catalog-cols-desktop', String(normalized.catalog.columnsDesktop));
  }

  clearTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    [
      '--fp-store-primary',
      '--fp-store-accent',
      '--fp-store-surface',
      '--brand-yellow',
      '--brand-yellow-700',
      '--fp-catalog-cols-mobile',
      '--fp-catalog-cols-desktop',
    ].forEach((k) => root.style.removeProperty(k));
  }
}
