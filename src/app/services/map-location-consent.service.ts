import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Consentimento explícito para geolocalização no mapa (primeira chave, LGPD). Valores: 1=sim, 0=não. */
export const COOKIE_MAP_LOC_CONSENT = 'fp_map_loc_consent';
/** Última posição aproximada e endereço exibido (JSON), após o usuário permitir. */
export const COOKIE_MAP_LOC_LAST = 'fp_map_last_pos';

const CONSENT_MAX_AGE = 60 * 60 * 24 * 400; // ~13 meses
const POS_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export type MapLastPositionPayload = {
  lat: number;
  lng: number;
  address?: string;
  savedAt: string; // ISO
};

function getCookieRaw(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const all = `; ${document.cookie}`;
  const parts = all.split(`; ${name}=`);
  if (parts.length !== 2) return null;
  return parts.pop()!.split(';').shift() || null;
}

function setCookie(name: string, value: string, maxAge: number, secure: boolean): void {
  if (typeof document === 'undefined') return;
  let c = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
  if (secure) c += ';Secure';
  document.cookie = c;
}

@Injectable({ providedIn: 'root' })
export class MapLocationConsentService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  /** `null` = ainda não respondeu; `true` = permitiu; `false` = recusou. */
  getConsent(): boolean | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = getCookieRaw(COOKIE_MAP_LOC_CONSENT);
    if (raw == null || raw === '') return null;
    if (raw === '0') return false;
    if (raw === '1') return true;
    return null;
  }

  setConsent(accepted: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    setCookie(COOKIE_MAP_LOC_CONSENT, accepted ? '1' : '0', CONSENT_MAX_AGE, secure);
  }

  getLastPosition(): MapLastPositionPayload | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = getCookieRaw(COOKIE_MAP_LOC_LAST);
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      const p = JSON.parse(decoded) as MapLastPositionPayload;
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || !p.savedAt) return null;
      return p;
    } catch {
      return null;
    }
  }

  setLastPosition(pos: { lat: number; lng: number }, address?: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    const addr = address ? String(address).trim().slice(0, 240) : undefined;
    const payload: MapLastPositionPayload = {
      lat: pos.lat,
      lng: pos.lng,
      savedAt: new Date().toISOString(),
      ...(addr ? { address: addr } : {}),
    };
    setCookie(COOKIE_MAP_LOC_LAST, JSON.stringify(payload), POS_MAX_AGE, secure);
  }

  clearLastPosition(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    setCookie(COOKIE_MAP_LOC_LAST, '', 0, secure);
  }

  /** Remove a decisão anterior para o aviso de localização voltar a aparecer. */
  clearConsent(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    setCookie(COOKIE_MAP_LOC_CONSENT, '', 0, secure);
  }
}
