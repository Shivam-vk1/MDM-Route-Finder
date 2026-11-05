import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocFromServer, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Strictly authorized administrator email
export const AUTHORIZED_ADMIN_EMAIL = 'shivamvk1090@gmail.com';

// Test Firestore connection on boot as required by skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Required Structured Error Handler
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
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

// Check if a Firebase user is the authorized administrator
export function isAuthorizedAdminUser(user: User | null): boolean {
  if (!user || !user.email) return false;
  return (
    user.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase() &&
    user.emailVerified === true
  );
}

// Sign in with Google Popup (with account chooser so user can pick shivamvk1090@gmail.com)
export async function signInWithGoogleAdmin(): Promise<{
  success: boolean;
  user?: User;
  isAuthorized?: boolean;
  error?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const isAuthorized = isAuthorizedAdminUser(user);

    if (!isAuthorized) {
      return {
        success: false,
        user,
        isAuthorized: false,
        error: `Unauthorized Google Account (${user.email}). Only ${AUTHORIZED_ADMIN_EMAIL} is permitted to access Admin controls.`,
      };
    }

    return {
      success: true,
      user,
      isAuthorized: true,
    };
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Google Sign-In popup was closed before completing login.' };
    }
    return {
      success: false,
      error: err?.message || 'Google authentication failed. Please try again.',
    };
  }
}

export async function signOutAdmin(): Promise<void> {
  await firebaseSignOut(auth);
}

export {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onAuthStateChanged,
};
export type { User };
