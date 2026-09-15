import {
  ProfileData,
  FoodDatabaseItem,
  FoodLogEntry,
  ActivityLogEntry,
  DailySummaryEntry,
  ProgressEntry,
  GoogleSheetFile,
} from '../types';
import { normalizeDateString } from './foodMatching';
import { setAccessToken } from './firebaseAuth';

// Default initial data based on user specification and stored Profile sheet values
export const DEFAULT_PROFILE: ProfileData = {
  age: 24,
  sex: 'Male',
  heightCm: 165,
  weightKg: 82,
  activityLevel: 'Sedentary',
  goal: 'Lose Fat / Toned Body',
  bmr: 1736.25,
  tdee: 2083.5,
  dailyCalorieTarget: 1770.975,
  proteinTargetG: 131.2,
  fatTargetG: 59.0325,
  carbTargetG: 178.720625,
};

export const DEFAULT_PROGRESS_ENTRIES: ProgressEntry[] = [
  {
    date: '2026-09-04',
    weightKg: 82.0,
    notes: 'First recorded weight entry, established as baseline.',
    sheetRowNumber: 1,
  },
  {
    date: '2026-09-10',
    weightKg: 81.5,
    notes: 'New weight entry recorded.',
    sheetRowNumber: 2,
  },
  {
    date: '2026-09-10',
    weightKg: 82.0,
    notes: 'Baseline weight established.',
    sheetRowNumber: 3,
  },
];

/**
 * Returns all valid Progress entries sorted in chronological order.
 * If multiple entries share the same date, original row order is preserved.
 * Rules:
 * - First/oldest existing entry = permanent baseline.
 * - Last/newest existing entry = latest recorded weight.
 * - Entry immediately before latest = previous.
 * - Never ignore older Progress rows.
 */
export function getSortedProgressEntries(entries: ProgressEntry[]): ProgressEntry[] {
  const validWithIndex = (entries || [])
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(
      ({ entry: p }) => p && typeof p.weightKg === 'number' && p.weightKg > 20 && p.weightKg < 300
    );

  return validWithIndex
    .sort((a, b) => {
      const dateCmp = a.entry.date.localeCompare(b.entry.date);
      if (dateCmp !== 0) return dateCmp;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ entry }) => entry);
}

export const DEFAULT_FOOD_DATABASE: FoodDatabaseItem[] = [
  {
    food: 'Egg',
    serving: 1,
    unit: 'piece',
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
    fiber: 0,
  },
  {
    food: 'Rice cooked',
    serving: 100,
    unit: 'g',
    calories: 130,
    protein: 2.7,
    carbs: 28.2,
    fat: 0.3,
    fiber: 0.4,
  },
  {
    food: 'Chicken breast',
    serving: 100,
    unit: 'g',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
  },
  {
    food: 'Roti / Chapati',
    serving: 1,
    unit: 'piece',
    calories: 105,
    protein: 3.2,
    carbs: 20,
    fat: 0.5,
    fiber: 2.5,
  },
  {
    food: 'Whole Milk',
    serving: 1,
    unit: 'cup',
    calories: 149,
    protein: 7.7,
    carbs: 11.7,
    fat: 8,
    fiber: 0,
  },
  {
    food: 'PANEER',
    serving: 100,
    unit: 'g',
    calories: 265,
    protein: 18.3,
    carbs: 3.4,
    fat: 20.8,
    fiber: 0,
    notes: 'Estimated values',
    isEstimate: true,
  },
];

/**
 * Search user's Google Drive for existing spreadsheets named "My Health AI"
 */
export async function searchHealthSpreadsheets(accessToken: string): Promise<GoogleSheetFile[]> {
  const query = encodeURIComponent(
    "name contains 'My Health AI' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Failed to search Drive for spreadsheets:', err);
    throw new Error(err.error?.message || 'Failed to search Google Drive for spreadsheets');
  }

  const data = await response.json();
  return (data.files || []).map((file: any) => ({
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
  }));
}

/**
 * Creates a brand-new "My Health AI" Google Spreadsheet in the authenticated user's Drive,
 * initializing all 6 required sheets: Profile, Food Log, Activity Log, Daily Summary, Progress, Food Database.
 * Strictly guarantees complete data isolation for new accounts.
 */
