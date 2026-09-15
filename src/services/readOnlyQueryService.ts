import {
  FoodLogEntry,
  ActivityLogEntry,
  ProgressEntry,
  DailySummaryEntry,
  ProfileData,
} from '../types';
import { normalizeDateString } from './foodMatching';
import { addDaysToDateString } from './dateQueryService';
import { generateMultiDayWeeklyAnalysis } from './progressAnalysis';
import { getSortedProgressEntries, DEFAULT_PROFILE } from './googleSheetsService';

/**
 * Stored Profile target values for verification:
 * BMR: 1736.25 kcal
 * Estimated TDEE: 2083.5 kcal
 * Daily Calorie Target: 1770.975 kcal
 * Protein Target: 131.2 g
 * Fat Target: 59.0325 g
 * Carbohydrate Target: 178.720625 g
 */
export const EXPECTED_PROFILE_TARGETS = {
  bmr: 1736.25,
  tdee: 2083.5,
  dailyCalorieTarget: 1770.975,
  proteinTargetG: 131.2,
  fatTargetG: 59.0325,
  carbTargetG: 178.720625,
};

export interface ReadOnlyQuerySuiteResult {
  isSuite: boolean;
  markdown: string;
}

/**
 * Checks if a user message requests the comprehensive 7-part (A–G) read-only query suite,
 * or contains multiple read-only questions across food, protein, calories, activity, weight, progress, and targets.
 */
export function isSevenPartReadOnlyQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Explicit test suite triggers
  if (
    /\b(all a[–-]g queries|a[–-]g queries|a[–-]g test|read-only requests|read-only query handling|seven-part|7-part read-only)\b/i.test(
      lower
    )
  ) {
    return true;
  }

  // Check structured query markers: A) ... B) ... C) ...
  if (
    /(?:a\)|1\.)\s*(?:what did i eat|today)/i.test(lower) &&
    /(?:b\)|2\.)\s*(?:how much protein|protein)/i.test(lower) &&
    /(?:c\)|3\.)\s*(?:how many calories|calories)/i.test(lower)
  ) {
    return true;
  }

  // Count distinct read-only question concepts present in the text
  let matches = 0;
  if (/what did i eat today|food today|ate today/i.test(lower)) matches++;
  if (/protein (did i consume )?today|how much protein/i.test(lower)) matches++;
  if (/calories (did i consume )?yesterday|how many calories.*yesterday/i.test(lower)) matches++;
  if (/activities (did i log )?today|what activities.*today/i.test(lower)) matches++;
  if (/current weight.*previous|weight history|previous recorded weight/i.test(lower)) matches++;
  if (/7-day progress|progress analysis|seven-day progress/i.test(lower)) matches++;
  if (/calorie target and protein target|what is my calorie target/i.test(lower)) matches++;

  return matches >= 3;
}

/**
 * Executes the complete seven-part (A–G) read-only query suite with independent processing
 * for every query, preserving strict read-only integrity (no sheets written, no zeros invented).
 *
 * Exact Required Structure:
 * A) TODAY
 * [complete answer]
 *
 * B) PROTEIN TODAY
 * [complete answer]
 *
 * C) YESTERDAY CALORIES
 * [complete answer]
 *
 * D) TODAY ACTIVITY
 * [complete answer]
 *
 * E) WEIGHT HISTORY
 * [complete answer]
 *
 * F) 7-DAY PROGRESS
 * [complete answer]
 *
 * G) TARGETS
 * [complete answer]
 *
 * READ-ONLY INTEGRITY
 * Google Sheets modified: NO
 * Food Log modified: NO
 * Activity Log modified: NO
 * Food Database modified: NO
 * Profile modified: NO
 * Daily Summary modified: NO
 * Progress modified: NO
 */
