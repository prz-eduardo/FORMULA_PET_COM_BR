import { Component, OnInit, Inject, PLATFORM_ID, NgZone } from '@angular/core';
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
export class MapaComponent implements OnInit {
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
  // default address used to center the map (same as previous iframe)
  private defaultCenterAddress = 'Rua Treze de Maio, 506, Conjunto 04, São Francisco, Curitiba, PR, CEP 80510-030';
  // exact pharmacy address requested by the user — we will geocode this and place the fixed pin here
  private pharmacyAddress = 'Rua Treze de Maio, 506 – Sala 04, Curitiba, PR';
  // resolved pharmacy coordinates (populated after a successful geocode); used by refreshMarkers()
  private pharmacyCoords: { lat: number; lng: number } | null = null;

  constructor(private api: ApiService, private toast: ToastService, @Inject(PLATFORM_ID) private platformId: Object) {}

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
      // load available professional types first (to build tabs), then partners
      this.loadProfessionalTypes();
      this.loadPartners();
      // load anunciantes (public advertisers) filtered by active tab
      this.loadAnunciantes(this.active);
    } else {
      this.loading = false;
    }
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
    } catch (e) {
      const pharmacyMarker = new (window as any).google.maps.Marker({ position: coordsToUse, map: this.map, title: 'Farmácia / Loja' });
      this.markers.push(pharmacyMarker);
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
          this.initInteractiveMap(this.mapsApiKey).catch(err => {
            console.error('initInteractiveMap failed', err);
            this.toast.error('Erro ao inicializar o mapa');
          });
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

  /**
   * Load Google Maps script dynamically and initialize map/markers.
   * - returns a promise that resolves when map is ready.
   */
  private async initInteractiveMap(apiKey: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // avoid loading script more than once
    if (!(window as any).google) {
      await this.loadGoogleMapsScript(apiKey);
    }

    // create map centered at default address (we geocode it) or at first partner coords
    const google = (window as any).google;
    const mapEl = document.getElementById('gmap');
    if (!mapEl) throw new Error('Map container not found');

  // default map options — keep the map clean by disabling the default Google UI
  // and hide Google's Points of Interest (POI) / business pins so only our custom markers display
  const opts: any = {
    zoom: 15,
    disableDefaultUI: true,
    // prevent default POI icons from being clickable
    clickableIcons: false,
    // allow normal single-finger gestures on mobile (avoid the "use two fingers" overlay)
    gestureHandling: 'greedy',
    // styles to hide POI icons and labels (businesses, places)
    styles: [
      { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
      { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'off' }] }
    ]
  };

    // Prefer to center the map on the pharmacy address (user requested).
    // Attempt to geocode the pharmacy address first; if that fails, fall back to
    // the first partner's coords (if any), otherwise use a Curitiba fallback.
    let centerLatLng: any = null;
    const fallbackCenter = { lat: -25.4284, lng: -49.2733 }; // Curitiba center fallback
    try {
      const geocoder = new google.maps.Geocoder();
      try {
        const results = await this.geocodeAddress(geocoder, this.pharmacyAddress);
        if (results && results[0] && results[0].geometry && results[0].geometry.location) {
          const loc = results[0].geometry.location;
          this.pharmacyCoords = { lat: loc.lat(), lng: loc.lng() };
          centerLatLng = { lat: loc.lat(), lng: loc.lng() };
        }
      } catch (gErr) {
        // ignore geocode failure here; we'll try partners next
        console.warn('Geocode failed for pharmacy address during init', gErr);
      }
    } catch (e) {
      // if geocoder construction or call fails, continue to partner/fallback
    }

    // if pharmacy geocode didn't produce coords, try to use first partner
    if (!centerLatLng && this.partners && this.partners.length) {
      const p = this.partners[0];
      const lat = p.lat ?? p.latitude ?? p.latitud ?? null;
      const lng = p.lng ?? p.longitude ?? p.long ?? null;
      if (lat != null && lng != null) centerLatLng = { lat: Number(lat), lng: Number(lng) };
    }

    // finalize opts.center and create the map
    opts.center = centerLatLng ?? fallbackCenter;
    this.map = new google.maps.Map(mapEl, opts);

    // Place the pharmacy marker using the resolved pharmacy coordinates (if we geocoded above)
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
    } catch (e) {
      try {
        const marker = new google.maps.Marker({ position: coordsToUse, map: this.map, title: 'Farmácia / Loja' });
        this.markers.push(marker);
      } catch (err) {
        console.warn('Failed to add pharmacy marker', err);
      }
    }

    // add markers for partners if they have lat/lng using partner paw icon
    for (const p of this.partners) {
      const lat = p.lat ?? p.latitude ?? p.latitud ?? null;
      const lng = p.lng ?? p.longitude ?? p.long ?? null;
      if (lat != null && lng != null) {
        try {
          const pataUrl = '/icones/pin-pata.svg';
          const iconPata = {
            url: pataUrl,
            scaledSize: new google.maps.Size(32, 36),
            anchor: new google.maps.Point(16, 36)
          };
          const m = new google.maps.Marker({ position: { lat: Number(lat), lng: Number(lng) }, map: this.map, title: p.nome || p.name || 'Parceiro', icon: iconPata });
          this.markers.push(m);
        } catch (e) {
          const m = new google.maps.Marker({ position: { lat: Number(lat), lng: Number(lng) }, map: this.map, title: p.nome || p.name || 'Parceiro' });
          this.markers.push(m);
        }
      }
    }
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
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', '1');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.onload = () => resolve();
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
}