export async function createHealthSpreadsheet(
  accessToken: string,
  userProfile?: ProfileData | null,
  foodDb?: FoodDatabaseItem[],
  customTitle = 'My Health AI'
): Promise<GoogleSheetFile> {
  const db = foodDb || DEFAULT_FOOD_DATABASE;

  // 1. Create spreadsheet with all 6 sheets
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const createPayload = {
    properties: {
      title: customTitle,
    },
    sheets: [
      { properties: { title: 'Profile' } },
      { properties: { title: 'Food Log' } },
      { properties: { title: 'Activity Log' } },
      { properties: { title: 'Daily Summary' } },
      { properties: { title: 'Progress' } },
      { properties: { title: 'Food Database' } },
    ],
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    console.error('Failed to create new spreadsheet:', err);
    throw new Error(err.error?.message || 'Failed to create new spreadsheet in Google Drive');
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;

  // 2. Batch update headers and initial starter data
  // When no profile exists, do NOT assume default age, height, weight, activity, goal, or targets.
  const profileRows = userProfile
    ? [
        ['Parameter', 'Value'],
        ['Age', userProfile.age],
        ['Sex', userProfile.sex],
        ['Height (cm)', userProfile.heightCm],
        ['Weight (kg)', userProfile.weightKg],
        ['Activity Level', userProfile.activityLevel],
        ['Goal', userProfile.goal],
        ['BMR', userProfile.bmr],
        ['Estimated TDEE', userProfile.tdee],
        ['Daily Calorie Target', userProfile.dailyCalorieTarget],
        ['Protein Target (g)', userProfile.proteinTargetG],
        ['Fat Target (g)', userProfile.fatTargetG],
        ['Carbohydrate Target (g)', userProfile.carbTargetG],
      ]
    : [
        ['Parameter', 'Value'],
        ['Age', ''],
        ['Sex', ''],
        ['Height (cm)', ''],
        ['Weight (kg)', ''],
        ['Activity Level', ''],
        ['Goal', ''],
        ['BMR', ''],
        ['Estimated TDEE', ''],
        ['Daily Calorie Target', ''],
        ['Protein Target (g)', ''],
        ['Fat Target (g)', ''],
        ['Carbohydrate Target (g)', ''],
      ];

  const foodLogHeaders = [
    ['Date', 'Meal', 'Food', 'Quantity', 'Unit', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber'],
  ];

  const activityLogHeaders = [
    ['Date', 'Activity', 'Duration (min)', 'Calories Burned', 'Notes'],
  ];

  const dailySummaryHeaders = [
    [
      'Date',
      'Total Calories',
      'Total Protein',
      'Total Carbs',
      'Total Fat',
      'Total Fiber',
      'Activity Burned',
      'Calorie Target',
      'Difference',
    ],
  ];

  const progressHeaders = [['Date', 'Weight (kg)', 'Notes']];

  const foodDbHeaders = [
    ['Food', 'Serving', 'Unit', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Notes'],
    ...db.map((item) => [
      item.food,
      item.serving,
      item.unit,
      item.calories,
      item.protein,
      item.carbs,
      item.fat,
      item.fiber,
      item.notes || '',
    ]),
  ];

  const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const batchPayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Profile!A1:B13', values: profileRows },
      { range: 'Food Log!A1:J1', values: foodLogHeaders },
      { range: 'Activity Log!A1:E1', values: activityLogHeaders },
      { range: 'Daily Summary!A1:I1', values: dailySummaryHeaders },
      { range: 'Progress!A1:C1', values: progressHeaders },
      { range: `Food Database!A1:I${foodDbHeaders.length}`, values: foodDbHeaders },
    ],
  };

  await fetch(batchUpdateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(batchPayload),
  }).catch((e) => console.warn('Could not populate initial headers in new sheet:', e));

  return {
    id: spreadsheetId,
    name: customTitle,
    modifiedTime: new Date().toISOString(),
    webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Get spreadsheet tabs metadata
 */
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to load spreadsheet details');
  }

  const data = await response.json();
  const tabs = (data.sheets || []).map((s: any) => s.properties.title as string);
  return {
    title: data.properties?.title || 'My Health AI',
    tabs,
    sheets: data.sheets || [],
  };
}

/**
 * Write or update Profile tab values in a user's Google Sheet
 */
export async function writeProfileToSheet(
  accessToken: string,
  spreadsheetId: string,
  profile: ProfileData
): Promise<void> {
  const profileRows = [
    ['Parameter', 'Value'],
    ['Age', profile.age],
    ['Sex', profile.sex],
    ['Height (cm)', profile.heightCm],
    ['Weight (kg)', profile.weightKg],
    ['Activity Level', profile.activityLevel],
    ['Goal', profile.goal],
    ['BMR', profile.bmr],
    ['Estimated TDEE', profile.tdee],
    ['Daily Calorie Target', profile.dailyCalorieTarget],
    ['Protein Target (g)', profile.proteinTargetG],
    ['Fat Target (g)', profile.fatTargetG],
    ['Carbohydrate Target (g)', profile.carbTargetG],
  ];

  const range = encodeURIComponent('Profile!A1:B13');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'Profile!A1:B13',
      values: profileRows,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Failed to update Profile tab in spreadsheet:', err);
    throw new Error(err.error?.message || 'Failed to update Profile tab in Google Sheet');
  }
}

/**
 * Read Profile tab from Google Sheet
 * Reads the actual stored values from the Profile sheet.
 * If no profile data exists in the sheet:
 * - For primary user, returns DEFAULT_PROFILE.
 * - For new users, returns null so onboarding is triggered without copying another's data.
 */
