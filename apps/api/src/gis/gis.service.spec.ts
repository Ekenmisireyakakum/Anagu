import { Pool } from 'pg';
import { GisService } from './gis.service';

jest.setTimeout(30000);

describe('GisService Integration', () => {
  let pool: Pool;
  let service: GisService;
  const testParcelIds: string[] = [];
  const verificationIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://anagu:anagu_password@localhost:5432/anagu_db',
    });
    service = new GisService(pool);
  });

  afterAll(async () => {
    // Clean up test verifications
    if (verificationIds.length > 0) {
      await pool.query(
        'DELETE FROM anagu.spatial_verifications WHERE id = ANY($1)',
        [verificationIds],
      );
    }
    // Clean up test parcels
    if (testParcelIds.length > 0) {
      await pool.query(
        'DELETE FROM anagu.land_parcels WHERE id = ANY($1)',
        [testParcelIds],
      );
    }
    // Also delete any TEST- prefixed parcels in case of partial failure
    await pool.query(
      "DELETE FROM anagu.land_parcels WHERE parcel_number LIKE 'TEST-%'",
    );
    await pool.end();
  });

  // Test 1: validate a correct non-overlapping polygon
  it('should validate a correct non-overlapping polygon', async () => {
    // A polygon in Lagos coords well away from seed data
    const wkt =
      'POLYGON((3.3900 6.5300, 3.3914 6.5300, 3.3914 6.5290, 3.3900 6.5290, 3.3900 6.5300))';

    const validation = await service.validateParcelGeometry(wkt);
    expect(validation.isValid).toBe(true);
    expect(validation.isSelfIntersecting).toBe(false);

    // Also verify the full pipeline passes
    const applicationId = 'a0000000-0000-0000-0000-000000000001';
    const result = await service.verifyParcel({ wkt, applicationId });
    expect(result.passed).toBe(true);
    expect(result.isValidGeometry).toBe(true);
    verificationIds.push(result.id);
  });

  // Test 2: reject a self-intersecting polygon (bowtie)
  it('should reject a self-intersecting polygon (bowtie)', async () => {
    // Classic bowtie / figure-8 polygon
    const wkt =
      'POLYGON((3.3900 6.5400, 3.3920 6.5420, 3.3920 6.5400, 3.3900 6.5420, 3.3900 6.5400))';

    const validation = await service.validateParcelGeometry(wkt);
    expect(validation.isValid).toBe(false);
    expect(validation.isSelfIntersecting).toBe(true);
  });

  // Test 3: detect an overlapping parcel
  it('should detect an overlapping parcel', async () => {
    // Insert a TEST parcel at known coords
    const refWkt =
      'POLYGON((3.3100 6.4100, 3.3114 6.4100, 3.3114 6.4090, 3.3100 6.4090, 3.3100 6.4100))';
    const insert = await pool.query(
      `INSERT INTO anagu.land_parcels (parcel_number, geometry, state, status)
       VALUES ('TEST-OVERLAP-REF', ST_GeomFromText($1, 4326), 'Lagos', 'active')
       RETURNING id`,
      [refWkt],
    );
    testParcelIds.push(insert.rows[0].id);

    // Now test with a WKT that overlaps it
    const overlappingWkt =
      'POLYGON((3.3105 6.4105, 3.3119 6.4105, 3.3119 6.4095, 3.3105 6.4095, 3.3105 6.4105))';

    const result = await service.detectOverlaps(overlappingWkt);
    expect(result.hasOverlap).toBe(true);
    expect(result.overlappingParcels.length).toBeGreaterThan(0);
  });

  // Test 4: pass a parcel that is adjacent but not overlapping
  it('should pass a parcel that is adjacent but not overlapping', async () => {
    // Insert a TEST reference parcel
    const refWkt =
      'POLYGON((3.3200 6.4200, 3.3214 6.4200, 3.3214 6.4190, 3.3200 6.4190, 3.3200 6.4200))';
    const insert = await pool.query(
      `INSERT INTO anagu.land_parcels (parcel_number, geometry, state, status)
       VALUES ('TEST-ADJACENT-REF', ST_GeomFromText($1, 4326), 'Lagos', 'active')
       RETURNING id`,
      [refWkt],
    );
    testParcelIds.push(insert.rows[0].id);

    // Space the new parcel 0.0001 degrees away — clearly non-overlapping
    // Reference ends at lon 3.3214; new parcel starts at 3.3215 (gap of 0.0001 >> buffer of 0.000005)
    const adjacentWkt =
      'POLYGON((3.3215 6.4200, 3.3229 6.4200, 3.3229 6.4190, 3.3215 6.4190, 3.3215 6.4200))';

    const result = await service.detectOverlaps(adjacentWkt);
    expect(result.hasOverlap).toBe(false);
  });

  // Test 5: correctly calculate area in sqm
  it('should correctly calculate area in sqm', async () => {
    // LG-VI-001 coords: ~0.0014° lon × 0.001° lat box near Lagos
    // At lat 6.43°N: lon degree ≈ 110,620m, lat degree ≈ 110,540m
    // Expected area ≈ (0.0014 × 110,620) × (0.001 × 110,540) ≈ 154.9m × 110.5m ≈ 17,100 m²
    const wkt =
      'POLYGON((3.4201 6.4290, 3.4215 6.4290, 3.4215 6.4280, 3.4201 6.4280, 3.4201 6.4290))';

    const area = await service.calculateArea(wkt);
    // Should be approximately 17,000 m², accept within 20% tolerance (13,600 - 20,500)
    expect(area).toBeGreaterThan(13600);
    expect(area).toBeLessThan(20500);
  });

  // Test 6: detect a slightly rotated overlap
  it('should detect a slightly rotated overlap', async () => {
    // Insert a TEST reference parcel
    const refWkt =
      'POLYGON((3.3300 6.4300, 3.3314 6.4300, 3.3314 6.4290, 3.3300 6.4290, 3.3300 6.4300))';
    const insert = await pool.query(
      `INSERT INTO anagu.land_parcels (parcel_number, geometry, state, status)
       VALUES ('TEST-ROTATE-REF', ST_GeomFromText($1, 4326), 'Lagos', 'active')
       RETURNING id`,
      [refWkt],
    );
    testParcelIds.push(insert.rows[0].id);

    // A slightly rotated/shifted polygon that still significantly overlaps the reference
    // Shifted by ~0.0005 degrees (about 50m) — well within the reference polygon
    const rotatedWkt =
      'POLYGON((3.3303 6.4302, 3.3317 6.4299, 3.3317 6.4289, 3.3303 6.4292, 3.3303 6.4302))';

    const result = await service.detectOverlaps(rotatedWkt);
    expect(result.hasOverlap).toBe(true);
  });
});
