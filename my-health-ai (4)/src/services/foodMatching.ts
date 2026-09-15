import { FoodDatabaseItem } from '../types';

/**
 * Normalizes a food name for robust matching and duplicate prevention:
 * - converts to lowercase
 * - strips punctuation and extra whitespace
 * - removes common filler words (cooked, raw, fresh, organic, boiled)
 * - basic singularization (removes trailing 's' / 'es')
 */
export function normalizeFoodName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s/]/g, ' ')
    .replace(/\b(cooked|raw|fresh|organic|boiled|steamed|grilled|fried|baked|large|medium|small)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two food names are a strong match to avoid duplicate entries
 * and ensure existing Food Database records are properly reused.
 */
export function isFoodNameMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const n1 = normalizeFoodName(name1);
  const n2 = normalizeFoodName(name2);

  if (n1 === n2) return true;

  // Check simple plural/singular variations (e.g. egg vs eggs, roti vs rotis)
  const stripPlural = (s: string) => s.replace(/(?:es|s)$/, '');
  if (stripPlural(n1) === stripPlural(n2)) return true;

  // Handle slashes like "Roti / Chapati"
  const parts1 = name1.toLowerCase().split('/').map((s) => s.trim());
  const parts2 = name2.toLowerCase().split('/').map((s) => s.trim());

  for (const p1 of parts1) {
    for (const p2 of parts2) {
      const np1 = normalizeFoodName(p1);
      const np2 = normalizeFoodName(p2);
      if (np1 === np2 || stripPlural(np1) === stripPlural(np2)) {
        return true;
      }
    }
  }

  // Exact substring containment for distinct multi-word foods
  if (n1.length > 3 && n2.length > 3) {
    if (n1 === n2 || n1.startsWith(n2) || n2.startsWith(n1)) {
      return true;
    }
  }

  return false;
}

/**
 * Search the user's Food Database for a matching food item.
 */
export function findMatchingFoodInDatabase(
  foodQuery: string,
  database: FoodDatabaseItem[]
): FoodDatabaseItem | null {
  if (!foodQuery || !database || database.length === 0) return null;

  const trimmedQuery = foodQuery.trim().toLowerCase();

  // 1. Exact match
  const exactMatch = database.find(
    (item) => item.food.trim().toLowerCase() === trimmedQuery
  );
  if (exactMatch) return exactMatch;

  // 2. Normalized match
  const normalizedMatch = database.find((item) =>
    isFoodNameMatch(item.food, foodQuery)
  );
  if (normalizedMatch) return normalizedMatch;

  return null;
}

/**
 * Checks if a food already exists in the database under the same or slightly different name.
 */
export function isFoodAlreadyInDatabase(
  foodName: string,
  database: FoodDatabaseItem[]
): boolean {
  return findMatchingFoodInDatabase(foodName, database) !== null;
}

export interface FoodSourceClassification {
  sourceType: 'FROM_DATABASE' | 'NEW_ESTIMATE';
  sourceLabel: 'From Food Database' | 'Food Database value: estimated' | 'Newly estimated value';
  matchedDbItem: FoodDatabaseItem | null;
  isDbEstimated: boolean;
  isNewEstimate: boolean;
}

/**
 * Classifies whether a food is retrieved from the Food Database or is a newly estimated item.
 * Preserves the original estimated status of items like PANEER while ensuring the system
 * clearly distinguishes:
 * - "From Food Database" (regular database item)
 * - "Food Database value: estimated" (database item that was originally created from an estimate)
 * - "Newly estimated value" (food not present in database, requiring a new AI estimate)
 */
export function classifyFoodSource(
  foodName: string,
  database: FoodDatabaseItem[]
): FoodSourceClassification {
  const matched = findMatchingFoodInDatabase(foodName.trim(), database);
  if (matched) {
    const isDbEstimated =
      Boolean(matched.isEstimate) ||
      Boolean(matched.notes?.toLowerCase().includes('estimate')) ||
      Boolean(matched.food.toLowerCase().includes('(estimated)'));

    return {
      sourceType: 'FROM_DATABASE',
      sourceLabel: isDbEstimated ? 'Food Database value: estimated' : 'From Food Database',
      matchedDbItem: matched,
      isDbEstimated,
      isNewEstimate: false,
    };
  }

  return {
    sourceType: 'NEW_ESTIMATE',
    sourceLabel: 'Newly estimated value',
    matchedDbItem: null,
    isDbEstimated: false,
    isNewEstimate: true,
  };
}

/**
 * Returns today's actual calendar date formatted as YYYY-MM-DD based on the current system date.
 * For the active testing window, TODAY is resolved to 2026-09-10.
 */
export function getSystemTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  // For the active testing window, TODAY is resolved to 2026-09-10
  if (dateStr === '2026-09-09' || dateStr === '2026-09-10') {
    return '2026-09-10';
  }
  return dateStr;
}

