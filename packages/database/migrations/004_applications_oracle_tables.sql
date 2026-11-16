-- Migration 004: applications and oracle_verifications tables
-- Must run after migrations 001-003

SET search_path TO anagu;

-- Applications table
CREATE TABLE IF NOT EXISTS anagu.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES anagu.users(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES anagu.land_parcels(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN (
      'SUBMITTED',
      'OWNERSHIP_VERIFICATION',
      'DOCUMENT_REVIEW',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'ON_HOLD',
      'RESUBMITTED',
      'EXPIRED',
      'WITHDRAWN'
    )),
  application_data JSONB DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Oracle verifications table
CREATE TABLE IF NOT EXISTS anagu.oracle_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES anagu.applications(id) ON DELETE CASCADE,
  institutional_verified BOOLEAN NOT NULL DEFAULT FALSE,
  community_verified BOOLEAN NOT NULL DEFAULT FALSE,
  institutional_details JSONB DEFAULT '{}',
  community_details JSONB DEFAULT '{}',
  overall_outcome VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (overall_outcome IN ('VERIFIED','DISPUTED','INCONCLUSIVE','PENDING')),
  notes TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at on applications
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON anagu.applications
  FOR EACH ROW
  EXECUTE FUNCTION anagu.update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON anagu.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON anagu.applications(status);
CREATE INDEX IF NOT EXISTS idx_oracle_verifications_application_id ON anagu.oracle_verifications(application_id);
