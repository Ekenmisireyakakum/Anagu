'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import { gisApi } from '../../lib/api';
import { getOpenStreetMapUrl, parseLatLngText, polygonToWKT } from '../../lib/gis-utils';
import { initSafeLeaflet, isLeafletMapReady } from '../../lib/leaflet-safe';
import ParcelInfoPanel from './ParcelInfoPanel';

initSafeLeaflet();

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  pending: '#eab308',
  revoked: '#ef4444',
  disputed: '#f97316',
  cancelled: '#6b7280',
};

function getColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6b7280';
}

interface LandParcel {
  id: string;
  parcelNumber: string;
  geometry: GeoJSON.Polygon;
  areaSqm: number | null;
  state: string;
  lga: string | null;
  address: string | null;
  status: string;
}

interface VerificationResult {
  id?: string;
  isValidGeometry: boolean;
  isSelfIntersecting: boolean;
  overlapDetected: boolean;
  overlappingParcels: Array<{ id: string; parcelNumber: string; overlapAreaSqm: number }>;
  areaSqm: number;
  centroid: { lat: number; lon: number };
  errorDetails: string | null;
  passed: boolean;
}

function getParcelCentroid(geometry: GeoJSON.Polygon): { lat: number; lon: number } {
  const ring = geometry?.coordinates?.[0] || [];
  if (ring.length === 0) return { lat: 6.4698, lon: 3.4068 };
  const open = ring.length > 1 ? ring.slice(0, -1) : ring;
  const lon = open.reduce((s, p) => s + p[0], 0) / open.length;
  const lat = open.reduce((s, p) => s + p[1], 0) / open.length;
  return { lat, lon };
}

