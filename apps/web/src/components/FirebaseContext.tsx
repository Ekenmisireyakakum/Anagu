'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  persistApplicationToFirestore,
  persistAuditLogToFirestore,
  persistContactToFirestore,
  persistListingToFirestore,
  persistPurchaseToFirestore,
  persistTitleToFirestore,
  subscribeFirestoreCollectionCounts,
  syncFirebaseUserRecords,
  testFirestoreConnection,
} from '../lib/firebase';
import type {
  AuditLogEntry,
  DigitalLandTitle,
  LandApplicationRecord,
  LandListingRecord,
  LandPurchaseRecord,
} from './dashboard/types';

interface FirebaseContextValue {
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  firestoreConnected: boolean;
  firestoreCounts: { applications: number; titles: number };
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (walletAddress?: string | null) => Promise<FirebaseUser | null>;
  signOutFirebase: () => Promise<void>;
  syncWalletProfile: (walletAddress: string, walletVerified: boolean) => Promise<void>;
  syncApplication: (app: LandApplicationRecord) => Promise<void>;
  syncTitle: (title: DigitalLandTitle) => Promise<void>;
  syncAudit: (entry: AuditLogEntry) => Promise<void>;
  syncListing: (listing: LandListingRecord) => Promise<void>;
  syncPurchase: (purchase: LandPurchaseRecord) => Promise<void>;
  syncContact: (entry: {
    id: string;
    name: string;
    organization: string;
    subject: string;
    message: string;
  }) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [firestoreCounts, setFirestoreCounts] = useState({ applications: 0, titles: 0 });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection().then(setFirestoreConnected);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) {
      setFirestoreCounts({ applications: 0, titles: 0 });
      return;
    }

    const unsub = subscribeFirestoreCollectionCounts(
      firebaseUser.uid,
      firebaseUser.email,
      setFirestoreCounts,
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(
    async (walletAddress?: string | null): Promise<FirebaseUser | null> => {
      setAuthError(null);
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await syncFirebaseUserRecords({
          uid: user.uid,
          displayName: user.displayName || user.email || 'ANAGU User',
          email: user.email || '',
          walletAddress: walletAddress || undefined,
          walletVerified: Boolean(walletAddress),
        });
        return user;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Firebase Google sign-in failed';
        setAuthError(msg);
        return null;
      }
    },
    [],
  );

  const signOutFirebase = useCallback(async () => {
    await signOut(auth);
  }, []);

  const syncWalletProfile = useCallback(
    async (walletAddress: string, walletVerified: boolean) => {
      if (!firebaseUser) return;
      await syncFirebaseUserRecords({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email || 'ANAGU User',
        email: firebaseUser.email || '',
        walletAddress,
        walletVerified,
      });
    },
    [firebaseUser],
  );

  const syncApplication = useCallback(
    async (appRecord: LandApplicationRecord) => {
      if (!firebaseUser) return;
      await persistApplicationToFirestore(firebaseUser.uid, appRecord);
    },
    [firebaseUser],
  );

  const syncTitle = useCallback(
    async (title: DigitalLandTitle) => {
      if (!firebaseUser) return;
      await persistTitleToFirestore(firebaseUser.uid, title);
    },
    [firebaseUser],
  );

  const syncAudit = useCallback(
    async (entry: AuditLogEntry) => {
      if (!firebaseUser) return;
      await persistAuditLogToFirestore(firebaseUser.uid, entry);
    },
    [firebaseUser],
  );

  const syncListing = useCallback(
    async (listing: LandListingRecord) => {
      if (!firebaseUser) return;
      await persistListingToFirestore(firebaseUser.uid, listing);
    },
    [firebaseUser],
  );

  const syncPurchase = useCallback(
    async (purchase: LandPurchaseRecord) => {
      if (!firebaseUser) return;
      await persistPurchaseToFirestore(firebaseUser.uid, purchase);
    },
    [firebaseUser],
  );

  const syncContact = useCallback(
    async (entry: {
      id: string;
      name: string;
      organization: string;
      subject: string;
      message: string;
    }) => {
      if (!firebaseUser) return;
      await persistContactToFirestore(firebaseUser.uid, entry);
    },
    [firebaseUser],
  );

  const value = useMemo<FirebaseContextValue>(
    () => ({
      firebaseUser,
      authReady,
      firestoreConnected,
      firestoreCounts,
      authError,
      clearAuthError,
      signInWithGoogle,
      signOutFirebase,
      syncWalletProfile,
      syncApplication,
      syncTitle,
      syncAudit,
      syncListing,
      syncPurchase,
      syncContact,
    }),
    [
      firebaseUser,
      authReady,
      firestoreConnected,
      firestoreCounts,
      authError,
      clearAuthError,
      signInWithGoogle,
      signOutFirebase,
      syncWalletProfile,
      syncApplication,
      syncTitle,
      syncAudit,
      syncListing,
      syncPurchase,
      syncContact,
    ],
  );

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
