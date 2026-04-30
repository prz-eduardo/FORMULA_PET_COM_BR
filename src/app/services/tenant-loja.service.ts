import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TenantLojaPublicProfile {
  id: number;
  nome: string;
  loja_slug: string | null;
  descricao?: string | null;
  logo_url?: string | null;
  texto_institucional?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [k: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class TenantLojaService {
  private readonly baseUrl = environment.apiBaseUrl;

  /** Slug normalizado da vitrine (subdomínio ou query ?loja= em dev). */
  readonly lojaSlug = signal<string | null>(null);
  readonly profile = signal<TenantLojaPublicProfile | null>(null);
  readonly resolvedFromCustomDomain = signal(false);
  private initDone = false;

  readonly isTenantLoja = computed(() => !!this.lojaSlug() && !!this.profile());

  readonly displayBrandName = computed(() => {
    const p = this.profile();
    return (p?.nome as string) || null;
  });

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  /**
   * Resolve host/subdomínio e carrega perfil público (aprovado).
   * Chamado uma vez no bootstrap (AppComponent).
   */
  async initFromLocation(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.initDone) return;
    this.initDone = true;
    let host = '';
    try {
      host = (window.location.hostname || '').toLowerCase();
    } catch {
      return;
    }

    let prof: TenantLojaPublicProfile | null = null;
    let slug: string | null = null;
    let fromCustom = false;

    try {
      const res = await firstValueFrom(
        this.http
          .get<{ source?: string; parceiro?: TenantLojaPublicProfile }>(
            `${this.baseUrl}/anunciantes/resolve-host`,
            { params: { host } }
          )
          .pipe(catchError(() => of(null)))
      );
      if (res?.parceiro?.loja_slug) {
        prof = res.parceiro as TenantLojaPublicProfile;
        slug = String(res.parceiro.loja_slug);
        fromCustom = true;
      }
    } catch {
      /* ignore */
    }

    if (!slug) {
      if (host.endsWith('.petsphere.com.br')) {
        const sub = host.replace(/\.petsphere\.com\.br$/i, '');
        if (sub && sub !== 'www') slug = sub.toLowerCase();
      }
    }

    if (!slug && (host === 'localhost' || host === '127.0.0.1')) {
      try {
        const q = new URLSearchParams(window.location.search).get('loja');
        if (q) slug = this.normalizeClientSlug(q);
      } catch {
        /* ignore */
      }
    }

    if (slug) {
      try {
        prof = await firstValueFrom(
          this.http.get<TenantLojaPublicProfile>(`${this.baseUrl}/anunciantes/por-slug/${encodeURIComponent(slug)}`)
        );
      } catch {
        prof = null;
        slug = null;
      }
    }

    this.resolvedFromCustomDomain.set(fromCustom);
    this.lojaSlug.set(slug);
    this.profile.set(prof);
  }

  parceiroId(): number | null {
    const id = this.profile()?.id;
    return id != null ? Number(id) : null;
  }

  private normalizeClientSlug(raw: string): string {
    let s = String(raw || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
    return s.replace(/^-|-$/g, '');
  }
}
