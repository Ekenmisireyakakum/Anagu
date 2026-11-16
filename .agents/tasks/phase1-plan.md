# Implementation Plan — Phase 1: GIS Foundation

**Workspace root:** `C:\Users\StarLab\Desktop\Library\Anagu`

## Exploration findings

- `apps/api/src` does **not exist** — the entire NestJS source tree must be created from scratch.
- `apps/web/src` does **not exist** — the entire Next.js source tree must be created from scratch.
- Both `apps/api` and `apps/web` have only `package.json` + `tsconfig.json` today.
- `apps/api/tsconfig.json` already has `emitDecoratorMetadata: true` and `experimentalDecorators: true` — no changes needed.
- `apps/api/package.json` has `pg ^8.12.0`, `class-validator`, `class-transformer`, `@nestjs/config`, `jest`, `ts-jest` — no missing runtime deps except `@types/pg`.
- `apps/web/package.json` has Next.js 14, React 18, Tailwind 3, postcss, autoprefixer — missing: `leaflet`, `react-leaflet`, `leaflet-draw`, `@types/leaflet`, `axios`.
- `packages/database/prisma/schema.prisma` maps `LandParcel` → table `land_parcels` (no schema prefix, public schema). The raw SQL migration must use the `anagu` schema with fully qualified table name `anagu.land_parcels`.
- `infrastructure/postgres/init.sql` creates the `anagu` schema and enables PostGIS, uuid-ossp, pg_trgm on first container boot.
- Docker containers running: `anagu_postgres` (postgis/postgis:17-3.5), `anagu_redis`, `anagu_minio`, `anagu_mosquitto`.
- Database credentials: user=`anagu`, password=`anagu_password`, db=`anagu_db`, host=`localhost`, port=`5432`.
- `DATABASE_URL=postgresql://anagu:anagu_password@localhost:5432/anagu_db` is in `.env`.
- `apps/api` jest config lives in `package.json` (no separate jest config file); uses `ts-jest`.
- NestJS CLI is in devDependencies — `nest build` and `npx tsc --noEmit` are the compile checks.

---

## Implementation Steps

- [ ] 1. Install missing npm dependencies in `apps/api` and `apps/web`.
      - In `apps/api`: add `@types/pg ^8.6.6` to devDependencies.
      - In `apps/web`: add `leaflet ^1.9.4`, `react-leaflet ^4.2.1`, `leaflet-draw ^1.0.4` to dependencies; add `@types/leaflet ^1.9.12`, `axios ^1.7.2` to devDependencies.
      - Run from workspace root (npm workspaces): `npm install --workspace=apps/api --save-dev @types/pg@8.6.6` then `npm install --workspace=apps/web leaflet@1.9.4 react-leaflet@4.2.1 leaflet-draw@1.0.4 axios@1.7.2` and `npm install --workspace=apps/web --save-dev @types/leaflet@1.9.12`.
      - **Important:** Run all npm commands from `C:\Users\StarLab\Desktop\Library\Anagu` (the monorepo root) to respect workspaces.
      - Files: `apps/api/package.json`, `apps/web/package.json`
      - Verify: `node -e "require('pg')"` in `apps/api` node_modules; check `node_modules/leaflet` exists under `apps/web` or root node_modules.

- [ ] 2. Create the SQL migration `001_gis_tables.sql`.
      - This creates the PostGIS-backed spatial tables in the `anagu` schema.
      - File: `packages/database/migrations/001_gis_tables.sql`
      - Content strategy:
        ```sql
        -- Set search path so unqualified names land in anagu schema
        SET search_path TO anagu, public;

        -- Enable PostGIS (may already be enabled by init.sql, IF NOT EXISTS is safe)
        CREATE EXTENSION IF NOT EXISTS postgis;
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- land_parcels: core spatial table
        CREATE TABLE IF NOT EXISTS anagu.land_parcels (
          id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          parcel_number  VARCHAR(50)  NOT NULL UNIQUE,
          geometry       GEOMETRY(POLYGON, 4326) NOT NULL,
          area_sqm       NUMERIC(14,4),
          state          VARCHAR(100) NOT NULL DEFAULT 'Lagos',
          lga            VARCHAR(100),
          address        TEXT,
          status         VARCHAR(20)  NOT NULL DEFAULT 'active'
                           CONSTRAINT land_parcels_status_check
                           CHECK (status IN ('active','pending','revoked','disputed')),
          owner_id       UUID,
          created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        -- GIST index for spatial queries
        CREATE INDEX IF NOT EXISTS land_parcels_geometry_gist
          ON anagu.land_parcels USING GIST (geometry);

        -- spatial_verifications: results of each GIS check run
        CREATE TABLE IF NOT EXISTS anagu.spatial_verifications (
          id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          application_id       UUID NOT NULL,
          parcel_id            UUID REFERENCES anagu.land_parcels(id) ON DELETE SET NULL,
          is_valid_geometry    BOOLEAN NOT NULL DEFAULT FALSE,
          is_self_intersecting BOOLEAN NOT NULL DEFAULT FALSE,
          overlap_detected     BOOLEAN NOT NULL DEFAULT FALSE,
          overlapping_parcels  JSONB,
          area_sqm             NUMERIC(14,4),
          centroid_lat         DOUBLE PRECISION,
          centroid_lon         DOUBLE PRECISION,
          error_details        TEXT,
          verified_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- updated_at auto-update trigger function
        CREATE OR REPLACE FUNCTION anagu.set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$;

        -- Attach trigger to land_parcels
        DROP TRIGGER IF EXISTS land_parcels_updated_at ON anagu.land_parcels;
        CREATE TRIGGER land_parcels_updated_at
          BEFORE UPDATE ON anagu.land_parcels
          FOR EACH ROW EXECUTE FUNCTION anagu.set_updated_at();
        ```
      - Verify (after running migration in step 4): `docker exec anagu_postgres psql -U anagu -d anagu_db -c "\dt anagu.*"` — lists `anagu.land_parcels` and `anagu.spatial_verifications`.

