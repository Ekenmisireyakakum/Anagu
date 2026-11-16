export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LandParcelRecord {
  id: string;
  parcelNumber: string;
  geometry: GeoJsonPolygon;
  areaSqm: number | null;
  state: string;
  lga: string | null;
  address: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpatialVerificationResult {
  id: string;
  applicationId: string;
  isValidGeometry: boolean;
  isSelfIntersecting: boolean;
  overlapDetected: boolean;
  overlappingParcels: Array<{ id: string; parcelNumber: string; overlapAreaSqm: number }>;
  areaSqm: number;
  centroid: { lat: number; lon: number };
  errorDetails: string | null;
  verifiedAt: string;
  passed: boolean;
}

type Point = [number, number]; // [lon, lat]

function ringFromWkt(wkt: string): Point[] {
  const match = wkt.trim().match(/^POLYGON\s*\(\(\s*([^)]+)\s*\)\)$/i);
  if (!match) {
    throw new Error('Invalid WKT polygon format');
  }
  const coords = match[1].split(',').map((pair) => {
    const parts = pair.trim().split(/\s+/);
    if (parts.length < 2) throw new Error('Invalid coordinate pair in WKT');
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error('Non-numeric coordinates in WKT');
    }
    return [lon, lat] as Point;
  });
  return coords;
}

function projectMeters(pt: Point, refLat: number): [number, number] {
  const metersPerLat = 110574;
  const metersPerLon = 111320 * Math.cos((refLat * Math.PI) / 180);
  return [pt[0] * metersPerLon, pt[1] * metersPerLat];
}

