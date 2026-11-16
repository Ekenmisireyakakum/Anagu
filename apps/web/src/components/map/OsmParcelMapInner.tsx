'use client';

import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  buildPlotWktFromCenter,
  getOpenStreetMapUrl,
  wktCentroid,
  wktToLatLngs,
} from '../../lib/gis-utils';

L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ExistingParcelFeature {
  id: string;
  parcelNumber: string;
  geometry: GeoJSON.Polygon;
  status: string;
  address: string | null;
}

export interface OsmParcelMapProps {
  wkt: string;
  label?: string;
  address?: string;
  heightClassName?: string;
  interactive?: boolean;
  showExistingParcels?: boolean;
  onSelectWkt?: (newWkt: string, discoveredAddress?: string) => void;
}

const LAGOS_DISTRICTS = [
  { label: 'Victoria Island', lat: 6.4285, lon: 3.4219 },
  { label: 'Ikoyi', lat: 6.4535, lon: 3.4342 },
  { label: 'Lekki Phase 1', lat: 6.4455, lon: 3.4717 },
  { label: 'Ikeja', lat: 6.5925, lon: 3.3417 },
  { label: 'Yaba', lat: 6.5105, lon: 3.3767 },
];

function MapViewportController({
  positions,
  flyTarget,
}: {
  positions: Array<[number, number]>;
  flyTarget: { lat: number; lon: number; key: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length >= 3) {
      const bounds = L.latLngBounds(positions);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17, animate: true });
      }
    }
  }, [map, positions]);

  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lon], 16, { duration: 0.6 });
    }
  }, [map, flyTarget]);

  return null;
}

function ClickToPlotHandler({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function OsmParcelMapInner({
  wkt,
  label,
  address,
  heightClassName = 'h-64',
  interactive = false,
  showExistingParcels = false,
  onSelectWkt,
}: OsmParcelMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const [existingParcels, setExistingParcels] = useState<ExistingParcelFeature[]>([]);

  const positions = useMemo(() => wktToLatLngs(wkt), [wkt]);
  const centroid = useMemo(() => wktCentroid(wkt) || { lat: 6.4535, lon: 3.4342 }, [wkt]);
  const osmExternalUrl = getOpenStreetMapUrl(centroid.lat, centroid.lon, 17);

  useEffect(() => {
    if (!showExistingParcels) return;
    let active = true;
    fetch('/api/gis/parcels')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) {
          setExistingParcels(data);
        }
      })
      .catch(() => {
        // Non-blocking background cadastral reference load
      });
    return () => {
      active = false;
    };
  }, [showExistingParcels]);

  const handleMapPick = (lat: number, lon: number) => {
    if (!interactive || !onSelectWkt) return;
    const generatedWkt = buildPlotWktFromCenter(lat, lon);
    onSelectWkt(generatedWkt);
    setFlyTarget({ lat, lon, key: Date.now() });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ng&q=${encodeURIComponent(
        q.toLowerCase().includes('lagos') ? q : `${q}, Lagos, Nigeria`,
      )}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('OpenStreetMap search unavailable');
      const results = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      if (!results.length) {
        setSearchError('No matching street or district found in Lagos on OpenStreetMap.');
        return;
      }
      const lat = Number(results[0].lat);
      const lon = Number(results[0].lon);
      setFlyTarget({ lat, lon, key: Date.now() });
      if (interactive && onSelectWkt) {
        onSelectWkt(buildPlotWktFromCenter(lat, lon), results[0].display_name);
      }
    } catch {
      setSearchError('Unable to reach OpenStreetMap Nominatim lookup. Click directly on the map instead.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {interactive && (
        <div className="space-y-2">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search street or district on OpenStreetMap (e.g. Ikoyi, Lekki)..."
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {searching ? 'Searching...' : 'Locate on OSM'}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 mr-1">Jump to Lagos district:</span>
            {LAGOS_DISTRICTS.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => {
                  setSearchError(null);
                  setFlyTarget({ lat: d.lat, lon: d.lon, key: Date.now() });
                }}
                className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                {d.label}
              </button>
            ))}
          </div>

          {searchError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
              {searchError}
            </p>
          )}
        </div>
      )}

      <div className={`w-full ${heightClassName} border border-slate-200 rounded-md overflow-hidden relative bg-slate-100`}>
        <MapContainer
          center={[centroid.lat, centroid.lon]}
          zoom={16}
          scrollWheelZoom={interactive}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewportController positions={positions} flyTarget={flyTarget} />
          <ClickToPlotHandler enabled={interactive} onPick={handleMapPick} />

          {showExistingParcels &&
            existingParcels.map((p) => (
              <GeoJSON
                key={`${p.id}-${p.status}`}
                data={{ type: 'Feature', geometry: p.geometry, properties: p } as GeoJSON.GeoJsonObject}
                style={() => ({
                  color: p.status === 'revoked' ? '#ef4444' : '#64748b',
                  weight: 1.5,
                  dashArray: '4 3',
                  fillOpacity: 0.15,
                  fillColor: p.status === 'revoked' ? '#ef4444' : '#94a3b8',
                })}
              >
                <Popup>
                  <div className="text-xs space-y-0.5">
                    <div className="font-mono font-semibold">{p.parcelNumber}</div>
                    {p.address && <div className="text-slate-600">{p.address}</div>}
                    <div className="text-slate-500">Existing Registered Parcel ({p.status})</div>
                  </div>
                </Popup>
              </GeoJSON>
            ))}

          {positions.length >= 3 && (
            <>
              <Polygon
                positions={positions}
                pathOptions={{
                  color: '#047857',
                  weight: 2.5,
                  fillColor: '#10b981',
                  fillOpacity: 0.35,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    {label && <div className="font-mono font-semibold text-slate-900">{label}</div>}
                    {address && <div className="text-slate-700">{address}</div>}
                    <div className="font-mono text-[11px] text-slate-500">
                      {centroid.lat.toFixed(5)}, {centroid.lon.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Polygon>
              <Marker position={[centroid.lat, centroid.lon]}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-900">
                      {label || 'Selected Parcel Centroid'}
                    </div>
                    {address && <div className="text-slate-600">{address}</div>}
                    <div className="font-mono text-[11px] text-slate-500">
                      Lat {centroid.lat.toFixed(5)} · Lon {centroid.lon.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          {interactive
            ? 'Click anywhere on OpenStreetMap to plot a 45m × 36m WGS 84 parcel boundary.'
            : `OpenStreetMap · Centroid ${centroid.lat.toFixed(5)}, ${centroid.lon.toFixed(5)}`}
        </span>
        <a
          href={osmExternalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-emerald-700 hover:underline whitespace-nowrap"
        >
          Open in OpenStreetMap →
        </a>
      </div>
    </div>
  );
}