- [ ] 3. Create the SQL seed `002_seed_lagos_parcels.sql`.
      - Inserts 10 non-overlapping Lagos parcels as WGS84 polygons across 5 LGAs.
      - All coordinates in WGS84 (lon 3.3–3.5°E, lat 6.4–6.6°N). Each polygon is a small rectangle (~150m × 150m) using ST_GeomFromText with SRID 4326.
      - File: `packages/database/migrations/002_seed_lagos_parcels.sql`
      - Content strategy — 10 INSERT statements, one per parcel. Use unique, non-overlapping bounding boxes:
        ```sql
        SET search_path TO anagu, public;

        INSERT INTO anagu.land_parcels
          (parcel_number, geometry, state, lga, address, status)
        VALUES
        -- Victoria Island (1–2)
        ('LG-VI-001',
         ST_GeomFromText('POLYGON((3.4100 6.4300, 3.4115 6.4300, 3.4115 6.4315, 3.4100 6.4315, 3.4100 6.4300))', 4326),
         'Lagos', 'Eti-Osa', '14 Ahmadu Bello Way, Victoria Island', 'active'),
        ('LG-VI-002',
         ST_GeomFromText('POLYGON((3.4120 6.4300, 3.4135 6.4300, 3.4135 6.4315, 3.4120 6.4315, 3.4120 6.4300))', 4326),
         'Lagos', 'Eti-Osa', '28 Ozumba Mbadiwe Ave, Victoria Island', 'pending'),
        -- Lekki (3–4)
        ('LG-LK-001',
         ST_GeomFromText('POLYGON((3.4700 6.4350, 3.4715 6.4350, 3.4715 6.4365, 3.4700 6.4365, 3.4700 6.4350))', 4326),
         'Lagos', 'Eti-Osa', '5 Admiralty Way, Lekki Phase 1', 'active'),
        ('LG-LK-002',
         ST_GeomFromText('POLYGON((3.4720 6.4350, 3.4735 6.4350, 3.4735 6.4365, 3.4720 6.4365, 3.4720 6.4350))', 4326),
         'Lagos', 'Eti-Osa', '19 Lekki-Epe Expressway, Lekki', 'active'),
        -- Ikeja (5–6)
        ('LG-IK-001',
         ST_GeomFromText('POLYGON((3.3480 6.5950, 3.3495 6.5950, 3.3495 6.5965, 3.3480 6.5965, 3.3480 6.5950))', 4326),
         'Lagos', 'Ikeja', '1 Obafemi Awolowo Way, Ikeja', 'active'),
        ('LG-IK-002',
         ST_GeomFromText('POLYGON((3.3500 6.5950, 3.3515 6.5950, 3.3515 6.5965, 3.3500 6.5965, 3.3500 6.5950))', 4326),
         'Lagos', 'Ikeja', '34 Allen Avenue, Ikeja', 'disputed'),
        -- Surulere (7–8)
        ('LG-SR-001',
         ST_GeomFromText('POLYGON((3.3600 6.4980, 3.3615 6.4980, 3.3615 6.4995, 3.3600 6.4995, 3.3600 6.4980))', 4326),
         'Lagos', 'Surulere', '7 Bode Thomas Street, Surulere', 'active'),
        ('LG-SR-002',
         ST_GeomFromText('POLYGON((3.3620 6.4980, 3.3635 6.4980, 3.3635 6.4995, 3.3620 6.4995, 3.3620 6.4980))', 4326),
         'Lagos', 'Surulere', '21 Western Avenue, Surulere', 'active'),
        -- Yaba (9–10)
        ('LG-YB-001',
         ST_GeomFromText('POLYGON((3.3730 6.5080, 3.3745 6.5080, 3.3745 6.5095, 3.3730 6.5095, 3.3730 6.5080))', 4326),
         'Lagos', 'Lagos Mainland', '2 Herbert Macaulay Way, Yaba', 'active'),
        ('LG-YB-002',
         ST_GeomFromText('POLYGON((3.3750 6.5080, 3.3765 6.5080, 3.3765 6.5095, 3.3750 6.5095, 3.3750 6.5080))', 4326),
         'Lagos', 'Lagos Mainland', '15 Commercial Avenue, Yaba', 'revoked')
        ON CONFLICT (parcel_number) DO NOTHING;
        ```
      - Verify (after running in step 4): `docker exec anagu_postgres psql -U anagu -d anagu_db -c "SELECT COUNT(*) FROM anagu.land_parcels;"` → returns 10.

- [ ] 4. Run the SQL migrations against the running `anagu_postgres` container.
      - Execute migrations in order. The commands below use PowerShell's `Get-Content` pipe to `docker exec -i` (Windows-safe approach — no `<` redirect in PowerShell).
      - **Command sequence (run from workspace root):**
        ```powershell
        # Migration 001
        Get-Content "packages\database\migrations\001_gis_tables.sql" | docker exec -i anagu_postgres psql -U anagu -d anagu_db

        # Migration 002 (seed)
        Get-Content "packages\database\migrations\002_seed_lagos_parcels.sql" | docker exec -i anagu_postgres psql -U anagu -d anagu_db
        ```
      - Verify tables exist:
        ```powershell
        docker exec anagu_postgres psql -U anagu -d anagu_db -c "\dt anagu.*"
        ```
        Expected: `anagu.land_parcels`, `anagu.spatial_verifications` both appear.
      - Verify PostGIS functions work:
        ```powershell
        docker exec anagu_postgres psql -U anagu -d anagu_db -c "SELECT ST_IsValid(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 1,0 0))',4326)), ST_Intersects(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 1,0 0))',4326), ST_GeomFromText('POLYGON((0.5 0.5,1.5 0.5,1.5 1.5,0.5 1.5,0.5 0.5))',4326));"
        ```
        Expected: `t | t`
      - Verify 10 seed rows:
        ```powershell
        docker exec anagu_postgres psql -U anagu -d anagu_db -c "SELECT COUNT(*) FROM anagu.land_parcels;"
        ```
        Expected: `10`

