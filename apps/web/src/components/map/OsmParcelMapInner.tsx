'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  buildPlotWktFromCenter,
  getOpenStreetMapUrl,
  parseLatLngText,
  PLOT_SIZE_PRESETS,
  polygonToWKT,
  wktCentroid,
  wktToLatLngs,
} from '../../lib/gis-utils';
import { initSafeLeaflet, isLeafletMapReady } from '../../lib/leaflet-safe';

initSafeLeaflet();

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
  externalQuery?: string;
  onSelectWkt?: (newWkt: string, discoveredAddress?: string) => void;
}

const QUICK_LOCATIONS = [
  { label: 'Lagos · Victoria Island', lat: 6.4285, lon: 3.4219 },
  { label: 'Lagos · Lekki', lat: 6.4455, lon: 3.4717 },
  { label: 'Abuja · Maitama', lat: 9.082, lon: 7.4951 },
  { label: 'London · Canary Wharf', lat: 51.5054, lon: -0.0235 },
  { label: 'Nairobi · Westlands', lat: -1.2647, lon: 36.8047 },
];

function MapViewportController({
  positions,
  flyTarget,
  skipAutoFit,
}: {
  positions: Array<[number, number]>;
  flyTarget: { lat: number; lon: number; key: number } | null;
  skipAutoFit?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!isLeafletMapReady(map)) return;
    const container = map.getContainer();
    const syncSize = () => {
      if (isLeafletMapReady(map)) {
        map.invalidateSize({ animate: false });
      }
    };
    const rafId = window.requestAnimationFrame(syncSize);
    const timerId = window.setTimeout(syncSize, 200);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      observer = new ResizeObserver(syncSize);
      observer.observe(container);
    }
    window.addEventListener('resize', syncSize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      observer?.disconnect();
      window.removeEventListener('resize', syncSize);
    };
  }, [map]);

  useEffect(() => {
    if (!skipAutoFit && positions.length >= 3 && isLeafletMapReady(map)) {
      const bounds = L.latLngBounds(positions);
      if (bounds.isValid()) {
        map.stop();
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17, animate: false });
      }
    }
  }, [map, positions, skipAutoFit]);

  useEffect(() => {
    if (flyTarget && isLeafletMapReady(map)) {
      map.stop();
      map.flyTo([flyTarget.lat, flyTarget.lon], 16, { duration: 0.6 });
    }
    return () => {
      if (isLeafletMapReady(map)) {
        map.stop();
      }
    };
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
  externalQuery,
  onSelectWkt,
}: OsmParcelMapProps) {
  const [searchQuery, setSearchQuery] = useState(externalQuery || '');
  const [searching, setSearching] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const [existingParcels, setExistingParcels] = useState<ExistingParcelFeature[]>([]);

  const [markMode, setMarkMode] = useState<'plot' | 'draw'>('plot');
  const [presetId, setPresetId] = useState<string>('standard');
  const [draftPoints, setDraftPoints] = useState<Array<{ lat: number; lng: number }>>([]);

  useEffect(() => {
    if (typeof externalQuery === 'string' && externalQuery.trim()) {
      setSearchQuery(externalQuery);
    }
  }, [externalQuery]);

  const activePreset = useMemo(
    () => PLOT_SIZE_PRESETS.find((p) => p.id === presetId) || PLOT_SIZE_PRESETS[1],
    [presetId],
  );

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
        // Non-blocking background reference load
      });
    return () => {
      active = false;
    };
  }, [showExistingParcels]);

  const reverseLookup = useCallback(async (lat: number, lon: number): Promise<string | undefined> => {
    try {
      const res = await fetch(
        `/api/gis/geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return undefined;
      const data = (await res.json()) as { display_name?: string | null };
      return data.display_name || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const plotAtPoint = useCallback(
    async (lat: number, lon: number, knownAddress?: string) => {
      if (!interactive || !onSelectWkt) return;
      const generatedWkt = buildPlotWktFromCenter(
        lat,
        lon,
        activePreset.widthMeters,
        activePreset.heightMeters,
      );
      if (knownAddress) {
        onSelectWkt(generatedWkt, knownAddress);
        return;
      }
      onSelectWkt(generatedWkt);
      const discovered = await reverseLookup(lat, lon);
      if (discovered) {
        onSelectWkt(generatedWkt, discovered);
      }
    },
    [activePreset.heightMeters, activePreset.widthMeters, interactive, onSelectWkt, reverseLookup],
  );

  const handleMapPick = (lat: number, lon: number) => {
    if (!interactive || !onSelectWkt) return;
    if (markMode === 'draw') {
      setDraftPoints((prev) => [...prev, { lat, lng: lon }]);
      return;
    }
    void plotAtPoint(lat, lon);
  };

  const handleFinishDrawing = async () => {
    if (!onSelectWkt || draftPoints.length < 3) return;
    const customWkt = polygonToWKT(draftPoints);
    const avgLat = draftPoints.reduce((sum, p) => sum + p.lat, 0) / draftPoints.length;
    const avgLon = draftPoints.reduce((sum, p) => sum + p.lng, 0) / draftPoints.length;
    onSelectWkt(customWkt);
    setDraftPoints([]);
    setMarkMode('plot');
    const discovered = await reverseLookup(avgLat, avgLon);
    if (discovered) {
      onSelectWkt(customWkt, discovered);
    }
  };

  const handlePresetChange = (nextId: string) => {
    setPresetId(nextId);
    const preset = PLOT_SIZE_PRESETS.find((p) => p.id === nextId);
    if (preset && interactive && onSelectWkt && centroid) {
      onSelectWkt(
        buildPlotWktFromCenter(centroid.lat, centroid.lon, preset.widthMeters, preset.heightMeters),
      );
    }
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);

    try {
      const coords = parseLatLngText(q);
      if (coords) {
        setFlyTarget({ lat: coords.lat, lon: coords.lon, key: Date.now() });
        if (interactive && onSelectWkt) {
          await plotAtPoint(coords.lat, coords.lon);
        }
        return;
      }

      const url = `/api/gis/geocode?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('GIS location search unavailable');
      const data = (await res.json()) as {
        results?: Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;
      };
      const results = data.results || [];
      if (!results.length) {
        setSearchError(
          `No location matched "${q}". Try a city/street name, "lat, lng" coordinates, or click directly on the map.`,
        );
        return;
      }
      const lat = Number(results[0].lat);
      const lon = Number(results[0].lon);
      setFlyTarget({ lat, lon, key: Date.now() });
      if (interactive && onSelectWkt) {
        await plotAtPoint(lat, lon, results[0].display_name);
      }
    } catch {
      setSearchError(
        'Location lookup is temporarily unavailable. Click directly on the map or enter lat, lng coordinates.',
      );
    } finally {
      setSearching(false);
    }
  };

  const handleUseMyLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setSearchError('GPS geolocation is not supported in this browser.');
      return;
    }
    setLocatingGps(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFlyTarget({ lat: latitude, lon: longitude, key: Date.now() });
        if (interactive && onSelectWkt) {
          await plotAtPoint(latitude, longitude);
        }
        setLocatingGps(false);
      },
      () => {
        setSearchError('Unable to read device GPS location. Search by address or click on the map.');
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-2.5">
      {interactive && (
        <div className="space-y-2.5">
          {/* Global Address or Coordinate Search + GPS */}
          <div role="search" className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Enter street, city, landmark, or lat, lng..."
              className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={searching}
                onClick={() => void handleSearch()}
                className="min-h-[38px] px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {searching ? 'Locating...' : 'Find Location'}
              </button>
              <button
                type="button"
                disabled={locatingGps}
                onClick={handleUseMyLocation}
                className="min-h-[38px] px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
              >
                {locatingGps ? 'Reading GPS...' : 'Use My GPS'}
              </button>
            </div>
          </div>

          {/* Marking Mode + Plot Size Controls */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600 mr-1">Marking Mode:</span>
              <button
                type="button"
                onClick={() => {
                  setMarkMode('plot');
                  setDraftPoints([]);
                }}
                className={`px-2.5 py-1.5 sm:py-1 rounded text-[11px] font-semibold border transition-colors ${
                  markMode === 'plot'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Click to Place Plot
              </button>
              <button
                type="button"
                onClick={() => setMarkMode('draw')}
                className={`px-2.5 py-1.5 sm:py-1 rounded text-[11px] font-semibold border transition-colors ${
                  markMode === 'draw'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Draw Custom Corners
              </button>
            </div>

            {markMode === 'plot' ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label htmlFor="plot-size-select" className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                  Plot Size:
                </label>
                <select
                  id="plot-size-select"
                  value={presetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="flex-1 sm:flex-initial min-w-0 px-2 py-1.5 sm:py-1 text-[11px] font-medium text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {PLOT_SIZE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-slate-600">
                  {draftPoints.length} corner{draftPoints.length === 1 ? '' : 's'} marked
                </span>
                <button
                  type="button"
                  disabled={draftPoints.length === 0}
                  onClick={() => setDraftPoints((prev) => prev.slice(0, -1))}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40"
                >
                  Undo Point
                </button>
                <button
                  type="button"
                  disabled={draftPoints.length < 3}
                  onClick={() => void handleFinishDrawing()}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 rounded hover:bg-emerald-800 disabled:opacity-40"
                >
                  Finish Boundary ({draftPoints.length}/3+)
                </button>
                <button
                  type="button"
                  disabled={draftPoints.length === 0}
                  onClick={() => setDraftPoints([])}
                  className="px-2 py-1 text-[11px] font-semibold text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto pb-1">
            <span className="text-slate-500 mr-1 whitespace-nowrap shrink-0">Quick Map Jump:</span>
            {QUICK_LOCATIONS.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => {
                  setSearchError(null);
                  setFlyTarget({ lat: d.lat, lon: d.lon, key: Date.now() });
                }}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
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

      <div
        className={`w-full ${heightClassName} border border-slate-200 rounded-md overflow-hidden relative bg-slate-100 ${
          interactive ? 'cursor-crosshair' : ''
        }`}
      >
        <MapContainer
          center={[centroid.lat, centroid.lon]}
          zoom={16}
          scrollWheelZoom={interactive}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="/api/gis/tile/{z}/{x}/{y}.png"
          />

          <MapViewportController
            positions={positions}
            flyTarget={flyTarget}
            skipAutoFit={markMode === 'draw' && draftPoints.length > 0}
          />
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
                    <div className="text-slate-500">Mapped Parcel ({p.status})</div>
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
                      {label || 'Mapped Land Center'}
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

          {draftPoints.length > 0 && (
            <>
              {draftPoints.length >= 2 && (
                <Polyline
                  positions={draftPoints.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: '#d97706', weight: 2.5, dashArray: '5 4' }}
                />
              )}
              {draftPoints.length >= 3 && (
                <Polygon
                  positions={draftPoints.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: '#d97706',
                    weight: 2,
                    fillColor: '#f59e0b',
                    fillOpacity: 0.22,
                  }}
                />
              )}
              {draftPoints.map((pt, idx) => (
                <CircleMarker
                  key={`${pt.lat}-${pt.lng}-${idx}`}
                  center={[pt.lat, pt.lng]}
                  radius={5}
                  pathOptions={{
                    color: '#92400e',
                    fillColor: '#fbbf24',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              ))}
            </>
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          {interactive
            ? markMode === 'draw'
              ? 'Click at least 3 corners on the map to outline your land boundary, then click Finish Boundary.'
              : `Click anywhere on the map to place a ${activePreset.label} boundary, or search any address above.`
            : `OpenStreetMap · Center ${centroid.lat.toFixed(5)}, ${centroid.lon.toFixed(5)}`}
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
