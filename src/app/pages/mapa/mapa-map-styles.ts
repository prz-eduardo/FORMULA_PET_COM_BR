/**
 * Estilos do Google Maps alinhados à identidade (menos ruído, base mais neutra, harmoniza com roxo/amarelo da app).
 * Tipo local — o projecto não inclui `@types/google.maps` no build.
 * @see https://developers.google.com/maps/documentation/javascript/styling
 */
export type FpMapStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number | boolean | undefined>>;
};

export const FP_MAP_STYLES: FpMapStyleRule[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f0f1f4' }, { weight: 0.6 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }, { weight: 2 }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#f5f6f8' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#e8e9ed' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0e1e6' }] },
  { featureType: 'water', stylers: [{ color: '#d4e4f0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#eceef2' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#5161ce' }, { weight: 0.4 }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'simplified' }] },
];
