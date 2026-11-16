'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import { gisApi } from '../../lib/api';
import { getOpenStreetMapUrl, polygonToWKT } from '../../lib/gis-utils';
import ParcelInfoPanel from './ParcelInfoPanel';

L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lon], flyTarget.zoom, { duration: 0.7 });
    }
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

    import('leaflet-draw').then(() => {
      if (!mounted) return;
      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      const DrawControl = (L.Control as unknown as { Draw: new (opts: unknown) => L.Control }).Draw;
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
      const drawEventCreated = (L as unknown as { Draw: { Event: { CREATED: string } } }).Draw.Event.CREATED;
      map.on(drawEventCreated, onCreated as unknown as L.LeafletEventHandlerFn);
    });

    return () => {
      mounted = false;
      const drawEventCreated = (L as unknown as { Draw?: { Event?: { CREATED?: string } } }).Draw?.Event?.CREATED;
      if (drawEventCreated) {
        map.off(drawEventCreated, onCreated as unknown as L.LeafletEventHandlerFn);
      }
      if (drawControl) {
        map.removeControl(drawControl);
      }
      if (drawnItems) {
        map.removeLayer(drawnItems);
      }
    };
  }, [map]);

  return (
    <>
      {parcels.map((parcel) => {
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
      <div className="absolute bottom-6 left-3 z-[1000] bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-md text-xs">
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

  const fetchParcels = useCallback(() => {
    const params: { status?: string; lga?: string } = {};
    if (statusFilter) params.status = statusFilter;
    if (lgaFilter) params.lga = lgaFilter;
    gisApi
      .getParcels(params)
      .then((res) => setParcels(res.data))
      .catch(console.error);
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
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ng&q=${encodeURIComponent(
        q.toLowerCase().includes('lagos') ? q : `${q}, Lagos, Nigeria`,
      )}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Search unavailable');
      const items = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!items.length) {
        setSearchNotice('No matching street found in Lagos on OpenStreetMap.');
        return;
      }
      setFlyTarget({
        lat: Number(items[0].lat),
        lon: Number(items[0].lon),
        zoom: 16,
        key: Date.now(),
      });
    } catch {
      setSearchNotice('OpenStreetMap search temporarily unreachable.');
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
    <div className="h-full w-full relative">
      {/* OpenStreetMap Toolbar & Filters */}
      <div className="absolute top-3 left-14 right-3 xl:right-auto z-[1000] bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-900 whitespace-nowrap">
          OpenStreetMap GIS ({parcels.length})
        </span>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-700"
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
          className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-700"
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
        <select
          aria-label="Jump to parcel"
          defaultValue=""
          onChange={(e) => handleFlyToParcel(e.target.value)}
          className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-700 max-w-[160px]"
        >
          <option value="">Fly to parcel...</option>
          {parcels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.parcelNumber} ({p.lga || p.state})
            </option>
          ))}
        </select>
        <form onSubmit={handleOsmSearch} className="flex items-center gap-1.5">
          <input
            type="search"
            value={osmSearch}
            onChange={(e) => setOsmSearch(e.target.value)}
            placeholder="Locate street on OpenStreetMap..."
            className="w-48 px-2 py-1 border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <button
            type="submit"
            disabled={searchingOsm}
            className="px-2.5 py-1 font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            {searchingOsm ? '...' : 'Locate'}
          </button>
        </form>
        <button
          type="button"
          onClick={fetchParcels}
          className="px-2.5 py-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 whitespace-nowrap"
        >
          Refresh
        </button>
        {searchNotice && <span className="text-red-700">{searchNotice}</span>}
      </div>

      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapInner parcels={parcels} flyTarget={flyTarget} />
      </MapContainer>
    </div>
  );
}
