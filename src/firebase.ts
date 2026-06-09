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

const dbId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-8af96458-c1d9-4cdf-9c9a-815dee7f9c70";

// Initialize Firestore with memory cache to bypass persistent IndexedDB corruption errors inside sandboxed iframes
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: memoryLocalCache()
  }, dbId);
} catch (e) {
  console.warn("Primary Firestore initialization failed. Falling back to default getFirestore.", e);
  dbInstance = getFirestore(app, dbId);
}

export const db = dbInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/chat.spaces');
googleProvider.addScope('https://www.googleapis.com/auth/chat.messages.create');

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('packer_google_access_token') : null;

export const getAccessToken = () => cachedAccessToken;
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('packer_google_access_token', token);
  } else {
    localStorage.removeItem('packer_google_access_token');
  }
};

export const signInWithGoogle = async () => {
  if (isSigningIn) {
    console.warn('A sign-in request is already in progress.');
    return null;
  }
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem('packer_google_access_token', credential.accessToken);
      }
    }
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

    if (error.code === 'auth/configuration-not-found' || errorMsg.includes('configuration-not-found')) {
      const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
      const setupInstructions = isEmbedded 
        ? "⚠️ Action Required: Google Authentication is not enabled for this project.\n\n1. Enable Auth in your Firebase Console: https://console.firebase.google.com/project/packer-tools-app/authentication\n2. Turn on Google authentication provider.\n3. Be sure to click 'Open in new tab' on this preview's top-right to log in successfully!"
        : "⚠️ Action Required: Google Authentication is not enabled for this project.\n\n1. Visit the Firebase Authentication page: https://console.firebase.google.com/project/packer-tools-app/authentication\n2. Click 'Get Started' and enable the 'Google' sign-in provider in the 'Sign-in method' tab!";
      
      toast.error(setupInstructions, { duration: 25000 });
      console.warn('Login warning (configuration not found):', error);
      return null;
    }

    if (error.code === 'auth/unauthorized-domain' || errorMsg.includes('unauthorized-domain')) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const projectId = firebaseConfig.projectId || 'packer-tools-app';
      const setupInstructions = `⚠️ Unauthorized Domain: "${hostname}" must be authorized in Firebase.\n\n` +
        `1. Open Firebase Console for your project:\n` +
        `   https://console.firebase.google.com/project/${projectId}/authentication/settings\n` +
        `2. Look for "Authorized domains" and click "Add domain".\n` +
        `3. Copy & paste this hostname:\n` +
        `   👉 ${hostname}\n` +
        `4. Refresh or click Sign In again to log in successfully!`;

      toast.error(setupInstructions, { duration: 30000 });
      console.warn('Login warning (unauthorized domain):', error);
      return null;
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

    console.warn('Login warning:', error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const logout = () => {
  localStorage.removeItem('packer_demo_bypass');
  localStorage.removeItem('packer_google_access_token');
  cachedAccessToken = null;
  return signOut(auth);
};

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