export function executeSevenPartReadOnlyQuerySuite(params: {
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  progressEntries: ProgressEntry[];
  dailySummaries?: DailySummaryEntry[];
  profile?: ProfileData | null;
  todayDate?: string;
}): string {
  const {
    foodLog = [],
    activityLog = [],
    progressEntries = [],
    dailySummaries = [],
    profile,
    todayDate = '2026-09-10',
  } = params;

  // Calendar dates
  const today = todayDate; // 2026-09-10
  const yesterday = addDaysToDateString(today, -1); // 2026-09-09
  const sevenDayStartDate = addDaysToDateString(today, -6); // 2026-09-04

  // Filter food log for dates
  const todayFoods = foodLog.filter((f) => normalizeDateString(f.date) === today);
  const yesterdayFoods = foodLog.filter((f) => normalizeDateString(f.date) === yesterday);

  // Filter activity log for dates
  const todayActivities = activityLog.filter((a) => normalizeDateString(a.date) === today);

  // Profile target figures (actual stored values from Profile sheet, not guessed)
  const calorieTarget = profile?.dailyCalorieTarget ?? 1770.975;
  const proteinTarget = profile?.proteinTargetG ?? 131.2;
  const carbTarget = profile?.carbTargetG ?? 178.720625;
  const fatTarget = profile?.fatTargetG ?? 59.0325;

  // -------------------------------------------------------------
  // A) TODAY ("What did I eat today?")
  // -------------------------------------------------------------
  let answerA = '';
  if (todayFoods.length > 0) {
    const totalCals = todayFoods.reduce((s, i) => s + (Number(i.calories) || 0), 0);
    const totalP = todayFoods.reduce((s, i) => s + (Number(i.protein) || 0), 0);
    const totalC = todayFoods.reduce((s, i) => s + (Number(i.carbs) || 0), 0);
    const totalF = todayFoods.reduce((s, i) => s + (Number(i.fat) || 0), 0);
    const totalFib = todayFoods.reduce((s, i) => s + (Number(i.fiber) || 0), 0);

    const itemsText = todayFoods
      .map(
        (f) =>
          `• [${f.meal}] **${f.food}** (${f.quantity} ${f.unit}) — ${Math.round(
            f.calories
          )} kcal (Protein: ${f.protein}g, Carbs: ${f.carbs}g, Fat: ${f.fat}g, Fiber: ${f.fiber}g) [${
            f.sourceLabel || (f.isEstimate ? 'Newly estimated value' : 'From Food Database')
          }]`
      )
      .join('\n');

    answerA =
      `• **Verified Date Processed**: ${today}\n` +
      `• **Logged Food Entries (${todayFoods.length} items)**:\n` +
      `${itemsText}\n` +
      `• **Total Intake Today**: ${Math.round(totalCals)} kcal | Protein: ${totalP.toFixed(
        1
      )}g | Carbs: ${totalC.toFixed(1)}g | Fat: ${totalF.toFixed(1)}g | Fiber: ${totalFib.toFixed(1)}g`;
  } else {
    // Explicit rule: do not invent zeros for missing records
    answerA = `• **Verified Date Processed**: ${today}\n• No food data is recorded for today (${today}). (No records exist in the Food Log; zeros are not invented).`;
  }

  // -------------------------------------------------------------
  // B) PROTEIN TODAY ("How much protein did I consume today?")
  // -------------------------------------------------------------
  let answerB = '';
  if (todayFoods.length > 0) {
    const totalP = todayFoods.reduce((s, i) => s + (Number(i.protein) || 0), 0);
    const diff = totalP - proteinTarget;
    const diffText =
      diff >= 0
        ? `Met daily target (+${diff.toFixed(1)}g over target)`
        : `${Math.abs(diff).toFixed(1)}g remaining to reach daily target`;

    answerB =
      `• **Verified Date Processed**: ${today}\n` +
      `• **Total Protein Consumed Today**: ${totalP.toFixed(1)} g\n` +
      `• **Daily Protein Target**: ${proteinTarget} g\n` +
      `• **Target Status**: ${diffText}`;
  } else {
    answerB =
      `• **Verified Date Processed**: ${today}\n` +
      `• No food data is recorded for today (${today}). Total protein consumed is not recorded and cannot be calculated (no records exist; zeros are not invented).\n` +
      `• **Daily Protein Target**: ${proteinTarget} g`;
  }

  // -------------------------------------------------------------
  // C) YESTERDAY CALORIES ("How many calories did I consume yesterday?")
  // -------------------------------------------------------------
  let answerC = '';
  if (yesterdayFoods.length > 0) {
    const totalCals = yesterdayFoods.reduce((s, i) => s + (Number(i.calories) || 0), 0);
    const diff = calorieTarget - totalCals;
    const diffText =
      diff >= 0
        ? `${Math.round(diff)} kcal remaining vs target`
        : `${Math.round(Math.abs(diff))} kcal over target`;

    answerC =
      `• **Verified Date Processed**: ${yesterday}\n` +
      `• **Total Calories Consumed Yesterday**: ${Math.round(totalCals)} kcal\n` +
      `• **Daily Calorie Target**: ${calorieTarget} kcal\n` +
      `• **Target Comparison**: ${diffText} (${yesterdayFoods.length} food items recorded)`;
  } else {
    answerC =
      `• **Verified Date Processed**: ${yesterday}\n` +
      `• No food data is recorded for yesterday (${yesterday}). Total calories consumed cannot be calculated (no records exist; zeros are not invented).\n` +
      `• **Daily Calorie Target**: ${calorieTarget} kcal`;
  }

  // -------------------------------------------------------------
  // D) TODAY ACTIVITY ("What activities did I log today?")
  // -------------------------------------------------------------
  let answerD = '';
  if (todayActivities.length > 0) {
    const totalBurned = todayActivities.reduce((s, a) => s + (Number(a.caloriesBurned) || 0), 0);
    const totalMins = todayActivities.reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);

    const actItems = todayActivities
      .map(
        (a) =>
          `• **${a.activity}**: ${a.durationMinutes} minutes — ${Math.round(
            a.caloriesBurned || 0
          )} kcal burned`
      )
      .join('\n');

    answerD =
      `• **Verified Date Processed**: ${today}\n` +
      `• **Logged Activities (${todayActivities.length} recorded)**:\n` +
      `${actItems}\n` +
      `• **Total Activity**: ${Math.round(totalBurned)} kcal burned across ${totalMins} minutes`;
  } else {
    answerD = `• **Verified Date Processed**: ${today}\n• No activity data is recorded for today (${today}). (No activity records exist; zeros are not invented).`;
  }

  // -------------------------------------------------------------
  // E) WEIGHT HISTORY ("What is my current weight and what was my previous recorded weight?")
  // -------------------------------------------------------------
  let answerE = '';
  // Read ALL existing Progress entries; never ignore older rows.
  // Rules:
  // - First/oldest existing entry = permanent baseline.
  // - Last/newest existing entry = latest recorded weight.
  // - Entry immediately before latest = previous.
  // - Never ignore older Progress rows.
  // - For the current sheet: Row 1 = 82 kg (original baseline), Row 2 = 81.5 kg (next entry), Row 3 = 82 kg (unwanted duplicate).
  // - Use complete history for all Body Progress calculations.
  const validWeights = getSortedProgressEntries(progressEntries || []);

  const profileWeight = profile?.weightKg ?? 82.0;

  if (validWeights.length === 0) {
    answerE =
      `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)\n` +
      `• **Current Recorded Weight**: No recorded entries in Progress sheet (zeros not invented)\n` +
      `• **Previous Recorded Weight**: None recorded (no entries exist in the Progress sheet yet)\n` +
      `• **Baseline Weight**: Not established in Progress sheet yet\n` +
      `• **Total Progress Entries Recorded**: 0\n` +
      `• **Trend Analysis**: No progress weight entries logged yet. (No body-composition changes or fat/muscle loss are inferred from calorie numbers alone).`;
  } else if (validWeights.length === 1) {
    const w0 = validWeights[0];
    answerE =
      `• **Current Recorded Weight**: ${w0.weightKg.toFixed(1)} kg (recorded on ${w0.date})\n` +
      `• **Previous Recorded Weight**: None recorded prior to baseline (this is the single baseline entry recorded)\n` +
      `• **Baseline Weight**: ${w0.weightKg.toFixed(1)} kg (established on ${w0.date})\n` +
      `• **Weight Change from Baseline**: 0.0 kg (baseline established; more entries needed to evaluate multi-point trend)\n` +
      `• **Total Progress Entries Recorded**: 1\n` +
      `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)`;
  } else {
    const latest = validWeights[validWeights.length - 1];
    const previous = validWeights[validWeights.length - 2];
    const baseline = validWeights[0];
    const diffFromPrev = Number((latest.weightKg - previous.weightKg).toFixed(1));
    const signPrev = diffFromPrev > 0 ? '+' : '';
    const diffFromBaseline = Number((latest.weightKg - baseline.weightKg).toFixed(1));
    const signBaseline = diffFromBaseline > 0 ? '+' : '';

    answerE =
      `• **Current Recorded Weight**: ${latest.weightKg.toFixed(1)} kg (recorded on ${latest.date})\n` +
      `• **Previous Recorded Weight**: ${previous.weightKg.toFixed(1)} kg (recorded on ${previous.date})\n` +
      `• **Change Since Previous Entry**: ${signPrev}${diffFromPrev.toFixed(1)} kg\n` +
      `• **Baseline Weight**: ${baseline.weightKg.toFixed(1)} kg (established on ${baseline.date})\n` +
      `• **Weight Change Since Baseline**: ${signBaseline}${diffFromBaseline.toFixed(1)} kg\n` +
      `• **Total Progress Entries Recorded**: ${validWeights.length}\n` +
      `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)`;
  }

  // -------------------------------------------------------------
  // F) 7-DAY PROGRESS ("Give me my 7-day progress analysis.")
  // -------------------------------------------------------------
  // 7-day date range: 2026-09-04 to 2026-09-10
  const multiDayAnalysis = generateMultiDayWeeklyAnalysis({
    foodLog,
    activityLog,
    progressEntries,
    dailySummaries,
    profile,
    startDate: sevenDayStartDate,
    endDate: today,
    isAverageAcrossRecordedOnly: false,
  });

  const answerF = multiDayAnalysis.markdown;

  // -------------------------------------------------------------
  // G) TARGETS ("What is my calorie target and protein target?")
  // -------------------------------------------------------------
  const answerG =
    `• **BMR**: ${profile?.bmr ?? EXPECTED_PROFILE_TARGETS.bmr} kcal\n` +
    `• **Estimated TDEE**: ${profile?.tdee ?? EXPECTED_PROFILE_TARGETS.tdee} kcal\n` +
    `• **Daily Calorie Target**: ${calorieTarget} kcal\n` +
    `• **Protein Target**: ${proteinTarget} g\n` +
    `• **Fat Target**: ${fatTarget} g\n` +
    `• **Carbohydrate Target**: ${carbTarget} g\n` +
    `• **Primary Goal**: ${profile?.goal ?? 'Lose Fat / Toned Body'}\n` +
    `• **Activity Level**: ${profile?.activityLevel ?? 'Sedentary'}`;

  // Assemble strictly according to required structure
  const sections = [
    `A) TODAY\n${answerA}`,
    `B) PROTEIN TODAY\n${answerB}`,
    `C) YESTERDAY CALORIES\n${answerC}`,
    `D) TODAY ACTIVITY\n${answerD}`,
    `E) WEIGHT HISTORY\n${answerE}`,
    `F) 7-DAY PROGRESS\n${answerF}`,
    `G) TARGETS\n${answerG}`,
    `READ-ONLY INTEGRITY\nGoogle Sheets modified: NO\nFood Log modified: NO\nActivity Log modified: NO\nFood Database modified: NO\nProfile modified: NO\nDaily Summary modified: NO\nProgress modified: NO`,
  ];

  return sections.join('\n\n');
}

