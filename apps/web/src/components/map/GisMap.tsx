'use client';
import { useCallback, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import { gisApi } from '../../lib/api';
import { polygonToWKT } from '../../lib/gis-utils';
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
  geometry: any;
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

function MapInner({ parcels }: { parcels: LandParcel[] }) {
  const map = useMap();
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let mounted = true;
    let drawnItems: L.FeatureGroup | null = null;
    let drawControl: any = null;

    const onCreated = async (e: any) => {
      if (!drawnItems) return;
      const layer = e.layer as L.Polygon;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map((ll) => ({
        lat: ll.lat,
        lng: ll.lng,
      }));
      const wkt = polygonToWKT(latlngs);
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
      (window as any).L = L;
    }

    import('leaflet-draw').then(() => {
      if (!mounted) return;
      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      drawControl = new (L.Control as any).Draw({
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
      map.on((L as any).Draw.Event.CREATED, onCreated);
    });

    return () => {
      mounted = false;
      if ((L as any).Draw?.Event?.CREATED) {
        map.off((L as any).Draw.Event.CREATED, onCreated);
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
      {parcels.map((parcel) => (
        <GeoJSON
          key={`${parcel.id}-${parcel.status}`}
          data={{ type: 'Feature', geometry: parcel.geometry, properties: parcel } as any}
          style={() => ({
            color: getColor(parcel.status),
            weight: 2,
            fillOpacity: 0.3,
            fillColor: getColor(parcel.status),
          })}
        >
          <Popup>
            <div className="text-sm space-y-1">
              <p className="font-mono font-semibold">{parcel.parcelNumber}</p>
              <p>{parcel.address}</p>
              {parcel.lga && <p className="text-xs text-slate-500">{parcel.lga}, {parcel.state}</p>}
              <p>
                Status:{' '}
                <span className="font-mono font-semibold" style={{ color: getColor(parcel.status) }}>
                  {parcel.status.toUpperCase()}
                </span>
              </p>
              {parcel.areaSqm && (
                <p className="font-mono text-xs">{parcel.areaSqm.toLocaleString()} m²</p>
              )}
            </div>
          </Popup>
        </GeoJSON>
      ))}

      <ParcelInfoPanel
        result={verifyResult}
        isLoading={verifying}
        onClose={() => setVerifyResult(null)}
      />

      {/* Legend */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-md text-xs">
        <p className="font-semibold text-slate-900 mb-1.5">Parcel Status</p>
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

  const center: [number, number] = [6.4698, 3.4068];

  return (
    <div className="h-full w-full relative">
      {/* Map Filter Overlay */}
      <div className="absolute top-3 left-14 right-3 sm:right-auto z-[1000] bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md flex flex-wrap items-center gap-2.5 text-xs">
        <span className="font-semibold text-slate-800">
          Lagos Parcels ({parcels.length})
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
          <option value="Alimosho">Alimosho</option>
          <option value="Kosofe">Kosofe</option>
          <option value="Ibeju-Lekki">Ibeju-Lekki</option>
          <option value="Lagos Island">Lagos Island</option>
        </select>
        <button
          type="button"
          onClick={fetchParcels}
          className="px-2.5 py-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
        >
          Refresh
        </button>
      </div>

      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapInner parcels={parcels} />
      </MapContainer>
    </div>
  );
}
