import crypto from 'crypto';
import {
  listParcels,
  verifyWktParcel,
  type GeoJsonPolygon,
  type LandParcelRecord,
  type SpatialVerificationResult,
} from './mock-gis-store';

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

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  phone: string;
  walletAddress: string;
  isActive: boolean;
  createdAt: string;
}

export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string;
  walletAddress: string;
  isActive: boolean;
  createdAt: string;
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

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  organization: string;
  subject: string;
  message: string;
  createdAt: string;
}

interface AnaguGlobalStore {
  users: UserAccount[];
  applications: LandApplicationRecord[];
  titles: DigitalLandTitle[];
  mqttLogs: MqttMessageLog[];
  auditLogs: AuditLogEntry[];
  contacts: ContactSubmission[];
  extraParcels: LandParcelRecord[];
  parcelStatusOverrides: Map<string, string>;
  nextTokenId: number;
  nextBlockNumber: number;
}

const SESSION_SECRET = process.env.JWT_SECRET || 'anagu-session-hmac-secret-dev-only';

function sha256(input: string): string {
  return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`anagu:${password}`).digest('hex');
}

function makeTxHash(seed: string): string {
  return '0x' + crypto.createHash('sha256').update(`besu-tx:${seed}:${Date.now()}`).digest('hex');
}

