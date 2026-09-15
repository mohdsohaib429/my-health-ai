export interface ProfileData {
  age: number;
  dateOfBirth?: string;
  sex: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
  bmr: number | string;
  tdee: number | string;
  dailyCalorieTarget: number;
  proteinTargetG: number;
  fatTargetG: number;
  carbTargetG: number;
}

export interface FoodDatabaseItem {
  food: string;
  variant?: string;
  preparation?: string;
  basis?: string;
  servingQuantity?: number; // Optional to not break writes
  servingUnit?: string; // Optional to not break writes
  serving: number; // Legacy, kept for compatibility
  unit: string; // Legacy, kept for compatibility
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  notes?: string;
  isEstimate?: boolean;
  sourceReference?: string;
  sheetRowNumber?: number;
}

export interface FoodLogEntry {
  id?: string;
  sheetRowNumber?: number;
  date: string; // YYYY-MM-DD
  meal: string; // Breakfast, Lunch, Dinner, Snack
  food: string;
  variant?: string;
  preparation?: string;
  basis?: string;
  servingQuantity?: number;
  servingUnit?: string;
  quantity: number;
  unit: string;
  oldQuantity?: number;
  oldUnit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  isEstimate?: boolean;
  sourceType?: 'FROM_DATABASE' | 'NEW_ESTIMATE';
  sourceLabel?: 'From Food Database' | 'Food Database value: estimated' | 'Newly estimated value';
  sourceReference?: string;
}

export interface ActivityLogEntry {
  id?: string;
  sheetRowNumber?: number;
  date: string; // YYYY-MM-DD
  activity: string;
  durationMinutes: number;
  caloriesBurned?: number;
  notes?: string;
  oldDurationMinutes?: number;
  oldCaloriesBurned?: number;
}

export interface DailySummaryEntry {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  activityBurned: number;
  calorieTarget: number;
  difference: number;
}

export interface ProgressEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
  notes?: string;
  sheetRowNumber?: number;
}

export interface GoogleSheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DuplicateOffer {
  uniqueEntries: FoodLogEntry[];
  duplicateEntries: FoodLogEntry[];
  date: string;
}

export interface PendingActivityUpdate {
  activity: string;
  date: string;
  oldDurationMinutes: number;
  newDurationMinutes: number;
  oldCaloriesBurned?: number;
  newCaloriesBurned?: number;
  offeredEntries: ActivityLogEntry[];
}

export interface PendingActivityDelete {
  activity: string;
  date: string;
  offeredEntries: ActivityLogEntry[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  action?: {
    type: 'LOG_FOOD' | 'LOG_ACTIVITY' | 'LOG_WEIGHT' | 'ADD_TO_DB' | 'NONE';
    foodItems?: FoodLogEntry[];
    activityItems?: ActivityLogEntry[];
    progressItem?: ProgressEntry;
    dbItems?: FoodDatabaseItem[];
    dbItemsAdded?: FoodDatabaseItem[];
  };
  offerAddToDb?: FoodDatabaseItem[];
  dbItemsAdded?: FoodDatabaseItem[];
  duplicateOffer?: DuplicateOffer;
  isPendingSync?: boolean;
  syncedToSheet?: boolean;
  syncConfirmation?: string;
}