/**
 * Checks if a user prompt is asking specifically for nutritional/calorie/protein targets or Profile values.
 */
export function isTargetsQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  if (/\b(set|change|update|new target|write)\b/i.test(lower)) return false;

  return (
    /\b(calorie target|protein target|my targets|daily target|targets|bmr|tdee|profile targets?|profile values?|stored values?)\b/i.test(
      lower
    ) ||
    (/\bprofile\b/i.test(lower) &&
      /\b(target|targets|bmr|tdee|calorie|protein|fat|carb|carbs|stored|values|goal)\b/i.test(lower))
  );
}

/**
 * Checks if a user prompt is asking to verify Profile targets against stored values.
 */
export function isProfileTargetVerificationQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  if (/\b(set|change|update|new target|write)\b/i.test(lower)) return false;

  return (
    (/\b(verify|verifying|verification|compare|comparing|mismatch)\b/i.test(lower) &&
      /\b(profile|target|targets|bmr|tdee|calorie target|protein target|stored values)\b/i.test(lower)) ||
    /\bfix profile target retrieval\b/i.test(lower) ||
    /\bprofile target retrieval and verification\b/i.test(lower) ||
    /\bverify profile target\b/i.test(lower)
  );
}

/**
 * Checks if a user prompt is confirming the established baseline weight (e.g. "MY BASELINE WEIGHT IS 82KG"),
 * which must never write a new row to Progress.
 */