function initStore(): AnaguGlobalStore {
  const now = new Date('2026-11-10T09:00:00.000Z').toISOString();
  const users: UserAccount[] = [
    {
      id: '11111111-1111-4111-8111-111111111101',
      email: 'citizen@anagu.gov.ng',
      passwordHash: hashPassword('Citizen123!'),
      role: 'CITIZEN',
      fullName: 'Adewale Balogun',
      phone: '+234 803 410 2201',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isActive: true,
      createdAt: now,
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      email: 'surveyor@anagu.gov.ng',
      passwordHash: hashPassword('Surveyor123!'),
      role: 'SURVEYOR',
      fullName: 'Surv. Tunde Fashola',
      phone: '+234 803 410 2202',
      walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      isActive: true,
      createdAt: now,
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      email: 'registrar@anagu.gov.ng',
      passwordHash: hashPassword('Registrar123!'),
      role: 'REGISTRAR',
      fullName: 'Barr. Ngozi Okafor',
      phone: '+234 803 410 2203',
      walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      isActive: true,
      createdAt: now,
    },
    {
      id: '11111111-1111-4111-8111-111111111104',
      email: 'admin@anagu.gov.ng',
      passwordHash: hashPassword('Admin1234!'),
      role: 'LAND_ADMINISTRATOR',
      fullName: 'Dr. Ibrahim Musa',
      phone: '+234 803 410 2204',
      walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      isActive: true,
      createdAt: now,
    },
    {
      id: '11111111-1111-4111-8111-111111111105',
      email: 'governor@anagu.gov.ng',
      passwordHash: hashPassword('Governor123!'),
      role: 'GOVERNOR',
      fullName: 'Office of the Governor (Lagos)',
      phone: '+234 803 410 2205',
      walletAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      isActive: true,
      createdAt: now,
    },
  ];

  const seedParcel = listParcels()[0];
  const initialTitleTx = sha256('genesis-title-LG-VI-001');
  const initialTitle: DigitalLandTitle = {
    tokenId: 1001,
    applicationId: '22222222-2222-4222-8222-222222222201',
    parcelId: seedParcel.id,
    parcelReference: seedParcel.parcelNumber,
    address: seedParcel.address || '15 Akin Adesola Street, Victoria Island',
    lga: seedParcel.lga || 'Eti-Osa',
    state: seedParcel.state,
    areaSqm: seedParcel.areaSqm || 1680.5,
    ownerId: users[0].id,
    ownerName: users[0].fullName,
    ownerAddress: users[0].walletAddress,
    ownerReferenceHash: sha256(users[0].id),
    spatialHash: sha256(JSON.stringify(seedParcel.geometry)),
    documentHash: sha256('C-of-O-LG-VI-001-deed.pdf'),
    txHash: initialTitleTx,
    blockNumber: 14208,
    issuedAt: '2026-11-10T10:15:00.000Z',
    isRevoked: false,
    revokedAt: null,
    revocationGrounds: null,
    revocationReference: null,
    revocationJustification: null,
    revokedByName: null,
    ownershipHistory: [
      {
        fromAddress: '0x0000000000000000000000000000000000000000',
        toAddress: users[0].walletAddress,
        toName: users[0].fullName,
        txHash: initialTitleTx,
        timestamp: '2026-11-10T10:15:00.000Z',
        action: 'ISSUED',
      },
    ],
  };

  const pendingAppWkt =
    'POLYGON((3.4310 6.4320, 3.4324 6.4320, 3.4324 6.4310, 3.4310 6.4310, 3.4310 6.4320))';
  const pendingSpatial = verifyWktParcel(pendingAppWkt, '22222222-2222-4222-8222-222222222202');

  const applications: LandApplicationRecord[] = [
    {
      id: '22222222-2222-4222-8222-222222222201',
      applicantId: users[0].id,
      applicantName: users[0].fullName,
      applicantEmail: users[0].email,
      parcelId: seedParcel.id,
      parcelReference: 'LG-VI-001',
      state: 'Lagos',
      lga: 'Eti-Osa',
      address: '15 Akin Adesola Street, Victoria Island',
      wkt: 'POLYGON((3.4201 6.4290, 3.4215 6.4290, 3.4215 6.4280, 3.4201 6.4280, 3.4201 6.4290))',
      claimantName: users[0].fullName,
      nationalIdHash: sha256('NIN-29384710293'),
      documents: [
        {
          id: 'doc-001',
          fileName: 'Survey_Plan_LG_VI_001.pdf',
          fileType: 'application/pdf',
          fileSizeBytes: 418200,
          sha256Hash: sha256('C-of-O-LG-VI-001-deed.pdf'),
          objectKey: 'anagu-documents/LG-VI-001/Survey_Plan_LG_VI_001.pdf',
          uploadedAt: '2026-11-10T09:12:00.000Z',
        },
      ],
      status: 'REGISTERED',
      spatialVerification: verifyWktParcel(
        'POLYGON((3.4201 6.4290, 3.4215 6.4290, 3.4215 6.4280, 3.4201 6.4280, 3.4201 6.4290))',
        '22222222-2222-4222-8222-222222222201',
        seedParcel.id,
      ),
      surveyReport: {
        id: 'srv-001',
        surveyorId: users[1].id,
        surveyorName: users[1].fullName,
        findings: 'WGS 84 beacons verified on-site with zero boundary encroachment.',
        boundaryConfirmed: true,
        submittedAt: '2026-11-10T09:40:00.000Z',
      },
      oracleVerification: {
        id: 'ora-001',
        applicationId: '22222222-2222-4222-8222-222222222201',
        institutionalVerified: true,
        communityVerified: true,
        institutionalDetails: { registry: 'LASRECCA', referenceId: 'INST-1731229200' },
        communityDetails: { witnesses: ['Chief O. Adeyemi', 'Baale M. Bello', 'Elder K. Sanni'] },
        overallOutcome: 'VERIFIED',
        notes: 'Institutional registry and community council attestations aligned.',
        verifiedAt: '2026-11-10T09:50:00.000Z',
      },
      legalVerified: true,
      legalOfficerName: users[2].fullName,
      legalNotes: 'Root of title confirmed under Lagos State Land Use Act registry guidelines.',
      registrarNotes: 'Approved for ERC-721 title issuance on Besu.',
      tokenId: 1001,
      txHash: initialTitleTx,
      idempotencyKey: null,
      submittedAt: '2026-11-10T09:15:00.000Z',
      updatedAt: '2026-11-10T10:15:00.000Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222202',
      applicantId: users[0].id,
      applicantName: users[0].fullName,
      applicantEmail: users[0].email,
      parcelId: null,
      parcelReference: 'LG-LK-044',
      state: 'Lagos',
      lga: 'Eti-Osa',
      address: 'Plot 44, Freedom Way, Lekki Phase 1',
      wkt: pendingAppWkt,
      claimantName: users[0].fullName,
      nationalIdHash: sha256('NIN-29384710293'),
      documents: [
        {
          id: 'doc-002',
          fileName: 'Deed_of_Assignment_LG_LK_044.pdf',
          fileType: 'application/pdf',
          fileSizeBytes: 512000,
          sha256Hash: sha256('Deed_of_Assignment_LG_LK_044.pdf'),
          objectKey: 'anagu-documents/LG-LK-044/Deed_of_Assignment_LG_LK_044.pdf',
          uploadedAt: '2026-11-14T11:05:00.000Z',
        },
      ],
      status: 'PENDING_REGISTRAR_APPROVAL',
      spatialVerification: pendingSpatial,
      surveyReport: {
        id: 'srv-002',
        surveyorId: users[1].id,
        surveyorName: users[1].fullName,
        findings: 'Polygon valid under EPSG:4326; 0.5m tolerance buffer clear of existing plots.',
        boundaryConfirmed: true,
        submittedAt: '2026-11-14T12:15:00.000Z',
      },
      oracleVerification: {
        id: 'ora-002',
        applicationId: '22222222-2222-4222-8222-222222222202',
        institutionalVerified: true,
        communityVerified: true,
        institutionalDetails: { registry: 'LASRECCA', referenceId: 'INST-1731586500' },
        communityDetails: { witnesses: ['Elder A. Elegushi', 'Chief B. Ojo', 'Elder C. Lawal'] },
        overallOutcome: 'VERIFIED',
        notes: 'Both institutional registry and community attestation verified.',
        verifiedAt: '2026-11-14T12:30:00.000Z',
      },
      legalVerified: true,
      legalOfficerName: users[2].fullName,
      legalNotes: 'Deed of assignment and survey plan cleared for Registrar decision.',
      registrarNotes: null,
      tokenId: null,
      txHash: null,
      idempotencyKey: null,
      submittedAt: '2026-11-14T11:05:00.000Z',
      updatedAt: '2026-11-14T12:45:00.000Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222203',
      applicantId: users[0].id,
      applicantName: users[0].fullName,
      applicantEmail: users[0].email,
      parcelId: null,
      parcelReference: 'LG-IK-088',
      state: 'Lagos',
      lga: 'Ikeja',
      address: '88 Isaac John Street, GRA Ikeja',
      wkt: 'POLYGON((3.3510 6.5820, 3.3524 6.5820, 3.3524 6.5810, 3.3510 6.5810, 3.3510 6.5820))',
      claimantName: users[0].fullName,
      nationalIdHash: sha256('NIN-29384710293'),
      documents: [
        {
          id: 'doc-003',
          fileName: 'Ikeja_GRA_Survey.pdf',
          fileType: 'application/pdf',
          fileSizeBytes: 389100,
          sha256Hash: sha256('Ikeja_GRA_Survey.pdf'),
          objectKey: 'anagu-documents/LG-IK-088/Ikeja_GRA_Survey.pdf',
          uploadedAt: '2026-11-15T14:20:00.000Z',
        },
      ],
      status: 'UNDER_SPATIAL_REVIEW',
      spatialVerification: null,
      surveyReport: null,
      oracleVerification: null,
      legalVerified: false,
      legalOfficerName: null,
      legalNotes: null,
      registrarNotes: null,
      tokenId: null,
      txHash: null,
      idempotencyKey: null,
      submittedAt: '2026-11-15T14:20:00.000Z',
      updatedAt: '2026-11-15T14:20:00.000Z',
    },
  ];

  const mqttLogs: MqttMessageLog[] = [
    {
      id: 'mqtt-001',
      topic: 'anagu/title/minted',
      qos: 1,
      payload: {
        tokenId: 1001,
        parcelReference: 'LG-VI-001',
        txHash: initialTitleTx,
      },
      recipientRole: 'CITIZEN',
      publishedAt: '2026-11-10T10:15:00.000Z',
      delivered: true,
    },
    {
      id: 'mqtt-002',
      topic: 'anagu/verification/ownership-complete',
      qos: 1,
      payload: {
        applicationId: '22222222-2222-4222-8222-222222222202',
        parcelReference: 'LG-LK-044',
        overallOutcome: 'VERIFIED',
      },
      recipientRole: 'REGISTRAR',
      publishedAt: '2026-11-14T12:30:00.000Z',
      delivered: true,
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-001',
      timestamp: '2026-11-10T10:15:00.000Z',
      actorId: users[2].id,
      actorName: users[2].fullName,
      actorRole: 'REGISTRAR',
      action: 'MINT_LAND_TITLE_NFT',
      entityType: 'TITLE',
      entityId: 'TOKEN-1001',
      outcome: 'SUCCESS',
      details: 'Issued ERC-721 Title #1001 for LG-VI-001 on Hyperledger Besu QBFT.',
    },
    {
      id: 'aud-002',
      timestamp: '2026-11-14T12:30:00.000Z',
      actorId: 'SYSTEM_ORACLE',
      actorName: 'Ownership Verification Oracle',
      actorRole: 'SYSTEM',
      action: 'VERIFY_OWNERSHIP_CLAIM',
      entityType: 'APPLICATION',
      entityId: '22222222-2222-4222-8222-222222222202',
      outcome: 'SUCCESS',
      details: 'Institutional LASRECCA + Community attestation returned VERIFIED for LG-LK-044.',
    },
  ];

  return {
    users,
    applications,
    titles: [initialTitle],
    mqttLogs,
    auditLogs,
    contacts: [],
    extraParcels: [],
    parcelStatusOverrides: new Map<string, string>(),
    nextTokenId: 1002,
    nextBlockNumber: 14209,
  };
}

