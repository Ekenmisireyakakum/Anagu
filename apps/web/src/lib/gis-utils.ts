export function polygonToWKT(latlngs: Array<{ lat: number; lng: number }>): string {
  const coords = latlngs.map(p => `${p.lng} ${p.lat}`).join(', ');
  const first = latlngs[0];
  return `POLYGON((${coords}, ${first.lng} ${first.lat}))`;
}

export function wktToGeoJSON(wkt: string): GeoJSON.Polygon {
  const match = wkt.match(/POLYGON\s*\(\(([^)]+)\)\)/);
  if (!match) throw new Error('Invalid WKT polygon');
  const coords = match[1].split(',').map(pair => {
    const [lon, lat] = pair.trim().split(/\s+/).map(Number);
    return [lon, lat] as [number, number];
  });
  return { type: 'Polygon', coordinates: [coords] };
}

export function formatArea(sqm: number): string {
  if (sqm >= 10000) {
    return `${(sqm / 10000).toFixed(2)} ha`;
  }
  return `${sqm.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}