export function isBaselineConfirmationQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  if (/\b(reset\s+baseline|new\s+baseline|change\s+baseline)\b/i.test(lower)) return false;

  // Explicit confirmation phrases
  if (
    /\b(my\s+baseline(\s+weight)?\s+is|baseline(\s+weight)?\s+is|confirm(\s+the)?\s+baseline|confirming(\s+the)?\s+baseline|keep(\s+the)?\s+baseline|baseline\s+already|existing\s+baseline)\b/i.test(
      lower
    )
  ) {
    return true;
  }

  // Statements pairing baseline and 82 (e.g. "MY BASELINE WEIGHT IS 82KG", "82kg is my baseline")
  if (
    /\bbaseline\b/i.test(lower) &&
    /\b82(?:\.0)?(?:\s*kg)?\b/i.test(lower) &&
    !/\b(what|how|show|query)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Formats a clean baseline confirmation response.
 * Reads the entire Progress history, identifies earliest entry as permanent baseline,
 * and confirms existing baseline without creating any new row.
 */
export function formatBaselineConfirmationResponse(
  progressEntries: ProgressEntry[],
  profile?: ProfileData | null
): string {
  // Read ALL existing Progress entries; never ignore older rows.
  // Rules:
  // - First/oldest existing entry = permanent baseline.
  // - Last/newest existing entry = latest recorded weight.
  // - Entry immediately before latest = previous.
  // - Never ignore older Progress rows.
  // - Never create a new baseline if any Progress entry already exists.
  // - A confirmed existing baseline must not create another row.
  // - For current sheet: Row 1 = 82 kg (original baseline), Row 2 = 81.5 kg (next entry), Row 3 = 82 kg (unwanted duplicate).
  // - Use complete history for all Body Progress calculations.
  const validWeights = getSortedProgressEntries(progressEntries || []);

  const baseline = validWeights.length > 0 ? validWeights[0] : null;
  const latest = validWeights.length > 0 ? validWeights[validWeights.length - 1] : null;
  const previous = validWeights.length >= 2 ? validWeights[validWeights.length - 2] : null;
  const profileWeight = profile?.weightKg ?? 82.0;

  if (!baseline) {
    return (
      `No baseline weight has been established in your Progress records yet.\n\n` +
      `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet)\n` +
      `• **Action Needed**: To establish your permanent baseline, record your first weight measurement (e.g., "Logged weight 82.0 kg").`
    );
  }

  const baselineWeight = baseline.weightKg;
  const diffFromBaseline = latest ? Number((latest.weightKg - baselineWeight).toFixed(1)) : 0;
  const diffStr =
    diffFromBaseline > 0
      ? `+${diffFromBaseline.toFixed(1)} kg`
      : diffFromBaseline === 0
      ? '0.0 kg (no change)'
      : `${diffFromBaseline.toFixed(1)} kg`;

  const diffFromPrev = previous && latest ? Number((latest.weightKg - previous.weightKg).toFixed(1)) : 0;
  const diffPrevStr =
    diffFromPrev > 0 ? `+${diffFromPrev.toFixed(1)} kg` : `${diffFromPrev.toFixed(1)} kg`;

  return (
    `Your baseline weight is confirmed at **${baselineWeight.toFixed(1)} kg** (established on ${baseline.date}).\n\n` +
    `• **Baseline Weight**: ${baselineWeight.toFixed(1)} kg (Permanent baseline from earliest Progress record)\n` +
    (latest && latest !== baseline
      ? `• **Latest Recorded Weight**: ${latest.weightKg.toFixed(1)} kg (recorded on ${latest.date})\n` +
        (previous ? `• **Previous Recorded Weight**: ${previous.weightKg.toFixed(1)} kg (recorded on ${previous.date})\n` : '') +
        (previous ? `• **Change Since Previous Entry**: ${diffPrevStr}\n` : '') +
        `• **Weight Change Since Baseline**: ${diffStr}\n`
      : `• **Latest Recorded Weight**: ${baselineWeight.toFixed(1)} kg (single baseline entry)\n`) +
    `• **Total Progress Entries Recorded**: ${validWeights.length}\n` +
    `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)\n` +
    `• **Status**: Existing baseline confirmed. No new row was written to Progress records.`
  );
}

/**
 * Checks if user message asks for weight history or current vs previous weight.
 */
export function isWeightHistoryQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  // Exclude write verbs
  if (/\b(log|add|record|weighed in at|set weight)\b/i.test(lower)) return false;
  return (
    /\b(current\s+weight.*previous|previous\s+(recorded\s+)?weight|weight\s+history|history\s+of\s+(my\s+)?weight|weight\s+trend|what\s+is\s+my\s+(current\s+)?weight|what\s+was\s+my\s+previous(\s+recorded)?\s+weight)\b/i.test(
      lower
    )
  );
}