const g = globalThis as typeof globalThis & { __anaguStore?: AnaguGlobalStore };
export function getAnaguStore(): AnaguGlobalStore {
  if (!g.__anaguStore) {
    g.__anaguStore = initStore();
  }
  return g.__anaguStore;
}

export function toSafeUser(user: UserAccount): SafeUser {
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

export function createSessionToken(user: SafeUser): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: Date.now() + 86400_000 }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): SafeUser | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.sub || parsed.exp < Date.now()) return null;
    const user = getAnaguStore().users.find((u) => u.id === parsed.sub);
    if (!user || !user.isActive) return null;
    return toSafeUser(user);
  } catch {
    return null;
  }
}

export function authenticateUser(email: string, password: string): SafeUser | null {
  const user = getAnaguStore().users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!user || !user.isActive) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  return toSafeUser(user);
}

export function registerCitizenUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): SafeUser {
  const store = getAnaguStore();
  const exists = store.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
  if (exists) {
    throw new Error('Email is already registered');
  }
  const newUser: UserAccount = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    passwordHash: hashPassword(input.password),
    role: 'CITIZEN',
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || '',
    walletAddress: '0x' + crypto.randomBytes(20).toString('hex'),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  store.users.push(newUser);
  recordAudit(
    newUser.id,
    newUser.fullName,
    newUser.role,
    'USER_REGISTERED',
    'USER',
    newUser.id,
    'SUCCESS',
    `New citizen account created for ${newUser.email}`,
  );
  return toSafeUser(newUser);
}

