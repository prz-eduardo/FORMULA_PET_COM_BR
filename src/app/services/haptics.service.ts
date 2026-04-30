import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Petsphere haptics — wrapper sobre @capacitor/haptics com fallback Web (Vibration API).
 *
 * - Em iOS/Android (Capacitor): usa CoreHaptics / VibrationEffect nativo.
 * - Em browser: usa navigator.vibrate quando disponível (Android Chrome).
 * - Respeita prefers-reduced-motion: tudo vira no-op.
 *
 * Esta camada é segura para SSR (Angular Universal): faz lazy import no browser.
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'selection';

@Injectable({ providedIn: 'root' })
export class HapticsService {
  private capacitorReady = false;
  private capacitorImpact: ((opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>) | null = null;
  private capacitorSelection: (() => Promise<void>) | null = null;
  private reducedMotion = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.reducedMotion = mq.matches;
        mq.addEventListener?.('change', (e) => { this.reducedMotion = e.matches; });
      } catch {}
      this.bootstrapCapacitor();
    }
  }

  /** Lazy-load do plugin Capacitor para não travar o bundle inicial / SSR. */
  private async bootstrapCapacitor(): Promise<void> {
    try {
      const mod: any = await import('@capacitor/haptics');
      const Haptics = mod?.Haptics;
      const ImpactStyle = mod?.ImpactStyle;
      if (!Haptics || !ImpactStyle) return;
      this.capacitorImpact = async ({ style }) => {
        const styleEnum = (ImpactStyle as any)[style];
        if (!styleEnum) return;
        await Haptics.impact({ style: styleEnum });
      };
      this.capacitorSelection = async () => {
        if (typeof Haptics.selectionStart === 'function') {
          await Haptics.selectionStart();
          await Haptics.selectionEnd();
        }
      };
      this.capacitorReady = true;
    } catch {
      this.capacitorReady = false;
    }
  }

  /** Toque leve — usado em tap de aba e botões secundários. */
  light(): void { this.fire('light'); }
  /** Toque médio — FAB, abrir bottom sheet. */
  medium(): void { this.fire('medium'); }
  /** Toque forte — long-press, ações destrutivas. */
  heavy(): void { this.fire('heavy'); }
  /** Seleção — quando o usuário muda de aba ativa. */
  selection(): void { this.fire('selection'); }

  private fire(intensity: HapticIntensity): void {
    if (this.reducedMotion) return;
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.capacitorReady) {
      try {
        if (intensity === 'selection' && this.capacitorSelection) {
          void this.capacitorSelection();
          return;
        }
        const map: Record<Exclude<HapticIntensity, 'selection'>, 'LIGHT' | 'MEDIUM' | 'HEAVY'> = {
          light: 'LIGHT',
          medium: 'MEDIUM',
          heavy: 'HEAVY',
        };
        const style = map[intensity as Exclude<HapticIntensity, 'selection'>];
        if (style && this.capacitorImpact) {
          void this.capacitorImpact({ style });
          return;
        }
      } catch {
        // cai no fallback web
      }
    }

    // Fallback Vibration API (Android Chrome). iOS Safari ignora.
    try {
      const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
      if (typeof nav.vibrate === 'function') {
        const ms = intensity === 'heavy' ? 22 : intensity === 'medium' ? 12 : 6;
        nav.vibrate(ms);
      }
    } catch {}
  }
}
