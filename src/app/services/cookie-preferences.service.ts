import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Bump quando a política de cookies/privacidade mudar, para reexibir o aviso. */
export const COOKIE_CONSENT_POLICY_VERSION = 1;

export const LS_COOKIE_CONSENT_KEY = 'fp_cookie_consent_v1';

export interface CookiePreferences {
  policyVersion: number;
  /** Sempre true; o armazenamento da preferência e cookies necessários. */
  essential: true;
  analytics: boolean;
  thirdParty: boolean;
  savedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CookiePreferencesService {
  private readonly preferencesSubject = new BehaviorSubject<CookiePreferences | null>(this.readFromStorage());
  /**
   * True quando o usuário reabriu o painel pelo rodapé (já existia decisão).
   * Na primeira visita, o painel aparece com manageOpen falso.
   */
  private readonly manageOpenSubject = new BehaviorSubject(false);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  get preferences$(): Observable<CookiePreferences | null> {
    return this.preferencesSubject.asObservable();
  }

  get manageOpen$(): Observable<boolean> {
    return this.manageOpenSubject.asObservable();
  }

  /** Visível: sem decisão válida, ou o usuário abriu "gerir" pelo rodapé. */
  get bannerVisible$(): Observable<boolean> {
    return combineLatest([this.preferencesSubject, this.manageOpenSubject]).pipe(
      map(([p, manage]) => !this.isValid(p) || manage)
    );
  }

  isBannerVisible(): boolean {
    const p = this.preferencesSubject.getValue();
    return !this.isValid(p) || this.manageOpenSubject.getValue();
  }

  getSnapshot(): CookiePreferences | null {
    return this.preferencesSubject.getValue();
  }

  hasValidPreferences(): boolean {
    return this.isValid(this.preferencesSubject.getValue());
  }

  isValid(p: CookiePreferences | null | undefined): p is CookiePreferences {
    if (!p || typeof p !== 'object') {
      return false;
    }
    if (p.policyVersion !== COOKIE_CONSENT_POLICY_VERSION) {
      return false;
    }
    if (p.essential !== true) {
      return false;
    }
    if (typeof p.analytics !== 'boolean' || typeof p.thirdParty !== 'boolean') {
      return false;
    }
    return true;
  }

  /** Reabre o painel (ex.: link no rodapé "Preferências de cookies"). */
  openPreferencesPanel(): void {
    this.manageOpenSubject.next(true);
  }

  closeManagePanel(): void {
    this.manageOpenSubject.next(false);
  }

  save(prefs: Pick<CookiePreferences, 'analytics' | 'thirdParty'>): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const next: CookiePreferences = {
      policyVersion: COOKIE_CONSENT_POLICY_VERSION,
      essential: true,
      analytics: prefs.analytics,
      thirdParty: prefs.thirdParty,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(LS_COOKIE_CONSENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    this.manageOpenSubject.next(false);
    this.preferencesSubject.next(next);
  }

  private readFromStorage(): CookiePreferences | null {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(LS_COOKIE_CONSENT_KEY);
      if (!raw) {
        return null;
      }
      const p = JSON.parse(raw) as CookiePreferences;
      return this.isValid(p) ? p : null;
    } catch {
      return null;
    }
  }
}
