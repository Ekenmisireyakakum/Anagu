'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import { gisApi } from '../../lib/api';
import { polygonToWKT } from '../../lib/gis-utils';
import ParcelInfoPanel from './ParcelInfoPanel';

// Fix Leaflet default icon in Next.js / Webpack environments
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

// Inner component that initialises leaflet-draw after the map is mounted
function MapInner({ parcels }: { parcels: LandParcel[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const drawLayerRef = useRef<L.FeatureGroup | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Lazy-load leaflet-draw so it only runs client-side
    import('leaflet-draw').then(() => {
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawLayerRef.current = drawnItems;

      const drawControl = new (L.Control as any).Draw({
        edit: { featureGroup: drawnItems },
        draw: {
          polygon: { allowIntersection: false, showArea: true },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
      });
      map.addControl(drawControl);

      map.on((L as any).Draw.Event.CREATED, async (e: any) => {
        const layer = e.layer as L.Polygon;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);

        const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(ll => ({
          lat: ll.lat,
          lng: ll.lng,
        }));
        const wkt = polygonToWKT(latlngs);
        const applicationId = Date.now().toString(36) + '-0000-0000-0000-' + Math.random().toString(36).slice(2).padEnd(12, '0');

        setVerifying(true);
        try {
          const response = await gisApi.verifyParcel({ wkt, applicationId });
          setVerifyResult(response.data);
        } catch (err) {
          console.error('Verification failed:', err);
        } finally {
          setVerifying(false);
        }
      });
    });
  }, [mapRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <MapInnerRef onMapReady={(m) => { mapRef.current = m; }} />

      {parcels.map((parcel) => (
        <GeoJSON
          key={parcel.id}
          data={{ type: 'Feature', geometry: parcel.geometry, properties: parcel } as any}
          style={() => ({
            color: getColor(parcel.status),
            weight: 2,
            fillOpacity: 0.3,
            fillColor: getColor(parcel.status),
          })}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{parcel.parcelNumber}</p>
              <p>{parcel.address}</p>
              <p>Status: <span style={{ color: getColor(parcel.status) }}>{parcel.status}</span></p>
              {parcel.areaSqm && <p>Area: {parcel.areaSqm.toLocaleString()} m²</p>}
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
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 12,
          zIndex: 1000,
          background: 'white',
          padding: '10px 14px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: 13,
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Parcel Status</p>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 14, height: 14, background: color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ textTransform: 'capitalize' }}>{status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// Helper to get map ref inside MapContainer using useMap hook equivalent via ref callback
function MapInnerRef({ onMapReady }: { onMapReady: (m: L.Map) => void }) {
  // This component relies on the MapContainer's context
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function GisMap() {
  const [parcels, setParcels] = useState<LandParcel[]>([]);

  useEffect(() => {
    gisApi.getParcels().then((res) => setParcels(res.data)).catch(console.error);
  }, []);

  // Lagos center
  const center: [number, number] = [6.4698, 3.4068];

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapInner parcels={parcels} />
      </MapContainer>
    </div>
  );
}
