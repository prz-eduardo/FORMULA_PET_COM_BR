import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, ApplicationRef } from '@angular/core';
import { filter, take } from 'rxjs/operators';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { FooterComponent } from '../../footer/footer.component';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, NavmenuComponent, FooterComponent],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent implements OnInit, OnDestroy {
  tabs = [
    { id: 'veterinario', label: 'Veterinário' },
    { id: 'dog-walker', label: 'Dog Walker' },
    { id: 'petsitter', label: 'Pet Sitter' },
    { id: 'creche', label: 'Creche Canina' },
    { id: 'banho-tosa', label: 'Banho & Tosa' },
    { id: 'outros', label: 'Outros' }
  ];
  active = this.tabs[0].id;

  // data loaded from /maps
  partners: Array<any> = [];
  mapsApiKey: string | null = null;
  loading = false;
  error: string | null = null;
  // google maps runtime objects
  private map: any = null;
  private markers: any[] = [];
  private infoWindow: any = null;
  private directionsService: any = null;
  private directionsRenderer: any = null;
  private originMarker: any = null;
  private mapInitialized = false;
  private mapReadyPromise: Promise<void> | null = null;
  private mapReadyResolver: (() => void) | null = null;
  // default address used to center the map (same as previous iframe)
  private defaultCenterAddress = 'Rua Treze de Maio, 506, Conjunto 04, São Francisco, Curitiba, PR, CEP 80510-030';
  // exact pharmacy address requested by the user — we will geocode this and place the fixed pin here
  private pharmacyAddress = 'Rua Treze de Maio, 506 – Sala 04, Curitiba, PR';
  // resolved pharmacy coordinates (populated after a successful geocode); used by refreshMarkers()
  private pharmacyCoords: { lat: number; lng: number } | null = null;

  constructor(private api: ApiService, private toast: ToastService, @Inject(PLATFORM_ID) private platformId: Object, private appRef: ApplicationRef) {}

  // keep references so we can remove listeners on destroy
  private __errHandler = (ev: any) => { console.error('map uncaught error', ev); try { this.showFallbackMap(); } catch (e) {}; };
  private __unhandledRejection = (ev: any) => { console.error('map unhandledrejection', ev); try { this.showFallbackMap(); } catch (e) {}; };

  // filters per service (each tab has its own set)
  filtersByTab: { [key: string]: Array<{ id: string; label: string; on: boolean }> } = {
    veterinario: [
      { id: '24h', label: '24 horas', on: false },
      { id: 'dom', label: 'Atende Domingo', on: false },
      { id: 'vacina', label: 'Aceita Vacina', on: false }
    ],
    'dog-walker': [
      { id: 'recorrente', label: 'Passeio recorrente', on: false },
      { id: 'grupos', label: 'Aceita grupos', on: false }
    ],
    petsitter: [
      { id: 'overnight', label: 'Cuidados noturnos', on: false },
      { id: 'vacina', label: 'Aceita Vacina', on: false }
    ],
    creche: [
      { id: 'meio-per', label: 'Meio período', on: false },
      { id: 'dia-inteiro', label: 'Dia inteiro', on: false }
    ],
    'banho-tosa': [
      { id: 'mobile', label: 'Atendimento em domicílio', on: false },
      { id: 'apoio', label: 'Secagem incluída', on: false }
    ],
    outros: [
      { id: 'acess', label: 'Acessórios', on: false },
      { id: 'remed', label: 'Serviços Remotos', on: false }
    ]
  };

  
  toggleFilter(f: any){
    // toggle the filter state in-place — since we bind objects from filtersByTab,
    // this will update the correct service-specific filter array.
    f.on = !f.on;
  }
  getActiveLabel(){
    const t = this.tabs.find(x => x.id === this.active);
    return t ? t.label : '';
  }

  getFiltersForActive(){
    return this.filtersByTab[this.active] || [];
  }

  ngOnInit(): void {
    // follow the same pattern as other pages: only call API from the browser
    // to avoid SSR network errors.
    if (isPlatformBrowser(this.platformId)) {
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
          this.loadAnunciantes(this.active);
        });
        // fallback timer: if stability doesn't occur within 1500ms, proceed anyway
        const stableTimer = setTimeout(() => {
          try { stableSub.unsubscribe(); } catch (e) {}
          this.loadPartners();
          this.loadAnunciantes(this.active);
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
  }

  // when the user switches tabs we should refresh the anunciantes list for that tipo
  select(tabId: string){
    this.active = tabId;
    if (isPlatformBrowser(this.platformId)) {
      this.loadAnunciantes(tabId);
    }
  }

  private loadAnunciantes(tipo?: string){
    // lightweight loading state for the anunciantes list
    this.api.getAnunciantes(tipo).subscribe({
      next: (res) => {
        // res expected to be array of anunciantes
        this.partners = Array.isArray(res) ? res : [];
        // refresh map markers if map already initialized
        try {
          this.refreshMarkers();
        } catch (e) {
          // ignore map refresh errors; map may not be ready yet
        }
      },
      error: (err) => {
        console.error('getAnunciantes failed', err);
        this.toast.error('Erro ao carregar anunciantes');
      }
    });
  }

  private refreshMarkers(){
    if (!this.map || !(window as any).google) return;
    // remove existing markers
    for (const m of this.markers) { try { m.setMap(null); } catch(e){} }
    this.markers = [];

    // add pharmacy marker at the resolved pharmacy coordinates (geocoded from pharmacyAddress)
    // fallback to the previous hardcoded coords if geocoding hasn't completed or failed
    const fallbackCoords = { lat: -25.4270, lng: -49.2706 };
    const coordsToUse = this.pharmacyCoords ?? fallbackCoords;
    try {
      const google = (window as any).google;
      const pinFpUrl = '/icones/pin-fp.png';
      const iconPharm = {
        url: pinFpUrl,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44)
      };
      const pharmacyMarker = new google.maps.Marker({ position: coordsToUse, map: this.map, icon: iconPharm, title: 'Farmácia / Loja' });
      this.markers.push(pharmacyMarker);
      // attach info window on click
      try { this.attachPharmacyInfo(pharmacyMarker, coordsToUse); } catch (e) { console.warn('attachPharmacyInfo failed', e); }
    } catch (e) {
      const pharmacyMarker = new (window as any).google.maps.Marker({ position: coordsToUse, map: this.map, title: 'Farmácia / Loja' });
      this.markers.push(pharmacyMarker);
      try { this.attachPharmacyInfo(pharmacyMarker, coordsToUse); } catch (err) { console.warn('attachPharmacyInfo fallback failed', err); }
    }

    // add markers for partners/anunciantes
    for (const p of this.partners) {
      const lat = p.latitude ?? p.lat ?? p.latitud ?? null;
      const lng = p.longitude ?? p.lng ?? p.long ?? null;
      if (lat != null && lng != null) {
        const marker = new (window as any).google.maps.Marker({ position: { lat: Number(lat), lng: Number(lng) }, map: this.map, title: p.nome || p.name || p.id?.toString?.() || 'Anunciante' });
        this.markers.push(marker);
      }
    }
  }

  private loadProfessionalTypes(){
    // call the API service to fetch types; if it fails we keep defaults
    this.api.getProfessionalTypes().subscribe({
      next: (res) => {
        const types = res.types || [];
        if (types.length) {
          // map to {id,label} shape; support multiple server keys using a safe any-cast
          this.tabs = types.map((t) => {
            const anyT: any = t;
            const id = String(anyT.id ?? anyT.key ?? anyT.slug ?? anyT.nome ?? anyT.label ?? anyT.name);
            const label = String(anyT.nome ?? anyT.label ?? anyT.name ?? anyT.id);
            return { id, label };
          });
          // ensure active exists on the new tabs
          if (!this.tabs.find(x => x.id === this.active)) {
            this.active = this.tabs[0]?.id ?? this.active;
          }
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
        this.partners = res.partners || [];
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
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'off' }] }
        ]
      };

      // geocode pharmacy address (best effort)
      let centerLatLng: any = null;
      const fallbackCenter = { lat: -25.4284, lng: -49.2733 };
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

      if (!centerLatLng && this.partners && this.partners.length) {
        const p = this.partners[0];
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

      // add pharmacy marker
      const fallbackPharmacyCoords = { lat: -25.4270, lng: -49.2706 };
      const coordsToUse = this.pharmacyCoords ?? fallbackPharmacyCoords;
      try {
        const pinFpUrl = '/icones/pin-fp.png';
        const icon = {
          url: pinFpUrl,
          scaledSize: new google.maps.Size(36, 44),
          anchor: new google.maps.Point(18, 44)
        };
        const marker = new google.maps.Marker({ position: coordsToUse, map: this.map, icon, title: 'Farmácia / Loja' });
        this.markers.push(marker);
        try { this.attachPharmacyInfo(marker, coordsToUse); } catch (e) { console.warn('attachPharmacyInfo init failed', e); }
      } catch (e) {
        try {
          const marker = new google.maps.Marker({ position: coordsToUse, map: this.map, title: 'Farmácia / Loja' });
          this.markers.push(marker);
          try { this.attachPharmacyInfo(marker, coordsToUse); } catch (err) { console.warn('attachPharmacyInfo init fallback failed', err); }
        } catch (err) {
          console.warn('Failed to add pharmacy marker', err);
        }
      }

      // add partner markers
      for (const p of this.partners) {
        const lat = p.lat ?? p.latitude ?? p.latitud ?? null;
        const lng = p.lng ?? p.longitude ?? p.long ?? null;
        if (lat != null && lng != null) {
          try {
            const pataUrl = '/icones/pin-pata.svg';
            const iconPata = { url: pataUrl, scaledSize: new google.maps.Size(32, 36), anchor: new google.maps.Point(16, 36) };
            const m = new google.maps.Marker({ position: { lat: Number(lat), lng: Number(lng) }, map: this.map, title: p.nome || p.name || 'Parceiro', icon: iconPata });
            this.markers.push(m);
          } catch (e) {
            const m = new google.maps.Marker({ position: { lat: Number(lat), lng: Number(lng) }, map: this.map, title: p.nome || p.name || 'Parceiro' });
            this.markers.push(m);
          }
        }
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
                const btnHtml = `<button id="fp-restore-route" title="Restaurar última rota" style="position:absolute;z-index:99999;right:18px;bottom:18px;padding:10px 12px;border-radius:8px;border:0;background:#0f172a;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer">Restaurar rota</button>`;
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
    const fallback = { lat: -25.4270, lng: -49.2706 };
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
    } catch (e) {
      console.warn('centerOnPharmacy unexpected error', e);
    }
  }

  /**
   * Attach a styled info window to the pharmacy marker.
   * Shows the configured pharmacy address and quick actions to get directions or open in Google Maps.
   */
  private attachPharmacyInfo(marker: any, coords: { lat: number; lng: number }) {
    if (!(window as any).google) return;
    const google = (window as any).google;
    // close previous info window if open
    try { if (this.infoWindow) this.infoWindow.close(); } catch {}

    const address = this.pharmacyAddress || this.defaultCenterAddress || '';
    const lat = coords?.lat ?? (coords as any)?.lat ?? 0;
    const lng = coords?.lng ?? (coords as any)?.lng ?? 0;
    const dest = encodeURIComponent(`${lat},${lng}`);
    const mapsDir = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    const mapsPlace = `https://www.google.com/maps/search/?api=1&query=${dest}`;

    const content = `
      <div style="max-width:320px;font-family:Inter,Arial,Helvetica,sans-serif;color:#0f172a;padding:12px;box-sizing:border-box;border-radius:10px;position:relative;overflow:visible">
        <!-- floating close button (visually overflows the card) -->
        <button id="map-close-btn" aria-label="Fechar" style="position:absolute;top:-20px;right:-20px;width:40px;height:40px;border-radius:50%;background:#111827;color:#fff;border:0;box-shadow:0 10px 28px rgba(0,0,0,.32);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0">✕</button>
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
          <img src=\"/icones/pin-fp.png\" style=\"width:36px;height:44px;object-fit:contain;border-radius:4px\"/>
          <div style="flex:1">
            <div style="font-family:'Pacifico',cursive,'Montserrat',Arial,sans-serif;font-weight:700;font-size:16px;color:#0f172a">Formula Pet</div>
            <div style="font-size:13px;color:#374151;margin-top:4px;line-height:1.2">${address}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button id="map-route-btn" style="flex:1;border:0;background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer">Traçar rota</button>
          <button id="map-open-btn" style="flex:1;border:1px solid #e5e7eb;background:#fff;color:#0f172a;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer">Abrir no Maps</button>
        </div>
      </div>
    `;

    this.infoWindow = new google.maps.InfoWindow({ content, maxWidth: 360 });

    // open on marker click
    marker.addListener('click', () => {
      try { if (this.infoWindow) this.infoWindow.close(); } catch {}
      // ensure the window is visible (pan if needed)
      try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
      this.infoWindow.open(this.map, marker);
      // attach DOM listeners once the InfoWindow is rendered
      try {
        google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
          try {
            // ensure InfoWindow outer container allows visible overflow so the button can float outside
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
            } catch (e) {}

            const routeBtn = document.getElementById('map-route-btn');
            const openBtn = document.getElementById('map-open-btn');
            if (routeBtn) {
              routeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const destObj = { lat: Number(lat), lng: Number(lng) };
                // persist last destination so we can restore after reload
                try { localStorage.setItem('fp_last_dest', JSON.stringify(destObj)); } catch (e) {}
                this.drawRoute(destObj);
                try { this.infoWindow.close(); } catch {}
              });
            }
            if (openBtn) {
              openBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                await this.openMapsWithRoute({ lat: Number(lat), lng: Number(lng) });
              });
            }
            // close button that visually overflows the card
            const closeBtn = document.getElementById('map-close-btn');
            if (closeBtn) {
              // ensure close button visually overflows (set again after domready)
              try {
                (closeBtn as HTMLElement).style.position = 'absolute';
                (closeBtn as HTMLElement).style.top = '-20px';
                (closeBtn as HTMLElement).style.right = '-20px';
                (closeBtn as HTMLElement).style.zIndex = '99999';
              } catch (e) {}
              closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { this.infoWindow.close(); } catch {} });
            }
          } catch (e) { console.warn('infoWindow domready handler failed', e); }
        });
      } catch (e) {
        // ignore attach errors
      }
    });
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
            if (route && route.bounds) this.map.fitBounds(route.bounds);
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

        } else {
          console.warn('Directions request failed:', status);
        }
      });
    } catch (e) { console.warn('route request failed', e); }
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
