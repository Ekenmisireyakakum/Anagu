SET search_path TO anagu, public;

DO $$ BEGIN
  CREATE TYPE anagu.user_role AS ENUM (
    'CITIZEN',
    'SURVEYOR',
    'REGISTRAR',
    'LAND_ADMINISTRATOR',
    'GOVERNOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS anagu.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          anagu.user_role NOT NULL DEFAULT 'CITIZEN',
  full_name     VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON anagu.users (email);

DROP TRIGGER IF EXISTS trg_users_updated_at ON anagu.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON anagu.users
  FOR EACH ROW EXECUTE FUNCTION anagu.update_updated_at();

-- Seed a default admin account (password: Admin1234!)
-- Hash generated for 'Admin1234!' with bcryptjs rounds=12
INSERT INTO anagu.users (email, password_hash, role, full_name)
VALUES (
  'admin@anagu.gov.ng',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VGY98gNge',
  'LAND_ADMINISTRATOR',
  'ANAGU System Administrator'
) ON CONFLICT (email) DO NOTHING;
