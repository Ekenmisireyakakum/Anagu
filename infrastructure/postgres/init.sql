-- ANAGU Land Administration Platform — PostgreSQL Initialization
-- This script runs once when the postgres container is first created.
-- Full table DDL is managed by Prisma migrations (run after container start).

-- =====================================================================
-- EXTENSIONS
-- =====================================================================

-- PostGIS: spatial/GIS types and functions for land parcel geometry
CREATE EXTENSION IF NOT EXISTS postgis;

-- uuid-ossp: UUID generation functions (used by Prisma default(uuid()))
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: trigram similarity for fuzzy text search on addresses/names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- SCHEMA
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS anagu;

-- =====================================================================
-- NOTES
-- =====================================================================
-- Core tables (users, land_parcels, applications, audit_logs,
-- notifications, etc.) are created by Prisma migrations.
-- Run: cd packages/database && npx prisma migrate deploy
--
-- PostGIS geometry columns on land_parcels will be added via
-- a raw SQL migration:
--   ALTER TABLE land_parcels
--     ADD COLUMN geom geometry(MultiPolygon, 4326);
--   CREATE INDEX land_parcels_geom_idx
--     ON land_parcels USING GIST (geom);