export async function fetchProfileData(
  accessToken: string,
  spreadsheetId: string,
  isPrimary = false
): Promise<ProfileData | null> {
  const range = encodeURIComponent('Profile!A1:C35');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.warn('Could not read Profile tab');
    return isPrimary ? DEFAULT_PROFILE : null;
  }

  const data = await response.json();
  const rows: any[][] = data.values || [];
  const map: Record<string, any> = {};

  for (const row of rows) {
    if (row && row[0] !== undefined && row[0] !== null) {
      const rawKey = String(row[0]).trim().toLowerCase();
      // row[1] is the primary value; fallback to row[2] if row[1] is empty
      const val =
        row[1] !== undefined && row[1] !== null && String(row[1]).trim() !== ''
          ? row[1]
          : row[2] !== undefined && row[2] !== null && String(row[2]).trim() !== ''
          ? row[2]
          : undefined;

      if (rawKey && val !== undefined) {
        map[rawKey] = val;
      }
    }
  }

  const findKeyVal = (aliases: string[]): any => {
    // 1. Direct match
    for (const alias of aliases) {
      const lowerAlias = alias.toLowerCase().trim();
      if (map[lowerAlias] !== undefined && map[lowerAlias] !== null && String(map[lowerAlias]).trim() !== '') {
        return map[lowerAlias];
      }
    }
    // 2. Normalized match (strip punctuation, parenthesis, colon, and collapse spaces)
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined || v === null || String(v).trim() === '') continue;
      const cleanK = k.replace(/[:\-_()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      for (const alias of aliases) {
        const cleanA = alias.replace(/[:\-_()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (cleanK === cleanA || cleanK.startsWith(cleanA) || cleanK.includes(cleanA)) {
          return v;
        }
      }
    }
    return undefined;
  };

  const num = (val: any, fallback: number) => {
    if (val === undefined || val === null || String(val).trim() === '') return fallback;
    const n = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? fallback : n;
  };

  const rawAge = findKeyVal(['age']);
  const rawSex = findKeyVal(['sex', 'gender']);
  const rawHeight = findKeyVal(['height (cm)', 'height']);
  const rawWeight = findKeyVal(['weight (kg)', 'weight']);

  // If none of the basic profile fields exist in the sheet
  const hasBasicFields =
    rawAge !== undefined || rawSex !== undefined || rawHeight !== undefined || rawWeight !== undefined;

  if (!hasBasicFields) {
    return isPrimary ? DEFAULT_PROFILE : null;
  }

  const age = num(rawAge, isPrimary ? DEFAULT_PROFILE.age : 0);
  const sex = rawSex ? String(rawSex).trim() : (isPrimary ? DEFAULT_PROFILE.sex : '');
  const heightCm = num(rawHeight, isPrimary ? DEFAULT_PROFILE.heightCm : 0);
  const weightKg = num(rawWeight, isPrimary ? DEFAULT_PROFILE.weightKg : 0);
  const activityLevel = findKeyVal(['activity level', 'activity'])
    ? String(findKeyVal(['activity level', 'activity'])).trim()
    : (isPrimary ? DEFAULT_PROFILE.activityLevel : '');
  const goal = findKeyVal(['goal', 'primary goal'])
    ? String(findKeyVal(['goal', 'primary goal'])).trim()
    : (isPrimary ? DEFAULT_PROFILE.goal : '');

  if (!isPrimary && (!age || !heightCm || !weightKg || !sex || sex.toLowerCase() === 'unspecified')) {
    return null;
  }

  return {
    age,
    sex,
    heightCm,
    weightKg,
    activityLevel,
    goal,
    bmr: num(
      findKeyVal(['bmr', 'basal metabolic rate', 'bmr (kcal)', 'basal metabolic rate (bmr)']),
      isPrimary ? (DEFAULT_PROFILE.bmr as number) : 0
    ),
    tdee: num(
      findKeyVal([
        'estimated tdee',
        'tdee',
        'tdee (kcal)',
        'total daily energy expenditure',
        'total daily energy expenditure (tdee)',
      ]),
      isPrimary ? (DEFAULT_PROFILE.tdee as number) : 0
    ),
    dailyCalorieTarget: num(
      findKeyVal([
        'daily calorie target',
        'calorie target',
        'daily calorie target (kcal)',
        'target calories',
        'calories target',
      ]),
      isPrimary ? DEFAULT_PROFILE.dailyCalorieTarget : 0
    ),
    proteinTargetG: num(
      findKeyVal(['protein target (g)', 'protein target', 'daily protein target', 'protein (g)', 'protein']),
      isPrimary ? DEFAULT_PROFILE.proteinTargetG : 0
    ),
    fatTargetG: num(
      findKeyVal(['fat target (g)', 'fat target', 'daily fat target', 'fat (g)', 'fat']),
      isPrimary ? DEFAULT_PROFILE.fatTargetG : 0
    ),
    carbTargetG: num(
      findKeyVal([
        'carbohydrate target (g)',
        'carbohydrate target',
        'carbohydrates target (g)',
        'carb target (g)',
        'carb target',
        'carbohydrates (g)',
        'carbohydrates',
        'carbs target',
        'carbs',
      ]),
      isPrimary ? DEFAULT_PROFILE.carbTargetG : 0
    ),
  };
}

/**
 * Read Food Database tab
 */
export async function fetchFoodDatabase(accessToken: string, spreadsheetId: string): Promise<FoodDatabaseItem[]> {
  const range = encodeURIComponent('Food Database!A2:I');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.warn('Could not read Food Database tab, falling back to defaults');
    return DEFAULT_FOOD_DATABASE;
  }

  const data = await response.json();
  const rows = data.values || [];
  if (rows.length === 0) return DEFAULT_FOOD_DATABASE;

  return rows
    .filter((row: any[]) => row && row[0])
    .map((row: any[]) => {
      const rawNotes = row[8] ? String(row[8]).trim() : undefined;
      const isEst =
        Boolean(rawNotes?.toLowerCase().includes('estimate')) ||
        Boolean(String(row[0]).toLowerCase().includes('(estimated)'));

      return {
        food: String(row[0] || '').trim(),
        serving: parseFloat(row[1]) || 1,
        unit: String(row[2] || 'g').trim(),
        calories: parseFloat(row[3]) || 0,
        protein: parseFloat(row[4]) || 0,
        carbs: parseFloat(row[5]) || 0,
        fat: parseFloat(row[6]) || 0,
        fiber: parseFloat(row[7]) || 0,
        notes: rawNotes,
        isEstimate: isEst,
      };
    });
}

