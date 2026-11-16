export type OracleOverallOutcome = 'VERIFIED' | 'DISPUTED' | 'INCONCLUSIVE' | 'PENDING';

export interface InstitutionalCheckResult {
  verified: boolean;
  referenceId: string | null;
  details: Record<string, unknown>;
}

export interface CommunityCheckResult {
  verified: boolean;
  attestationCount: number;
  details: Record<string, unknown>;
}

export interface OracleVerificationResult {
  id: string;
  applicationId: string;
  institutionalVerified: boolean;
  communityVerified: boolean;
  institutionalDetails: Record<string, unknown>;
  communityDetails: Record<string, unknown>;
  overallOutcome: OracleOverallOutcome;
  notes: string | null;
  verifiedAt: Date;
}