- [ ] 5. Create the NestJS app bootstrap files.
      - Depends on: nothing (creates the src directory structure).
      - **File: `apps/api/src/database/database.providers.ts`**
        ```typescript
        import { Pool } from 'pg';

        export const databaseProviders = [
          {
            provide: 'DATABASE_POOL',
            useFactory: (): Pool => {
              const pool = new Pool({
                connectionString: process.env.DATABASE_URL ||
                  `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}` +
                  `@${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || 5432}/${process.env.DATABASE_NAME}`,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
              });
              return pool;
            },
          },
        ];
        ```
      - **File: `apps/api/src/database/database.module.ts`**
        ```typescript
        import { Module } from '@nestjs/common';
        import { databaseProviders } from './database.providers';

        @Module({
          providers: [...databaseProviders],
          exports: [...databaseProviders],
        })
        export class DatabaseModule {}
        ```
      - **File: `apps/api/src/app.module.ts`**
        ```typescript
        import { Module } from '@nestjs/common';
        import { ConfigModule } from '@nestjs/config';
        import { GisModule } from './gis/gis.module';

        @Module({
          imports: [
            ConfigModule.forRoot({ isGlobal: true }),
            GisModule,
          ],
        })
        export class AppModule {}
        ```
      - **File: `apps/api/src/main.ts`**
        ```typescript
        import { NestFactory } from '@nestjs/core';
        import { ValidationPipe } from '@nestjs/common';
        import { AppModule } from './app.module';

        async function bootstrap() {
          const app = await NestFactory.create(AppModule);
          app.setGlobalPrefix('api');
          app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
          app.enableCors({ origin: '*' });
          const port = process.env.API_PORT || 3001;
          await app.listen(port);
          console.log(`ANAGU API running on port ${port}`);
        }
        bootstrap();
        ```
      - Files: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/database/database.module.ts`, `apps/api/src/database/database.providers.ts`
      - Verify: `cd apps/api && npx tsc --noEmit` (run after step 7 when all GIS files exist so imports resolve).

- [ ] 6. Create the GIS interfaces and DTOs.
      - Depends on: step 5 (src directory exists).
      - **File: `apps/api/src/gis/interfaces/gis.interfaces.ts`**
        ```typescript
        export interface GeometryValidationResult {
          isValid: boolean;
          isSelfIntersecting: boolean;
          errorDetails?: string;
        }

        export interface OverlapDetectionResult {
          overlapDetected: boolean;
          overlappingParcels: Array<{
            id: string;
            parcelNumber: string;
            overlapAreaSqm?: number;
          }>;
        }

        export interface SpatialVerificationResult {
          id: string;
          applicationId: string;
          parcelId?: string;
          isValidGeometry: boolean;
          isSelfIntersecting: boolean;
          overlapDetected: boolean;
          overlappingParcels: Array<{
            id: string;
            parcelNumber: string;
            overlapAreaSqm?: number;
          }>;
          areaSqm?: number;
          centroidLat?: number;
          centroidLon?: number;
          errorDetails?: string;
          verifiedAt: Date;
        }

        export interface LandParcel {
          id: string;
          parcelNumber: string;
          geometry?: any;        // GeoJSON when fetched with ST_AsGeoJSON
          geometryWkt?: string;  // WKT when needed
          areaSqm?: number;
          state: string;
          lga?: string;
          address?: string;
          status: 'active' | 'pending' | 'revoked' | 'disputed';
          ownerId?: string;
          createdAt: Date;
          updatedAt: Date;
        }
        ```
      - **File: `apps/api/src/gis/dto/verify-parcel.dto.ts`**
        ```typescript
        import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

        export class VerifyParcelDto {
          @IsString()
          @IsNotEmpty()
          geometryWkt: string;   // WKT POLYGON string from client

          @IsOptional()
          @IsUUID()
          applicationId?: string;

          @IsOptional()
          @IsUUID()
          parcelId?: string;
        }
        ```
      - **File: `apps/api/src/gis/dto/create-parcel.dto.ts`**
        ```typescript
        import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

        export class CreateParcelDto {
          @IsString()
          @IsNotEmpty()
          parcelNumber: string;

          @IsString()
          @IsNotEmpty()
          geometryWkt: string;   // WKT POLYGON in SRID 4326

          @IsOptional()
          @IsString()
          state?: string;

          @IsOptional()
          @IsString()
          lga?: string;

          @IsOptional()
          @IsString()
          address?: string;

          @IsOptional()
          @IsString()
          status?: string;

          @IsOptional()
          @IsString()
          ownerId?: string;
        }
        ```
      - Files: `apps/api/src/gis/interfaces/gis.interfaces.ts`, `apps/api/src/gis/dto/verify-parcel.dto.ts`, `apps/api/src/gis/dto/create-parcel.dto.ts`
      - Verify: These are plain TypeScript, no compile step needed yet; verified with the full tsc check in step 10.

- [ ] 7. Create `GisService` with 8 spatial methods.
      - Depends on: steps 5–6.
      - File: `apps/api/src/gis/gis.service.ts`
      - Use `@Inject('DATABASE_POOL') private readonly pool: Pool` — raw `pg.Pool`, no TypeORM or Prisma.
      - Implement all 8 methods as described below. All spatial SQL uses fully qualified `anagu.land_parcels` and `anagu.spatial_verifications`.

      **Method signatures and SQL strategy:**

      **`validateParcelGeometry(wkt: string): Promise<GeometryValidationResult>`**
      ```sql
      SELECT
        ST_IsValid(ST_GeomFromText($1, 4326))          AS is_valid,
        ST_IsSimple(ST_GeomFromText($1, 4326))         AS is_simple,
        ST_IsValidReason(ST_GeomFromText($1, 4326))    AS reason
      ```
      - `isSelfIntersecting = !is_simple`; wrap in try/catch — a parse error means invalid geometry.

      **`detectOverlaps(wkt: string, excludeParcelId?: string): Promise<OverlapDetectionResult>`**
      ```sql
      SELECT id, parcel_number,
        ST_Area(
          ST_Transform(
            ST_Intersection(geometry, ST_Buffer(ST_GeomFromText($1, 4326), 0.000005)),
            32632
          )
        ) AS overlap_area_sqm
      FROM anagu.land_parcels
      WHERE ST_Intersects(geometry, ST_Buffer(ST_GeomFromText($1, 4326), 0.000005))
        AND ($2::uuid IS NULL OR id != $2::uuid)
        AND status != 'revoked'
      ```
      - Pass `excludeParcelId ?? null` as `$2`.

      **`calculateArea(wkt: string): Promise<number>`**
      ```sql
      SELECT ST_Area(ST_Transform(ST_GeomFromText($1, 4326), 32632)) AS area_sqm
      ```
      - EPSG:32632 = UTM Zone 32N, appropriate for Nigeria (longitude 6°E–12°E covers Lagos at ~3.4°E; use 32631 instead — UTM Zone 31N covers 0°–6°E which includes Lagos at 3.3–3.5°E).
      - **Correction:** Lagos longitude is ~3.3–3.5°E, which falls in UTM Zone 31N (EPSG:32631). Use `ST_Transform(..., 32631)` for area calculations.

      **`getCentroid(wkt: string): Promise<{ lat: number; lon: number }>`**
      ```sql
      SELECT
        ST_Y(ST_Centroid(ST_GeomFromText($1, 4326))) AS lat,
        ST_X(ST_Centroid(ST_GeomFromText($1, 4326))) AS lon
      ```

      **`verifyParcel(dto: VerifyParcelDto): Promise<SpatialVerificationResult>`**
      - Calls `validateParcelGeometry`, `detectOverlaps`, `calculateArea`, `getCentroid` in parallel using `Promise.all`.
      - Assembles result object, then saves it to `anagu.spatial_verifications`:
        ```sql
        INSERT INTO anagu.spatial_verifications
          (application_id, parcel_id, is_valid_geometry, is_self_intersecting,
           overlap_detected, overlapping_parcels, area_sqm, centroid_lat, centroid_lon, error_details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        ```
      - `applicationId` defaults to `uuid_generate_v4()` SQL call if not supplied by client (pass `dto.applicationId ?? null`; use `COALESCE($1, uuid_generate_v4())` in SQL).

      **`getParcels(filters?: { status?: string; lga?: string }): Promise<LandParcel[]>`**
      ```sql
      SELECT id, parcel_number,
        ST_AsGeoJSON(geometry)::json AS geometry,
        area_sqm, state, lga, address, status, owner_id,
        created_at, updated_at
      FROM anagu.land_parcels
      WHERE ($1::text IS NULL OR status = $1)
        AND ($2::text IS NULL OR lga = $2)
      ORDER BY created_at DESC
      ```
      - Map snake_case DB columns to camelCase in a `mapRow()` helper inside the service.

      **`getParcelById(id: string): Promise<LandParcel | null>`**
      ```sql
      SELECT id, parcel_number,
        ST_AsGeoJSON(geometry)::json AS geometry,
        area_sqm, state, lga, address, status, owner_id,
        created_at, updated_at
      FROM anagu.land_parcels
      WHERE id = $1
      ```

      **`createParcel(dto: CreateParcelDto): Promise<LandParcel>`**
      ```sql
      INSERT INTO anagu.land_parcels
        (parcel_number, geometry, state, lga, address, status, owner_id)
      VALUES
        ($1, ST_GeomFromText($2, 4326), $3, $4, $5, $6, $7)
      RETURNING id, parcel_number,
        ST_AsGeoJSON(geometry)::json AS geometry,
        area_sqm, state, lga, address, status, owner_id,
        created_at, updated_at
      ```
      - Use area trigger? No — compute area explicitly after insert: add an `UPDATE anagu.land_parcels SET area_sqm = ST_Area(ST_Transform(geometry,32631)) WHERE id = ...` or inline it in the INSERT as a subquery. Preferred approach: compute in the INSERT using a subquery:
        ```sql
        INSERT INTO anagu.land_parcels
          (parcel_number, geometry, area_sqm, state, lga, address, status, owner_id)
        SELECT $1,
               ST_GeomFromText($2, 4326),
               ST_Area(ST_Transform(ST_GeomFromText($2, 4326), 32631)),
               $3, $4, $5, $6, $7
        RETURNING ...
        ```

      - Full file skeleton:
        ```typescript
        import { Injectable, Inject, NotFoundException } from '@nestjs/common';
        import { Pool } from 'pg';
        import { GeometryValidationResult, OverlapDetectionResult, SpatialVerificationResult, LandParcel } from './interfaces/gis.interfaces';
        import { VerifyParcelDto } from './dto/verify-parcel.dto';
        import { CreateParcelDto } from './dto/create-parcel.dto';

        @Injectable()
        export class GisService {
          constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

          private mapParcelRow(row: any): LandParcel { /* camelCase mapping */ }

          async validateParcelGeometry(wkt: string): Promise<GeometryValidationResult> { ... }
          async detectOverlaps(wkt: string, excludeParcelId?: string): Promise<OverlapDetectionResult> { ... }
          async calculateArea(wkt: string): Promise<number> { ... }
          async getCentroid(wkt: string): Promise<{ lat: number; lon: number }> { ... }
          async verifyParcel(dto: VerifyParcelDto): Promise<SpatialVerificationResult> { ... }
          async getParcels(filters?: { status?: string; lga?: string }): Promise<LandParcel[]> { ... }
          async getParcelById(id: string): Promise<LandParcel | null> { ... }
          async createParcel(dto: CreateParcelDto): Promise<LandParcel> { ... }
        }
        ```
      - Files: `apps/api/src/gis/gis.service.ts`
      - Verify: `cd apps/api && npx tsc --noEmit` after step 8 when controller and module are also present.

- [ ] 8. Create `GisController` and `GisModule`.
      - Depends on: steps 5–7.
      - **File: `apps/api/src/gis/gis.controller.ts`**
        ```typescript
        import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
        import { GisService } from './gis.service';
        import { VerifyParcelDto } from './dto/verify-parcel.dto';
        import { CreateParcelDto } from './dto/create-parcel.dto';

        @Controller('gis')
        export class GisController {
          constructor(private readonly gisService: GisService) {}

          // POST /api/gis/verify
          @Post('verify')
          verifyParcel(@Body() dto: VerifyParcelDto) {
            return this.gisService.verifyParcel(dto);
          }

          // GET /api/gis/parcels?status=active&lga=Ikeja
          @Get('parcels')
          getParcels(
            @Query('status') status?: string,
            @Query('lga') lga?: string,
          ) {
            return this.gisService.getParcels({ status, lga });
          }

          // GET /api/gis/parcels/:id
          @Get('parcels/:id')
          async getParcelById(@Param('id') id: string) {
            const parcel = await this.gisService.getParcelById(id);
            if (!parcel) throw new NotFoundException(`Parcel ${id} not found`);
            return parcel;
          }

          // POST /api/gis/parcels
          @Post('parcels')
          createParcel(@Body() dto: CreateParcelDto) {
            return this.gisService.createParcel(dto);
          }

          // GET /api/gis/parcels/:id/geojson
          @Get('parcels/:id/geojson')
          async getParcelGeoJson(@Param('id') id: string) {
            const parcel = await this.gisService.getParcelById(id);
            if (!parcel) throw new NotFoundException(`Parcel ${id} not found`);
            return {
              type: 'Feature',
              geometry: parcel.geometry,
              properties: {
                id: parcel.id,
                parcelNumber: parcel.parcelNumber,
                status: parcel.status,
                areaSqm: parcel.areaSqm,
                lga: parcel.lga,
                address: parcel.address,
              },
            };
          }
        }
        ```
      - **File: `apps/api/src/gis/gis.module.ts`**
        ```typescript
        import { Module } from '@nestjs/common';
        import { DatabaseModule } from '../database/database.module';
        import { GisService } from './gis.service';
        import { GisController } from './gis.controller';

        @Module({
          imports: [DatabaseModule],
          controllers: [GisController],
          providers: [GisService],
          exports: [GisService],
        })
        export class GisModule {}
        ```
      - Files: `apps/api/src/gis/gis.controller.ts`, `apps/api/src/gis/gis.module.ts`
      - Verify: `cd apps/api && npx tsc --noEmit` — zero TypeScript errors expected.

- [ ] 9. Add Jest config to `apps/api/package.json` and create `gis.service.spec.ts`.
      - Depends on: steps 5–8 (service must exist).
      - Add a `jest` section to `apps/api/package.json` (NestJS projects typically add this):
        ```json
        "jest": {
          "moduleFileExtensions": ["js","json","ts"],
          "rootDir": "src",
          "testRegex": ".*\\.spec\\.ts$",
          "transform": { "^.+\\.(t|j)s$": "ts-jest" },
          "collectCoverageFrom": ["**/*.(t|j)s"],
          "coverageDirectory": "../coverage",
          "testEnvironment": "node"
        }
        ```
      - **File: `apps/api/src/gis/gis.service.spec.ts`**
      - Uses real PostgreSQL — connects to `postgresql://anagu:anagu_password@localhost:5432/anagu_db` via `DATABASE_URL` env var or the default string above.
      - Test setup: creates a `Pool` directly (no NestJS test module needed for integration tests), instantiates `GisService` by passing pool to constructor.
      - **6 test cases:**

        **Test 1 — `validateParcelGeometry`: valid polygon**
        ```
        Input: 'POLYGON((3.41 6.43, 3.42 6.43, 3.42 6.44, 3.41 6.44, 3.41 6.43))'
        Expect: { isValid: true, isSelfIntersecting: false }
        ```

        **Test 2 — `validateParcelGeometry`: self-intersecting (bowtie)**
        ```
        Input: 'POLYGON((0 0, 1 1, 1 0, 0 1, 0 0))'  — figure-8 / bowtie
        Expect: { isValid: false } OR { isSelfIntersecting: true }
        Note: PostGIS ST_IsValid returns false for self-intersecting; ST_IsSimple returns false.
              Accept either flag being true.
        ```

        **Test 3 — `detectOverlaps`: no overlap with seed data**
        ```
        Input WKT: a small polygon far from seed data, e.g. around lon 3.30, lat 6.40
        'POLYGON((3.300 6.400, 3.301 6.400, 3.301 6.401, 3.300 6.401, 3.300 6.400))'
        Expect: { overlapDetected: false, overlappingParcels: [] }
        ```

        **Test 4 — `detectOverlaps`: detects overlap with seed parcel LG-VI-001**
        ```
        Input WKT: polygon overlapping LG-VI-001 at (3.410–3.4115, 6.430–6.4315)
        Use: 'POLYGON((3.4105 6.4305, 3.4120 6.4305, 3.4120 6.4320, 3.4105 6.4320, 3.4105 6.4305))'
        Expect: { overlapDetected: true, overlappingParcels: array with length >= 1 }
        ```

        **Test 5 — `calculateArea`: reasonable area for a Lagos parcel**
        ```
        Input: 'POLYGON((3.41 6.43, 3.42 6.43, 3.42 6.44, 3.41 6.44, 3.41 6.43))'
        Expect: area > 0 (should be ~1.2 km² for 0.01° × 0.01° box near equator)
        ```

        **Test 6 — `verifyParcel`: full pipeline saves to DB and returns result**
        ```
        Input dto: { geometryWkt: 'POLYGON((3.300 6.410, 3.301 6.410, 3.301 6.411, 3.300 6.411, 3.300 6.410))' }
        Expect: result.isValidGeometry === true, result.id is a UUID string, result.verifiedAt instanceof Date
        ```

      - **Setup/teardown pattern:**
        ```typescript
        import { Pool } from 'pg';
        import { GisService } from './gis.service';

        describe('GisService Integration', () => {
          let pool: Pool;
          let service: GisService;
          const verificationIds: string[] = [];

          beforeAll(async () => {
            pool = new Pool({
              connectionString: process.env.DATABASE_URL ||
                'postgresql://anagu:anagu_password@localhost:5432/anagu_db',
            });
            service = new GisService(pool);
          });

          afterAll(async () => {
            // Clean up any spatial_verifications rows created by tests
            if (verificationIds.length > 0) {
              await pool.query(
                'DELETE FROM anagu.spatial_verifications WHERE id = ANY($1)',
                [verificationIds],
              );
            }
            await pool.end();
          });

          // ... tests here, pushing result.id to verificationIds in test 6
        });
        ```
      - Files: `apps/api/src/gis/gis.service.spec.ts`, `apps/api/package.json` (jest config section added)
      - Verify: `cd apps/api && npx jest --testPathPattern=gis.service.spec` — all 6 tests pass. (Requires `anagu_postgres` to be running and migrations applied from step 4.)

- [ ] 10. TypeScript compile check for the full API app.
      - Depends on: steps 5–9.
      - Run: `cd C:\Users\StarLab\Desktop\Library\Anagu\apps\api && npx tsc --noEmit`
      - Expected: zero errors.
      - If errors appear: check that `@types/pg` is installed (step 1), that `reflect-metadata` is imported in `main.ts` as the first import (`import 'reflect-metadata';`), and that NestJS decorator imports are from `@nestjs/common`.
      - **Important:** `main.ts` must have `import 'reflect-metadata';` as its very first line for `emitDecoratorMetadata` to work at runtime (it's already in `package.json` dependencies as `reflect-metadata ^0.2.2`).

- [ ] 11. Create Next.js web app source files — config and layout.
      - Depends on: step 1 (packages installed).
      - **File: `apps/web/next.config.js`**
        ```javascript
        /** @type {import('next').NextConfig} */
        const nextConfig = {
          reactStrictMode: true,
          // Allow leaflet CSS to be imported from node_modules
          transpilePackages: [],
        };
        module.exports = nextConfig;
        ```
      - **File: `apps/web/tailwind.config.js`**
        ```javascript
        /** @type {import('tailwindcss').Config} */
        module.exports = {
          content: [
            './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
            './src/components/**/*.{js,ts,jsx,tsx,mdx}',
            './src/app/**/*.{js,ts,jsx,tsx,mdx}',
          ],
          theme: { extend: {} },
          plugins: [],
        };
        ```
      - **File: `apps/web/postcss.config.js`**
        ```javascript
        module.exports = {
          plugins: { tailwindcss: {}, autoprefixer: {} },
        };
        ```
      - **File: `apps/web/tsconfig.json`** — verify it has `"paths": { "@/*": ["./src/*"] }` for `@/` imports; if not present, add it. The existing tsconfig.json only has `package.json` and `tsconfig.json` so this needs to be fully created:
        ```json
        {
          "compilerOptions": {
            "target": "ES2017",
            "lib": ["dom", "dom.iterable", "esnext"],
            "allowJs": true,
            "skipLibCheck": true,
            "strict": false,
            "forceConsistentCasingInFileNames": true,
            "noEmit": true,
            "esModuleInterop": true,
            "module": "esnext",
            "moduleResolution": "bundler",
            "resolveJsonModule": true,
            "isolatedModules": true,
            "jsx": "preserve",
            "incremental": true,
            "plugins": [{ "name": "next" }],
            "paths": { "@/*": ["./src/*"] }
          },
          "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          "exclude": ["node_modules"]
        }
        ```
        **Note:** This overwrites the existing stub tsconfig.json.
      - **File: `apps/web/src/app/globals.css`**
        ```css
        @tailwind base;
        @tailwind components;
        @tailwind utilities;

        /* Leaflet CSS — imported in GisMap.tsx via dynamic import side-effect */
        ```
      - **File: `apps/web/src/app/layout.tsx`**
        ```typescript
        import type { Metadata } from 'next';
        import { Inter } from 'next/font/google';
        import './globals.css';

        const inter = Inter({ subsets: ['latin'] });

        export const metadata: Metadata = {
          title: 'ANAGU - Land Administration Platform',
          description: 'Blockchain-powered land administration for Nigeria',
        };

        export default function RootLayout({ children }: { children: React.ReactNode }) {
          return (
            <html lang="en">
              <body className={inter.className}>{children}</body>
            </html>
          );
        }
        ```
      - **File: `apps/web/src/app/page.tsx`**
        ```typescript
        import Link from 'next/link';

        export default function HomePage() {
          return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
              <div className="text-center space-y-6 p-8">
                <h1 className="text-4xl font-bold text-gray-900">ANAGU</h1>
                <p className="text-xl text-gray-600">Land Administration Platform</p>
                <Link
                  href="/map"
                  className="inline-block bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Open GIS Map
                </Link>
              </div>
            </main>
          );
        }
        ```
      - Files: `apps/web/next.config.js`, `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`, `apps/web/tsconfig.json`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
      - Verify: `cd apps/web && npx next build` — no errors on these files specifically (full build runs after all web files are created in steps 11–15).

- [ ] 12. Create the web utility libraries.
      - Depends on: step 11 (src directory exists).
      - **File: `apps/web/src/lib/api.ts`**
        ```typescript
        import axios from 'axios';

        const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        export const apiClient = axios.create({
          baseURL,
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        });

        export const gisApi = {
          getParcels: (params?: { status?: string; lga?: string }) =>
            apiClient.get('/api/gis/parcels', { params }),
          getParcelById: (id: string) =>
            apiClient.get(`/api/gis/parcels/${id}`),
          getParcelGeoJson: (id: string) =>
            apiClient.get(`/api/gis/parcels/${id}/geojson`),
          verifyParcel: (data: { geometryWkt: string; applicationId?: string; parcelId?: string }) =>
            apiClient.post('/api/gis/verify', data),
          createParcel: (data: {
            parcelNumber: string;
            geometryWkt: string;
            state?: string;
            lga?: string;
            address?: string;
            status?: string;
          }) => apiClient.post('/api/gis/parcels', data),
        };
        ```
      - **File: `apps/web/src/lib/gis-utils.ts`**
        ```typescript
        /**
         * Convert a Leaflet LatLng array (from leaflet-draw) to WKT POLYGON string.
         * Leaflet uses [lat, lng] order; WKT/PostGIS uses (lon lat) order.
         */
        export function polygonToWKT(latLngs: Array<{ lat: number; lng: number }>): string {
          const coords = [...latLngs, latLngs[0]] // close the ring
            .map((p) => `${p.lng} ${p.lat}`)
            .join(', ');
          return `POLYGON((${coords}))`;
        }

        /**
         * Convert a WKT POLYGON string to a GeoJSON Geometry object.
         * Handles simple polygons only (no holes); sufficient for Phase 1.
         */
        export function wktToGeoJSON(wkt: string): GeoJSON.Polygon | null {
          const match = wkt.match(/POLYGON\s*\(\((.+)\)\)/i);
          if (!match) return null;
          const coords = match[1]
            .split(',')
            .map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number]);
          return { type: 'Polygon', coordinates: [coords] };
        }

        /**
         * Format area in square meters to a human-readable string.
         */
        export function formatArea(areaSqm: number): string {
          if (areaSqm >= 10000) {
            return `${(areaSqm / 10000).toFixed(2)} ha`;
          }
          return `${areaSqm.toFixed(0)} m²`;
        }
        ```
      - **File: `apps/web/src/types/leaflet-draw.d.ts`** — leaflet-draw has no @types package:
        ```typescript
        declare module 'leaflet-draw' {
          // leaflet-draw adds itself to the L namespace when imported as a side effect.
          // No exports needed; import as: import 'leaflet-draw';
        }
        ```
      - Files: `apps/web/src/lib/api.ts`, `apps/web/src/lib/gis-utils.ts`, `apps/web/src/types/leaflet-draw.d.ts`
      - Verify: TypeScript check is part of the Next.js build in step 15.

- [ ] 13. Create the `ParcelInfoPanel` component.
      - Depends on: step 11.
      - **File: `apps/web/src/components/map/ParcelInfoPanel.tsx`**
      - Shows verification results returned from `POST /api/gis/verify`.
      - Props: `result: SpatialVerificationResult | null`, `onClose: () => void`.
      - Import the `SpatialVerificationResult` shape locally (duplicate the interface or import from a shared types file — since `@anagu/shared` doesn't expose GIS types yet, declare a local interface in this file).
        ```typescript
        'use client';

        interface OverlapEntry { id: string; parcelNumber: string; overlapAreaSqm?: number; }

        interface SpatialVerificationResult {
          id: string;
          isValidGeometry: boolean;
          isSelfIntersecting: boolean;
          overlapDetected: boolean;
          overlappingParcels: OverlapEntry[];
          areaSqm?: number;
          centroidLat?: number;
          centroidLon?: number;
          errorDetails?: string;
          verifiedAt: string;
        }

        interface Props {
          result: SpatialVerificationResult | null;
          onClose: () => void;
        }

        export default function ParcelInfoPanel({ result, onClose }: Props) {
          if (!result) return null;
          return (
            <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 w-80">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Verification Result</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className={`font-medium ${result.isValidGeometry ? 'text-green-600' : 'text-red-600'}`}>
                  Geometry: {result.isValidGeometry ? '✓ Valid' : '✗ Invalid'}
                </div>
                {result.isSelfIntersecting && (
                  <div className="text-red-600">⚠ Self-intersecting polygon</div>
                )}
                <div className={result.overlapDetected ? 'text-red-600' : 'text-green-600'}>
                  Overlaps: {result.overlapDetected ? `✗ ${result.overlappingParcels.length} conflict(s)` : '✓ None'}
                </div>
                {result.areaSqm && (
                  <div className="text-gray-700">
                    Area: {result.areaSqm >= 10000
                      ? `${(result.areaSqm / 10000).toFixed(2)} ha`
                      : `${result.areaSqm.toFixed(0)} m²`}
                  </div>
                )}
                {result.centroidLat && (
                  <div className="text-gray-500 text-xs">
                    Centroid: {result.centroidLat.toFixed(6)}, {result.centroidLon?.toFixed(6)}
                  </div>
                )}
                {result.overlapDetected && result.overlappingParcels.length > 0 && (
                  <div className="mt-2">
                    <div className="text-gray-600 font-medium text-xs uppercase">Conflicts:</div>
                    {result.overlappingParcels.map((p) => (
                      <div key={p.id} className="text-red-500 text-xs">{p.parcelNumber}</div>
                    ))}
                  </div>
                )}
                {result.errorDetails && (
                  <div className="text-red-500 text-xs mt-2">{result.errorDetails}</div>
                )}
              </div>
            </div>
          );
        }
        ```
      - Files: `apps/web/src/components/map/ParcelInfoPanel.tsx`
      - Verify: Included in Next.js build check at step 15.

- [ ] 14. Create the `GisMap` Leaflet component and map page.
      - Depends on: steps 11–13.
      - **File: `apps/web/src/components/map/GisMap.tsx`**
      - This is a client-only component (Leaflet requires browser DOM). Must import `leaflet/dist/leaflet.css` and `leaflet-draw/dist/leaflet.draw.css` as side effects inside the component file (not layout).
      - Fix the Leaflet default marker icon broken images in Next.js (known issue) by overriding icon URLs in a `useEffect`.
      - Use `react-leaflet` `MapContainer`, `TileLayer`, `GeoJSON`, `useMap` (for map ref access with leaflet-draw).
      - **Status color map:** `active → #22c55e (green)`, `pending → #eab308 (yellow)`, `revoked → #ef4444 (red)`, `disputed → #f97316 (orange)`.
      - Leaflet-draw integration: use `useEffect` to imperatively attach `L.Control.Draw` and listen to `map.on(L.Draw.Event.CREATED)` — this is the correct approach since react-leaflet has no draw plugin wrapper.
        ```typescript
        'use client';
        import { useEffect, useState, useRef } from 'react';
        import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
        import L from 'leaflet';
        import 'leaflet/dist/leaflet.css';
        import 'leaflet-draw/dist/leaflet.draw.css';
        import 'leaflet-draw';
        import { gisApi } from '@/lib/api';
        import { polygonToWKT } from '@/lib/gis-utils';
        import ParcelInfoPanel from './ParcelInfoPanel';

        // Fix Leaflet default marker icons in Next.js
        // (Webpack doesn't process Leaflet's internal image require correctly)
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const STATUS_COLORS: Record<string, string> = {
          active: '#22c55e',
          pending: '#eab308',
          revoked: '#ef4444',
          disputed: '#f97316',
        };

        function DrawControl({ onVerifyResult }: { onVerifyResult: (r: any) => void }) {
          const map = useMap();
          useEffect(() => {
            const drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
            const drawControl = new (L.Control as any).Draw({
              edit: { featureGroup: drawnItems },
              draw: {
                polygon: true,
                polyline: false,
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
              },
            });
            map.addControl(drawControl);
            map.on((L as any).Draw.Event.CREATED, async (e: any) => {
              const layer = e.layer;
              drawnItems.addLayer(layer);
              const latlngs: Array<{ lat: number; lng: number }> = layer.getLatLngs()[0];
              const wkt = polygonToWKT(latlngs);
              try {
                const response = await gisApi.verifyParcel({ geometryWkt: wkt });
                onVerifyResult(response.data);
              } catch (err) {
                console.error('Verification failed', err);
              }
            });
            return () => {
              map.removeControl(drawControl);
              map.removeLayer(drawnItems);
            };
          }, [map, onVerifyResult]);
          return null;
        }

        export default function GisMap() {
          const [parcels, setParcels] = useState<any[]>([]);
          const [verificationResult, setVerificationResult] = useState<any>(null);

          useEffect(() => {
            gisApi.getParcels().then((res) => setParcels(res.data)).catch(console.error);
          }, []);

          const parcelStyle = (feature: any) => ({
            color: STATUS_COLORS[feature?.properties?.status] || '#6b7280',
            weight: 2,
            fillOpacity: 0.3,
          });

          const onEachParcel = (feature: any, layer: L.Layer) => {
            const p = feature.properties;
            if (p) {
              layer.bindPopup(
                `<b>${p.parcelNumber}</b><br/>` +
                `Status: ${p.status}<br/>` +
                `LGA: ${p.lga || 'N/A'}<br/>` +
                (p.areaSqm ? `Area: ${(p.areaSqm / 10000).toFixed(2)} ha<br/>` : '') +
                (p.address ? `Address: ${p.address}` : '')
              );
            }
          };

          return (
            <div className="relative h-full w-full">
              <MapContainer
                center={[6.5244, 3.3792]}
                zoom={12}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {parcels.map((parcel) =>
                  parcel.geometry ? (
                    <GeoJSON
                      key={parcel.id}
                      data={{ type: 'Feature', geometry: parcel.geometry, properties: { ...parcel, parcelNumber: parcel.parcelNumber } }}
                      style={parcelStyle}
                      onEachFeature={onEachParcel}
                    />
                  ) : null
                )}
                <DrawControl onVerifyResult={setVerificationResult} />
              </MapContainer>
              <ParcelInfoPanel
                result={verificationResult}
                onClose={() => setVerificationResult(null)}
              />
              {/* Legend */}
              <div className="absolute bottom-8 left-4 z-[1000] bg-white rounded-lg shadow p-3 text-xs">
                <div className="font-semibold mb-1 text-gray-700">Parcel Status</div>
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-2 capitalize">
                    <span style={{ background: color }} className="inline-block w-3 h-3 rounded-sm" />
                    {status}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        ```
      - **File: `apps/web/src/app/map/page.tsx`**
        ```typescript
        import dynamic from 'next/dynamic';

        const GisMap = dynamic(() => import('@/components/map/GisMap'), {
          ssr: false,
          loading: () => (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading map...
            </div>
          ),
        });

        export default function MapPage() {
          return (
            <div className="h-screen w-screen">
              <GisMap />
            </div>
          );
        }
        ```
      - Files: `apps/web/src/components/map/GisMap.tsx`, `apps/web/src/app/map/page.tsx`
      - Verify: Included in Next.js build at step 15.

- [ ] 15. Build verification — Next.js compile check.
      - Depends on: steps 11–14.
      - Run: `cd C:\Users\StarLab\Desktop\Library\Anagu\apps\web && npx next build`
      - Expected: build completes without TypeScript or module-resolution errors.
      - If Leaflet CSS import errors appear in the build: add `experimental: { esmExternals: 'loose' }` to `next.config.js`.
      - If `leaflet-draw` import errors appear: confirm `apps/web/src/types/leaflet-draw.d.ts` exists (from step 12) and the tsconfig `include` covers it.

---

## Validation Gate — Phase 1 passes when ALL 5 criteria are met

Run these commands in order:

**Criterion 1 — Tables exist with correct columns:**
```powershell
docker exec anagu_postgres psql -U anagu -d anagu_db -c "\d anagu.land_parcels"
docker exec anagu_postgres psql -U anagu -d anagu_db -c "\d anagu.spatial_verifications"
```
Expected: both tables listed with their columns including `geometry geometry(Polygon,4326)` on `land_parcels`.

**Criterion 2 — PostGIS spatial functions work:**
```powershell
docker exec anagu_postgres psql -U anagu -d anagu_db -c "SELECT ST_IsValid(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 1,0 0))',4326)) AS isvalid, ST_Intersects(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 1,0 0))',4326), ST_GeomFromText('POLYGON((0.5 0.5,1.5 0.5,1.5 1.5,0.5 1.5,0.5 0.5))',4326)) AS intersects, ST_Buffer(ST_GeomFromText('POINT(0 0)',4326), 0.000005) IS NOT NULL AS buffer_works;"
```
Expected: `t | t | t`

**Criterion 3 — 10 seed parcels inserted:**
```powershell
docker exec anagu_postgres psql -U anagu -d anagu_db -c "SELECT COUNT(*) FROM anagu.land_parcels;"
```
Expected: `10`

**Criterion 4 — All 6 GIS tests pass:**
```powershell
cd C:\Users\StarLab\Desktop\Library\Anagu\apps\api
npx jest --testPathPattern=gis.service.spec
```
Expected: `Tests: 6 passed, 6 total`

**Criterion 5 — NestJS GIS module compiles without TypeScript errors:**
```powershell
cd C:\Users\StarLab\Desktop\Library\Anagu\apps\api
npx tsc --noEmit
```
Expected: no output (zero errors).

---

## Key implementation notes for the implementer

1. **`reflect-metadata` import:** `apps/api/src/main.ts` must start with `import 'reflect-metadata';` as the absolute first line, before any NestJS imports.

2. **UTM zone for Nigeria:** Lagos (~3.4°E) falls in UTM Zone 31N (EPSG:32631), not 32N. All `ST_Transform(..., 32631)` calls in `gis.service.ts` must use 32631.

3. **`anagu` schema vs public schema:** The Prisma schema maps tables to the `public` schema (no `@@schema` directive). The raw SQL migration creates tables in the `anagu` schema. These are separate tables — `anagu.land_parcels` (PostGIS-backed, Phase 1) and `public.land_parcels` (Prisma-managed, future phases). No conflict.

4. **leaflet-draw import:** `import 'leaflet-draw';` is a side-effect import that patches the global `L` object. It must come after `import L from 'leaflet';`. The `leaflet-draw.d.ts` module declaration (step 12) prevents TypeScript from complaining about this untyped module.

5. **Dynamic import for GisMap:** Next.js App Router SSR will fail if Leaflet is imported at module level because Leaflet accesses `window`. The `dynamic(() => import(...), { ssr: false })` pattern in `app/map/page.tsx` ensures the component only renders on the client.

6. **Jest integration tests:** The spec file connects to a real running PostgreSQL. Run `anagu_postgres` container before running tests. Tests do NOT mock the pool. The `afterAll` teardown closes the pool to prevent Jest from hanging.

7. **PowerShell migration execution:** PowerShell does not support `< file` redirection for stdin. Use `Get-Content file | docker exec -i container psql ...` as specified in step 4.

8. **npm workspace commands:** Always run npm install commands from the monorepo root (`C:\Users\StarLab\Desktop\Library\Anagu`) with `--workspace=apps/api` or `--workspace=apps/web` flags. Do not `cd` into the app directory and run `npm install` directly — this breaks the workspace hoisting.
