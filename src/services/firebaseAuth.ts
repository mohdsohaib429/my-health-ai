import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({
  prompt: 'select_account',
});

const TOKEN_KEY = 'mha_google_access_token';

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem(TOKEN_KEY);

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const storedToken = cachedAccessToken || localStorage.getItem(TOKEN_KEY);
    if (user && storedToken) {
      cachedAccessToken = storedToken;
      if (onAuthSuccess) onAuthSuccess(user, storedToken);
    } else if (user && !storedToken) {
      // User is authenticated in Firebase, but we need the Google Sheets token
      if (onAuthFailure) onAuthFailure();
    } else {
      cachedAccessToken = null;
      localStorage.removeItem(TOKEN_KEY);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export interface SignInResponse {
  user: User | null;
  accessToken: string | null;
  cancelled?: boolean;
  error?: string;
}

export const googleSignIn = async (): Promise<SignInResponse> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return {
        user: null,
        accessToken: null,
        error: 'Signed in, but Google access token for Sheets/Drive was not granted.',
      };
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem(TOKEN_KEY, credential.accessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      console.info('Google Sign-In popup was closed or cancelled by the user.');
      return {
        user: null,
        accessToken: null,
        cancelled: true,
      };
    }

    if (error?.code === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by the browser.');
      return {
        user: null,
        accessToken: null,
        error: 'Popup was blocked by your browser. Please allow popups for this site or open in a new tab.',
      };
    }

    if (error?.code === 'auth/unauthorized-domain') {
      console.error('Firebase Auth domain not authorized:', error);
      return {
        user: null,
        accessToken: null,
        error: 'Current domain is not in the Firebase Auth authorized domains list.',
      };
    }

    console.warn('Google Sign-In error:', error?.message || error);
    return {
      user: null,
      accessToken: null,
      error: error?.message || 'Failed to complete Google Sign-In.',
    };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem(TOKEN_KEY);
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem(TOKEN_KEY);
};
