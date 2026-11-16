export type UserRole =
  | 'CITIZEN'
  | 'SURVEYOR'
  | 'REGISTRAR'
  | 'LAND_ADMINISTRATOR'
  | 'GOVERNOR';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SPATIAL_REVIEW'
  | 'UNDER_OWNERSHIP_VERIFICATION'
  | 'PENDING_LEGAL_VERIFICATION'
  | 'PENDING_REGISTRAR_APPROVAL'
  | 'APPROVED'
  | 'REGISTERED'
  | 'REJECTED'
  | 'REVOKED'
  | 'CANCELLED';

export type RevocationGround =
  | 'Overriding Public Interest'
  | 'Breach of Statutory Condition';

export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string;
  walletAddress: string;
  walletVerified?: boolean;
  walletLinkedAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WalletProof {
  message: string;
  signature: string;
  signerAddress: string;
  chainId?: number | null;
  onChainTxHash?: string;
}

export interface DocumentAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  objectKey: string;
  uploadedAt: string;
}

export interface SpatialVerificationResult {
  id?: string;
  isValidGeometry: boolean;
  isSelfIntersecting: boolean;
  overlapDetected: boolean;
  overlappingParcels: Array<{ id: string; parcelNumber: string; overlapAreaSqm: number }>;
  areaSqm: number;
  centroid: { lat: number; lon: number };
  errorDetails: string | null;
  passed: boolean;
}

export interface OracleVerificationRecord {
  id: string;
  applicationId: string;
  institutionalVerified: boolean;
  communityVerified: boolean;
  institutionalDetails: Record<string, unknown>;
  communityDetails: Record<string, unknown>;
  overallOutcome: 'VERIFIED' | 'DISPUTED' | 'INCONCLUSIVE' | 'PENDING';
  notes: string;
  verifiedAt: string;
}

export interface SurveyReportRecord {
  id: string;
  surveyorId: string;
  surveyorName: string;
  findings: string;
  boundaryConfirmed: boolean;
  submittedAt: string;
}

export interface LandApplicationRecord {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  parcelId: string | null;
  parcelReference: string;
  state: string;
  lga: string;
  address: string;
  wkt: string;
  claimantName: string;
  nationalIdHash: string;
  documents: DocumentAttachment[];
  status: ApplicationStatus;
  spatialVerification: SpatialVerificationResult | null;
  surveyReport: SurveyReportRecord | null;
  oracleVerification: OracleVerificationRecord | null;
  legalVerified: boolean;
  legalOfficerName: string | null;
  legalNotes: string | null;
  registrarNotes: string | null;
  tokenId: number | null;
  txHash: string | null;
  idempotencyKey: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface OwnershipHistoryEntry {
  fromAddress: string;
  toAddress: string;
  toName: string;
  txHash: string;
  timestamp: string;
  action: 'ISSUED' | 'TRANSFERRED' | 'REVOKED';
}

export interface DigitalLandTitle {
  tokenId: number;
  applicationId: string;
  parcelId: string;
  parcelReference: string;
  address: string;
  lga: string;
  state: string;
  areaSqm: number;
  ownerId: string;
  ownerName: string;
  ownerAddress: string;
  ownerReferenceHash: string;
  spatialHash: string;
  documentHash: string;
  txHash: string;
  blockNumber: number;
  issuedAt: string;
  isRevoked: boolean;
  revokedAt: string | null;
  revocationGrounds: RevocationGround | null;
  revocationReference: string | null;
  revocationJustification: string | null;
  revokedByName: string | null;
  ownershipHistory: OwnershipHistoryEntry[];
}

export interface MqttMessageLog {
  id: string;
  topic: string;
  qos: 0 | 1 | 2;
  payload: Record<string, unknown>;
  recipientRole: UserRole | 'ALL';
  publishedAt: string;
  delivered: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: 'APPLICATION' | 'TITLE' | 'PARCEL' | 'USER' | 'SYSTEM';
  entityId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  details: string;
}

export interface OfflineQueuedApplication {
  idempotencyKey: string;
  queuedAt: string;
  payload: {
    parcelReference: string;
    state: string;
    lga: string;
    address: string;
    wkt: string;
    claimantName: string;
    nationalId: string;
    documents: Array<{
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
      sha256Hash: string;
    }>;
    idempotencyKey: string;
  };
}

export type LandListingType = 'STATE_ALLOCATION' | 'VERIFIED_RESALE';
export type LandListingStatus = 'AVAILABLE' | 'SOLD';
export type LandZoning = 'Residential' | 'Commercial' | 'Mixed-Use';

export interface LandListingRecord {
  id: string;
  parcelId: string;
  parcelReference: string;
  title: string;
  address: string;
  lga: string;
  state: string;
  areaSqm: number;
  wkt: string;
  zoning: LandZoning;
  priceNgn: number;
  priceEth: string;
  sellerId: string;
  sellerName: string;
  sellerAddress: string;
  tokenId: number | null;
  listingType: LandListingType;
  status: LandListingStatus;
  imageUrl: string;
  description: string;
  createdAt: string;
  soldAt: string | null;
  buyerId: string | null;
  buyerName: string | null;
  purchaseTxHash: string | null;
}

export interface LandPurchaseRecord {
  id: string;
  listingId: string;
  parcelReference: string;
  title: string;
  address: string;
  lga: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerWallet: string;
  priceNgn: number;
  priceEth: string;
  paymentMethod: 'REGISTRY_ESCROW' | 'METAMASK_ETH' | 'TRUST_WALLET_ETH';
  txHash: string;
  tokenId: number;
  purchasedAt: string;
}