/**
 * Read the entire Food Database, including Row Numbers for updates.
 * Reads the raw A1:I range to ensure Row Numbers are correctly mapped.
 */
export async function fetchFoodDatabaseForUpdate(
  accessToken: string,
  spreadsheetId: string
): Promise<(FoodDatabaseItem & { sheetRowNumber: number })[]> {
  const range = encodeURIComponent('Food Database!A1:I');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch Food Database');
  }

  const data = await response.json();
  const rows: any[][] = data.values || [];
  
  const dbItems: (FoodDatabaseItem & { sheetRowNumber: number })[] = [];
  // Start from 1 to skip header (row 1), and rowNumber will be i+1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue; // Skip blank rows
    
    dbItems.push({
        food: String(row[0] || '').trim(),
        serving: parseFloat(row[1]) || 1,
        unit: String(row[2] || 'g').trim(),
        calories: parseFloat(row[3]) || 0,
        protein: parseFloat(row[4]) || 0,
        carbs: parseFloat(row[5]) || 0,
        fat: parseFloat(row[6]) || 0,
        fiber: parseFloat(row[7]) || 0,
        notes: row[8] ? String(row[8]).trim() : undefined,
        sheetRowNumber: i + 1,
    });
  }
  return dbItems;
}

/**
 * Update a specific Food Log row
 */
export async function updateFoodLogEntry(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number,
  entry: FoodLogEntry
): Promise<void> {
  const range = encodeURIComponent(`Food Log!A${rowNumber}:J${rowNumber}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [
        [
          entry.date,
          entry.meal,
          entry.food,
          entry.quantity,
          entry.unit,
          entry.calories,
          entry.protein,
          entry.carbs,
          entry.fat,
          entry.fiber,
        ],
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Failed to update Food Log in Google Sheet:', err, { rowNumber, entry });
    throw new Error(err.error?.message || 'Failed to update Food Log in Google Sheet');
  }
}

/**
 * Update a specific Activity Log row
 */
export async function updateActivityLogEntry(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number,
  entry: ActivityLogEntry
): Promise<void> {
  const range = encodeURIComponent(`Activity Log!A${rowNumber}:E${rowNumber}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [
        [
          entry.date,
          entry.activity,
          entry.durationMinutes,
          entry.caloriesBurned !== undefined ? Math.round(entry.caloriesBurned) : '',
          entry.notes || '',
        ],
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Failed to update Activity Log in Google Sheet:', err, { rowNumber, entry });
    throw new Error(err.error?.message || 'Failed to update Activity Log in Google Sheet');
  }
  console.log('Successfully updated Activity Log in Google Sheet:', { rowNumber, entry });
}

/**
 * Delete a specific Food Log row by deleting the row dimension
 */
export async function deleteFoodLogEntry(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number
): Promise<void> {
  // 1. Get spreadsheet details to find the 'Food Log' sheet ID
  const details = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const sheet = details.sheets.find(s => s.properties?.title?.toLowerCase() === 'food log');
  if (!sheet) {
    throw new Error('Food Log sheet not found');
  }
  const sheetId = sheet.properties.sheetId;

  // 2. Prepare the delete request
  const request = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      },
    ],
  };

  // 3. Execute the batchUpdate
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  
  console.log('DIAG_DELETE_API: Requesting deletion', { spreadsheetId, sheetId, rowNumber });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const responseBody = await response.json().catch(() => ({}));
  console.log('DIAG_DELETE_API: Response status', response.status, 'Body', responseBody);

  if (!response.ok) {
    throw new Error(responseBody.error?.message || 'Failed to delete Food Log row in Google Sheet');
  }
}

/**
 * Delete a specific Activity Log row by deleting the row dimension
 */
export async function deleteActivityLogEntry(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number
): Promise<void> {
  // 1. Get spreadsheet details to find the 'Activity Log' sheet ID
  const details = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const sheet = details.sheets.find(s => s.properties?.title?.toLowerCase() === 'activity log');
  if (!sheet) {
    throw new Error('Activity Log sheet not found');
  }
  const sheetId = sheet.properties.sheetId;

  // 2. Prepare the delete request
  const request = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      },
    ],
  };

  // 3. Execute the batchUpdate
  console.log("DIAG_DELETE: deleteActivityLogEntry - About to batchUpdate.", {
    spreadsheetId,
    sheetId,
    rowNumber,
    startIndex: rowNumber - 1,
    endIndex: rowNumber
  });
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responseBody.error?.message || 'Failed to delete Activity Log row in Google Sheet');
  }
  
  console.log("DIAG_DELETE: deleteActivityLogEntry - batchUpdate successful.");
}