export function getAllEffectiveParcels(filters?: {
  status?: string | null;
  lga?: string | null;
}): LandParcelRecord[] {
  const store = getAnaguStore();
  const base = listParcels();
  const combined = [...store.extraParcels, ...base].map((p) => {
    const override = store.parcelStatusOverrides.get(p.id);
    return override ? { ...p, status: override } : p;
  });
  return combined.filter((p) => {
    if (filters?.status && p.status !== filters.status) return false;
    if (filters?.lga && p.lga !== filters.lga) return false;
    return true;
  });
}

export function publishMqttLog(
  topic: string,
  payload: Record<string, unknown>,
  recipientRole: UserRole | 'ALL' = 'ALL',
  qos: 0 | 1 | 2 = 1,
): MqttMessageLog {
  const store = getAnaguStore();
  const entry: MqttMessageLog = {
    id: crypto.randomUUID(),
    topic,
    qos,
    payload,
    recipientRole,
    publishedAt: new Date().toISOString(),
    delivered: true,
  };
  store.mqttLogs.unshift(entry);
  return entry;
}

export function recordAudit(
  actorId: string,
  actorName: string,
  actorRole: string,
  action: string,
  entityType: AuditLogEntry['entityType'],
  entityId: string,
  outcome: AuditLogEntry['outcome'],
  details: string,
): AuditLogEntry {
  const store = getAnaguStore();
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actorId,
    actorName,
    actorRole,
    action,
    entityType,
    entityId,
    outcome,
    details,
  };
  store.auditLogs.unshift(entry);
  return entry;
}

export function runOracleCheck(
  application: LandApplicationRecord,
): OracleVerificationRecord {
  const ref = application.parcelReference.toUpperCase();
  const hasDoc = application.documents.length > 0;
  const institutionalVerified = !ref.endsWith('-DISPUTED');
  const communityVerified = !ref.endsWith('-NOATTEST');

  let overallOutcome: OracleVerificationRecord['overallOutcome'];
  let notes: string;

  if (!institutionalVerified) {
    overallOutcome = 'DISPUTED';
    notes = 'Conflicting claim detected in LASRECCA institutional registry.';
  } else if (!communityVerified) {
    overallOutcome = 'INCONCLUSIVE';
    notes = 'Institutional records clear, but community council attestation is missing.';
  } else if (!hasDoc) {
    overallOutcome = 'PENDING';
    notes = 'Supporting title deed / survey document required before verification.';
  } else {
    overallOutcome = 'VERIFIED';
    notes = 'Institutional registry and community council attestations verified claimant ownership.';
  }

  return {
    id: crypto.randomUUID(),
    applicationId: application.id,
    institutionalVerified,
    communityVerified,
    institutionalDetails: {
      registry: 'LASRECCA',
      parcelReference: application.parcelReference,
      verified: institutionalVerified,
      referenceId: institutionalVerified ? `INST-${Date.now()}` : null,
    },
    communityDetails: {
      witnesses: communityVerified ? ['Elder A', 'Elder B', 'Elder C'] : [],
      attestationCount: communityVerified ? 3 : 0,
      verified: communityVerified,
    },
    overallOutcome,
    notes,
    verifiedAt: new Date().toISOString(),
  };
}