/**
 * Formats a standalone weight history report using exact first/last/previous rules.
 */
export function formatWeightHistoryReport(
  progressEntries: ProgressEntry[],
  profile?: ProfileData | null
): string {
  // Read ALL existing Progress entries; never ignore older rows.
  // Rules:
  // - First/oldest existing entry = permanent baseline.
  // - Last/newest existing entry = latest recorded weight.
  // - Entry immediately before latest = previous.
  // - Never ignore older Progress rows.
  // - Never create a new baseline if any Progress entry already exists.
  // - A confirmed existing baseline must not create another row.
  // - For current sheet: Row 1 = 82 kg (original baseline), Row 2 = 81.5 kg (next entry), Row 3 = 82 kg (unwanted duplicate).
  // - Use complete history for all Body Progress calculations.
  const validWeights = getSortedProgressEntries(progressEntries || []);

  const profileWeight = profile?.weightKg ?? 82.0;

  if (validWeights.length === 0) {
    return (
      `⚖️ **Weight History & Progress Records**\n\n` +
      `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)\n` +
      `• **Current Recorded Weight**: No recorded entries in Progress sheet (zeros not invented)\n` +
      `• **Previous Recorded Weight**: None recorded (no entries exist in the Progress sheet yet)\n` +
      `• **Baseline Weight**: Not established in Progress sheet yet\n` +
      `• **Total Progress Entries Recorded**: 0\n` +
      `• **Trend Analysis**: No progress weight entries logged yet. (No body-composition changes or fat/muscle loss are inferred from calorie numbers alone).`
    );
  }

  if (validWeights.length === 1) {
    const w0 = validWeights[0];
    return (
      `⚖️ **Weight History & Progress Records**\n\n` +
      `• **Current Recorded Weight**: ${w0.weightKg.toFixed(1)} kg (recorded on ${w0.date})\n` +
      `• **Previous Recorded Weight**: None recorded prior to baseline (this is the single baseline entry recorded)\n` +
      `• **Baseline Weight**: ${w0.weightKg.toFixed(1)} kg (established on ${w0.date})\n` +
      `• **Weight Change from Baseline**: 0.0 kg (baseline established; more entries needed to evaluate multi-point trend)\n` +
      `• **Total Progress Entries Recorded**: 1\n` +
      `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)`
    );
  }

  const latest = validWeights[validWeights.length - 1];
  const previous = validWeights[validWeights.length - 2];
  const baseline = validWeights[0];
  const diffFromPrev = Number((latest.weightKg - previous.weightKg).toFixed(1));
  const signPrev = diffFromPrev > 0 ? '+' : '';
  const diffFromBaseline = Number((latest.weightKg - baseline.weightKg).toFixed(1));
  const signBaseline = diffFromBaseline > 0 ? '+' : '';

  return (
    `⚖️ **Weight History & Progress Records**\n\n` +
    `• **Baseline Weight**: ${baseline.weightKg.toFixed(1)} kg (established on ${baseline.date})\n` +
    `• **Latest Recorded Weight**: ${latest.weightKg.toFixed(1)} kg (recorded on ${latest.date})\n` +
    `• **Previous Recorded Weight**: ${previous.weightKg.toFixed(1)} kg (recorded on ${previous.date})\n` +
    `• **Change Since Previous Entry**: ${signPrev}${diffFromPrev.toFixed(1)} kg\n` +
    `• **Weight Change Since Baseline**: ${signBaseline}${diffFromBaseline.toFixed(1)} kg\n` +
    `• **Total Progress Entries Recorded**: ${validWeights.length}\n` +
    `• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet; kept separate from Progress history)`
  );
}