/**
 * Read Food Log tab
 */
export async function fetchFoodLog(accessToken: string, spreadsheetId: string): Promise<FoodLogEntry[]> {
  const range = encodeURIComponent('Food Log!A2:J1000');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      setAccessToken(null);
      throw new Error('Unauthorized');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch Food Log: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .map((row: any[], index: number): FoodLogEntry | null => {
      if (!row || !row[0] || !row[2]) return null;
      const entry = {
        id: `food-${index}-${row[0]}-${row[2]}`,
        sheetRowNumber: index + 2,
        date: normalizeDateString(row[0]),
        meal: String(row[1] || 'Breakfast').trim(),
        food: String(row[2] || '').trim(),
        quantity: parseFloat(row[3]) || 1,
        unit: String(row[4] || 'serving').trim(),
        calories: parseFloat(row[5]) || 0,
        protein: parseFloat(row[6]) || 0,
        carbs: parseFloat(row[7]) || 0,
        fat: parseFloat(row[8]) || 0,
        fiber: parseFloat(row[9]) || 0,
      };
      if (entry.food.includes('CHICKEN BREAST')) {
        console.log('DEBUG [fetchFoodLog] Chicken Row:', entry);
      }
      return entry;
    })
    .filter((entry): entry is FoodLogEntry => entry !== null);
}

/**
 * Read Activity Log tab
 */
export async function fetchActivityLog(accessToken: string, spreadsheetId: string): Promise<ActivityLogEntry[]> {
  const range = encodeURIComponent('Activity Log!A2:E');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch Activity Log: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .map((row: any[], index: number): ActivityLogEntry | null => {
      const isRecordValid = row && row[0] && row[1];
      const notes = row[4] ? String(row[4]).trim() : '';
      const isDeletionMarker = 
        notes.toLowerCase() === 'deletion requested' || 
        notes.toLowerCase() === 'delete_requested';

      if (!isRecordValid || isDeletionMarker) {
        return null;
      }

      return {
        id: `activity-${index}-${row[0]}-${row[1]}`,
        sheetRowNumber: index + 2,
        date: normalizeDateString(row[0]),
        activity: String(row[1] || '').trim(),
        durationMinutes: parseFloat(row[2]) || 0,
        caloriesBurned: parseFloat(row[3]) || undefined,
        notes: row[4] ? String(row[4]) : undefined,
      };
    })
    .filter((entry): entry is ActivityLogEntry => entry !== null);
}

export async function fetchRawActivityLog(accessToken: string, spreadsheetId: string): Promise<ActivityLogEntry[]> {
  const range = encodeURIComponent('Activity Log!A2:E');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch Raw Activity Log: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .map((row: any[], index: number): ActivityLogEntry | null => {
      const isRecordValid = row && row[0] && row[1];
      if (!isRecordValid) {
        return null;
      }

      return {
        id: `activity-${index}-${row[0]}-${row[1]}`,
        sheetRowNumber: index + 2,
        date: normalizeDateString(row[0]),
        activity: String(row[1] || '').trim(),
        durationMinutes: parseFloat(row[2]) || 0,
        caloriesBurned: parseFloat(row[3]) || undefined,
        notes: row[4] ? String(row[4]) : undefined,
      };
    })
    .filter((entry): entry is ActivityLogEntry => entry !== null);
}

/**
 * Read Daily Summary tab
 */
export async function fetchDailySummary(accessToken: string, spreadsheetId: string): Promise<DailySummaryEntry[]> {
  const range = encodeURIComponent('Daily Summary!A2:I');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch Daily Summary: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .filter((row: any[]) => row && row[0])
    .map((row: any[]) => ({
      date: normalizeDateString(row[0]),
      totalCalories: parseFloat(row[1]) || 0,
      totalProtein: parseFloat(row[2]) || 0,
      totalCarbs: parseFloat(row[3]) || 0,
      totalFat: parseFloat(row[4]) || 0,
      totalFiber: parseFloat(row[5]) || 0,
      activityBurned: parseFloat(row[6]) || 0,
      calorieTarget: parseFloat(row[7]) || 0,
      difference: parseFloat(row[8]) || 0,
    }));
}

/**
 * Read Progress tab
 * Reads every non-empty Progress data row starting from the first data row, including Sheet Row 1.
 * Does not skip the first entry or limit results to the last 2 entries.
 */