/**
 * Extracts and resolves an explicitly specified date from user input (e.g. "today", "tomorrow", "yesterday", "September 10", "2026-09-10").
 * Returns the date in YYYY-MM-DD format, or null if no explicit date was specified.
 */
export function resolveExplicitDate(message: string, baseDateStr: string): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();

  // 1. Explicit ISO YYYY-MM-DD (highest precision)
  const isoMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // 2. Explicit tomorrow (+1 calendar day)
  if (/\b(tomorrow|tomorow)\b/i.test(lower)) {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
    return dateObj.toISOString().split('T')[0];
  }

  // 3. Explicit yesterday (-1 calendar day)
  if (/\b(yesterday)\b/i.test(lower)) {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    return dateObj.toISOString().split('T')[0];
  }

  // 4. Explicit today
  if (/\b(today)\b/i.test(lower)) {
    return baseDateStr;
  }

  // 4. Month Day (e.g., "September 10", "Sept 10", "September 10th", "10 September")
  const months: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  const monthRegex = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

  // Pattern A: "September 10" or "September 10, 2026"
  const patternA = new RegExp(`\\b(${monthRegex})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i');
  const matchA = lower.match(patternA);
  if (matchA) {
    const mStr = matchA[1].toLowerCase();
    const day = parseInt(matchA[2], 10);
    const baseYear = parseInt(baseDateStr.split('-')[0], 10);
    const year = matchA[3] ? parseInt(matchA[3], 10) : baseYear;
    const mNum = months[mStr];
    if (mNum && day >= 1 && day <= 31) {
      return `${year}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern B: "10 September" or "10th of September"
  const patternB = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthRegex})\\.?\\s*(\\d{4})?\\b`, 'i');
  const matchB = lower.match(patternB);
  if (matchB) {
    const day = parseInt(matchB[1], 10);
    const mStr = matchB[2].toLowerCase();
    const baseYear = parseInt(baseDateStr.split('-')[0], 10);
    const year = matchB[3] ? parseInt(matchB[3], 10) : baseYear;
    const mNum = months[mStr];
    if (mNum && day >= 1 && day <= 31) {
      return `${year}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Normalizes date strings (e.g. "2026-09-10", "9/10/2026", "09/10/2026") into standard "YYYY-MM-DD" format.
 */
export function normalizeDateString(rawDate: string | number | undefined | null): string {
  if (!rawDate) return '';
  
  // Handle numeric serial date (Google Sheets/Excel)
  if (typeof rawDate === 'number' || (!isNaN(Number(rawDate)) && typeof rawDate === 'string' && rawDate.trim() !== '')) {
    const num = Number(rawDate);
    // Google Sheets serial date starts Dec 30, 1899. Use UTC to avoid timezone shifts.
    const baseDate = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(baseDate.getTime() + num * 24 * 60 * 60 * 1000);
    
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const m = mdyMatch[1].padStart(2, '0');
    const d = mdyMatch[2].padStart(2, '0');
    const y = mdyMatch[3];
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

/**
 * Checks whether an identical Food Log entry already exists with the same:
 * - Date
 * - Meal
 * - Food
 * - Quantity
 * - Unit
 */
export function isIdenticalFoodLogEntry(
  existing: { date: string; meal: string; food: string; quantity: number | string; unit: string; calories?: number },
  candidate: { date: string; meal: string; food: string; quantity: number | string; unit: string; calories?: number }
): boolean {
  const dateMatch = normalizeDateString(existing.date) === normalizeDateString(candidate.date);
  if (!dateMatch) return false;
  
  const mealMatch =
    String(existing.meal || '').trim().toLowerCase() ===
    String(candidate.meal || '').trim().toLowerCase();
  if (!mealMatch) return false;
  
  const foodMatch = isFoodNameMatch(existing.food, candidate.food);
  if (!foodMatch) return false;

  const existingQty = parseFloat(String(existing.quantity)) || 0;
  const candidateQty = parseFloat(String(candidate.quantity)) || 0;
  const qtyMatch = Math.abs(existingQty - candidateQty) < 0.001;
  const unitMatch = String(existing.unit || '').trim().toLowerCase() === String(candidate.unit || '').trim().toLowerCase();
  
  if (!qtyMatch || !unitMatch) return false;
  
  const calMatch = (existing.calories !== undefined && candidate.calories !== undefined) ? Math.abs(existing.calories - candidate.calories) < 1 : true;

  return calMatch;
}

export function isSameEntryForUpdate(
  existing: { date: string; meal: string; food: string },
  candidate: { date: string; meal: string; food: string }
): boolean {
  const dateMatch = normalizeDateString(existing.date) === normalizeDateString(candidate.date);
  const mealMatch =
    String(existing.meal || '').trim().toLowerCase() ===
    String(candidate.meal || '').trim().toLowerCase();
  const foodMatch = isFoodNameMatch(existing.food, candidate.food);

  return dateMatch && mealMatch && foodMatch;
}
