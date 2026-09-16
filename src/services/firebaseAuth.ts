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
const EXPIRY_KEY = 'mha_google_token_expiry';

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
      if (onAuthFailure) onAuthFailure();
    } else {
      cachedAccessToken = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EXPIRY_KEY);
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
    // Google OAuth access tokens expire in 1 hour; store a 55-minute expiry timestamp
    const expiresAt = Date.now() + 55 * 60 * 1000;
    localStorage.setItem(EXPIRY_KEY, expiresAt.toString());

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return { user: null, accessToken: null, cancelled: true };
    }
    return {
      user: null,
      accessToken: null,
      error: error?.message || 'Failed to complete Google Sign-In.',
    };
  }
};

export const isTokenExpired = (): boolean => {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() >= parseInt(expiry, 10);
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem(TOKEN_KEY);
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, (Date.now() + 55 * 60 * 1000).toString());
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
};