function MapInner({
  parcels,
  flyTarget,
}: {
  parcels: LandParcel[];
  flyTarget: { lat: number; lon: number; zoom: number; key: number } | null;
}) {
  const map = useMap();
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [drawnWkt, setDrawnWkt] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

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
    if (flyTarget && isLeafletMapReady(map)) {
      map.stop();
      map.flyTo([flyTarget.lat, flyTarget.lon], flyTarget.zoom, { duration: 0.7 });
    }
    return () => {
      if (isLeafletMapReady(map)) {
        map.stop();
      }
    };
  }, [flyTarget, map]);

  useEffect(() => {
    let mounted = true;
    let drawnItems: L.FeatureGroup | null = null;
    let drawControl: L.Control | null = null;

    const onCreated = async (e: { layer: L.Layer }) => {
      if (!drawnItems) return;
      const layer = e.layer as L.Polygon;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map((ll) => ({
        lat: ll.lat,
        lng: ll.lng,
      }));
      const wkt = polygonToWKT(latlngs);
      setDrawnWkt(wkt);
      const applicationId =
        Date.now().toString(36) +
        '-0000-0000-0000-' +
        Math.random().toString(36).slice(2).padEnd(12, '0');

      setVerifying(true);
      try {
        const response = await gisApi.verifyParcel({ wkt, applicationId });
        if (mounted) setVerifyResult(response.data);
      } catch (err) {
        console.error('Verification failed:', err);
      } finally {
        if (mounted) setVerifying(false);
      }
    };

    if (typeof window !== 'undefined') {
      (window as unknown as { L: typeof L }).L = L;
    }

    import('leaflet-draw')
      .then(() => {
        if (!mounted || !isLeafletMapReady(map)) return;
        const winL =
          typeof window !== 'undefined'
            ? (window as unknown as { L?: typeof L }).L || L
            : L;

        // Guard leaflet-draw@1.0.4 strict-mode global `type` bug inside readableArea
        const geomUtil = (winL as unknown as {
          GeometryUtil?: { readableArea?: (area: number, isMetric?: boolean, precision?: unknown) => string };
        }).GeometryUtil;
        if (geomUtil && typeof geomUtil.readableArea === 'function') {
          const origReadable = geomUtil.readableArea;
          geomUtil.readableArea = function (area: number, isMetric = true, precision?: unknown) {
            try {
              return origReadable.call(this, area, isMetric, precision);
            } catch {
              return `${Math.round(area).toLocaleString()} m²`;
            }
          };
        }

        const DrawControl =
          (L.Control as unknown as { Draw?: new (opts: unknown) => L.Control }).Draw ||
          (winL.Control as unknown as { Draw?: new (opts: unknown) => L.Control }).Draw;
        if (!DrawControl) return;

        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        drawControl = new DrawControl({
          edit: { featureGroup: drawnItems },
          draw: {
            polygon: { allowIntersection: false, showArea: false },
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
          },
        });
        map.addControl(drawControl);
        const drawEventCreated = (winL as unknown as { Draw?: { Event?: { CREATED?: string } } })
          .Draw?.Event?.CREATED;
        if (drawEventCreated) {
          map.on(drawEventCreated, onCreated as unknown as L.LeafletEventHandlerFn);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize map drawing tools:', err);
      });

    return () => {
      mounted = false;
      const winL =
        typeof window !== 'undefined'
          ? (window as unknown as { L?: typeof L }).L || L
          : L;
      const drawEventCreated = (winL as unknown as { Draw?: { Event?: { CREATED?: string } } })
        .Draw?.Event?.CREATED;
      if (drawEventCreated) {
        map.off(drawEventCreated, onCreated as unknown as L.LeafletEventHandlerFn);
      }
      if (drawControl && isLeafletMapReady(map)) {
        try {
          map.removeControl(drawControl);
        } catch {
          // Ignore already removed draw control
        }
      }
      if (drawnItems && isLeafletMapReady(map)) {
        try {
          map.removeLayer(drawnItems);
        } catch {
          // Ignore already removed layer
        }
      }
    };
  }, [map]);

  return (
    <>
      {parcels
        .filter((p) => Array.isArray(p?.geometry?.coordinates?.[0]) && p.geometry.coordinates[0].length >= 3)
        .map((parcel) => {
        const centroid = getParcelCentroid(parcel.geometry);
        return (
          <GeoJSON
            key={`${parcel.id}-${parcel.status}`}
            data={{ type: 'Feature', geometry: parcel.geometry, properties: parcel } as GeoJSON.GeoJsonObject}
            style={() => ({
              color: getColor(parcel.status),
              weight: 2.5,
              fillOpacity: 0.35,
              fillColor: getColor(parcel.status),
            })}
          >
            <Popup>
              <div className="text-xs space-y-1.5 min-w-[200px]">
                <p className="font-mono font-semibold text-slate-900">{parcel.parcelNumber}</p>
                {parcel.address && <p className="text-slate-700">{parcel.address}</p>}
                {parcel.lga && (
                  <p className="text-slate-500">
                    {parcel.lga}, {parcel.state}
                  </p>
                )}
                <p>
                  Status:{' '}
                  <span className="font-mono font-semibold" style={{ color: getColor(parcel.status) }}>
                    {parcel.status.toUpperCase()}
                  </span>
                </p>
                {parcel.areaSqm && (
                  <p className="font-mono text-slate-700 tabular-nums">
                    {parcel.areaSqm.toLocaleString()} m²
                  </p>
                )}
                <div className="pt-1.5 border-t border-slate-200 flex flex-col gap-1">
                  <Link
                    href={`/marketplace?parcel=${encodeURIComponent(parcel.parcelNumber)}`}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Inspect / Buy in Marketplace →
                  </Link>
                  <a
                    href={getOpenStreetMapUrl(centroid.lat, centroid.lon, 17)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 hover:underline"
                  >
                    Open in OpenStreetMap →
                  </a>
                </div>
              </div>
            </Popup>
          </GeoJSON>
        );
      })}

      <ParcelInfoPanel
        result={verifyResult}
        drawnWkt={drawnWkt}
        isLoading={verifying}
        onClose={() => {
          setVerifyResult(null);
          setDrawnWkt(null);
        }}
      />

      {/* Legend */}
      <div className="hidden sm:block absolute bottom-6 left-3 z-[1000] bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-md text-xs">
        <p className="font-semibold text-slate-900 mb-1.5">OpenStreetMap Cadastral Overlay</p>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2 mb-1 last:mb-0">
            <span
              className="w-3 h-3 rounded-sm shrink-0 inline-block"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize text-slate-700">{status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function GisMap() {
  const [parcels, setParcels] = useState<LandParcel[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [lgaFilter, setLgaFilter] = useState('');
  const [osmSearch, setOsmSearch] = useState('');
  const [searchingOsm, setSearchingOsm] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lon: number;
    zoom: number;
    key: number;
  } | null>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  const fetchParcels = useCallback(() => {
    const params: { status?: string; lga?: string } = {};
    if (statusFilter) params.status = statusFilter;
    if (lgaFilter) params.lga = lgaFilter;
    setSearchNotice(null);
    gisApi
      .getParcels(params)
      .then((res) => setParcels(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error(err);
        setSearchNotice('Unable to load GIS parcel boundaries right now.');
      });
  }, [statusFilter, lgaFilter]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  const handleOsmSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = osmSearch.trim();
    if (!q) return;
    setSearchingOsm(true);
    setSearchNotice(null);
    try {
      const coords = parseLatLngText(q);
      if (coords) {
        setFlyTarget({ lat: coords.lat, lon: coords.lon, zoom: 16, key: Date.now() });
        setMobileToolsOpen(false);
        return;
      }

      const res = await fetch(`/api/gis/geocode?q=${encodeURIComponent(q)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Search unavailable');
      const data = (await res.json()) as {
        results?: Array<{ lat: string; lon: string; display_name: string }>;
      };
      const items = data.results || [];
      if (!items.length) {
        setSearchNotice(`No matching location found for "${q}". Try a city, street, or "lat, lng".`);
        return;
      }
      setFlyTarget({
        lat: Number(items[0].lat),
        lon: Number(items[0].lon),
        zoom: 16,
        key: Date.now(),
      });
      setMobileToolsOpen(false);
    } catch {
      setSearchNotice('Location search is temporarily unreachable.');
    } finally {
      setSearchingOsm(false);
    }
  };

  const handleFlyToParcel = (parcelId: string) => {
    if (!parcelId) return;
    const found = parcels.find((p) => p.id === parcelId);
    if (!found) return;
    const centroid = getParcelCentroid(found.geometry);
    setFlyTarget({ lat: centroid.lat, lon: centroid.lon, zoom: 17, key: Date.now() });
  };

  const center: [number, number] = [6.4698, 3.4068];

  return (
    <div className="h-full w-full min-h-[520px] relative">
      {/* Mobile Compact Header Toggle */}
      <div className="md:hidden absolute top-3 left-14 right-3 z-[1000] flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
        <span className="font-semibold text-slate-900 truncate">
          GIS Cadastre ({parcels.length})
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fetchParcels}
            className="px-2.5 py-1.5 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setMobileToolsOpen((prev) => !prev)}
            className="px-2.5 py-1.5 font-semibold text-white bg-slate-900 rounded hover:bg-slate-800"
          >
            {mobileToolsOpen ? 'Hide Tools' : 'Filter & Search'}
          </button>
        </div>
      </div>

      {/* OpenStreetMap Toolbar & Filters */}
      <div
        className={`${
          mobileToolsOpen ? 'flex' : 'hidden'
        } md:flex absolute top-16 md:top-3 left-3 md:left-14 right-3 xl:right-auto z-[1000] bg-white border border-slate-200 rounded-lg p-3 md:px-3 md:py-2 shadow-md flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-2 text-xs max-h-[65dvh] overflow-y-auto`}
      >
        <span className="hidden md:inline font-semibold text-slate-900 whitespace-nowrap">
          OpenStreetMap GIS ({parcels.length})
        </span>
        <div className="grid grid-cols-2 md:flex gap-2">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-2 py-1.5 md:py-1 border border-slate-300 rounded bg-white text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="revoked">Revoked</option>
            <option value="disputed">Disputed</option>
          </select>
          <select
            aria-label="Filter by LGA"
            value={lgaFilter}
            onChange={(e) => setLgaFilter(e.target.value)}
            className="w-full md:w-auto px-2 py-1.5 md:py-1 border border-slate-300 rounded bg-white text-slate-700"
          >
            <option value="">All LGAs</option>
            <option value="Eti-Osa">Eti-Osa</option>
            <option value="Ikeja">Ikeja</option>
            <option value="Mainland">Mainland</option>
            <option value="Surulere">Surulere</option>
            <option value="Alimosho">Alimosho</option>
            <option value="Kosofe">Kosofe</option>
            <option value="Ibeju-Lekki">Ibeju-Lekki</option>
            <option value="Lagos Island">Lagos Island</option>
          </select>
        </div>
        <select
          aria-label="Jump to parcel"
          defaultValue=""
          onChange={(e) => {
            handleFlyToParcel(e.target.value);
            setMobileToolsOpen(false);
          }}
          className="w-full md:w-auto md:max-w-[160px] px-2 py-1.5 md:py-1 border border-slate-300 rounded bg-white text-slate-700"
        >
          <option value="">Fly to parcel...</option>
          {parcels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.parcelNumber} ({p.lga || p.state})
            </option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            void handleOsmSearch(e);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="search"
            value={osmSearch}
            onChange={(e) => setOsmSearch(e.target.value)}
            placeholder="Locate address, city, or lat, lng..."
            className="flex-1 md:w-52 px-2 py-1.5 md:py-1 border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <button
            type="submit"
            disabled={searchingOsm}
            className="px-3 py-1.5 md:py-1 font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            {searchingOsm ? '...' : 'Locate'}
          </button>
        </form>
        <button
          type="button"
          onClick={fetchParcels}
          className="hidden md:inline-block px-2.5 py-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 whitespace-nowrap"
        >
          Refresh
        </button>
        {searchNotice && <span className="text-red-700">{searchNotice}</span>}
      </div>

      <MapContainer center={center} zoom={12} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="/api/gis/tile/{z}/{x}/{y}.png"
        />
        <MapInner parcels={parcels} flyTarget={flyTarget} />
      </MapContainer>
    </div>
  );
}