export function submitLandApplication(
  user: SafeUser,
  input: {
    parcelReference: string;
    state?: string;
    lga: string;
    address: string;
    wkt: string;
    claimantName?: string;
    nationalId?: string;
    documents?: Array<{
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
      sha256Hash?: string;
    }>;
    idempotencyKey?: string;
  },
): { application: LandApplicationRecord; deduplicated: boolean } {
  const store = getAnaguStore();

  if (input.idempotencyKey) {
    const existing = store.applications.find(
      (a) => a.idempotencyKey === input.idempotencyKey && a.applicantId === user.id,
    );
    if (existing) {
      return { application: existing, deduplicated: true };
    }
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  const maxBytes = 10 * 1024 * 1024;
  const docs: DocumentAttachment[] = (input.documents || []).map((d) => {
    if (!allowedTypes.includes(d.fileType)) {
      throw new Error(`Unsupported file type: ${d.fileType}. Allowed: PDF, PNG, JPEG`);
    }
    if (d.fileSizeBytes > maxBytes || d.fileSizeBytes <= 0) {
      throw new Error(`File ${d.fileName} exceeds 10 MB size limit`);
    }
    return {
      id: crypto.randomUUID(),
      fileName: d.fileName,
      fileType: d.fileType,
      fileSizeBytes: d.fileSizeBytes,
      sha256Hash: d.sha256Hash || sha256(`${d.fileName}:${d.fileSizeBytes}:${user.id}`),
      objectKey: `anagu-documents/${input.parcelReference}/${d.fileName}`,
      uploadedAt: new Date().toISOString(),
    };
  });

  if (docs.length === 0) {
    throw new Error('At least one supporting document (PDF, PNG, or JPEG) is required');
  }

  const appId = crypto.randomUUID();
  const spatial = verifyWktParcel(input.wkt, appId);
  const now = new Date().toISOString();

  const app: LandApplicationRecord = {
    id: appId,
    applicantId: user.id,
    applicantName: user.fullName,
    applicantEmail: user.email,
    parcelId: null,
    parcelReference: input.parcelReference.trim(),
    state: input.state || 'Lagos',
    lga: input.lga.trim(),
    address: input.address.trim(),
    wkt: input.wkt.trim(),
    claimantName: input.claimantName?.trim() || user.fullName,
    nationalIdHash: sha256(input.nationalId || user.id),
    documents: docs,
    status: spatial.passed ? 'UNDER_SPATIAL_REVIEW' : 'SUBMITTED',
    spatialVerification: spatial,
    surveyReport: null,
    oracleVerification: null,
    legalVerified: false,
    legalOfficerName: null,
    legalNotes: null,
    registrarNotes: null,
    tokenId: null,
    txHash: null,
    idempotencyKey: input.idempotencyKey || null,
    submittedAt: now,
    updatedAt: now,
  };

  store.applications.unshift(app);

  publishMqttLog('anagu/application/submitted', {
    applicationId: app.id,
    parcelReference: app.parcelReference,
    applicantName: app.applicantName,
    spatialPassed: spatial.passed,
  }, 'SURVEYOR');

  publishMqttLog('anagu/verification/spatial-complete', {
    applicationId: app.id,
    parcelReference: app.parcelReference,
    passed: spatial.passed,
    overlapDetected: spatial.overlapDetected,
    areaSqm: spatial.areaSqm,
  }, 'CITIZEN');

  recordAudit(
    user.id,
    user.fullName,
    user.role,
    'APPLICATION_SUBMITTED',
    'APPLICATION',
    app.id,
    'SUCCESS',
    `Submitted application for ${app.parcelReference} (${app.address}); spatial check ${spatial.passed ? 'PASSED' : 'FAILED'}.`,
  );

  return { application: app, deduplicated: false };
}

export function performApplicationWorkflowAction(
  user: SafeUser,
  applicationId: string,
  action:
    | 'RUN_SPATIAL'
    | 'SUBMIT_SURVEY_REPORT'
    | 'RUN_ORACLE'
    | 'COMPLETE_LEGAL_REVIEW'
    | 'APPROVE_AND_MINT'
    | 'REJECT'
    | 'CANCEL',
  payload?: {
    findings?: string;
    boundaryConfirmed?: boolean;
    legalNotes?: string;
    registrarNotes?: string;
  },
): LandApplicationRecord {
  const store = getAnaguStore();
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) {
    throw new Error('Application not found');
  }

  const now = new Date().toISOString();

  switch (action) {
    case 'RUN_SPATIAL': {
      if (user.role !== 'SURVEYOR' && user.role !== 'LAND_ADMINISTRATOR') {
        recordAudit(user.id, user.fullName, user.role, action, 'APPLICATION', app.id, 'DENIED', 'Role not authorized for spatial review');
        throw new Error('FORBIDDEN: Only a licensed Surveyor or Land Administrator can execute spatial verification');
      }
      const spatial = verifyWktParcel(app.wkt, app.id, app.parcelId || undefined);
      app.spatialVerification = spatial;
      app.status = spatial.passed ? 'UNDER_SPATIAL_REVIEW' : 'SUBMITTED';
      app.updatedAt = now;
      publishMqttLog('anagu/verification/spatial-complete', {
        applicationId: app.id,
        parcelReference: app.parcelReference,
        passed: spatial.passed,
      }, 'CITIZEN');
      recordAudit(user.id, user.fullName, user.role, 'SPATIAL_VERIFICATION', 'APPLICATION', app.id, spatial.passed ? 'SUCCESS' : 'FAILED', `Spatial verification ${spatial.passed ? 'passed' : 'failed'}`);
      return app;
    }

    case 'SUBMIT_SURVEY_REPORT': {
      if (user.role !== 'SURVEYOR') {
        recordAudit(user.id, user.fullName, user.role, action, 'APPLICATION', app.id, 'DENIED', 'Only Surveyor can submit survey report');
        throw new Error('FORBIDDEN: Only a licensed Surveyor can submit a survey report');
      }
      const spatial = verifyWktParcel(app.wkt, app.id, app.parcelId || undefined);
      app.spatialVerification = spatial;
      if (!spatial.passed) {
        recordAudit(user.id, user.fullName, user.role, 'SUBMIT_SURVEY_REPORT', 'APPLICATION', app.id, 'FAILED', 'Blocked survey progression due to failed GIS spatial check');
        throw new Error('Cannot advance application: GIS spatial verification failed (invalid geometry or parcel overlap detected)');
      }
      app.surveyReport = {
        id: crypto.randomUUID(),
        surveyorId: user.id,
        surveyorName: user.fullName,
        findings: payload?.findings?.trim() || 'Boundary coordinates verified under EPSG:4326 with zero overlaps.',
        boundaryConfirmed: payload?.boundaryConfirmed ?? true,
        submittedAt: now,
      };
      // Automatically run ownership oracle upon survey clearance
      const oracle = runOracleCheck(app);
      app.oracleVerification = oracle;
      app.status =
        oracle.overallOutcome === 'VERIFIED'
          ? 'PENDING_LEGAL_VERIFICATION'
          : 'UNDER_OWNERSHIP_VERIFICATION';
      app.updatedAt = now;

      publishMqttLog('anagu/verification/ownership-complete', {
        applicationId: app.id,
        parcelReference: app.parcelReference,
        overallOutcome: oracle.overallOutcome,
      }, 'REGISTRAR');
      recordAudit(user.id, user.fullName, user.role, 'SURVEY_REPORT_SUBMITTED', 'APPLICATION', app.id, 'SUCCESS', `Survey report approved; Ownership Oracle outcome: ${oracle.overallOutcome}`);
      return app;
    }

    case 'RUN_ORACLE': {
      if (user.role !== 'REGISTRAR' && user.role !== 'LAND_ADMINISTRATOR') {
        recordAudit(user.id, user.fullName, user.role, action, 'APPLICATION', app.id, 'DENIED', 'Role not authorized for oracle re-check');
        throw new Error('FORBIDDEN: Only Registrar or Land Administrator can trigger Ownership Oracle verification');
      }
      if (!app.spatialVerification?.passed) {
        throw new Error('Cannot run Ownership Oracle before GIS spatial verification passes');
      }
      const oracle = runOracleCheck(app);
      app.oracleVerification = oracle;
      app.status =
        oracle.overallOutcome === 'VERIFIED'
          ? 'PENDING_LEGAL_VERIFICATION'
          : 'UNDER_OWNERSHIP_VERIFICATION';
      app.updatedAt = now;
      publishMqttLog('anagu/verification/ownership-complete', {
        applicationId: app.id,
        parcelReference: app.parcelReference,
        overallOutcome: oracle.overallOutcome,
      }, 'CITIZEN');
      recordAudit(user.id, user.fullName, user.role, 'ORACLE_VERIFICATION', 'APPLICATION', app.id, 'SUCCESS', `Ownership Oracle outcome: ${oracle.overallOutcome}`);
      return app;
    }

    case 'COMPLETE_LEGAL_REVIEW': {
      if (user.role !== 'REGISTRAR') {
        recordAudit(user.id, user.fullName, user.role, action, 'APPLICATION', app.id, 'DENIED', 'Only Registrar can complete legal verification');
        throw new Error('FORBIDDEN: Only Registrar can complete legal verification');
      }
      if (app.applicantId === user.id) {
        throw new Error('FORBIDDEN: Users cannot approve their own applications');
      }
      if (!app.spatialVerification?.passed) {
        throw new Error('Spatial verification has not passed');
      }
      if (app.oracleVerification?.overallOutcome !== 'VERIFIED') {
        throw new Error('Ownership Oracle must be VERIFIED before legal sign-off');
      }
      app.legalVerified = true;
      app.legalOfficerName = user.fullName;
      app.legalNotes = payload?.legalNotes?.trim() || 'Statutory title root and supporting instruments verified.';
      app.status = 'PENDING_REGISTRAR_APPROVAL';
      app.updatedAt = now;
      publishMqttLog('anagu/application/status-changed', {
        applicationId: app.id,
        status: app.status,
      }, 'CITIZEN');
      recordAudit(user.id, user.fullName, user.role, 'LEGAL_VERIFICATION_COMPLETE', 'APPLICATION', app.id, 'SUCCESS', `Legal verification cleared for ${app.parcelReference}`);
      return app;
    }

    case 'APPROVE_AND_MINT': {
      if (user.role !== 'REGISTRAR') {
        recordAudit(user.id, user.fullName, user.role, action, 'APPLICATION', app.id, 'DENIED', 'Only Registrar can approve and mint land title NFT');
        throw new Error('FORBIDDEN: Only Registrar can approve applications and mint LandTitleNFT');
      }
      if (app.applicantId === user.id) {
        throw new Error('FORBIDDEN: Users cannot approve their own applications');
      }
      if (!app.spatialVerification?.passed) {
        throw new Error('Workflow gate blocked: GIS spatial verification must pass before minting');
      }
      if (!app.surveyReport?.boundaryConfirmed) {
        throw new Error('Workflow gate blocked: Surveyor boundary confirmation is required');
      }
      if (app.oracleVerification?.overallOutcome !== 'VERIFIED') {
        throw new Error('Workflow gate blocked: Ownership Oracle must return VERIFIED');
      }
      if (!app.legalVerified) {
        throw new Error('Workflow gate blocked: Legal verification must be completed first');
      }
      if (app.tokenId !== null) {
        throw new Error('Title NFT has already been minted for this application');
      }

      // Parse WKT ring to add parcel to GIS map
      const coordsMatch = app.wkt.match(/POLYGON\s*\(\(([^)]+)\)\)/i);
      const ring = coordsMatch
        ? coordsMatch[1].split(',').map((pair) => {
            const [lon, lat] = pair.trim().split(/\s+/).map(Number);
            return [lon, lat];
          })
        : [];
      const geometry: GeoJsonPolygon = { type: 'Polygon', coordinates: [ring] };
      const parcelId = app.parcelId || crypto.randomUUID();

      const existingParcel = getAllEffectiveParcels().find((p) => p.id === parcelId || p.parcelNumber === app.parcelReference);
      if (!existingParcel) {
        store.extraParcels.unshift({
          id: parcelId,
          parcelNumber: app.parcelReference,
          geometry,
          areaSqm: app.spatialVerification.areaSqm,
          state: app.state,
          lga: app.lga,
          address: app.address,
          status: 'active',
          ownerId: app.applicantId,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        store.parcelStatusOverrides.set(existingParcel.id, 'active');
      }

      const applicant = store.users.find((u) => u.id === app.applicantId);
      const tokenId = store.nextTokenId++;
      const blockNumber = store.nextBlockNumber++;
      const txHash = makeTxHash(`mint:${app.parcelReference}:${tokenId}`);
      const docConcatHash = sha256(app.documents.map((d) => d.sha256Hash).join(':'));

      const title: DigitalLandTitle = {
        tokenId,
        applicationId: app.id,
        parcelId: existingParcel?.id || parcelId,
        parcelReference: app.parcelReference,
        address: app.address,
        lga: app.lga,
        state: app.state,
        areaSqm: app.spatialVerification.areaSqm,
        ownerId: app.applicantId,
        ownerName: app.claimantName,
        ownerAddress: applicant?.walletAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        ownerReferenceHash: sha256(app.applicantId),
        spatialHash: sha256(app.wkt),
        documentHash: docConcatHash,
        txHash,
        blockNumber,
        issuedAt: now,
        isRevoked: false,
        revokedAt: null,
        revocationGrounds: null,
        revocationReference: null,
        revocationJustification: null,
        revokedByName: null,
        ownershipHistory: [
          {
            fromAddress: '0x0000000000000000000000000000000000000000',
            toAddress: applicant?.walletAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            toName: app.claimantName,
            txHash,
            timestamp: now,
            action: 'ISSUED',
          },
        ],
      };

      store.titles.unshift(title);
      app.parcelId = title.parcelId;
      app.tokenId = tokenId;
      app.txHash = txHash;
      app.registrarNotes = payload?.registrarNotes?.trim() || 'Approved by Registrar and minted on Besu LandRegistry.';
      app.status = 'REGISTERED';
      app.updatedAt = now;

      publishMqttLog('anagu/title/minted', {
        tokenId,
        applicationId: app.id,
        parcelReference: app.parcelReference,
        txHash,
        blockNumber,
      }, 'CITIZEN');

      recordAudit(
        user.id,
        user.fullName,
        user.role,
        'MINT_LAND_TITLE_NFT',
        'TITLE',
        `TOKEN-${tokenId}`,
        'SUCCESS',
        `Approved ${app.parcelReference} and minted ERC-721 Title #${tokenId} (tx ${txHash.slice(0, 14)}...)`,
      );
      return app;
    }

    case 'REJECT': {
      if (user.role !== 'REGISTRAR' && user.role !== 'SURVEYOR' && user.role !== 'LAND_ADMINISTRATOR') {
        recordAudit(user.id, user.fullName, user.role, action, 'APPLICATION', app.id, 'DENIED', 'Role not authorized to reject applications');
        throw new Error('FORBIDDEN: Not authorized to reject applications');
      }
      app.status = 'REJECTED';
      app.registrarNotes = payload?.registrarNotes?.trim() || 'Application rejected during statutory review.';
      app.updatedAt = now;
      publishMqttLog('anagu/application/status-changed', {
        applicationId: app.id,
        status: 'REJECTED',
        reason: app.registrarNotes,
      }, 'CITIZEN');
      recordAudit(user.id, user.fullName, user.role, 'APPLICATION_REJECTED', 'APPLICATION', app.id, 'SUCCESS', `Rejected ${app.parcelReference}: ${app.registrarNotes}`);
      return app;
    }

    case 'CANCEL': {
      if (app.applicantId !== user.id && user.role !== 'LAND_ADMINISTRATOR') {
        throw new Error('FORBIDDEN: Only the applicant or Land Administrator can cancel this draft/application');
      }
      if (app.status === 'REGISTERED' || app.status === 'REVOKED') {
        throw new Error('Cannot cancel an already registered or revoked title');
      }
      app.status = 'CANCELLED';
      app.updatedAt = now;
      recordAudit(user.id, user.fullName, user.role, 'APPLICATION_CANCELLED', 'APPLICATION', app.id, 'SUCCESS', `Cancelled application ${app.parcelReference}`);
      return app;
    }
  }
}

export function transferTitleOwnership(
  user: SafeUser,
  tokenId: number,
  newOwnerEmailOrId: string,
  bypassAttempt?: boolean,
): DigitalLandTitle {
  const store = getAnaguStore();
  const title = store.titles.find((t) => t.tokenId === tokenId);
  if (!title) {
    throw new Error(`Title #${tokenId} not found`);
  }

  if (bypassAttempt || user.role !== 'REGISTRAR') {
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'DIRECT_NFT_TRANSFER_BLOCKED',
      'TITLE',
      `TOKEN-${tokenId}`,
      'DENIED',
      `Rejected non-registry transfer attempt on Title #${tokenId} (${title.parcelReference}) — LandRegistry.sol requires REGISTRAR_ROLE.`,
    );
    throw new Error(
      'FORBIDDEN: Direct owner-to-owner NFT transfers are blocked by LandRegistry.sol. Transfers require authorised REGISTRAR_ROLE execution.',
    );
  }

  if (title.isRevoked) {
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'REVOKED_TITLE_TRANSFER_BLOCKED',
      'TITLE',
      `TOKEN-${tokenId}`,
      'DENIED',
      `Blocked transfer of statutorily revoked Title #${tokenId} (${title.parcelReference}).`,
    );
    throw new Error('CONFLICT: Cannot transfer a title that has been statutorily revoked.');
  }

  const recipient = store.users.find(
    (u) =>
      u.id === newOwnerEmailOrId ||
      u.email.toLowerCase() === newOwnerEmailOrId.trim().toLowerCase(),
  );
  if (!recipient) {
    throw new Error('Recipient user account not found');
  }

  const now = new Date().toISOString();
  const txHash = makeTxHash(`transfer:${tokenId}:${recipient.id}`);
  const fromAddr = title.ownerAddress;

  title.ownerId = recipient.id;
  title.ownerName = recipient.fullName;
  title.ownerAddress = recipient.walletAddress;
  title.ownerReferenceHash = sha256(recipient.id);
  title.txHash = txHash;
  title.blockNumber = store.nextBlockNumber++;
  title.ownershipHistory.push({
    fromAddress: fromAddr,
    toAddress: recipient.walletAddress,
    toName: recipient.fullName,
    txHash,
    timestamp: now,
    action: 'TRANSFERRED',
  });

  publishMqttLog('anagu/application/status-changed', {
    event: 'OWNERSHIP_TRANSFERRED',
    tokenId,
    parcelReference: title.parcelReference,
    newOwnerName: recipient.fullName,
    txHash,
  }, 'CITIZEN');

  recordAudit(
    user.id,
    user.fullName,
    user.role,
    'OWNERSHIP_TRANSFERRED',
    'TITLE',
    `TOKEN-${tokenId}`,
    'SUCCESS',
    `Registry-controlled transfer of Title #${tokenId} (${title.parcelReference}) to ${recipient.fullName} (tx ${txHash.slice(0, 14)}...)`,
  );

  return title;
}

