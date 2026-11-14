import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  GeometryValidationResult,
  OverlapDetectionResult,
  SpatialVerificationResult,
  LandParcel,
} from './interfaces/gis.interfaces';
import { VerifyParcelDto } from './dto/verify-parcel.dto';
import { CreateParcelDto } from './dto/create-parcel.dto';

@Injectable()
export class GisService {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  private mapParcelRow(row: any): LandParcel {
    return {
      id: row.id,
      parcelNumber: row.parcel_number,
      geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
      areaSqm: row.area_sqm !== null ? parseFloat(row.area_sqm) : null,
      state: row.state,
      lga: row.lga,
      address: row.address,
      status: row.status,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async validateParcelGeometry(wkt: string): Promise<GeometryValidationResult> {
    try {
      const result = await this.pool.query(
        `SELECT
          ST_IsValid(ST_GeomFromText($1, 4326)) AS is_valid,
          ST_IsValidReason(ST_GeomFromText($1, 4326)) AS reason`,
        [wkt],
      );
      const row = result.rows[0];
      const isValid: boolean = row.is_valid;
      const reason: string | null = row.reason !== 'Valid Geometry' ? row.reason : null;
      const isSelfIntersecting: boolean =
        !isValid && typeof row.reason === 'string' && row.reason.includes('Self-intersection');
      return { isValid, isSelfIntersecting, reason };
    } catch (err) {
      return {
        isValid: false,
        isSelfIntersecting: false,
        reason: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async detectOverlaps(
    wkt: string,
    excludeParcelId?: string,
  ): Promise<OverlapDetectionResult> {
    const result = await this.pool.query(
      `SELECT lp.id, lp.parcel_number,
        ST_Area(ST_Transform(ST_Intersection(lp.geometry, ST_Buffer(ST_GeomFromText($1, 4326), 0.000005)), 32632)) AS overlap_area_sqm
       FROM anagu.land_parcels lp
       WHERE ST_Intersects(lp.geometry, ST_Buffer(ST_GeomFromText($1, 4326), 0.000005))
         AND ($2::uuid IS NULL OR lp.id != $2::uuid)
         AND lp.status NOT IN ('revoked', 'cancelled')`,
      [wkt, excludeParcelId ?? null],
    );

    const overlappingParcels = result.rows.map((row) => ({
      id: row.id,
      parcelNumber: row.parcel_number,
      overlapAreaSqm: parseFloat(row.overlap_area_sqm) || 0,
    }));

    return {
      hasOverlap: overlappingParcels.length > 0,
      overlappingParcels,
    };
  }

  async calculateArea(wkt: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT ST_Area(ST_Transform(ST_GeomFromText($1, 4326), 32632)) AS area_sqm`,
      [wkt],
    );
    return parseFloat(result.rows[0].area_sqm) || 0;
  }

  async getCentroid(wkt: string): Promise<{ lat: number; lon: number }> {
    const result = await this.pool.query(
      `SELECT
        ST_Y(ST_Centroid(ST_GeomFromText($1, 4326))) AS lat,
        ST_X(ST_Centroid(ST_GeomFromText($1, 4326))) AS lon`,
      [wkt],
    );
    return {
      lat: parseFloat(result.rows[0].lat),
      lon: parseFloat(result.rows[0].lon),
    };
  }

  async verifyParcel(dto: VerifyParcelDto): Promise<SpatialVerificationResult> {
    const [validation, overlaps, areaSqm, centroid] = await Promise.all([
      this.validateParcelGeometry(dto.wkt),
      this.detectOverlaps(dto.wkt, dto.excludeParcelId),
      this.calculateArea(dto.wkt),
      this.getCentroid(dto.wkt),
    ]);

    const overlapDetected = overlaps.hasOverlap;
    const passed = validation.isValid && !overlapDetected;

    const insert = await this.pool.query(
      `INSERT INTO anagu.spatial_verifications
         (application_id, is_valid_geometry, is_self_intersecting,
          overlap_detected, overlapping_parcels, area_sqm,
          centroid_lat, centroid_lon, error_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, verified_at`,
      [
        dto.applicationId,
        validation.isValid,
        validation.isSelfIntersecting,
        overlapDetected,
        JSON.stringify(overlaps.overlappingParcels),
        areaSqm,
        centroid.lat,
        centroid.lon,
        validation.reason,
      ],
    );

    return {
      id: insert.rows[0].id,
      applicationId: dto.applicationId,
      isValidGeometry: validation.isValid,
      isSelfIntersecting: validation.isSelfIntersecting,
      overlapDetected,
      overlappingParcels: overlaps.overlappingParcels,
      areaSqm,
      centroid,
      errorDetails: validation.reason,
      verifiedAt: insert.rows[0].verified_at,
      passed,
    };
  }

  async getParcels(filters?: { status?: string; lga?: string }): Promise<LandParcel[]> {
    const status = filters?.status ?? null;
    const lga = filters?.lga ?? null;

    const result = await this.pool.query(
      `SELECT id, parcel_number,
         ST_AsGeoJSON(geometry) AS geometry,
         area_sqm, state, lga, address, status, owner_id,
         created_at, updated_at
       FROM anagu.land_parcels
       WHERE ($1::text IS NULL OR status = $1)
         AND ($2::text IS NULL OR lga = $2)
       ORDER BY created_at DESC`,
      [status, lga],
    );

    return result.rows.map((row) => this.mapParcelRow(row));
  }

  async getParcelById(id: string): Promise<LandParcel | null> {
    const result = await this.pool.query(
      `SELECT id, parcel_number,
         ST_AsGeoJSON(geometry) AS geometry,
         area_sqm, state, lga, address, status, owner_id,
         created_at, updated_at
       FROM anagu.land_parcels
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) return null;
    return this.mapParcelRow(result.rows[0]);
  }

  async createParcel(dto: CreateParcelDto): Promise<LandParcel> {
    const validation = await this.validateParcelGeometry(dto.wkt);
    if (!validation.isValid) {
      throw new Error(`Invalid geometry: ${validation.reason}`);
    }

    const overlaps = await this.detectOverlaps(dto.wkt);
    if (overlaps.hasOverlap) {
      throw new Error(
        `Parcel overlaps existing parcels: ${overlaps.overlappingParcels.map((p) => p.parcelNumber).join(', ')}`,
      );
    }

    const result = await this.pool.query(
      `INSERT INTO anagu.land_parcels
         (parcel_number, geometry, area_sqm, state, lga, address, status)
       SELECT $1,
              ST_GeomFromText($2, 4326),
              ST_Area(ST_Transform(ST_GeomFromText($2, 4326), 32632)),
              $3, $4, $5, $6
       RETURNING id, parcel_number,
         ST_AsGeoJSON(geometry) AS geometry,
         area_sqm, state, lga, address, status, owner_id,
         created_at, updated_at`,
      [
        dto.parcelNumber,
        dto.wkt,
        dto.state ?? 'Lagos',
        dto.lga ?? null,
        dto.address ?? null,
        'pending',
      ],
    );

    return this.mapParcelRow(result.rows[0]);
  }
}
