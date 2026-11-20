export function polygonToWKT(latlngs: Array<{ lat: number; lng: number }>): string {
  const coords = latlngs.map((p) => `${p.lng} ${p.lat}`).join(', ');
  const first = latlngs[0];
  return `POLYGON((${coords}, ${first.lng} ${first.lat}))`;
}

export function wktToGeoJSON(wkt: string): GeoJSON.Polygon {
  const match = wkt.match(/POLYGON\s*\(\(([^)]+)\)\)/i);
  if (!match) throw new Error('Invalid WKT polygon');
  const coords = match[1].split(',').map((pair) => {
    const [lon, lat] = pair.trim().split(/\s+/).map(Number);
    return [lon, lat] as [number, number];
  });
  return { type: 'Polygon', coordinates: [coords] };
}

export function wktToLatLngs(wkt: string): Array<[number, number]> {
  try {
    const match = wkt.trim().match(/POLYGON\s*\(\(\s*([^)]+)\s*\)\)/i);
    if (!match) return [];
    const pairs = match[1]
      .split(',')
      .map((pair) => pair.trim().split(/\s+/).map(Number))
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (pairs.length < 3) return [];
    return pairs.map(([lon, lat]) => [lat, lon] as [number, number]);
  } catch {
    return [];
  }
}

export function parseJsonRing(jsonText: string): Array<[number, number]> | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed) || parsed.length < 4) return null;
    const ring: Array<[number, number]> = [];
    for (const pt of parsed) {
      if (!Array.isArray(pt) || pt.length < 2) return null;
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      ring.push([lng, lat]);
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }
    return ring;
  } catch {
    return null;
  }
}

export function ringToWkt(ring: Array<[number, number]>): string {
  const closed =
    ring.length >= 3 &&
    (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]]
      : ring;
  return `POLYGON((${closed.map(([lng, lat]) => `${lng} ${lat}`).join(', ')}))`;
}

export function wktToJsonRing(wkt: string): string {
  const latLngs = wktToLatLngs(wkt);
  if (latLngs.length < 3) return '[]';
  const ring = latLngs.map(([lat, lng]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  return JSON.stringify(ring);
}

/**
 * Computes approximate geodesic polygon area in square meters using
 * spherical excess over WGS 84 mean radius (6,378,137 m).
 */
export function computeGeodesicAreaSqm(ring: Array<[number, number]>): number {
  if (ring.length < 3) return 0;
  const closed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];
  const R = 6378137;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [lng1, lat1] = closed[i];
    const [lng2, lat2] = closed[i + 1];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

export function wktCentroid(wkt: string): { lat: number; lon: number } | null {
  const latLngs = wktToLatLngs(wkt);
  if (latLngs.length === 0) return null;
  const last = latLngs[latLngs.length - 1];
  const first = latLngs[0];
  const open =
    latLngs.length > 1 && last[0] === first[0] && last[1] === first[1]
      ? latLngs.slice(0, -1)
      : latLngs;
  const lat = open.reduce((sum, pt) => sum + pt[0], 0) / open.length;
  const lon = open.reduce((sum, pt) => sum + pt[1], 0) / open.length;
  return { lat, lon };
}

export interface PlotSizePreset {
  id: string;
  label: string;
  widthMeters: number;
  heightMeters: number;
}

export const PLOT_SIZE_PRESETS: PlotSizePreset[] = [
  { id: 'single', label: '1 Plot (~650 m²)', widthMeters: 36, heightMeters: 18 },
  { id: 'standard', label: 'Standard (~1,620 m²)', widthMeters: 45, heightMeters: 36 },
  { id: 'double', label: '2 Plots (~3,240 m²)', widthMeters: 90, heightMeters: 36 },
  { id: 'acre', label: '1 Acre (~4,047 m²)', widthMeters: 64, heightMeters: 63.2 },
  { id: 'hectare', label: '1 Hectare (10,000 m²)', widthMeters: 100, heightMeters: 100 },
];

export function parseLatLngText(input: string): { lat: number; lon: number } | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function buildPlotWktFromCenter(
  lat: number,
  lon: number,
  widthMeters = 45,
  heightMeters = 36,
): string {
  const dLat = heightMeters / 2 / 110574;
  const dLon = widthMeters / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  const minLon = Number((lon - dLon).toFixed(6));
  const maxLon = Number((lon + dLon).toFixed(6));
  const minLat = Number((lat - dLat).toFixed(6));
  const maxLat = Number((lat + dLat).toFixed(6));
  return `POLYGON((${minLon} ${maxLat}, ${maxLon} ${maxLat}, ${maxLon} ${minLat}, ${minLon} ${minLat}, ${minLon} ${maxLat}))`;
}

export function getOpenStreetMapUrl(lat: number, lon: number, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=${zoom}/${lat.toFixed(6)}/${lon.toFixed(6)}`;
}

export function formatArea(sqm: number): string {
  if (sqm >= 10000) {
    return `${(sqm / 10000).toFixed(2)} ha (${sqm.toLocaleString('en-US', { maximumFractionDigits: 0 })} m²)`;
  }
  const acres = sqm / 4046.8564;
  return `${sqm.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} m² (${acres.toFixed(2)} acres)`;
}
