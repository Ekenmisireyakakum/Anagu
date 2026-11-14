export interface GeometryValidationResult {
  isValid: boolean;
  isSelfIntersecting: boolean;
  reason: string | null;
}

export interface OverlapDetectionResult {
  hasOverlap: boolean;
  overlappingParcels: Array<{
    id: string;
    parcelNumber: string;
    overlapAreaSqm: number;
  }>;
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
  verifiedAt: Date;
  passed: boolean;
}

export interface LandParcel {
  id: string;
  parcelNumber: string;
  geometry: any; // GeoJSON
  areaSqm: number | null;
  state: string;
  lga: string | null;
  address: string | null;
  status: string;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