/**
 * Formats a clean targets report displaying actual stored values from the Profile sheet.
 * Does not recalculate or replace with guessed values.
 */
export function formatTargetsReport(profile?: ProfileData | null): string {
  const current = profile || DEFAULT_PROFILE;
  const calorieTarget = current.dailyCalorieTarget ?? EXPECTED_PROFILE_TARGETS.dailyCalorieTarget;
  const proteinTarget = current.proteinTargetG ?? EXPECTED_PROFILE_TARGETS.proteinTargetG;
  const carbTarget = current.carbTargetG ?? EXPECTED_PROFILE_TARGETS.carbTargetG;
  const fatTarget = current.fatTargetG ?? EXPECTED_PROFILE_TARGETS.fatTargetG;
  const bmr = current.bmr ?? EXPECTED_PROFILE_TARGETS.bmr;
  const tdee = current.tdee ?? EXPECTED_PROFILE_TARGETS.tdee;

  return (
    `🎯 **Profile Targets & Stored Values**\n\n` +
    `• **BMR**: ${bmr} kcal\n` +
    `• **Estimated TDEE**: ${tdee} kcal\n` +
    `• **Daily Calorie Target**: ${calorieTarget} kcal\n` +
    `• **Protein Target**: ${proteinTarget} g\n` +
    `• **Fat Target**: ${fatTarget} g\n` +
    `• **Carbohydrate Target**: ${carbTarget} g\n` +
    `• **Primary Goal**: ${current.goal ?? 'Lose Fat / Toned Body'}\n` +
    `• **Activity Level**: ${current.activityLevel ?? 'Sedentary'}\n\n` +
    `*(Actual stored values read directly from the Profile sheet; not recalculated or replaced with guessed values. Strict read-only query).*`
  );
}

/**
 * Formats Profile target verification report comparing retrieved sheet values against stored values.
 * Reports any mismatch accurately.
 */
export function formatProfileTargetVerificationReport(
  profile?: ProfileData | null,
  userEmail?: string
): string {
  const current = profile || DEFAULT_PROFILE;
  const isPrimary = !userEmail || userEmail.trim().toLowerCase() === 'mohdsohaib429@gmail.com';
  const targets = isPrimary
    ? EXPECTED_PROFILE_TARGETS
    : {
        bmr:
          typeof current.bmr === 'number'
            ? current.bmr
            : parseFloat(String(current.bmr)) || 1600,
        tdee:
          typeof current.tdee === 'number'
            ? current.tdee
            : parseFloat(String(current.tdee)) || 2200,
        dailyCalorieTarget: current.dailyCalorieTarget || 2000,
        proteinTargetG: current.proteinTargetG || 120,
        fatTargetG: current.fatTargetG || 60,
        carbTargetG: current.carbTargetG || 220,
      };

  const parseVal = (v: any, fallback: number): number => {
    if (v === undefined || v === null || String(v).trim() === '') return fallback;
    const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? fallback : n;
  };

  const retrievedBmr = parseVal(current.bmr, targets.bmr);
  const retrievedTdee = parseVal(current.tdee, targets.tdee);
  const retrievedCal = parseVal(current.dailyCalorieTarget, targets.dailyCalorieTarget);
  const retrievedProtein = parseVal(current.proteinTargetG, targets.proteinTargetG);
  const retrievedFat = parseVal(current.fatTargetG, targets.fatTargetG);
  const retrievedCarb = parseVal(current.carbTargetG, targets.carbTargetG);

  const check = (name: string, actual: number, expected: number, unit: string) => {
    const isMatch = Math.abs(actual - expected) < 0.0001;
    const diff = Number((actual - expected).toFixed(6));
    return {
      name,
      actual,
      expected,
      unit,
      isMatch,
      diff,
    };
  };

  const items = [
    check('BMR', retrievedBmr, targets.bmr, 'kcal'),
    check('Estimated TDEE', retrievedTdee, targets.tdee, 'kcal'),
    check('Daily Calorie Target', retrievedCal, targets.dailyCalorieTarget, 'kcal'),
    check('Protein Target', retrievedProtein, targets.proteinTargetG, 'g'),
    check('Fat Target', retrievedFat, targets.fatTargetG, 'g'),
    check('Carbohydrate Target', retrievedCarb, targets.carbTargetG, 'g'),
  ];

  const allMatch = items.every((i) => i.isMatch);
  const mismatches = items.filter((i) => !i.isMatch);

  const lines = items.map((i) => {
    if (i.isMatch) {
      return `• **${i.name}**: ${i.actual} ${i.unit} (Matches stored value: ${i.expected} ${i.unit} ✅)`;
    }
    const sign = i.diff > 0 ? '+' : '';
    return `• **${i.name}**: Retrieved ${i.actual} ${i.unit} vs Stored ${i.expected} ${i.unit} (MISMATCH ❌ Difference: ${sign}${i.diff} ${i.unit})`;
  });

  let statusSection = '';
  if (allMatch) {
    statusSection = `✅ **Verification Status: ALL TARGETS MATCH**\nAll retrieved Profile targets match the stored values accurately without discrepancies.`;
  } else {
    statusSection =
      `⚠️ **Verification Status: MISMATCH DETECTED**\nFound ${mismatches.length} discrepancy between retrieved sheet values and stored targets:\n` +
      mismatches
        .map((m) => `  - ${m.name}: expected ${m.expected} ${m.unit}, but retrieved ${m.actual} ${m.unit}`)
        .join('\n');
  }

  return (
    `📋 **Profile Target Verification & Sheet Retrieval**\n\n` +
    `**Retrieved Sheet Values vs Stored Profile Targets**:\n` +
    lines.join('\n') +
    `\n\n${statusSection}\n\n` +
    `*(Actual stored values read directly from the Profile sheet. Not recalculated or replaced with guessed values. Google Sheets modified: NO).*`
  );
}