export async function fetchProgress(accessToken: string, spreadsheetId: string): Promise<ProgressEntry[]> {
  const range = encodeURIComponent('Progress!A1:C');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return [];

  const data = await response.json();
  const rows = data.values || [];

  const entries: ProgressEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const sheetRowNum = i + 1;
    const col0 = String(row[0] || '').trim();
    const col1 = row[1] !== undefined ? String(row[1]).trim() : '';
    const col2 = row[2] !== undefined ? String(row[2]).trim() : '';

    if (!col0 && !col1) continue;

    const parsedWeight = parseFloat(col1.replace(/[^0-9.-]+/g, ''));
    // If it's a non-numeric header row like 'Date' | 'Weight', skip it
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      continue;
    }

    entries.push({
      date: col0,
      weightKg: parsedWeight,
      notes: col2 || undefined,
      sheetRowNumber: sheetRowNum,
    });
  }

  return entries;
}

/**
 * Append rows to Food Log tab
 */
export async function appendFoodLog(
  accessToken: string,
  spreadsheetId: string,
  entries: FoodLogEntry[]
) {
  if (entries.length === 0) return;
  const range = encodeURIComponent('Food Log!A:J');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const values = entries.map((e) => [
    e.date,
    e.meal,
    e.food,
    e.quantity,
    e.unit,
    Math.round(e.calories),
    Number(e.protein.toFixed(1)),
    Number(e.carbs.toFixed(1)),
    Number(e.fat.toFixed(1)),
    Number(e.fiber.toFixed(1)),
  ]);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to append to Food Log in Google Sheet');
  }
}

/**
 * Append rows to Activity Log tab
 */
export async function appendActivityLog(
  accessToken: string,
  spreadsheetId: string,
  entries: ActivityLogEntry[]
) {
  if (entries.length === 0) return;
  const range = encodeURIComponent('Activity Log!A:E');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const values = entries.map((e) => [
    e.date,
    e.activity,
    e.durationMinutes,
    e.caloriesBurned !== undefined ? Math.round(e.caloriesBurned) : '',
    e.notes || '',
  ]);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to append to Activity Log in Google Sheet');
  }
}

/**
 * Append entry to Progress tab
 */
export async function appendProgress(
  accessToken: string,
  spreadsheetId: string,
  entry: ProgressEntry
) {
  const range = encodeURIComponent('Progress!A:C');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const values = [[entry.date, entry.weightKg, entry.notes || '']];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to append to Progress in Google Sheet');
  }
}

export interface RecordProgressOptions {
  isExplicitReset?: boolean;
  isExplicitNewMeasurement?: boolean;
  isBaselineConfirmation?: boolean;
}

export interface RecordProgressResult {
  status: 'SUCCESS' | 'DUPLICATE_IGNORED' | 'BASELINE_CONFIRMED' | 'VERIFICATION_FAILED' | 'ERROR';
  isBaseline: boolean;
  entry: ProgressEntry;
  existingEntries: ProgressEntry[];
  updatedEntries: ProgressEntry[];
  baselineWeight: number;
  changeFromBaseline?: number;
  changeFromPrevious?: number;
  message: string;
  verified: boolean;
}

/**
 * Local recording logic enforcing:
 * - First Progress entry = permanent baseline
 * - If baseline already exists, never create another baseline row unless user explicitly resets it
 * - If user confirms existing baseline, do not write a duplicate
 * - A new weight creates exactly one new Progress row
 * - Do not duplicate same weight/date unless explicitly requested
 * - After writing, verify the new row was added exactly once
 */
export function recordProgressLocal(
  existingEntries: ProgressEntry[],
  newEntry: ProgressEntry,
  options: RecordProgressOptions = {}
): RecordProgressResult {
  // Read ALL existing Progress entries; never ignore older rows
  const sortedExisting = getSortedProgressEntries(existingEntries);

  // Rule: First/oldest existing entry = permanent baseline.
  // Rule: Never create a new baseline if any Progress entry already exists.
  const isBaseline = sortedExisting.length === 0;
  const earliestEntry = sortedExisting.length > 0 ? sortedExisting[0] : null;
  const originalBaseline = earliestEntry ? earliestEntry.weightKg : newEntry.weightKg;
  const latestExisting = sortedExisting.length > 0 ? sortedExisting[sortedExisting.length - 1] : null;

  // 1. Rule: A confirmed existing baseline must not create another row.
  const isConfirmingBaseline =
    !isBaseline &&
    (options.isBaselineConfirmation ||
      (Math.abs(newEntry.weightKg - originalBaseline) < 0.05 &&
        (/\b(baseline|confirm|my baseline)\b/i.test(newEntry.notes || '') || !options.isExplicitNewMeasurement)));

  if (isConfirmingBaseline) {
    return {
      status: 'BASELINE_CONFIRMED',
      isBaseline: false,
      entry: newEntry,
      existingEntries,
      updatedEntries: existingEntries,
      baselineWeight: originalBaseline,
      message: `Your baseline weight is already established at ${originalBaseline.toFixed(1)} kg${earliestEntry?.date ? ` (established on ${earliestEntry.date})` : ''}. No duplicate entry was created.`,
      verified: true,
    };
  }

  // 2. Do not duplicate the same weight/date unless the user explicitly requests a new measurement
  if (!options.isExplicitNewMeasurement && sortedExisting.length > 0) {
    const existingSame = sortedExisting.find(
      (p) => normalizeDateString(p.date) === normalizeDateString(newEntry.date) && Math.abs(p.weightKg - newEntry.weightKg) < 0.05
    );
    if (existingSame) {
      return {
        status: 'DUPLICATE_IGNORED',
        isBaseline: false,
        entry: newEntry,
        existingEntries,
        updatedEntries: existingEntries,
        baselineWeight: originalBaseline,
        message: `A weight measurement of ${newEntry.weightKg.toFixed(1)} kg is already recorded for ${newEntry.date}. No duplicate entry was created.`,
        verified: true,
      };
    }
  }

  // 3. Rule: New weight = exactly one new Progress row. Never delete or modify existing Progress data automatically.
  const noteToUse = newEntry.notes || (isBaseline ? 'Baseline Weight Established' : 'New Progress Weight Entry');
  const finalEntry: ProgressEntry = {
    ...newEntry,
    notes: noteToUse,
  };

  const updatedEntries = [...existingEntries, finalEntry];

  // 4. Verify the new row was added exactly once
  const verified = updatedEntries.length === existingEntries.length + 1;
  const previousWeight = latestExisting ? latestExisting.weightKg : finalEntry.weightKg;
  const changeFromBaseline = Number((finalEntry.weightKg - (isBaseline ? finalEntry.weightKg : originalBaseline)).toFixed(1));
  const changeFromPrevious = Number((finalEntry.weightKg - previousWeight).toFixed(1));

  return {
    status: verified ? 'SUCCESS' : 'VERIFICATION_FAILED',
    isBaseline,
    entry: finalEntry,
    existingEntries,
    updatedEntries,
    baselineWeight: isBaseline ? finalEntry.weightKg : originalBaseline,
    changeFromBaseline,
    changeFromPrevious,
    message: verified ? 'Progress recorded successfully.' : 'Verification failed: row was not added exactly once.',
    verified,
  };
}

