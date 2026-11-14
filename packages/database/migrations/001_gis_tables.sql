-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis_topology;

SET search_path TO anagu, public;

CREATE TABLE IF NOT EXISTS anagu.land_parcels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_number   VARCHAR(50) UNIQUE NOT NULL,
  geometry        GEOMETRY(POLYGON, 4326) NOT NULL,
  area_sqm        NUMERIC(15,4),
  state           VARCHAR(100) NOT NULL DEFAULT 'Lagos',
  lga             VARCHAR(100),
  address         TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','revoked','disputed','cancelled')),
  owner_id        UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_parcels_geometry
  ON anagu.land_parcels USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_land_parcels_status
  ON anagu.land_parcels (status);

CREATE TABLE IF NOT EXISTS anagu.spatial_verifications (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id       UUID NOT NULL,
  parcel_id            UUID REFERENCES anagu.land_parcels(id),
  is_valid_geometry    BOOLEAN NOT NULL,
  is_self_intersecting BOOLEAN NOT NULL DEFAULT FALSE,
  overlap_detected     BOOLEAN NOT NULL DEFAULT FALSE,
  overlapping_parcels  JSONB DEFAULT '[]',
  area_sqm             NUMERIC(15,4),
  centroid_lat         NUMERIC(12,8),
  centroid_lon         NUMERIC(12,8),
  error_details        TEXT,
  verified_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spatial_verifications_application
  ON anagu.spatial_verifications (application_id);

CREATE OR REPLACE FUNCTION anagu.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_land_parcels_updated_at ON anagu.land_parcels;
CREATE TRIGGER trg_land_parcels_updated_at
  BEFORE UPDATE ON anagu.land_parcels
  FOR EACH ROW EXECUTE FUNCTION anagu.update_updated_at();