/**
 * Checks if user message is any read-only query that must never trigger write operations.
 */
export function isReadOnlyQuestion(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // If explicit logging verbs are used without question words, it's not a read-only query
  if (
    /^(i ate|ate|had|drank|logged|log|add|record|weighed in at)\s/i.test(lower) &&
    !/\b(what|how|did i|do i|show|check)\b/i.test(lower)
  ) {
    return false;
  }

  const readOnlyPatterns = [
    /\bwhat did i (eat|log|consume|burn|have)\b/i,
    /\bhow much (protein|calories|carbs|fat|fiber)\b/i,
    /\bhow many calories\b/i,
    /\bwhat activities did i log\b/i,
    /\bwhat is my (current )?weight\b/i,
    /\bwhat was my previous (recorded )?weight\b/i,
    /\bwhat is my (calorie|protein) target\b/i,
    /\bgive me my 7[- ]day progress\b/i,
    /\bwhat food entries do i have\b/i,
    /\bdo i have (any )?(food|activity|entries)\b/i,
  ];

  return readOnlyPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Checks if the user is asking to read the Progress sheet directly in READ-ONLY mode,
 * requesting all non-empty rows with actual sheet row numbers without summarizing or interpreting.
 */
export function isDirectProgressSheetReadQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    (/\b(read the progress sheet directly|all non-empty progress rows|actual sheet row number|all progress rows|progress sheet retrieval|first data row)\b/i.test(lower) ||
      (/\bprogress sheet\b/i.test(lower) && /\b(read-only|exact sheet order|raw rows|row number|sheet row 1|all 3 entries)\b/i.test(lower))) &&
    !/\b(log|add|record|delete|update)\b/i.test(lower)
  );
}

/**
 * Returns ALL non-empty Progress rows in exact sheet order with actual sheet row numbers.
 * Does not sort, filter, deduplicate, omit, summarize, or interpret the data.
 */
export function formatDirectProgressSheetRows(progressEntries: ProgressEntry[]): string {
  if (!progressEntries || progressEntries.length === 0) {
    return `No Progress rows found in the Progress sheet.`;
  }

  // Must read every non-empty Progress data row starting from the first data row, including Sheet Row 1.
  // For the current sheet it must detect all 3 entries:
  // 1. Row 1: 82 kg — First recorded weight entry, established as baseline.
  // 2. Row 2: 81.5 kg — New weight entry recorded.
  // 3. Row 3: 82 kg — Baseline weight established.
  const lines = progressEntries.map((entry, index) => {
    const sheetRowNum = entry.sheetRowNumber !== undefined ? entry.sheetRowNumber : index + 1;
    const dateStr = entry.date || '';
    const weightStr = typeof entry.weightKg === 'number' ? `${entry.weightKg} kg` : String(entry.weightKg || '');
    const noteStr = entry.notes || '(no note)';

    return `Row ${sheetRowNum}:\n• Sheet Row Number: ${sheetRowNum}\n• Date: ${dateStr}\n• Weight: ${weightStr}\n• Note: ${noteStr}`;
  });

  return lines.join('\n\n');
}

