import {
  ProfileData,
  FoodDatabaseItem,
  FoodLogEntry,
  ActivityLogEntry,
  DailySummaryEntry,
  ProgressEntry,
  GoogleSheetFile,
  ChatMessage,
} from '../types';
import {
  DEFAULT_PROFILE,
  DEFAULT_FOOD_DATABASE,
  DEFAULT_PROGRESS_ENTRIES,
} from './googleSheetsService';

export const PRIMARY_USER_EMAIL = 'mohdsohaib429@gmail.com';

export interface UserHealthDataset {
  userId: string;
  userEmail: string;
  displayName: string;
  selectedSheet: GoogleSheetFile | null;
  sheetTabs: string[];
  profile: ProfileData | null;
  foodDatabase: FoodDatabaseItem[];
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  dailySummaries: DailySummaryEntry[];
  progressEntries: ProgressEntry[];
  messages: ChatMessage[];
  updatedAt: string;
}

export interface UserProfileSummary {
  userId: string;
  userEmail: string;
  displayName: string;
  isPrimary: boolean;
  hasSheet: boolean;
  sheetName?: string;
  lastActive: string;
}

const STORAGE_KEY_PREFIX = 'my_health_ai_user_data_';
const KNOWN_USERS_KEY = 'my_health_ai_registered_users';
const ACTIVE_USER_EMAIL_KEY = 'my_health_ai_active_user_email';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPrimaryUser(emailOrId?: string | null): boolean {
  if (!emailOrId) return true; // Default/unauthenticated session belongs to primary user
  const norm = normalizeEmail(emailOrId);
  return norm === PRIMARY_USER_EMAIL || norm === 'primary_user_sohaib';
}

export function getUserStorageKey(userIdentifier: string): string {
  const safeId = normalizeEmail(userIdentifier).replace(/[^a-z0-9_]/g, '_');
  return `${STORAGE_KEY_PREFIX}${safeId}`;
}

/**
 * Returns the dataset for the primary/existing user (Mohd Sohaib).
 * Preserves all original stored values, baseline progress history, and food database.
 */
