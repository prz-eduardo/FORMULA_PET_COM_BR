import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../enviroments/environment';
import { BannerPosition } from '../shared/banner/banner-positions';
import { BannerDto } from './admin-api.service';

interface CacheEntry {
  expiresAt: number;
  banners: BannerDto[];
  stream$?: Observable<BannerDto[]>;
}

@Injectable({ providedIn: 'root' })
export class BannersPublicService {
  private baseUrl = `${environment.apiBaseUrl}/banners`;
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 60_000;

  constructor(private http: HttpClient) {}

  /**
   * Retorna banners ativos para uma posição, com cache em memória por 1 minuto
   * (evita múltiplas requisições quando vários componentes montam simultaneamente).
   */
  list(posicao: BannerPosition): Observable<BannerDto[]> {
    const key = posicao;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return of(cached.banners);
    if (cached?.stream$) return cached.stream$;

    const params = new HttpParams().set('posicao', posicao);
    const stream$ = this.http.get<{ data: BannerDto[] }>(this.baseUrl, { params }).pipe(
      map(res => Array.isArray(res?.data) ? res.data : []),
      tap(banners => {
        this.cache.set(key, { banners, expiresAt: Date.now() + this.defaultTtlMs });
      }),
      catchError(() => {
        this.cache.delete(key);
        return of([] as BannerDto[]);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.cache.set(key, { banners: [], expiresAt: 0, stream$ });
    return stream$;
  }

  invalidate(posicao?: BannerPosition) {
    if (posicao) this.cache.delete(posicao);
    else this.cache.clear();
  }
}