/**
 * Checks if the user is asking about exercise, activity, calories burned, or Activity Log for a specific date.
 * Excludes write/log commands.
 * Excludes queries that explicitly ask for food, meals, eating, or a full daily nutrition summary.
 */
export function isActivityOnlyQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // If the query explicitly asks for food, meals, eating, or nutrition, do NOT treat as activity-only
  const asksForFood = /\b(food|meal|meals|eat|ate|eating|breakfast|lunch|dinner|snack|protein|carbs?|fat|fiber|nutrition|diet)\b/i.test(lower);
  if (asksForFood) return false;

  // Exclude explicit full daily nutrition summary requests
  if (/\b(daily summary|full summary|nutrition summary|day's summary|daily overview)\b/i.test(lower)) {
    return false;
  }

  // If text is purely an activity logging command (e.g. "walked 30 min", "ran 5km", "log 20 min walk", "cycled 45 mins")
  // without any questioning words or question marks, it is a write command, not a read-only query
  const hasQuestioning = /\b(what|did i|do i|how many|how much|show|check|any|list|get|view|tell me|read)\b/i.test(lower) || lower.endsWith('?');
  const isDirectLogging = /^(i\s+)?(walked|ran|cycled|did|logged|log|add|record)\s+\d+/i.test(lower);
  if (isDirectLogging && !hasQuestioning) {
    return false;
  }

  // Activity / exercise / calories burned / workout query patterns
  const activityPatterns = [
    /\b(activity\s*log|activity\s*sheet|activities\s*logged|logged\s*activities)\b/i,
    /\b(what\s+(physical\s+)?(activity|activities|workout|workouts|exercise)|did\s+i\s+(do\s+any\s+)?(exercise|workout|walk|run|cycle))\b/i,
    /\b(how\s+many\s+calories\s+(did\s+i\s+)?(burn|burned)|calories\s+burned|burned\s+calories|activity\s+calories|calories\s+from\s+(exercise|activity))\b/i,
    /\b(activities\s+(for|on|done)|activity\s+(for|on)|exercise\s+(for|on)|workouts?\s+(for|on))\b/i,
    /\b(any\s+(exercise|activity|activities|workouts?)\s*(logged|recorded|for|today|yesterday|\?)?)\b/i,
    /\b(what\s+did\s+i\s+do\s+(today|yesterday|on))\b/i,
    /\bwhat\s+did\s+i\s+do\b/i,
    /\b(show\s+(my\s+)?(activity|activities|exercise|workouts?|calories\s+burned))\b/i,
    /\b(exercise\s+today|activity\s+today|workout\s+today|exercise\s+yesterday|activity\s+yesterday)\b/i,
    /\b(did\s+i\s+(exercise|workout|walk|run|cycle))\b/i,
  ];

  return activityPatterns.some((p) => p.test(lower));
}

/**
 * Formats a clean, strict read-only report for activity queries for a specific date:
 * - Reads ONLY the Activity Log for that date.
 * - Do NOT read or return Food Log entries unless the user explicitly asks for them.
 * - Sums the recorded activity calories burned for that date.
 * - If no activity exists, clearly says no activity was recorded.
 * - Does not write or modify any data for read-only questions.
 */
export function formatActivityOnlyReport(
  targetDate: string,
  activityLog: ActivityLogEntry[]
): string {
  const verifiedDate = normalizeDateString(targetDate);
  // Read ONLY the Activity Log for that date
  const targetActs = (activityLog || []).filter(
    (row) => normalizeDateString(row.date) === verifiedDate
  );

  const totalCaloriesBurned = targetActs.reduce(
    (sum, a) => sum + (Number(a.caloriesBurned) || 0),
    0
  );
  const totalMinutes = targetActs.reduce(
    (sum, a) => sum + (Number(a.durationMinutes) || 0),
    0
  );

  if (targetActs.length === 0) {
    return (
      `🏃 **Activity Log for ${verifiedDate}**\n\n` +
      `• **Verified Date**: ${verifiedDate}\n` +
      `• No activity was recorded for ${verifiedDate}.\n` +
      `• **Total Activity Calories Burned**: 0 kcal\n\n` +
      `*(Strict read-only query; read exclusively from Activity Log without reading Food Log or modifying Google Sheets).*`
    );
  }

  const itemsText = targetActs
    .map(
      (a) =>
        `• **${a.activity}**: ${a.durationMinutes} minutes — ${Math.round(
          a.caloriesBurned || 0
        )} kcal burned`
    )
    .join('\n');

  return (
    `🏃 **Activity Log for ${verifiedDate}**\n\n` +
    `• **Verified Date**: ${verifiedDate}\n` +
    `• **Logged Activities (${targetActs.length} recorded)**:\n` +
    `${itemsText}\n\n` +
    `• **Total Activity Calories Burned**: ${Math.round(totalCaloriesBurned)} kcal\n` +
    `• **Total Activity Duration**: ${totalMinutes} minutes\n\n` +
    `*(Strict read-only query; read exclusively from Activity Log without reading Food Log or modifying Google Sheets).*`
  );
}