export function getInitialPrimaryUserDataset(): UserHealthDataset {
  return {
    userId: 'primary_user_sohaib',
    userEmail: PRIMARY_USER_EMAIL,
    displayName: 'Mohd Sohaib',
    selectedSheet: null,
    sheetTabs: [
      'Profile',
      'Food Log',
      'Activity Log',
      'Daily Summary',
      'Progress',
      'Food Database',
    ],
    profile: { ...DEFAULT_PROFILE },
    foodDatabase: [...DEFAULT_FOOD_DATABASE],
    foodLog: [],
    activityLog: [],
    dailySummaries: [],
    progressEntries: [...DEFAULT_PROGRESS_ENTRIES],
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Initializes a clean, completely isolated dataset for a new Google account.
 * A new user must NEVER see, read, modify, or inherit another user's health data.
 * Does NOT assume default age, height, weight, activity level, goal, or targets.
 * Does not inherit another user's baseline weight, logs, or spreadsheet.
 */
export function createNewUserDataset(
  userId: string,
  userEmail: string,
  displayName?: string
): UserHealthDataset {
  const normEmail = normalizeEmail(userEmail);
  const name = displayName || normEmail.split('@')[0];

  // Standard clean starter food database for new user
  const starterFoodDb: FoodDatabaseItem[] = [
    { food: 'Egg', serving: 1, unit: 'piece', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 },
    { food: 'Rice cooked', serving: 100, unit: 'g', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 },
    { food: 'Chicken breast', serving: 100, unit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    { food: 'Oatmeal', serving: 100, unit: 'g', calories: 68, protein: 2.4, carbs: 12, fat: 1.4, fiber: 1.7 },
    { food: 'Apple', serving: 1, unit: 'piece', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4 },
    { food: 'Milk', serving: 1, unit: 'cup', calories: 149, protein: 7.7, carbs: 11.7, fat: 8, fiber: 0 },
  ];

  return {
    userId,
    userEmail: normEmail,
    displayName: name,
    selectedSheet: null,
    sheetTabs: [],
    profile: null, // No assumed default age, height, weight, activity, goal, or targets
    foodDatabase: starterFoodDb,
    foodLog: [],
    activityLog: [],
    dailySummaries: [],
    progressEntries: [], // Brand new user has NO prior progress entries; never inherit another's 82kg baseline!
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save user dataset into their dedicated partition in localStorage.
 */
export function saveUserDataset(dataset: UserHealthDataset): void {
  try {
    const key = getUserStorageKey(dataset.userEmail);
    const updated = {
      ...dataset,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(updated));
    recordKnownUser(updated);
  } catch (err) {
    console.warn('Could not save user dataset to localStorage:', err);
  }
}

/**
 * Load user dataset for the given user identity.
 * Strictly guarantees that User A's data is never returned for User B.
 */
export function loadUserDataset(
  user: { uid: string; email: string | null; displayName?: string | null } | null
): UserHealthDataset {
  // If no user is authenticated, check for primary user or active user session
  if (!user || !user.email) {
    const savedActiveEmail = localStorage.getItem(ACTIVE_USER_EMAIL_KEY);
    const targetEmail = savedActiveEmail || PRIMARY_USER_EMAIL;
    const storageKey = getUserStorageKey(targetEmail);
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.userEmail && normalizeEmail(parsed.userEmail) === normalizeEmail(targetEmail)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Error parsing cached user dataset:', e);
      }
    }

    const defaultDataset = isPrimaryUser(targetEmail)
      ? getInitialPrimaryUserDataset()
      : createNewUserDataset('anon_' + Date.now(), targetEmail);
    saveUserDataset(defaultDataset);
    return defaultDataset;
  }

  const normEmail = normalizeEmail(user.email);
  localStorage.setItem(ACTIVE_USER_EMAIL_KEY, normEmail);
  const storageKey = getUserStorageKey(normEmail);
  const raw = localStorage.getItem(storageKey);

  if (raw) {
    try {
      const parsed: UserHealthDataset = JSON.parse(raw);
      // Strictly verify identity matches: NEVER return another account's dataset
      if (normalizeEmail(parsed.userEmail) === normEmail) {
        // Sync display name or userId if needed
        if (user.displayName && parsed.displayName !== user.displayName) {
          parsed.displayName = user.displayName;
        }
        parsed.userId = user.uid;
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading user dataset for', normEmail, e);
    }
  }

  // No dataset found for this user in localStorage
  if (isPrimaryUser(normEmail)) {
    // Current user gets original preserved data
    const initialPrimary = getInitialPrimaryUserDataset();
    initialPrimary.userId = user.uid;
    if (user.displayName) initialPrimary.displayName = user.displayName;
    saveUserDataset(initialPrimary);
    return initialPrimary;
  } else {
    // New Google account gets a brand new, isolated dataset
    const newUser = createNewUserDataset(user.uid, normEmail, user.displayName || undefined);
    saveUserDataset(newUser);
    return newUser;
  }
}

/**
 * Record a user into the known users registry for multi-account management.
 */
function recordKnownUser(dataset: UserHealthDataset): void {
  try {
    const raw = localStorage.getItem(KNOWN_USERS_KEY);
    let list: UserProfileSummary[] = raw ? JSON.parse(raw) : [];

    const normEmail = normalizeEmail(dataset.userEmail);
    const existingIndex = list.findIndex((u) => normalizeEmail(u.userEmail) === normEmail);

    const summary: UserProfileSummary = {
      userId: dataset.userId,
      userEmail: normEmail,
      displayName: dataset.displayName,
      isPrimary: isPrimaryUser(normEmail),
      hasSheet: Boolean(dataset.selectedSheet),
      sheetName: dataset.selectedSheet?.name,
      lastActive: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = summary;
    } else {
      list.push(summary);
    }

    localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Could not update known users registry:', err);
  }
}

/**
 * Returns list of all known Google accounts on this device.
 */
export function getRegisteredUsers(): UserProfileSummary[] {
  try {
    const raw = localStorage.getItem(KNOWN_USERS_KEY);
    const list: UserProfileSummary[] = raw ? JSON.parse(raw) : [];

    // Ensure primary user is always in the list
    if (!list.some((u) => isPrimaryUser(u.userEmail))) {
      list.unshift({
        userId: 'primary_user_sohaib',
        userEmail: PRIMARY_USER_EMAIL,
        displayName: 'Mohd Sohaib',
        isPrimary: true,
        hasSheet: false,
        lastActive: new Date().toISOString(),
      });
    }

    return list;
  } catch {
    return [
      {
        userId: 'primary_user_sohaib',
        userEmail: PRIMARY_USER_EMAIL,
        displayName: 'Mohd Sohaib',
        isPrimary: true,
        hasSheet: false,
        lastActive: new Date().toISOString(),
      },
    ];
  }
}

/**
 * Switch the active user session.
 */
export function setActiveUserEmail(email: string): void {
  localStorage.setItem(ACTIVE_USER_EMAIL_KEY, normalizeEmail(email));
}

/**
 * Get currently active user email.
 */
export function getActiveUserEmail(): string {
  return localStorage.getItem(ACTIVE_USER_EMAIL_KEY) || PRIMARY_USER_EMAIL;
}