export function revokeLandTitle(
  user: SafeUser,
  input: {
    tokenId: number;
    grounds: RevocationGround;
    administrativeReference: string;
    justification: string;
  },
): DigitalLandTitle {
  const store = getAnaguStore();
  const title = store.titles.find((t) => t.tokenId === input.tokenId);
  if (!title) {
    throw new Error(`Title #${input.tokenId} not found`);
  }

  if (user.role !== 'GOVERNOR') {
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'UNAUTHORIZED_REVOCATION_BLOCKED',
      'TITLE',
      `TOKEN-${input.tokenId}`,
      'DENIED',
      `Rejected statutory revocation attempt by non-GOVERNOR role (${user.role}) on Title #${input.tokenId}.`,
    );
    throw new Error(
      'FORBIDDEN: Only an authorised GOVERNOR_ROLE account may execute statutory revocation under Section 28 of the Land Use Act 1978.',
    );
  }

  if (title.isRevoked) {
    throw new Error(`Title #${input.tokenId} has already been revoked`);
  }

  if (
    input.grounds !== 'Overriding Public Interest' &&
    input.grounds !== 'Breach of Statutory Condition'
  ) {
    throw new Error(
      'Invalid statutory ground. Must be "Overriding Public Interest" or "Breach of Statutory Condition".',
    );
  }

  if (!input.administrativeReference.trim() || !input.justification.trim()) {
    throw new Error('Administrative gazette reference and legal justification are required.');
  }

  const now = new Date().toISOString();
  const txHash = makeTxHash(`revoke:${input.tokenId}:${input.grounds}`);

  title.isRevoked = true;
  title.revokedAt = now;
  title.revocationGrounds = input.grounds;
  title.revocationReference = input.administrativeReference.trim();
  title.revocationJustification = input.justification.trim();
  title.revokedByName = user.fullName;
  title.ownershipHistory.push({
    fromAddress: title.ownerAddress,
    toAddress: '0x000000000000000000000000000000000000dEaD',
    toName: `STATUTORY REVOCATION (${input.grounds})`,
    txHash,
    timestamp: now,
    action: 'REVOKED',
  });

  // Update GIS parcel status to revoked and application status to REVOKED
  store.parcelStatusOverrides.set(title.parcelId, 'revoked');
  const app = store.applications.find((a) => a.id === title.applicationId);
  if (app) {
    app.status = 'REVOKED';
    app.updatedAt = now;
  }

  publishMqttLog('anagu/title/revoked', {
    tokenId: title.tokenId,
    parcelReference: title.parcelReference,
    grounds: input.grounds,
    administrativeReference: title.revocationReference,
    txHash,
    revokedAt: now,
  }, 'ALL');

  recordAudit(
    user.id,
    user.fullName,
    user.role,
    'STATUTORY_TITLE_REVOCATION',
    'TITLE',
    `TOKEN-${title.tokenId}`,
    'SUCCESS',
    `Governor revoked Title #${title.tokenId} (${title.parcelReference}) under Land Use Act 1978 Sec. 28 — Ground: ${input.grounds} (Ref: ${title.revocationReference})`,
  );

  return title;
}
