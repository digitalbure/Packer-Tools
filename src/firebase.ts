import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { toast } from 'sonner';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with a more robust strategy for handling IndexedDB errors (common in sandboxed iframes)
let dbInstance;
try {
  // Use a safer initialization that explicitly handles potential failures in setting up persistence
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({})
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Primary Firestore initialization failed. Falling back to memory cache.", e);
  dbInstance = initializeFirestore(app, {
    localCache: memoryLocalCache()
  }, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let isSigningIn = false;

export const signInWithGoogle = async () => {
  if (isSigningIn) {
    console.warn('A sign-in request is already in progress.');
    return null;
  }
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the login popup');
      return null;
    }
    
    let errorMsg = error.message || String(error);
    if (error.code === 'auth/cancelled-popup-request') {
      errorMsg = 'Sign-in request is already active, or was blocked/cancelled by the iframe environment settings.';
    }

    const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
    if (isEmbedded) {
      toast.error(
        `Firebase Login Error: ${errorMsg}. Since this app is running in an iframe preview, cookies/popups might be restricted. Press the "Open in new tab" icon at the top right of your preview to log in successfully!`,
        { duration: 8000 }
      );
    } else {
      toast.error(`Firebase Login Error: ${errorMsg}`);
    }

    console.error('Login error:', error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
