import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  reauthenticateWithPopup,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const getProvider = (emailHint?: string | null) => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  
  const customParams: Record<string, string> = {};
  if (emailHint) {
    customParams.login_hint = emailHint;
  }
  provider.setCustomParameters(customParams);
  return provider;
};

const TOKEN_KEY = 'mha_google_access_token';
const EXPIRY_KEY = 'mha_google_token_expiry';

let cachedAccessToken: string | null = localStorage.getItem(TOKEN_KEY);

export const isTokenExpired = (): boolean => {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return true; // Treat absent expiry as expired
  // Return true if expired or within 2 minutes of expiration
  return Date.now() >= parseInt(expiry, 10) - 2 * 60 * 1000;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, (Date.now() + 55 * 60 * 1000).toString());
  } else {
    cachedAccessToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  // 1. If we have a valid, non-expired token, return it immediately
  if (cachedAccessToken && !isTokenExpired()) {
    return cachedAccessToken;
  }

  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken && !isTokenExpired()) {
    cachedAccessToken = storedToken;
    return storedToken;
  }

  // 2. Token is missing or expired. If user is logged into Firebase, refresh it
  if (auth.currentUser) {
    try {
      const provider = getProvider(auth.currentUser.email);
      // Re-authenticate or trigger seamless popup to fetch a fresh Google OAuth access token
      const result = await reauthenticateWithPopup(auth.currentUser, provider).catch(() =>
        signInWithPopup(auth, provider)
      );
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        return credential.accessToken;
      }
    } catch (err) {
      console.warn('Silent token refresh failed or was closed:', err);
    }
  }

  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      setAccessToken(null);
      if (onAuthFailure) onAuthFailure();
      return;
    }

    const token = await getAccessToken();
    if (token) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      // User is logged into Firebase, but Google Sheets token is expired/missing
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
    const provider = getProvider(auth.currentUser?.email);
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return {
        user: null,
        accessToken: null,
        error: 'Signed in, but Google access token for Sheets/Drive was not granted.',
      };
    }

    setAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
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

export const googleSignOut = async () => {
  await signOut(auth);
  setAccessToken(null);
};
