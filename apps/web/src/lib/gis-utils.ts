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

export function buildPlotWktFromCenter(
  lat: number,
  lon: number,
  widthMeters = 45,
  heightMeters = 36,
): string {
  const dLat = (heightMeters / 2 / 110574);
  const dLon = (widthMeters / 2 / (111320 * Math.cos((lat * Math.PI) / 180)));
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
    return `${(sqm / 10000).toFixed(2)} ha`;
  }
  return `${sqm.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}
