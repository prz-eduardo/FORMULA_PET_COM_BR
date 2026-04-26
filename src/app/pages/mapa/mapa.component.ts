import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, ApplicationRef, HostBinding } from '@angular/core';
import { filter, take } from 'rxjs/operators';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import {
  LOJA_CEP,
  LOJA_ENDERECO_TEXTO,
  LOJA_MAPA_LAT,
  LOJA_MAPA_LNG,
  MARCA_NOME,
} from '../../constants/loja-public';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { FP_MAP_STYLES } from './mapa-map-styles';

  // `allPartners` holds the raw/full list from backend; `partners` is the filtered/visible list
@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, RouterModule, BannerSlotComponent],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent implements OnInit, OnDestroy {
  // start with no tab selected; user must pick a service type to load partners
  // `allPartners` holds the raw/full list from backend; `partners` is the filtered/visible list
  allPartners: Array<any> = [];
  partners: Array<any> = [];
  // tabs populated from backend (/tipos-profissionais)
  tabs: Array<{ id: string; label: string; typeId?: number; icon?: string }> = [];
  // currently selected tab id (string slug) — default to 'todos' so initial load requests all types
  active: string = 'todos';
  mapsApiKey: string | null = null;
  loading = false;
  error: string | null = null;
  // google maps runtime objects
  private map: any = null;
  private markers: any[] = [];
  private partnerClusterer: MarkerClusterer | null = null;
  private pharmacyPulseCircle: any = null;
  private pharmacyPulseRaf = 0;
  private infoWindow: any = null;
  // currently opened info window instance (so different markers don't overwrite behavior)
  private currentInfoWindow: any = null;
  private directionsService: any = null;
  private directionsRenderer: any = null;
  private originMarker: any = null;
  private mapInitialized = false;
  private mapReadyPromise: Promise<void> | null = null;
  private mapReadyResolver: (() => void) | null = null;
  readonly marcaNome = MARCA_NOME;
  readonly lojaEnderecoExibicao = `${LOJA_ENDERECO_TEXTO}, CEP ${LOJA_CEP}`;
  private defaultCenterAddress = `${LOJA_ENDERECO_TEXTO}, Curitiba, PR, CEP ${LOJA_CEP}`;
  private pharmacyAddress = `${LOJA_ENDERECO_TEXTO}, Curitiba, PR`;
  private pharmacyCoords: { lat: number; lng: number } | null = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
  private readonly pinLojaUrl = '/icones/pin-pata.svg';

  /** Full map + overlays (matches CSS breakpoint max-width 860px) */
  isMobileMapLayout = false;
  /** Painel inferior (mobile): acordeão de resultados — inicia fechado */
  resultsAccordionOpen = false;
  @HostBinding('class.host--mobile-map') get hostMobileMap() {
    return this.isMobileMapLayout;
  }

  toggleResultsAccordion(): void {
    this.resultsAccordionOpen = !this.resultsAccordionOpen;
    this.scheduleMapResize();
  }

  private mobileLayoutMql: MediaQueryList | null = null;
  private mobileLayoutListener: (() => void) | null = null;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private appRef: ApplicationRef,
    private zone: NgZone
  ) {}

  // keep references so we can remove listeners on destroy
  private __errHandler = (ev: any) => { console.error('map uncaught error', ev); try { this.showFallbackMap(); } catch (e) {}; };
  private __unhandledRejection = (ev: any) => { console.error('map unhandledrejection', ev); try { this.showFallbackMap(); } catch (e) {}; };

  // filters per service (each tab has its own set)
  filtersByTab: { [key: string]: Array<{ id: string; label: string; on: boolean }> } = {};

  
  toggleFilter(f: any){
    // toggle the filter state in-place — since we bind objects from filtersByTab,
    // this will update the correct service-specific filter array.
    f.on = !f.on;
    // when a filter toggles, re-apply filters to update visible partners and markers
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }
    this.scheduleMapResize();
  }

  // compute the filtered partners based on currently selected filters for active tab
  private computeFilteredPartners(): any[] {
    const key = this.active || '';
    const filters = this.filtersByTab[key] || [];
    // collect keys of filters that are ON
    const activeFilterKeys = filters.filter(f => !!f.on).map(f => String(f.id));
    // if no active filters, return full list
    if (!activeFilterKeys.length) return this.allPartners.slice();

    // otherwise return partners where all active filter keys are true in filtros_selecionados
    return this.allPartners.filter(p => {
      try {
        const sel = p.filtros_selecionados || {};
        return activeFilterKeys.every(k => !!sel[k]);
      } catch (e) { return false; }
    });
  }

  // apply filters and refresh UI + markers
  private applyFilters(){
    this.partners = this.computeFilteredPartners();
    try { this.refreshMarkers(); } catch (e) { console.warn('refreshMarkers failed in applyFilters', e); }
  }
  getActiveLabel(){
    const t = this.tabs.find(x => x.id === this.active);
    return t ? t.label : '';
  }

  getFiltersForActive(){
    return this.filtersByTab[this.active] || [];
  }

  /**
   * Retorna o caminho de um ícone amigável para a aba, baseando-se no slug/label.
   * Sem efeito sobre a lógica dos markers — usado apenas no template para decorar abas.
   */
  getTabIcon(tab: { id?: string; label?: string; icon?: string }): string {
    try {
      const raw = String(tab?.icon ?? tab?.id ?? tab?.label ?? '').toLowerCase();
      const key = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      if (!key) return '/icones/paw.png';
      if (key === 'todos' || key === 'all') return '/icones/paw.png';
      if (/vet|clinic/.test(key)) return '/icones/clinic-icon.png';
      if (/walker|passeio|passeador/.test(key)) return '/icones/walker-icon.png';
      if (/petshop|pet-shop|loja|shop/.test(key)) return '/icones/loja.png';
      if (/banho|tosa|groom/.test(key)) return '/icones/shop-icon.png';
      if (/creche|hotel|daycare/.test(key)) return '/icones/galeria-pet.png';
      if (/sitter|pet-sitter|petsitter/.test(key)) return '/icones/paw.png';
      return '/icones/paw.png';
    } catch (e) {
      return '/icones/paw.png';
    }
  }

  /**
   * Label amigável para o tipo do parceiro (exibido como badge no card de resultado).
   */
  getPartnerTypeLabel(p: any): string {
    try {
      const t = p?.tipo;
      if (!t) {
        const firstTipo = Array.isArray(p?.tipos) ? p.tipos[0] : null;
        if (firstTipo) return String(firstTipo.nome ?? firstTipo.label ?? firstTipo.slug ?? '').trim();
        return '';
      }
      if (typeof t === 'string') return t;
      return String(t.nome ?? t.label ?? t.slug ?? '').trim();
    } catch (e) {
      return '';
    }
  }

  /**
   * Retorna { src, isIcon } para o avatar do card de resultado.
   * Prefere a logo do parceiro; caso contrário usa o ícone do tipo como fallback.
   */
  getPartnerAvatar(p: any): { src: string; isIcon: boolean } {
    try {
      const logo = p?.logo_url ?? p?._raw?.logo_url ?? null;
      if (logo && typeof logo === 'string') return { src: logo, isIcon: false };
      const tipoSlug = p?.tipo?.slug ?? (Array.isArray(p?.tipos) && p.tipos[0]?.slug) ?? p?.tipo?.nome ?? '';
      const iconSrc = this.getTabIcon({ id: tipoSlug, label: this.getPartnerTypeLabel(p) });
      return { src: iconSrc, isIcon: true };
    } catch (e) {
      return { src: '/icones/paw.png', isIcon: true };
    }
  }

  /**
   * Cidade/estado resumidos para exibir no card de resultado.
   */
  getPartnerLocation(p: any): string {
    try {
      const cidade = p?.cidade ?? p?._raw?.cidade ?? '';
      const estado = p?.estado ?? p?._raw?.estado ?? '';
      if (cidade && estado) return `${cidade} - ${estado}`;
      return String(cidade || estado || p?.endereco || '').trim();
    } catch (e) {
      return '';
    }
  }

  ngOnInit(): void {
    // follow the same pattern as other pages: only call API from the browser
    // to avoid SSR network errors.
    if (isPlatformBrowser(this.platformId)) {
      this.initMobileLayoutListener();
      // attach global handlers to capture initialization errors so the app doesn't get left in a broken state
      try { window.addEventListener('error', this.__errHandler); window.addEventListener('unhandledrejection', this.__unhandledRejection); } catch (e) {}
      // load available professional types first (to build tabs).
      // Defer heavy partner/map initialization until the app is stable to avoid
      // NG0506 hydration timeouts (don't start long-running async work during hydration).
      this.loadProfessionalTypes();
      try {
        // wait until ApplicationRef reports stability (first true) and then start partners/map
        // but don't wait forever: fallback after a short timeout to avoid blocking map init
        const stableSub = (this.appRef.isStable as any).pipe(filter((s: boolean) => s), take(1)).subscribe(() => {
          try { clearTimeout(stableTimer as any); } catch (e) {}
            this.loadPartners();
              // only load anunciantes if a tab is already selected
              if (this.active) this.loadAnunciantes(this.active === 'todos' ? undefined : this.active);
        });
        // fallback timer: if stability doesn't occur within 1500ms, proceed anyway
        const stableTimer = setTimeout(() => {
          try { stableSub.unsubscribe(); } catch (e) {}
            this.loadPartners();
            if (this.active) this.loadAnunciantes(this.active === 'todos' ? undefined : this.active);
        }, 1500);
      } catch (e) {
        // fallback: schedule after a tick
        setTimeout(() => { this.loadPartners(); this.loadAnunciantes(this.active); }, 0);
      }
    } else {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    try { window.removeEventListener('error', this.__errHandler); window.removeEventListener('unhandledrejection', this.__unhandledRejection); } catch (e) {}
    this.teardownMobileLayoutListener();
    this.stopPharmacyPulse();
    this.disposePartnerClusterer();
  }

  private initMobileLayoutListener(): void {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 860px)');
    this.mobileLayoutMql = mql;
    const apply = () => {
      const next = !!mql.matches;
      this.zone.run(() => {
        this.isMobileMapLayout = next;
        if (!next) {
          this.resultsAccordionOpen = false;
        }
        this.scheduleMapResize();
      });
    };
    this.mobileLayoutListener = apply;
    try {
      if (mql.addEventListener) mql.addEventListener('change', apply);
      else (mql as any).addListener(apply);
    } catch (e) {
      /* ignore */
    }
    apply();
  }

  private teardownMobileLayoutListener(): void {
    if (!this.mobileLayoutMql || !this.mobileLayoutListener) return;
    try {
      if (this.mobileLayoutMql.removeEventListener) this.mobileLayoutMql.removeEventListener('change', this.mobileLayoutListener);
      else (this.mobileLayoutMql as any).removeListener(this.mobileLayoutListener);
    } catch (e) {
      /* ignore */
    }
    this.mobileLayoutMql = null;
    this.mobileLayoutListener = null;
  }

  /** After layout changes (esp. mobile overlay), refresh map tiles. */
  private scheduleMapResize(): void {
    if (!isPlatformBrowser(this.platformId) || !this.map) return;
    const run = () => {
      try {
        const g = (window as any).google;
        if (g?.maps?.event) g.maps.event.trigger(this.map, 'resize');
      } catch (e) {
        /* ignore */
      }
    };
    setTimeout(run, 0);
    setTimeout(run, 200);
  }

  /** Evita que o ponto activo fique sob o acordeão / dock em mobile. */
  private nudgeMapForMobileChrome(): void {
    if (!this.isMobileMapLayout || !this.map) return;
    try {
      this.map.panBy(0, -100);
    } catch (e) {
      /* ignore */
    }
  }

  private disposePartnerClusterer(): void {
    if (!this.partnerClusterer) return;
    try {
      this.partnerClusterer.clearMarkers();
    } catch (e) {
      /* ignore */
    }
    try {
      (this.partnerClusterer as any).setMap(null);
    } catch (e) {
      /* ignore */
    }
    this.partnerClusterer = null;
  }

  private stopPharmacyPulse(): void {
    if (this.pharmacyPulseRaf) {
      try {
        cancelAnimationFrame(this.pharmacyPulseRaf);
      } catch (e) {
        /* ignore */
      }
      this.pharmacyPulseRaf = 0;
    }
    if (this.pharmacyPulseCircle) {
      try {
        this.pharmacyPulseCircle.setMap(null);
      } catch (e) {
        /* ignore */
      }
      this.pharmacyPulseCircle = null;
    }
  }

  private startPharmacyPulse(center: { lat: number; lng: number }): void {
    this.stopPharmacyPulse();
    if (!this.map || !(window as any).google) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const google = (window as any).google;
    try {
      this.pharmacyPulseCircle = new google.maps.Circle({
        map: this.map,
        center,
        radius: 28,
        strokeColor: '#c4d600',
        strokeOpacity: 0.5,
        strokeWeight: 2,
        fillColor: '#c4d600',
        fillOpacity: 0.1,
        zIndex: 0,
      });
    } catch (e) {
      return;
    }
    let t = 0;
    const tick = () => {
      if (!this.pharmacyPulseCircle) return;
      t += 0.028;
      const w = 0.5 + 0.5 * Math.sin(t);
      const r = 22 + 18 * w;
      const fo = 0.06 + 0.08 * w;
      try {
        this.pharmacyPulseCircle.setRadius(r);
        this.pharmacyPulseCircle.setOptions({
          fillOpacity: fo,
          strokeOpacity: 0.32 + 0.22 * w,
        });
      } catch (e) {
        /* ignore */
      }
      this.pharmacyPulseRaf = requestAnimationFrame(tick) as unknown as number;
    };
    this.pharmacyPulseRaf = requestAnimationFrame(tick) as unknown as number;
  }

  // when the user switches tabs we should refresh the anunciantes list for that tipo
  select(tabId: string){
    this.active = tabId;
    this.scheduleMapResize();
    if (isPlatformBrowser(this.platformId)) {
      // resolve numeric type id from the populated tabs list and pass that to backend
      let tipo: any = tabId;
      // if the special 'todos' tab is selected, send undefined so backend returns all
      if (String(tabId) === 'todos') tipo = undefined;
      try {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab && typeof tab.typeId !== 'undefined') tipo = Number(tab.typeId);
      } catch (e) {}
      this.loadAnunciantes(tipo);
    }
  }

  private loadAnunciantes(tipo?: any){
    // lightweight loading state for the anunciantes list
    // normalize special 'todos' marker so backend receives undefined (meaning: all types)
    if (String(tipo) === 'todos') tipo = undefined;
    this.api.getAnunciantes(tipo).subscribe({
      next: (res) => {
        try {
          // backend may return { filtros: [...], anuncios: [...] } or a raw array
          let anuncios: any[] = [];
          let filtros: any[] = [];
          if (Array.isArray(res)) {
            anuncios = res;
          } else if (res && typeof res === 'object') {
            anuncios = Array.isArray((res as any).anuncios) ? (res as any).anuncios : [];
            filtros = Array.isArray((res as any).filtros) ? (res as any).filtros : [];
          }

          // populate filtersByTab for the currently active tab (or fallback to tipo as key)
          const key = this.active || String(tipo ?? '');
          try {
            // Prefer `filtros` (legacy) but if backend supplies atributos_disponiveis or
            // anuncios include atributos (or atributos_disponiveis) use those to build filters.
            let availableAtributos: any[] = [];
            if (filtros && filtros.length) {
              availableAtributos = filtros.map((f: any) => ({ atributo_id: f.atributo_id ?? null, chave: f.chave ?? null, nome: f.nome ?? f.chave ?? '' }));
            } else if (res && Array.isArray((res as any).atributos_disponiveis) && (res as any).atributos_disponiveis.length) {
              availableAtributos = (res as any).atributos_disponiveis.map((a: any) => ({ atributo_id: a.atributo_id ?? null, chave: a.chave ?? null, nome: a.nome ?? a.chave ?? '' }));
            } else {
              // fallback: collect atributos_disponiveis or atributos from anuncios
              const collect: { [k: string]: any } = {};
              (anuncios || []).forEach((an: any) => {
                if (Array.isArray(an.atributos_disponiveis)) {
                  an.atributos_disponiveis.forEach((a: any) => { const keyk = a.chave ?? String(a.atributo_id ?? ''); if (!collect[keyk]) collect[keyk] = { atributo_id: a.atributo_id ?? null, chave: a.chave ?? keyk, nome: a.nome ?? a.chave ?? '' }; });
                }
                if (Array.isArray(an.atributos)) {
                  an.atributos.forEach((a: any) => { const keyk = a.chave ?? String(a.atributo_id ?? ''); if (!collect[keyk]) collect[keyk] = { atributo_id: a.atributo_id ?? null, chave: a.chave ?? keyk, nome: a.nome ?? a.chave ?? '' }; });
                }
              });
              availableAtributos = Object.values(collect || {});
            }

            if (availableAtributos && availableAtributos.length) {
              this.filtersByTab[key] = availableAtributos.map((f: any) => ({ id: f.chave ?? String(f.atributo_id ?? ''), label: f.nome ?? f.chave ?? '', on: false }));
            } else {
              this.filtersByTab[key] = this.filtersByTab[key] || [];
            }
          } catch (e) {
            this.filtersByTab[key] = this.filtersByTab[key] || [];
          }

            // normalize anuncios into partner objects expected by the UI/map
            this.allPartners = (anuncios || []).map((a: any) => {
              const anuncio = a || {};
              // try multiple field names used by backend
              const latRaw = anuncio.anuncio_latitude ?? anuncio.latitude ?? anuncio.lat ?? anuncio.anunciante_latitude ?? null;
              const lngRaw = anuncio.anuncio_longitude ?? anuncio.longitude ?? anuncio.lng ?? anuncio.anunciante_longitude ?? null;
              const latitude = latRaw != null ? Number(latRaw) : (anuncio.lat ? Number(anuncio.lat) : undefined);
              const longitude = lngRaw != null ? Number(lngRaw) : (anuncio.lng ? Number(anuncio.lng) : undefined);

              // build filtros_selecionados from anuncio.atributos (if present) so computeFilteredPartners can use them
              const filtros_map: any = {};
              try {
                if (Array.isArray(anuncio.atributos)) {
                  anuncio.atributos.forEach((at: any) => {
                    const k = at.chave ?? String(at.atributo_id ?? '');
                    if (typeof at.valor_bool !== 'undefined') filtros_map[k] = !!at.valor_bool;
                    else if (typeof at.valor_texto !== 'undefined' && at.valor_texto != null) filtros_map[k] = String(at.valor_texto);
                    else if (typeof at.valor_numero !== 'undefined' && at.valor_numero != null) filtros_map[k] = at.valor_numero;
                  });
                }
              } catch (e) { /* ignore attribute parsing errors */ }

            return {
              // primary identifiers
              id: anuncio.anunciante_id ?? anuncio.anunciante_id ?? anuncio.anuncio_id ?? anuncio.id,
              anuncio_id: anuncio.anuncio_id ?? undefined,
              // display name: prefer anunciante_nome, fallback to titulo
              nome: anuncio.anunciante_nome ?? anuncio.titulo ?? anuncio.nome ?? '',
              // title/heading
              titulo: anuncio.titulo ?? '',
              // contact info
              telefone: anuncio.anuncio_telefone ?? anuncio.anunciante_telefone ?? anuncio.telefone ?? '',
              email: anuncio.anuncio_email ?? anuncio.anunciante_email ?? anuncio.email ?? '',
              // address
              endereco: anuncio.anuncio_endereco ?? anuncio.endereco ?? '',
              cidade: anuncio.anunciante_cidade ?? anuncio.cidade ?? '',
              estado: anuncio.anunciante_estado ?? anuncio.estado ?? '',
              cep: anuncio.anunciante_cep ?? anuncio.cep ?? '',
              // description
              descricao: anuncio.anunciante_descricao ?? anuncio.anuncio_descricao ?? anuncio.descricao ?? '',
              // media
              logo_url: anuncio.logo_url ?? null,
              // geographic
              latitude: typeof latitude === 'number' && !isNaN(latitude) ? latitude : undefined,
              longitude: typeof longitude === 'number' && !isNaN(longitude) ? longitude : undefined,
              // filters selected for this anuncio (normalized from atributos array or fallback)
              filtros_selecionados: Object.keys(filtros_map).length ? filtros_map : (anuncio.filtros_selecionados ?? {}),
              // tipo normalization: backend may return `tipo` or `tipos` (array)
              tipo: anuncio.tipo ?? (Array.isArray(anuncio.tipos) && anuncio.tipos[0]) ?? null,
              tipos: Array.isArray(anuncio.tipos) ? anuncio.tipos : undefined,
              // raw payload for debugging if needed
              _raw: anuncio
              };
            });

            // apply current filters to compute visible partners
            try { this.applyFilters(); } catch (e) { console.warn('applyFilters after loadAnunciantes failed', e); }

            // refresh map markers if map already initialized
            try { this.refreshMarkers(); } catch (e) { /* ignore map refresh errors; may not be ready */ }
        } catch (e) {
          console.error('loadAnunciantes parse failed', e);
          this.allPartners = [];
          this.partners = [];
        }
      },
      error: (err) => {
        console.error('getAnunciantes failed', err);
        this.toast.error('Erro ao carregar anunciantes');
      }
    });
  }

  private readonly clusterPartnerThreshold = 15;

  private refreshMarkers() {
    if (!this.map || !(window as any).google) return;
    try {
      if (this.currentInfoWindow) {
        try {
          this.currentInfoWindow.close();
        } catch (e) {
          /* ignore */
        }
        this.currentInfoWindow = null;
      }
    } catch (e) {
      /* ignore */
    }

    this.stopPharmacyPulse();
    this.disposePartnerClusterer();
    for (const m of this.markers) {
      try {
        m.setMap(null);
      } catch (e) {
        /* ignore */
      }
    }
    this.markers = [];

    const fallbackCoords = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
    const coordsToUse = this.pharmacyCoords ?? fallbackCoords;
    const google = (window as any).google;

    try {
      const pinFpUrl = this.pinLojaUrl;
      const iconPharm = {
        url: pinFpUrl,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      };
      const pharmacyMarker = new google.maps.Marker({
        position: coordsToUse,
        map: this.map,
        icon: iconPharm,
        title: 'Farmácia / Loja',
        zIndex: 1000,
      });
      this.markers.push(pharmacyMarker);
      try {
        this.attachPharmacyInfo(pharmacyMarker, coordsToUse);
      } catch (e) {
        console.warn('attachPharmacyInfo failed', e);
      }
    } catch (e) {
      const pharmacyMarker = new google.maps.Marker({
        position: coordsToUse,
        map: this.map,
        title: 'Farmácia / Loja',
        zIndex: 1000,
      });
      this.markers.push(pharmacyMarker);
      try {
        this.attachPharmacyInfo(pharmacyMarker, coordsToUse);
      } catch (err) {
        console.warn('attachPharmacyInfo fallback failed', err);
      }
    }

    this.startPharmacyPulse(coordsToUse);

    const partnerMarkers: any[] = [];
    for (const p of this.partners) {
      const lat = p.latitude ?? p.lat ?? p.latitud ?? null;
      const lng = p.longitude ?? p.lng ?? p.long ?? null;
      if (lat == null || lng == null) continue;
      try {
        const iconObj = this.getIconForPartner(p);
        const defaultIcon = {
          url: '/icones/pin-pata.svg',
          scaledSize: new google.maps.Size(32, 36),
          anchor: new google.maps.Point(16, 36),
        };
        const useCluster = this.partners.length > this.clusterPartnerThreshold;
        const markerOpts: any = {
          position: { lat: Number(lat), lng: Number(lng) },
          map: useCluster ? null : this.map,
          title: p.nome || p.name || p.id?.toString?.() || 'Anunciante',
          zIndex: 500,
        };
        if (iconObj) markerOpts.icon = iconObj;
        else markerOpts.icon = defaultIcon;
        const marker = new google.maps.Marker(markerOpts);
        try {
          (marker as any).__partnerId = p.anuncio_id ?? p.id ?? p._raw?.id ?? null;
        } catch (e) {
          /* ignore */
        }
        this.markers.push(marker);
        partnerMarkers.push(marker);
        try {
          this.attachPartnerInfo(marker, p);
        } catch (e) {
          console.warn('attachPartnerInfo failed', e);
        }
      } catch (e) {
        const marker = new google.maps.Marker({
          position: { lat: Number(lat), lng: Number(lng) },
          map: this.partners.length > this.clusterPartnerThreshold ? null : this.map,
          title: p.nome || p.name || 'Anunciante',
          zIndex: 500,
        });
        try {
          (marker as any).__partnerId = p.anuncio_id ?? p.id ?? p._raw?.id ?? null;
        } catch (e) {
          /* ignore */
        }
        this.markers.push(marker);
        partnerMarkers.push(marker);
        try {
          this.attachPartnerInfo(marker, p);
        } catch (err) {
          console.warn('attachPartnerInfo fallback failed', err);
        }
      }
    }

    if (partnerMarkers.length > this.clusterPartnerThreshold) {
      try {
        this.partnerClusterer = new MarkerClusterer({
          map: this.map,
          markers: partnerMarkers,
        });
      } catch (e) {
        console.warn('MarkerClusterer failed, falling back to individual markers', e);
        for (const m of partnerMarkers) {
          try {
            m.setMap(this.map);
          } catch (e) {
            /* ignore */
          }
        }
      }
    }
  }

  /**
   * Attach an info window to a partner marker showing basic info and actions.
   */
  private attachPartnerInfo(marker: any, partner: any) {
    if (!(window as any).google) return;
    const google = (window as any).google;
    try { if (this.infoWindow) this.infoWindow.close(); } catch {}

    const lat = partner.latitude ?? partner.lat ?? partner._raw?.latitude ?? 0;
    const lng = partner.longitude ?? partner.lng ?? partner._raw?.longitude ?? 0;
    const uid = String(partner.anuncio_id ?? partner.id ?? Math.abs(Math.floor(Math.random() * 1e9)));
    const dest = encodeURIComponent(`${lat},${lng}`);
    const name = partner.nome ?? partner.titulo ?? partner._raw?.anunciante?.nome ?? '';
    const title = partner.titulo ?? '';
    const address = partner.endereco ?? partner._raw?.endereco ?? '';
    const phone = partner.telefone ?? partner._raw?.telefone ?? '';

    const routeBtnId = `map-route-btn-${uid}`;
    const openBtnId = `map-open-btn-${uid}`;
    const closeBtnId = `map-close-btn-${uid}`;

    const content = `
      <div style="max-width:340px;font-family:Inter,Arial,Helvetica,sans-serif;color:#0f172a;padding:12px;box-sizing:border-box;border-radius:10px;position:relative;overflow:visible">
      <button id="${closeBtnId}" aria-label="Fechar" style="position:absolute;top:-20px;right:-20px;width:40px;height:40px;border-radius:50%;background:#111827;color:#fff;border:0;box-shadow:0 10px 28px rgba(0,0,0,.32);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0">✕</button>

      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;line-height:1.2;word-break:break-word">${title}${address ? ' · ' + address : ''}</div>
        ${phone ? `<div style="font-size:13px;color:#374151;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Tel: ${phone}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px">
        <button id="${routeBtnId}" style="flex:1;border:0;background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer">Traçar rota</button>
        <button id="${openBtnId}" style="flex:1;border:1px solid #e5e7eb;background:#fff;color:#0f172a;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer">Abrir no Maps</button>
      </div>
      </div>
    `;

    const iw = new google.maps.InfoWindow({ content, maxWidth: 360 });

    marker.addListener('click', () => {
      try { if (this.currentInfoWindow) this.currentInfoWindow.close(); } catch {}
      try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
      this.nudgeMapForMobileChrome();
      iw.open(this.map, marker);
      this.currentInfoWindow = iw;
      try {
        google.maps.event.addListenerOnce(iw, 'domready', () => {
          try {
            // ensure style injection exists (allows overflow and hides built-in close)
            try {
              if (!document.querySelector('style[data-gm-style-iw]')) {
                const st = document.createElement('style');
                st.setAttribute('data-gm-style-iw', '1');
                st.innerHTML = `
                  .gm-style .gm-style-iw { overflow: visible !important; }
                  .gm-style .gm-style-iw > div { overflow: visible !important; }
                  .gm-style .gm-style-iw-chr > button.gm-ui-hover-effect { display: none !important; }
                  .gm-style .gm-ui-hover-effect[aria-label='Fechar'] { display: none !important; }
                `;
                document.head.appendChild(st);
              }
            } catch (e) {}

            const routeBtn = document.getElementById(routeBtnId);
            const openBtn = document.getElementById(openBtnId);
            const closeBtn = document.getElementById(closeBtnId);
            if (routeBtn) {
              routeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const destObj = { lat: Number(lat), lng: Number(lng) };
                try { localStorage.setItem('fp_last_dest', JSON.stringify(destObj)); } catch (e) {}
                this.drawRoute(destObj);
                try { iw.close(); } catch (e) {}
              });
            }
            if (openBtn) {
              openBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                await this.openMapsWithRoute({ lat: Number(lat), lng: Number(lng) });
              });
            }
            if (closeBtn) {
              try { (closeBtn as HTMLElement).style.zIndex = '99999'; } catch (e) {}
              closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { iw.close(); } catch {} });
            }
          } catch (e) { console.warn('partner info domready handler failed', e); }
        });
      } catch (e) {}
    });
  }

  /**
   * Determine an icon object for a partner based on its type.
   * Tries several sources (partner.tipo.icone, partner.tipo.slug, partner.tipo.nome,
   * tabs icons or active tab) and returns a Google Maps Icon object or undefined.
   */
  private getIconForPartner(partner: any) {
    try {
      if (!(window as any).google) return undefined;
      const google = (window as any).google;
      const candidates = [
        // explicit tipo object
        partner?.tipo?.icone,
        partner?.tipo?.slug,
        partner?.tipo?.nome,
        // if backend provides an array of tipos, prefer the first
        (Array.isArray(partner?.tipos) && partner?.tipos[0]?.icone),
        (Array.isArray(partner?.tipos) && partner?.tipos[0]?.slug),
        (Array.isArray(partner?.tipos) && partner?.tipos[0]?.nome),
        // raw payload fallbacks
        partner?._raw?.tipo?.icone,
        partner?._raw?.tipo?.slug,
        partner?._raw?.tipo?.nome,
        partner?._raw?.tipos && Array.isArray(partner._raw.tipos) ? partner._raw.tipos[0]?.icone : undefined,
        partner?._raw?.tipos && Array.isArray(partner._raw.tipos) ? partner._raw.tipos[0]?.slug : undefined,
        partner?._raw?.tipos && Array.isArray(partner._raw.tipos) ? partner._raw.tipos[0]?.nome : undefined,
        // try active tab icon as last resort
        (this.tabs.find(t => t.id === this.active)?.icon),
        // try a tab by numeric typeId
        (this.tabs.find(t => typeof t.typeId !== 'undefined' && partner?.tipo && partner.tipo.id === t.typeId)?.icon)
      ];
      let name: any = null;
      for (const c of candidates) { if (c) { name = c; break; } }
      if (!name) return undefined;
      // sanitize filename: lowercase, remove diacritics, spaces -> -, remove invalid chars
      let file = String(name).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-_.]/g, '');
      // ensure extension
      if (!file.endsWith('.png') && !file.endsWith('.svg')) file = `${file}.png`;
      const url = `/icones/${file}`;
      return { url, scaledSize: new google.maps.Size(32, 36), anchor: new google.maps.Point(16, 36) };
    } catch (e) { return undefined; }
  }

  private loadProfessionalTypes(){
    // call the API service to fetch types; if it fails we keep defaults
    this.api.getProfessionalTypes().subscribe({
      next: (res) => {
        // normalize response to an array of types
        const types: any[] = Array.isArray(res)
          ? (res as any[])
          : (res && Array.isArray((res as any).types) ? (res as any).types : []);
        if (types.length) {
          // map to { id: slug(for DOM), label, typeId: numeric id for backend, icon }
          this.tabs = types.map((t: any) => {
            const anyT: any = t;
            const slug = anyT.slug ? String(anyT.slug) : String(anyT.id ?? anyT.key ?? anyT.nome ?? anyT.label ?? anyT.name ?? '');
            const label = String(anyT.nome ?? anyT.label ?? anyT.name ?? '');
            const typeId = (typeof anyT.id !== 'undefined' && anyT.id !== null) ? Number(anyT.id) : undefined;
            const icon = anyT.icone ?? anyT.icon ?? undefined;
            return { id: slug, label, typeId, icon };
          });
          // ensure a default 'todos' tab exists at the beginning so UI/backends can request all
          if (!this.tabs.find(x => x.id === 'todos')) {
            this.tabs.unshift({ id: 'todos', label: 'Todos', typeId: undefined, icon: undefined });
          }
          // do NOT auto-select other tabs — we keep `this.active` default (currently 'todos')
        }
      },
      error: (err) => {
        console.error('getProfessionalTypes failed', err);
        // don't break the page; show a soft toast so developer knows
        this.toast.error('Erro ao carregar tipos de profissionais');
      }
    });
  }

  loadPartners(){
    this.loading = true;
    this.error = null;
    this.api.getMaps().subscribe({
      next: (res) => {
        // normalize partners coming from /maps so the UI and map code can use a
        // consistent shape (same as loadAnunciantes normalization).
        const rawPartners: any[] = Array.isArray(res.partners) ? res.partners : [];
        this.allPartners = rawPartners.map((p: any) => {
          const latitudeRaw = p.latitude ?? p.lat ?? p.anunciante?.latitude ?? null;
          const longitudeRaw = p.longitude ?? p.lng ?? p.anunciante?.longitude ?? null;
          const latitude = latitudeRaw != null ? Number(latitudeRaw) : undefined;
          const longitude = longitudeRaw != null ? Number(longitudeRaw) : undefined;
          const anunciante = p.anunciante ?? {};
          return {
            id: anunciante.id ?? p.id ?? undefined,
            anuncio_id: p.id ?? undefined,
            nome: anunciante.nome ?? p.titulo ?? p.nome ?? '',
            titulo: p.titulo ?? '',
            telefone: p.telefone ?? anunciante.telefone ?? '',
            email: p.email ?? anunciante.email ?? '',
            endereco: p.endereco ?? p.anuncio_endereco ?? '',
            cidade: p.cidade ?? '',
            estado: p.estado ?? '',
            cep: p.cep ?? '',
            descricao: anunciante.descricao ?? p.descricao ?? p.anuncio_descricao ?? '',
            logo_url: anunciante.logo_url ?? p.logo_url ?? null,
            latitude: typeof latitude === 'number' && !isNaN(latitude) ? latitude : undefined,
            longitude: typeof longitude === 'number' && !isNaN(longitude) ? longitude : undefined,
            filtros_selecionados: p.filtros_selecionados ?? {},
            // normalize tipo/tipos shapes: prefer explicit tipo, otherwise pick first from tipos array
            tipo: p.tipo ?? (Array.isArray(p.tipos) && p.tipos[0]) ?? null,
            tipos: Array.isArray(p.tipos) ? p.tipos : undefined,
            partner_type: p.partner_type ?? null,
            _raw: p
          };
        });
        // compute visible partners according to any current filters
        try { this.applyFilters(); } catch (e) { this.partners = this.allPartners.slice(); }
        this.mapsApiKey = res.mapsApiKey ?? null;
        this.loading = false;
        // if we have a maps key, initialize the interactive map
        if (this.mapsApiKey && isPlatformBrowser(this.platformId)) {
          this.initInteractiveMapWithRetries(this.mapsApiKey, 3).catch(err => {
            console.error('initInteractiveMap failed after retries', err);
            this.toast.error('Erro ao inicializar o mapa');
            try { this.showFallbackMap(); } catch (e) {}
          });
        } else {
          // no API key available — show a simple iframe fallback so the page isn't empty
          try { if (isPlatformBrowser(this.platformId)) this.showFallbackMap(); } catch (e) {}
        }
      },
      error: (err) => {
        console.error('ApiService.getMaps failed', err);
        this.toast.error('Erro ao carregar parceiros');
        this.error = 'Erro ao carregar parceiros';
        this.loading = false;
      }
    });
  }

  // If interactive map fails, replace the container with an embedded iframe as fallback
  private showFallbackMap() {
    try {
      const mapEl = document.getElementById('gmap');
      if (!mapEl) return;
      const addr = encodeURIComponent(this.pharmacyAddress || this.defaultCenterAddress || 'Curitiba, PR');
      const iframe = `<iframe src="https://www.google.com/maps?q=${addr}&output=embed" width="100%" height="100%" style="border:0;border-radius:12px;" allowfullscreen="" loading="lazy" title="Mapa (fallback)"></iframe>`;
      mapEl.innerHTML = iframe;
    } catch (e) {
      console.warn('showFallbackMap failed', e);
    }
  }

  // wrapper with retries to improve robustness on flaky reloads
  private async initInteractiveMapWithRetries(apiKey: string, attempts = 3): Promise<void> {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        await this.initInteractiveMap(apiKey);
        return;
      } catch (e) {
        lastErr = e;
        const delay = 500 * Math.pow(2, i); // exponential backoff: 500,1000,2000
        await this.sleep(delay);
      }
    }
    throw lastErr;
  }

  private sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

  /**
   * Load Google Maps script dynamically and initialize map/markers.
   * - returns a promise that resolves when map is ready.
   */
  private async initInteractiveMap(apiKey: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // prevent double initialization
    if (this.mapInitialized) return;

    // ensure mapReadyPromise exists so callers can await readiness
    if (!this.mapReadyPromise) {
      this.mapReadyPromise = new Promise((resolve) => { this.mapReadyResolver = resolve; });
    }

    try {
      // load Google Maps script if necessary
      if (!(window as any).google) {
        await this.loadGoogleMapsScript(apiKey);
      }

      const google = (window as any).google;
      const mapEl = document.getElementById('gmap');
      if (!mapEl) throw new Error('Map container not found');

      const opts: any = {
        zoom: 15,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        styles: [...FP_MAP_STYLES],
      };

      // geocode pharmacy address (best effort)
      let centerLatLng: any = null;
      const fallbackCenter = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
      try {
        const geocoder = new google.maps.Geocoder();
        const results = await this.geocodeAddress(geocoder, this.pharmacyAddress).catch((err) => { console.warn('geocode error', err); return null; });
        if (results && results[0] && results[0].geometry && results[0].geometry.location) {
          const loc = results[0].geometry.location;
          this.pharmacyCoords = { lat: loc.lat(), lng: loc.lng() };
          centerLatLng = { lat: loc.lat(), lng: loc.lng() };
        }
      } catch (e) {
        console.warn('geocode construction failed', e);
      }

      if (!centerLatLng && this.allPartners && this.allPartners.length) {
        const p = this.allPartners[0];
        const lat = p.lat ?? p.latitude ?? p.latitud ?? null;
        const lng = p.lng ?? p.longitude ?? p.long ?? null;
        if (lat != null && lng != null) centerLatLng = { lat: Number(lat), lng: Number(lng) };
      }

      opts.center = centerLatLng ?? fallbackCenter;
      this.map = new google.maps.Map(mapEl, opts);

      // small resize nudges to avoid blank tiles
      setTimeout(() => { try { google.maps.event.trigger(this.map, 'resize'); } catch (e) {} }, 250);

      try {
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#c4d600', strokeWeight: 6, strokeOpacity: 0.95 } });
        this.directionsRenderer.setMap(this.map);
      } catch (e) {
        this.directionsService = null;
        this.directionsRenderer = null;
      }

      setTimeout(() => { try { google.maps.event.trigger(this.map, 'resize'); } catch (e) {} }, 600);

      try {
        this.refreshMarkers();
      } catch (e) {
        console.warn('refreshMarkers during init failed', e);
      }

      // mark ready and resolve waiters
      this.mapInitialized = true;
      if (this.mapReadyResolver) { try { this.mapReadyResolver(); } catch (e) {} this.mapReadyResolver = null; }

      // If there is a saved destination from a previous session, do NOT auto-draw the route
      // (auto-drawing has caused navigation/lock issues on some environments). Instead,
      // show a small "Restaurar rota" button over the map so the user can restore manually.
      try {
        const raw = localStorage.getItem('fp_last_dest');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.lat != null && parsed.lng != null) {
            try {
              const wrap = document.getElementById('gmap');
              if (wrap) {
                const btnHtml = `<button id="fp-restore-route" title="Restaurar última rota" style="position:absolute;z-index:99999;right:18px;bottom:18px;padding:10px 12px;border-radius:8px;border:0;background:#0f172a;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer">Traçar rota</button>`;
                // ensure container is positioned for absolute child
                if (wrap.style.position === '' || wrap.style.position === 'static') wrap.style.position = 'relative';
                wrap.insertAdjacentHTML('beforeend', btnHtml);
                const btn = document.getElementById('fp-restore-route');
                if (btn) {
                  btn.addEventListener('click', () => {
                    try { this.drawRoute({ lat: Number(parsed.lat), lng: Number(parsed.lng) }); } catch (e) { console.warn('manual restore drawRoute failed', e); }
                    try { btn.remove(); } catch (e) {}
                  });
                }
              }
            } catch (e) { console.warn('prepare restore button failed', e); }
          }
        }
      } catch (e) {}

    } catch (initErr) {
      console.error('initInteractiveMap unexpected error', initErr);
      try { this.showFallbackMap(); } catch (e) { console.warn('showFallbackMap failed during init error', e); }
      // ensure waiters are resolved
      try { if (this.mapReadyResolver) { try { this.mapReadyResolver(); } catch (e) {} this.mapReadyResolver = null; } } catch (e) {}
      this.mapInitialized = false;
    }

    // safe window handlers (outside main try)
    try {
      const google = (window as any).google;
      window.addEventListener('resize', () => { try { if (this.map && google && google.maps) google.maps.event.trigger(this.map, 'resize'); } catch (e) {} });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { try { if (this.map && google && google.maps) google.maps.event.trigger(this.map, 'resize'); } catch (e) {} } });
    } catch (e) {}
  }

  // returns a promise that resolves when the map becomes initialized
  private waitForMapReady(timeoutMs = 10000): Promise<void> {
    if (this.mapInitialized) return Promise.resolve();
    if (!this.mapReadyPromise) {
      this.mapReadyPromise = new Promise((resolve) => { this.mapReadyResolver = resolve; });
    }
    // create a timeout wrapper
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { reject(new Error('map ready timeout')); }, timeoutMs);
      this.mapReadyPromise!.then(() => { clearTimeout(t); resolve(); }).catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  private geocodeAddress(geocoder: any, address: string): Promise<any> {
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK') resolve(results);
        else reject(status);
      });
    });
  }

  private loadGoogleMapsScript(apiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google) return resolve();
      const existing = document.querySelector('script[data-gmaps]') as HTMLScriptElement;
      if (existing) {
        // If script exists but google isn't available yet, wait for it with a timeout
        const onLoad = () => {
          // poll for window.google availability (some CSPs may delay attach)
          const start = Date.now();
          const poll = () => {
            if ((window as any).google) return resolve();
            if (Date.now() - start > 10000) return reject(new Error('Google Maps did not initialize in time'));
            setTimeout(poll, 200);
          };
          poll();
        };
        existing.addEventListener('load', onLoad);
        existing.addEventListener('error', (e) => reject(e));
        // if already complete, trigger onLoad
        if ((existing as any).readyState === 'complete') onLoad();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', '1');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.onload = () => {
        // ensure google object is attached; poll briefly if needed
        const start = Date.now();
        const poll = () => {
          if ((window as any).google) return resolve();
          if (Date.now() - start > 10000) return reject(new Error('Google Maps did not initialize in time'));
          setTimeout(poll, 200);
        };
        poll();
      };
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  /**
   * Center the interactive map on the pharmacy address.
   * Uses the cached geocoded `pharmacyCoords` if available, otherwise attempts
   * to geocode the configured `pharmacyAddress`. Falls back to hardcoded coords.
   */
  async centerOnPharmacy(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !(window as any).google || !this.map) return;
    const google = (window as any).google;
    const fallback = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
    try {
      let coords = this.pharmacyCoords;
      if (!coords && this.pharmacyAddress) {
        try {
          const geocoder = new google.maps.Geocoder();
          const results = await this.geocodeAddress(geocoder, this.pharmacyAddress);
          if (results && results[0] && results[0].geometry && results[0].geometry.location) {
            const loc = results[0].geometry.location;
            coords = { lat: loc.lat(), lng: loc.lng() };
            this.pharmacyCoords = coords;
          }
        } catch (e) {
          // geocode failed; we'll fallback below
          console.warn('Geocode for pharmacy failed', e);
        }
      }

      const center = coords ?? fallback;
      try { this.map.setCenter(center); } catch (e) { console.warn('map.setCenter failed', e); }
      try { this.map.setZoom(Math.max(this.map.getZoom ? this.map.getZoom() : 15, 15)); } catch (e) {}
      this.nudgeMapForMobileChrome();
    } catch (e) {
      console.warn('centerOnPharmacy unexpected error', e);
    }
  }

  /**
   * Center the map on a partner and open its info window.
   * If a marker with a matching partner id exists, trigger its click handler.
   */
  async centerOnPartner(partner: any): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !(window as any).google || !this.map) return;
    try {
      await this.waitForMapReady(5000).catch(() => {});
      const google = (window as any).google;
      const lat = partner.latitude ?? partner.lat ?? partner._raw?.latitude ?? null;
      const lng = partner.longitude ?? partner.lng ?? partner._raw?.longitude ?? null;
      const partnerId = partner.anuncio_id ?? partner.id ?? partner._raw?.id ?? null;

      // try to find marker by attached partner id
      let marker: any = null;
      if (partnerId != null) {
        marker = this.markers.find(m => m && (m as any).__partnerId != null && String((m as any).__partnerId) === String(partnerId));
      }

      // fallback: match by coordinates (within tiny tolerance)
      if (!marker && lat != null && lng != null) {
        const latN = Number(lat);
        const lngN = Number(lng);
        const eps = 1e-6;
        marker = this.markers.find(m => {
          try {
            const pos = (m as any).getPosition && (m as any).getPosition();
            if (!pos) return false;
            const plat = pos.lat(); const plng = pos.lng();
            return Math.abs(plat - latN) < eps && Math.abs(plng - lngN) < eps;
          } catch (e) { return false; }
        });
      }

      // If marker found, pan to it and trigger click to open info window
      if (marker) {
        try { this.map.panTo(marker.getPosition()); } catch (e) { /* ignore */ }
        try { if (this.map.setZoom) this.map.setZoom(Math.max(this.map.getZoom ? this.map.getZoom() : 15, 15)); } catch (e) {}
        try { google.maps.event.trigger(marker, 'click'); } catch (e) { /* ignore */ }
        // full-screen mobile map: map is always in view; avoid scrolling the page
        if (!this.isMobileMapLayout) {
          try {
            const wrap = document.getElementById('gmap');
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (e) {}
        }
        return;
      }

      // final fallback: if we have coords, center the map on them
      if (lat != null && lng != null) {
        try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
        this.nudgeMapForMobileChrome();
      }
    } catch (e) {
      console.warn('centerOnPartner failed', e);
    }
  }

  /**
   * Attach a styled info window to the pharmacy marker.
   * Shows the configured pharmacy address and quick actions to get directions or open in Google Maps.
   */
  private attachPharmacyInfo(marker: any, coords: { lat: number; lng: number }, openImmediately = false) {
    if (!(window as any).google) return;
    const google = (window as any).google;

    const address = this.pharmacyAddress || this.defaultCenterAddress || '';
    const lat = coords?.lat ?? (coords as any)?.lat ?? 0;
    const lng = coords?.lng ?? (coords as any)?.lng ?? 0;
    const dest = encodeURIComponent(`${lat},${lng}`);

    const content = `
      <div style="max-width:320px;font-family:Inter,Arial,Helvetica,sans-serif;color:#0f172a;padding:12px;box-sizing:border-box;border-radius:10px;position:relative;overflow:visible">
        <!-- floating close button (visually overflows the card) -->
        <button id="map-close-btn" aria-label="Fechar" style="position:absolute;top:-20px;right:-20px;width:40px;height:40px;border-radius:50%;background:#111827;color:#fff;border:0;box-shadow:0 10px 28px rgba(0,0,0,.32);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0">✕</button>
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
          <img src=\"${this.pinLojaUrl}\" style=\"width:36px;height:44px;object-fit:contain;border-radius:4px\"/>
          <div style="flex:1">
            <div style=\"font-family:'Pacifico',cursive,'Montserrat',Arial,sans-serif;font-weight:700;font-size:16px;color:#0f172a\">${MARCA_NOME}</div>
            <div style=\"font-size:13px;color:#374151;margin-top:4px;line-height:1.2\">${address}</div>
          </div>
        </div>
        <div style=\"display:flex;gap:8px;margin-top:10px\">
          <button id=\"map-route-btn\" style=\"flex:1;border:0;background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer\">Traçar rota</button>
          <button id=\"map-open-btn\" style=\"flex:1;border:1px solid #e5e7eb;background:#fff;color:#0f172a;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer\">Abrir no Maps</button>
        </div>
      </div>
    `;

    const iw = new google.maps.InfoWindow({ content, maxWidth: 360 });

    marker.addListener('click', () => {
      try { if (this.currentInfoWindow) this.currentInfoWindow.close(); } catch {}
      try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
      this.nudgeMapForMobileChrome();
      iw.open(this.map, marker);
      this.currentInfoWindow = iw;
      try {
        google.maps.event.addListenerOnce(iw, 'domready', () => {
          try {
            if (!document.querySelector('style[data-gm-style-iw]')) {
              const st = document.createElement('style');
              st.setAttribute('data-gm-style-iw', '1');
              st.innerHTML = `
                /* allow content to overflow so floating close button is visible */
                .gm-style .gm-style-iw { overflow: visible !important; }
                .gm-style .gm-style-iw > div { overflow: visible !important; }
                /* hide Google Maps built-in infoWindow close button (duplicate) */
                .gm-style .gm-style-iw-chr > button.gm-ui-hover-effect { display: none !important; }
                .gm-style .gm-ui-hover-effect[aria-label='Fechar'] { display: none !important; }
              `;
              document.head.appendChild(st);
            }

            const routeBtn = document.getElementById('map-route-btn');
            const openBtn = document.getElementById('map-open-btn');
            const closeBtn = document.getElementById('map-close-btn');
            if (routeBtn) {
              routeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const destObj = { lat: Number(lat), lng: Number(lng) };
                try { localStorage.setItem('fp_last_dest', JSON.stringify(destObj)); } catch (e) {}
                this.drawRoute(destObj);
                try { iw.close(); } catch {}
              });
            }
            if (openBtn) {
              openBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                await this.openMapsWithRoute({ lat: Number(lat), lng: Number(lng) });
              });
            }
            if (closeBtn) {
              try { (closeBtn as HTMLElement).style.position = 'absolute'; (closeBtn as HTMLElement).style.top = '-20px'; (closeBtn as HTMLElement).style.right = '-20px'; (closeBtn as HTMLElement).style.zIndex = '99999'; } catch (e) {}
              closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { iw.close(); } catch {} });
            }
          } catch (e) { console.warn('infoWindow domready handler failed', e); }
        });
      } catch (e) {}
    });

    if (openImmediately) {
      try { if (this.currentInfoWindow) this.currentInfoWindow.close(); } catch {}
      iw.open(this.map, marker);
      this.currentInfoWindow = iw;
    }
  }

  private async drawRoute(dest: { lat: number; lng: number }) {
    if (!(window as any).google || !this.map) return;
    const google = (window as any).google;
    // Ensure directions services are available
    if (!this.directionsService || !this.directionsRenderer) {
      try {
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: false });
        this.directionsRenderer.setMap(this.map);
      } catch (e) {
        console.warn('DirectionsService not available', e);
        return;
      }
    }

    // Try to get user's current position as origin
    let origin: any = null;
    try {
      origin = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!navigator.geolocation) return reject('no-geolocation');
        navigator.geolocation.getCurrentPosition((pos) => {
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }, (err) => reject(err), { timeout: 5000 });
      });
    } catch (e) {
      // fallback to map center
      try { const c = this.map.getCenter(); origin = { lat: c.lat(), lng: c.lng() }; } catch { origin = null; }
    }

    if (!origin) {
      console.warn('No origin available for routing');
      return;
    }

    const request = {
      origin,
      destination: { lat: Number(dest.lat), lng: Number(dest.lng) },
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date() }
    };

    try {
      this.directionsService.route(request, (result: any, status: any) => {
        if (status === 'OK' && result) {
          try { this.directionsRenderer.setDirections(result); } catch (e) { console.warn('setDirections failed', e); }
          try {
            // fit map to route bounds
            const route = result.routes && result.routes[0];
            if (route && route.bounds) {
              if (this.isMobileMapLayout) {
                this.map.fitBounds(route.bounds, { top: 48, right: 20, bottom: 100, left: 20 });
              } else {
                this.map.fitBounds(route.bounds, 48);
              }
            }
          } catch (e) {}

          // create/update a single origin marker (user) while keeping pharmacy marker intact
          try {
            if (this.originMarker) {
              try { this.originMarker.setMap(null); } catch (e) {}
              this.originMarker = null;
            }
            const google = (window as any).google;
            const originIcon = {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#c4d600',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            };
            this.originMarker = new google.maps.Marker({ position: origin, map: this.map, title: 'Você', icon: originIcon, zIndex: 9999 });
          } catch (e) {
            console.warn('failed to create origin marker', e);
          }

          // when a route is drawn, show a 'Limpar rota' button overlay so the user can clear it
          try { this.addClearRouteButton(); } catch (e) { /* ignore */ }

        } else {
          console.warn('Directions request failed:', status);
        }
      });
    } catch (e) { console.warn('route request failed', e); }
  }

  /**
   * Add a 'Limpar rota' button overlayed on the map. Idempotent: does nothing if button exists.
   */
  private addClearRouteButton() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const wrap = document.getElementById('gmap');
      if (!wrap) return;
      if (document.getElementById('fp-clear-route')) return; // already present
      const btnHtml = `<button id="fp-clear-route" title="Limpar rota" style="position:absolute;z-index:99999;left:18px;bottom:18px;padding:10px 12px;border-radius:8px;border:0;background:#ffffff;color:#0f172a;box-shadow:0 8px 20px rgba(0,0,0,.12);cursor:pointer">Limpar rota</button>`;
      if (wrap.style.position === '' || wrap.style.position === 'static') wrap.style.position = 'relative';
      wrap.insertAdjacentHTML('beforeend', btnHtml);
      const btn = document.getElementById('fp-clear-route');
      if (btn) btn.addEventListener('click', (ev) => { ev.preventDefault(); try { this.clearRoute(); } catch (e) {} });
    } catch (e) { console.warn('addClearRouteButton failed', e); }
  }

  /** Remove the clear-route button if present. */
  private removeClearRouteButton() {
    try { const b = document.getElementById('fp-clear-route'); if (b) b.remove(); } catch (e) {}
  }

  /**
   * Clear any drawn route and remove origin marker and stored last-destination.
   */
  public clearRoute() {
    try {
      if (this.directionsRenderer) {
        try { (this.directionsRenderer as any).set('directions', null); } catch (e) { /* fallback attempt */ try { this.directionsRenderer.setDirections({ routes: [] } as any); } catch (er) {} }
      }
    } catch (e) { console.warn('clearRoute: clearing directions failed', e); }
    try { if (this.originMarker) { try { this.originMarker.setMap(null); } catch (e) {} this.originMarker = null; } } catch (e) {}
    try { localStorage.removeItem('fp_last_dest'); } catch (e) {}
    try { this.removeClearRouteButton(); } catch (e) {}
  }

  private async openMapsWithRoute(dest: { lat: number; lng: number }) {
    const destStr = `${dest.lat},${dest.lng}`;
    // Try to get user's position
    try {
      const pos = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!navigator.geolocation) return reject('no-geolocation');
        navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), (err) => reject(err), { timeout: 5000 });
      });
      const originStr = `${pos.lat},${pos.lng}`;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}`;
      window.open(url, '_blank');
      return;
    } catch (e) {
      // if geolocation failed, open directions with destination only
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}`;
      window.open(url, '_blank');
    }
  }
}