function computePolygonAreaSqm(ring: Point[]): number {
  if (ring.length < 4) return 0;
  const refLat = ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
  const projected = ring.map((p) => projectMeters(p, refLat));
  let sum = 0;
  for (let i = 0; i < projected.length - 1; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function computeCentroid(ring: Point[]): { lat: number; lon: number } {
  const open = ring.length > 1 ? ring.slice(0, -1) : ring;
  if (open.length === 0) return { lat: 0, lon: 0 };
  const lon = open.reduce((s, p) => s + p[0], 0) / open.length;
  const lat = open.reduce((s, p) => s + p[1], 0) / open.length;
  return { lat, lon };
}

function orient(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
}

function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = orient(p1, q1, p2);
  const o2 = orient(p1, q1, q2);
  const o3 = orient(p2, q2, p1);
  const o4 = orient(p2, q2, q1);

  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
    return true;
  }
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function hasSelfIntersection(ring: Point[]): boolean {
  const n = ring.length - 1;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[i + 1];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const b1 = ring[j];
      const b2 = ring[j + 1];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function ensureCCW(ring: Point[]): Point[] {
  const open = ring.slice(0, -1);
  let area = 0;
  for (let i = 0; i < open.length; i++) {
    const [x1, y1] = open[i];
    const [x2, y2] = open[(i + 1) % open.length];
    area += x1 * y2 - x2 * y1;
  }
  return area >= 0 ? open : [...open].reverse();
}

function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  let output = subject;
  const clipEdges = clip;
  for (let i = 0; i < clipEdges.length; i++) {
    const cp1 = clipEdges[i];
    const cp2 = clipEdges[(i + 1) % clipEdges.length];
    const input = output;
    output = [];
    if (input.length === 0) break;

    const isInside = (p: Point) => orient(cp1, cp2, p) >= 0;
    const intersect = (a: Point, b: Point): Point => {
      const dc: Point = [cp1[0] - cp2[0], cp1[1] - cp2[1]];
      const dp: Point = [a[0] - b[0], a[1] - b[1]];
      const n1 = cp1[0] * cp2[1] - cp1[1] * cp2[0];
      const n2 = a[0] * b[1] - a[1] * b[0];
      const denom = dc[0] * dp[1] - dc[1] * dp[0];
      if (Math.abs(denom) < 1e-18) return b;
      return [(n1 * dp[0] - n2 * dc[0]) / denom, (n1 * dp[1] - n2 * dc[1]) / denom];
    };

    let s = input[input.length - 1];
    for (const e of input) {
      if (isInside(e)) {
        if (!isInside(s)) output.push(intersect(s, e));
        output.push(e);
      } else if (isInside(s)) {
        output.push(intersect(s, e));
      }
      s = e;
    }
  }
  return output;
}

function computeOverlapAreaSqm(ringA: Point[], ringB: Point[]): number {
  const polyA = ensureCCW(ringA);
  const polyB = ensureCCW(ringB);
  const clipped = clipPolygon(polyA, polyB);
  if (clipped.length < 3) return 0;
  return computePolygonAreaSqm([...clipped, clipped[0]]);
}

function makeSeedParcel(
  id: string,
  parcelNumber: string,
  wkt: string,
  areaSqm: number,
  state: string,
  lga: string,
  address: string,
  status: string,
): LandParcelRecord {
  const ring = ringFromWkt(wkt);
  const now = new Date('2025-01-01T00:00:00.000Z').toISOString();
  return {
    id,
    parcelNumber,
    geometry: { type: 'Polygon', coordinates: [ring] },
    areaSqm,
    state,
    lga,
    address,
    status,
    ownerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Seeded Lagos parcels matching packages/database/migrations/002_seed_lagos_parcels.sql
const parcelsStore: LandParcelRecord[] = [
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000001',
    'LG-VI-001',
    'POLYGON((3.4201 6.4290, 3.4215 6.4290, 3.4215 6.4280, 3.4201 6.4280, 3.4201 6.4290))',
    1680.5,
    'Lagos',
    'Eti-Osa',
    '15 Akin Adesola Street, Victoria Island',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000002',
    'LG-VI-002',
    'POLYGON((3.4230 6.4295, 3.4244 6.4295, 3.4244 6.4285, 3.4230 6.4285, 3.4230 6.4295))',
    1620.3,
    'Lagos',
    'Eti-Osa',
    '22 Ozumba Mbadiwe Avenue, Victoria Island',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000003',
    'LG-LK-001',
    'POLYGON((3.4710 6.4350, 3.4724 6.4350, 3.4724 6.4340, 3.4710 6.4340, 3.4710 6.4350))',
    1710.2,
    'Lagos',
    'Eti-Osa',
    '10 Admiralty Way, Lekki Phase 1',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000004',
    'LG-LK-002',
    'POLYGON((3.4740 6.4360, 3.4754 6.4360, 3.4754 6.4350, 3.4740 6.4350, 3.4740 6.4360))',
    1680.8,
    'Lagos',
    'Eti-Osa',
    '45 Fola Osibo Road, Lekki Phase 1',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000005',
    'LG-IK-001',
    'POLYGON((3.3410 6.5920, 3.3424 6.5920, 3.3424 6.5910, 3.3410 6.5910, 3.3410 6.5920))',
    1620.6,
    'Lagos',
    'Ikeja',
    '5 Obafemi Awolowo Way, Ikeja',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000006',
    'LG-IK-002',
    'POLYGON((3.3440 6.5930, 3.3454 6.5930, 3.3454 6.5920, 3.3440 6.5920, 3.3440 6.5930))',
    1590.4,
    'Lagos',
    'Ikeja',
    '12 Allen Avenue, Ikeja',
    'pending',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000007',
    'LG-SU-001',
    'POLYGON((3.3620 6.4980, 3.3634 6.4980, 3.3634 6.4970, 3.3620 6.4970, 3.3620 6.4980))',
    1600.9,
    'Lagos',
    'Surulere',
    '8 Bode Thomas Street, Surulere',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000008',
    'LG-SU-002',
    'POLYGON((3.3650 6.4990, 3.3664 6.4990, 3.3664 6.4980, 3.3650 6.4980, 3.3650 6.4990))',
    1570.2,
    'Lagos',
    'Surulere',
    '30 Adeniran Ogunsanya Street, Surulere',
    'pending',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000009',
    'LG-YB-001',
    'POLYGON((3.3760 6.5100, 3.3774 6.5100, 3.3774 6.5090, 3.3760 6.5090, 3.3760 6.5100))',
    1610.5,
    'Lagos',
    'Mainland',
    '22 Herbert Macaulay Way, Yaba',
    'active',
  ),
  makeSeedParcel(
    '00000000-0000-4000-8000-000000000010',
    'LG-YB-002',
    'POLYGON((3.3790 6.5110, 3.3804 6.5110, 3.3804 6.5100, 3.3790 6.5100, 3.3790 6.5110))',
    1580.7,
    'Lagos',
    'Mainland',
    '7 Commercial Avenue, Yaba',
    'active',
  ),
];

export function listParcels(filters?: { status?: string | null; lga?: string | null }): LandParcelRecord[] {
  return parcelsStore.filter((p) => {
    if (filters?.status && p.status !== filters.status) return false;
    if (filters?.lga && p.lga !== filters.lga) return false;
    return true;
  });
}

export function findParcelById(id: string): LandParcelRecord | null {
  return parcelsStore.find((p) => p.id === id) ?? null;
}

export function verifyWktParcel(
  wkt: string,
  applicationId: string,
  excludeParcelId?: string,
): SpatialVerificationResult {
  let ring: Point[] = [];
  let isValidGeometry = true;
  let isSelfIntersecting = false;
  let errorDetails: string | null = null;

  try {
    ring = ringFromWkt(wkt);
    if (ring.length < 4) {
      isValidGeometry = false;
      errorDetails = 'Polygon ring must contain at least 4 coordinates';
    } else if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      isValidGeometry = false;
      errorDetails = 'Polygon ring is not closed';
    } else if (hasSelfIntersection(ring)) {
      isValidGeometry = false;
      isSelfIntersecting = true;
      errorDetails = 'Self-intersection detected in polygon geometry';
    }
  } catch (err) {
    isValidGeometry = false;
    errorDetails = err instanceof Error ? err.message : 'Invalid WKT geometry';
  }

  const areaSqm = ring.length >= 4 ? Math.round(computePolygonAreaSqm(ring) * 100) / 100 : 0;
  const centroid = ring.length >= 3 ? computeCentroid(ring) : { lat: 0, lon: 0 };

  const overlappingParcels: Array<{ id: string; parcelNumber: string; overlapAreaSqm: number }> = [];
  if (ring.length >= 4) {
    for (const parcel of parcelsStore) {
      if (excludeParcelId && parcel.id === excludeParcelId) continue;
      if (parcel.status === 'revoked' || parcel.status === 'cancelled') continue;
      const existingRing = parcel.geometry.coordinates[0] as Point[];
      const overlapArea = computeOverlapAreaSqm(ring, existingRing);
      if (overlapArea > 0.01) {
        overlappingParcels.push({
          id: parcel.id,
          parcelNumber: parcel.parcelNumber,
          overlapAreaSqm: Math.round(overlapArea * 100) / 100,
        });
      }
    }
  }

  const overlapDetected = overlappingParcels.length > 0;
  const passed = isValidGeometry && !overlapDetected;

  return {
    id: crypto.randomUUID(),
    applicationId,
    isValidGeometry,
    isSelfIntersecting,
    overlapDetected,
    overlappingParcels,
    areaSqm,
    centroid,
    errorDetails,
    verifiedAt: new Date().toISOString(),
    passed,
  };
}

export function createInMemoryParcel(input: {
  parcelNumber: string;
  wkt: string;
  state?: string;
  lga?: string;
  address?: string;
}): LandParcelRecord {
  const verification = verifyWktParcel(input.wkt, 'create-parcel');
  if (!verification.isValidGeometry) {
    throw new Error(`Invalid geometry: ${verification.errorDetails}`);
  }
  if (verification.overlapDetected) {
    throw new Error(
      `Parcel overlaps existing parcels: ${verification.overlappingParcels.map((p) => p.parcelNumber).join(', ')}`,
    );
  }
  const ring = ringFromWkt(input.wkt);
  const now = new Date().toISOString();
  const parcel: LandParcelRecord = {
    id: crypto.randomUUID(),
    parcelNumber: input.parcelNumber,
    geometry: { type: 'Polygon', coordinates: [ring] },
    areaSqm: verification.areaSqm,
    state: input.state ?? 'Lagos',
    lga: input.lga ?? null,
    address: input.address ?? null,
    status: 'pending',
    ownerId: null,
    createdAt: now,
    updatedAt: now,
  };
  parcelsStore.unshift(parcel);
  return parcel;
}