/**
 * Robust Google Sheet weight recording:
 * 1. Before writing to Progress, always reads existing entries.
 * 2. Permanent baseline preservation (first recorded entry).
 * 3. Never creates duplicate baseline unless explicit reset requested.
 * 4. Never writes duplicate if user confirms baseline.
 * 5. Creates exactly one new row.
 * 6. Avoids duplicate date/weight unless explicit new measurement requested.
 * 7. Verifies the row was added exactly once by re-reading after write.
 */
export async function recordProgressWithVerification(
  accessToken: string,
  spreadsheetId: string,
  newEntry: ProgressEntry,
  options: RecordProgressOptions = {}
): Promise<RecordProgressResult> {
  // Step 1: Always read ALL existing entries first from the Progress sheet
  const existingEntries = await fetchProgress(accessToken, spreadsheetId);

  // Read all existing entries in chronological order
  const sortedExisting = getSortedProgressEntries(existingEntries);

  // Rule: First/oldest existing entry = permanent baseline.
  // Rule: Never create a new baseline if any Progress entry already exists.
  const isBaseline = sortedExisting.length === 0;
  const earliestEntry = sortedExisting.length > 0 ? sortedExisting[0] : null;
  const originalBaseline = earliestEntry ? earliestEntry.weightKg : newEntry.weightKg;
  const latestExisting = sortedExisting.length > 0 ? sortedExisting[sortedExisting.length - 1] : null;

  // Step 2: Rule: A confirmed existing baseline must not create another row.
  const isConfirmingBaseline =
    !isBaseline &&
    (options.isBaselineConfirmation ||
      (Math.abs(newEntry.weightKg - originalBaseline) < 0.05 &&
        (/\b(baseline|confirm|my baseline)\b/i.test(newEntry.notes || '') || !options.isExplicitNewMeasurement)));

  if (isConfirmingBaseline) {
    return {
      status: 'BASELINE_CONFIRMED',
      isBaseline: false,
      entry: newEntry,
      existingEntries,
      updatedEntries: existingEntries,
      baselineWeight: originalBaseline,
      message: `Your baseline weight is already established at ${originalBaseline.toFixed(1)} kg${earliestEntry?.date ? ` (established on ${earliestEntry.date})` : ''}. No duplicate entry was created in Progress sheet.`,
      verified: true,
    };
  }

  // Step 3: Do not duplicate same weight/date unless explicitly requested
  if (!options.isExplicitNewMeasurement && sortedExisting.length > 0) {
    const existingSame = sortedExisting.find(
      (p) => normalizeDateString(p.date) === normalizeDateString(newEntry.date) && Math.abs(p.weightKg - newEntry.weightKg) < 0.05
    );
    if (existingSame) {
      return {
        status: 'DUPLICATE_IGNORED',
        isBaseline: false,
        entry: newEntry,
        existingEntries,
        updatedEntries: existingEntries,
        baselineWeight: originalBaseline,
        message: `A weight measurement of ${newEntry.weightKg.toFixed(1)} kg is already recorded for ${newEntry.date}. No duplicate entry was created in Progress sheet.`,
        verified: true,
      };
    }
  }

  // Step 4: Rule: New weight = exactly one new Progress row. Never delete or modify existing Progress data automatically.
  const noteToUse = newEntry.notes || (isBaseline ? 'Baseline Weight Established' : 'New Progress Weight Entry');
  const finalEntry: ProgressEntry = {
    ...newEntry,
    notes: noteToUse,
  };

  await appendProgress(accessToken, spreadsheetId, finalEntry);

  // Step 5: After writing, verify the new row was added exactly once
  const reReadProgress = await fetchProgress(accessToken, spreadsheetId);

  const lengthMatches = reReadProgress.length === existingEntries.length + 1;
  const lastRow = reReadProgress.length > 0 ? reReadProgress[reReadProgress.length - 1] : null;
  const lastRowMatches =
    lastRow &&
    Math.abs(lastRow.weightKg - finalEntry.weightKg) < 0.05 &&
    normalizeDateString(lastRow.date) === normalizeDateString(finalEntry.date);

  const verified = Boolean(lengthMatches && lastRowMatches);

  if (!verified) {
    return {
      status: 'VERIFICATION_FAILED',
      isBaseline,
      entry: finalEntry,
      existingEntries,
      updatedEntries: existingEntries,
      baselineWeight: isBaseline ? finalEntry.weightKg : originalBaseline,
      message: 'Verification failed: Google Sheet Progress tab did not reflect the new row exactly once.',
      verified: false,
    };
  }

  const previousWeight = latestExisting ? latestExisting.weightKg : finalEntry.weightKg;
  const changeFromBaseline = Number((finalEntry.weightKg - (isBaseline ? finalEntry.weightKg : originalBaseline)).toFixed(1));
  const changeFromPrevious = Number((finalEntry.weightKg - previousWeight).toFixed(1));

  return {
    status: 'SUCCESS',
    isBaseline,
    entry: finalEntry,
    existingEntries,
    updatedEntries: reReadProgress,
    baselineWeight: isBaseline ? finalEntry.weightKg : originalBaseline,
    changeFromBaseline,
    changeFromPrevious,
    message: 'Weight entry recorded and verified in Progress sheet exactly once.',
    verified: true,
  };
}

