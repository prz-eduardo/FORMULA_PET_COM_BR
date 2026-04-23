import { Injectable } from '@angular/core';

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
    const cfg = theme?.config as Record<string, any> | undefined;
    const colors = cfg?.['colors'] as Record<string, string> | undefined;
    if (colors?.['primary']) {
      root.style.setProperty('--fp-store-primary', colors['primary']);
    }
    if (colors?.['accent']) {
      root.style.setProperty('--fp-store-accent', colors['accent']);
      root.style.setProperty('--brand-yellow', colors['accent']);
    }
    if (colors?.['surface']) {
      root.style.setProperty('--fp-store-surface', colors['surface']);
    }
  }

  clearTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    ['--fp-store-primary', '--fp-store-accent', '--fp-store-surface'].forEach((k) => root.style.removeProperty(k));
  }
}
