import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../../../firebase-applet-config.json';
import type {
  AuditLogEntry,
  DigitalLandTitle,
  LandApplicationRecord,
  LandListingRecord,
  LandPurchaseRecord,
} from '../components/dashboard/types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const BOOTSTRAPPED_ADMIN_EMAIL = 'blinxtanimuyakakum@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Online response (including permission-denied when unauthenticated or missing doc) confirms connectivity
    return true;
  }
}

function sanitizeId(raw: string, fallback = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeWallet(addr?: string | null): string {
  if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) return addr;
  return '0x0000000000000000000000000000000000000000';
}

export async function syncFirebaseUserRecords(input: {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  walletAddress?: string;
  walletVerified?: boolean;
}): Promise<void> {
  const uid = sanitizeId(input.uid);
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  const displayName = (input.displayName || 'ANAGU User').slice(0, 120);
  const walletAddress = normalizeWallet(input.walletAddress);

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName,
        role: 'CITIZEN',
        walletAddress,
        walletVerified: Boolean(input.walletVerified),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        walletAddress,
        walletVerified: Boolean(input.walletVerified),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const existingPrivate = await getDoc(privateRef);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid,
        email: (input.email || 'user@anagu.gov.ng').slice(0, 200),
        phone: (input.phone || '').slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email: (input.email || 'user@anagu.gov.ng').slice(0, 200),
        phone: (input.phone || '').slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function persistApplicationToFirestore(
  firebaseUid: string,
  appRecord: LandApplicationRecord,
): Promise<void> {
  const docId = sanitizeId(appRecord.id);
  const path = `applications/${docId}`;
  const ref = doc(db, 'applications', docId);
  const parcelRef = sanitizeId(appRecord.parcelReference, 'PARCEL').slice(0, 64);

  const documentHashes = appRecord.documents.slice(0, 10).map((d) => d.sha256Hash.slice(0, 200));
  const documentNames = appRecord.documents.slice(0, 10).map((d) => d.fileName.slice(0, 200));

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        applicantId: sanitizeId(firebaseUid),
        applicantName: appRecord.applicantName.slice(0, 120),
        parcelReference: parcelRef.length >= 2 ? parcelRef : 'LG-01',
        state: appRecord.state.slice(0, 64),
        lga: appRecord.lga.slice(0, 64),
        address: appRecord.address.slice(0, 240),
        wkt: appRecord.wkt.slice(0, 4000),
        claimantName: appRecord.claimantName.slice(0, 120),
        nationalIdHash: (appRecord.nationalIdHash || '0x0000').slice(0, 128),
        documentHashes,
        documentNames,
        status: appRecord.spatialVerification?.passed ? 'UNDER_SPATIAL_REVIEW' : 'SUBMITTED',
        spatialPassed: Boolean(appRecord.spatialVerification?.passed),
        areaSqm: Math.max(0, Number(appRecord.spatialVerification?.areaSqm || 0)),
        surveyConfirmed: Boolean(appRecord.surveyReport?.boundaryConfirmed),
        oracleOutcome: appRecord.oracleVerification?.overallOutcome || 'PENDING',
        legalVerified: false,
        ...(appRecord.idempotencyKey ? { idempotencyKey: appRecord.idempotencyKey.slice(0, 128) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        status: appRecord.status,
        spatialPassed: Boolean(appRecord.spatialVerification?.passed),
        areaSqm: Math.max(0, Number(appRecord.spatialVerification?.areaSqm || 0)),
        surveyConfirmed: Boolean(appRecord.surveyReport?.boundaryConfirmed),
        oracleOutcome: appRecord.oracleVerification?.overallOutcome || 'PENDING',
        legalVerified: Boolean(appRecord.legalVerified),
        ...(appRecord.tokenId !== null ? { tokenId: appRecord.tokenId } : {}),
        ...(appRecord.txHash ? { txHash: appRecord.txHash.slice(0, 128) } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistTitleToFirestore(
  ownerUid: string,
  title: DigitalLandTitle,
): Promise<void> {
  const docId = sanitizeId(`token-${title.tokenId}`);
  const path = `titles/${docId}`;
  const ref = doc(db, 'titles', docId);
  const parcelRef = sanitizeId(title.parcelReference, 'PARCEL').slice(0, 64);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        tokenId: title.tokenId,
        applicationId: sanitizeId(title.applicationId),
        parcelReference: parcelRef.length >= 2 ? parcelRef : 'LG-01',
        address: title.address.slice(0, 240),
        lga: title.lga.slice(0, 64),
        state: title.state.slice(0, 64),
        areaSqm: Math.max(1, Number(title.areaSqm || 1)),
        ownerId: sanitizeId(ownerUid),
        ownerName: title.ownerName.slice(0, 120),
        ownerAddress: normalizeWallet(title.ownerAddress),
        spatialHash: title.spatialHash.slice(0, 128),
        documentHash: title.documentHash.slice(0, 128),
        txHash: title.txHash.slice(0, 128),
        isRevoked: Boolean(title.isRevoked),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (title.isRevoked) {
      await updateDoc(ref, {
        isRevoked: true,
        revocationGrounds: (title.revocationGrounds || 'Overriding Public Interest').slice(0, 64),
        revocationReference: (title.revocationReference || 'GAZETTE-S28').slice(0, 128),
        revocationJustification: (title.revocationJustification || 'Section 28 revocation').slice(0, 1000),
        txHash: title.txHash.slice(0, 128),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ownerId: sanitizeId(ownerUid),
        ownerName: title.ownerName.slice(0, 120),
        ownerAddress: normalizeWallet(title.ownerAddress),
        txHash: title.txHash.slice(0, 128),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistAuditLogToFirestore(
  firebaseUid: string,
  entry: AuditLogEntry,
): Promise<void> {
  const docId = sanitizeId(entry.id);
  const path = `audit_logs/${docId}`;
  try {
    await setDoc(doc(db, 'audit_logs', docId), {
      id: docId,
      actorId: sanitizeId(firebaseUid),
      actorName: entry.actorName.slice(0, 120),
      actorRole: entry.actorRole.slice(0, 40),
      action: entry.action.slice(0, 80),
      entityType: entry.entityType,
      entityId: entry.entityId.slice(0, 128),
      outcome: entry.outcome,
      details: entry.details.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function persistContactToFirestore(
  firebaseUid: string,
  entry: {
    id: string;
    name: string;
    organization: string;
    subject: string;
    message: string;
  },
): Promise<void> {
  const docId = sanitizeId(entry.id);
  const path = `contacts/${docId}`;
  try {
    await setDoc(doc(db, 'contacts', docId), {
      id: docId,
      senderUid: sanitizeId(firebaseUid),
      name: entry.name.slice(0, 120),
      organization: entry.organization.slice(0, 120),
      subject: entry.subject.slice(0, 120),
      message: entry.message.slice(0, 2000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function persistListingToFirestore(
  firebaseUid: string,
  listing: LandListingRecord,
): Promise<void> {
  const docId = sanitizeId(listing.id);
  const path = `listings/${docId}`;
  const ref = doc(db, 'listings', docId);
  const parcelRef = sanitizeId(listing.parcelReference, 'PARCEL').slice(0, 64);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        parcelReference: parcelRef.length >= 2 ? parcelRef : 'LG-01',
        title: listing.title.slice(0, 160),
        address: listing.address.slice(0, 240),
        lga: listing.lga.slice(0, 64),
        state: listing.state.slice(0, 64),
        areaSqm: Math.max(1, Number(listing.areaSqm || 1)),
        zoning: listing.zoning,
        priceNgn: Math.max(1, Number(listing.priceNgn || 1)),
        priceEth: listing.priceEth.slice(0, 32),
        sellerId: sanitizeId(firebaseUid),
        sellerName: listing.sellerName.slice(0, 120),
        sellerAddress: normalizeWallet(listing.sellerAddress),
        listingType: listing.listingType,
        status: listing.status === 'SOLD' ? 'AVAILABLE' : listing.status,
        ...(listing.tokenId !== null ? { tokenId: listing.tokenId } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (listing.status === 'SOLD') {
        await updateDoc(ref, {
          status: 'SOLD',
          buyerId: sanitizeId(firebaseUid),
          buyerName: (listing.buyerName || 'ANAGU Buyer').slice(0, 120),
          ...(listing.purchaseTxHash ? { purchaseTxHash: listing.purchaseTxHash.slice(0, 128) } : {}),
          ...(listing.tokenId !== null ? { tokenId: listing.tokenId } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } else if (listing.status === 'SOLD') {
      await updateDoc(ref, {
        status: 'SOLD',
        buyerId: sanitizeId(firebaseUid),
        buyerName: (listing.buyerName || 'ANAGU Buyer').slice(0, 120),
        ...(listing.purchaseTxHash ? { purchaseTxHash: listing.purchaseTxHash.slice(0, 128) } : {}),
        ...(listing.tokenId !== null ? { tokenId: listing.tokenId } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistPurchaseToFirestore(
  firebaseUid: string,
  purchase: LandPurchaseRecord,
): Promise<void> {
  const docId = sanitizeId(purchase.id);
  const path = `purchases/${docId}`;
  const parcelRef = sanitizeId(purchase.parcelReference, 'PARCEL').slice(0, 64);
  try {
    await setDoc(doc(db, 'purchases', docId), {
      id: docId,
      listingId: sanitizeId(purchase.listingId),
      parcelReference: parcelRef.length >= 2 ? parcelRef : 'LG-01',
      title: purchase.title.slice(0, 160),
      address: purchase.address.slice(0, 240),
      lga: purchase.lga.slice(0, 64),
      buyerId: sanitizeId(firebaseUid),
      buyerName: purchase.buyerName.slice(0, 120),
      buyerWallet: normalizeWallet(purchase.buyerWallet),
      priceNgn: Math.max(1, Number(purchase.priceNgn || 1)),
      priceEth: purchase.priceEth.slice(0, 32),
      paymentMethod: purchase.paymentMethod,
      txHash: purchase.txHash.slice(0, 128),
      tokenId: Math.max(1, Number(purchase.tokenId || 1)),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeFirestoreCollectionCounts(
  uid: string,
  email: string | null,
  onCounts: (counts: { applications: number; titles: number }) => void,
): Unsubscribe {
  const isBootAdmin = email === BOOTSTRAPPED_ADMIN_EMAIL;
  const appsPath = 'applications';
  const titlesPath = 'titles';

  const appsQuery = isBootAdmin
    ? collection(db, appsPath)
    : query(collection(db, appsPath), where('applicantId', '==', sanitizeId(uid)));

  const titlesQuery = isBootAdmin
    ? collection(db, titlesPath)
    : query(collection(db, titlesPath), where('ownerId', '==', sanitizeId(uid)));

  let latestApps = 0;
  let latestTitles = 0;

  const unsubApps = onSnapshot(
    appsQuery,
    (snap) => {
      latestApps = snap.size;
      onCounts({ applications: latestApps, titles: latestTitles });
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, appsPath);
    },
  );

  const unsubTitles = onSnapshot(
    titlesQuery,
    (snap) => {
      latestTitles = snap.size;
      onCounts({ applications: latestApps, titles: latestTitles });
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, titlesPath);
    },
  );

  return () => {
    unsubApps();
    unsubTitles();
  };
}