/**
 * Add an item to Food Database tab
 */
export async function appendFoodDatabaseItem(
  accessToken: string,
  spreadsheetId: string,
  item: FoodDatabaseItem
) {
  const range = encodeURIComponent('Food Database!A:I');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const values = [
    [
      item.food,
      item.serving,
      item.unit,
      Math.round(item.calories),
      Number(item.protein.toFixed(1)),
      Number(item.carbs.toFixed(1)),
      Number(item.fat.toFixed(1)),
      Number(item.fiber.toFixed(1)),
      item.notes || (item.isEstimate ? 'Estimated' : ''),
    ],
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to add item to Food Database in Google Sheet');
  }
}

/**
 * Update a specific Food Database row
 */
export async function updateFoodDatabaseEntry(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number,
  item: FoodDatabaseItem
): Promise<void> {
  const range = encodeURIComponent(`Food Database!A${rowNumber}:I${rowNumber}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const values = [
    [
      item.food,
      item.serving,
      item.unit,
      Math.round(item.calories),
      Number(item.protein.toFixed(1)),
      Number(item.carbs.toFixed(1)),
      Number(item.fat.toFixed(1)),
      Number(item.fiber.toFixed(1)),
      item.notes || (item.isEstimate ? 'Estimated values' : ''),
    ],
  ];

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Failed to update Food Database entry in Google Sheet:', err, { rowNumber, item });
    throw new Error(err.error?.message || 'Failed to update Food Database entry in Google Sheet');
  }
}

/**
 * Upsert Daily Summary row for a specific date
 */
export async function upsertDailySummary(
  accessToken: string,
  spreadsheetId: string,
  summary: DailySummaryEntry
) {
  // First check existing rows in Daily Summary
  const readRange = encodeURIComponent('Daily Summary!A2:A100');
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${readRange}`;

  const readRes = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let existingRowIndex = -1;
  if (readRes.ok) {
    const readData = await readRes.json();
    const rows: string[][] = readData.values || [];
    existingRowIndex = rows.findIndex(
      (r) => r[0] && normalizeDateString(r[0].trim()) === normalizeDateString(summary.date)
    );
  }

  const rowValues = [
    summary.date,
    Math.round(summary.totalCalories),
    Number(summary.totalProtein.toFixed(1)),
    Number(summary.totalCarbs.toFixed(1)),
    Number(summary.totalFat.toFixed(1)),
    Number(summary.totalFiber.toFixed(1)),
    Math.round(summary.activityBurned),
    Math.round(summary.calorieTarget),
    Math.round(summary.difference),
  ];

  if (existingRowIndex >= 0) {
    // Row 2 is index 0, so spreadsheet row number is index + 2
    const targetRow = existingRowIndex + 2;
    const updateRange = encodeURIComponent(`Daily Summary!A${targetRow}:I${targetRow}`);
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`;

    await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    });
  } else {
    // Append new row
    const appendRange = encodeURIComponent('Daily Summary!A:I');
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    });
  }
}

/**
 * Read Food Log tab with raw formulas (valueRenderOption=FORMULA)
 */
export async function fetchFoodLogRawFormulas(
  accessToken: string,
  spreadsheetId: string
): Promise<any[][]> {
  const range = encodeURIComponent('Food Log!A2:J');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMULA`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.values || [];
  } catch {
    return [];
  }
}

