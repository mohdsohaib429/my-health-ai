import { FoodLogEntry, ActivityLogEntry, ProgressEntry, ProfileData, DailySummaryEntry } from '../types';
import { getSystemTodayDate, normalizeDateString, resolveExplicitDate } from './foodMatching';
import { getSortedProgressEntries } from './googleSheetsService';

export interface DayNutritionStats {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function parseMonthNameToNumber(monthStr: string): number {
  if (!monthStr) return 1;
  const m = monthStr.toLowerCase().trim();
  const map: Record<string, number> = {
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
  return map[m] || 1;
}

/**
 * Generates an array of contiguous calendar date strings from startDate to endDate inclusive.
 */
export function generateCalendarDatesArray(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const current = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Checks if user message explicitly requests multi-day weekly analysis, consistency analysis,
 * or specifies a multi-day / 7-day date range.
 */
export function isWeeklyOr7DayRequest(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Exclude single-action logging commands like "log 7 pieces of food" or "record weekly weight"
  if (
    /\b(log|add|record|delete|remove)\b/i.test(lower) &&
    !/\b(analysis|progress|consistency|summary|overview|report|review)\b/i.test(lower)
  ) {
    return false;
  }

  // 1. Explicit 7-day or weekly keywords
  const weeklyKeywords =
    /\b(last 7 days|past 7 days|previous 7 days|7[- ]day analysis|7[- ]day progress|7[- ]day consistency|7[- ]day summary|7[- ]day overview|7[- ]day report|7 days analysis|7 days progress|7 days summary|7 days overview|weekly progress|weekly consistency|weekly analysis|weekly summary|weekly overview|weekly report|weekly trend|analyze (my )?(week|last 7 days|past 7 days)|how consistent (was i|am i) (this week|over the last 7 days)|week in review|week review)\b/i;
  if (weeklyKeywords.test(lower)) {
    return true;
  }

  // 2. Date range pattern: YYYY-MM-DD to YYYY-MM-DD
  if (/\b\d{4}-\d{2}-\d{2}\s*(?:to|through|thru|-|–|until|till)\s*\d{4}-\d{2}-\d{2}\b/i.test(text)) {
    return true;
  }

  // 3. Month Day to Month Day (e.g. Sept 4 to Sept 10)
  const monthNames = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const monthRangePattern = new RegExp(
    `\\b(?:from\\s+)?${monthNames}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*(?:to|through|thru|-|–|until|till)\\s*(?:${monthNames}\\.?\\s+)?\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?\\b`,
    'i'
  );
  if (monthRangePattern.test(text)) {
    return true;
  }

  return false;
}

/**
 * Resolves the multi-day date range requested by the user.
 * Defaults to a 7-day period ending on reference date (e.g. 2026-09-04 through 2026-09-10).
 */
export function resolveRequestedDateRange(
  text: string,
  baseDateStr: string,
  availableLoggedDates: string[] = []
): { startDate: string; endDate: string; totalDays: number; dates: string[] } {
  // 1. Check for explicit ISO range: YYYY-MM-DD to YYYY-MM-DD
  const isoRangeMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\s*(?:to|through|thru|-|–|until|till)\s*(\d{4}-\d{2}-\d{2})\b/i);
  if (isoRangeMatch) {
    let d1 = normalizeDateString(isoRangeMatch[1]);
    let d2 = normalizeDateString(isoRangeMatch[2]);
    if (d1 > d2) {
      const temp = d1;
      d1 = d2;
      d2 = temp;
    }
    const dates = generateCalendarDatesArray(d1, d2);
    return { startDate: d1, endDate: d2, totalDays: dates.length, dates };
  }

  // 2. Check for explicit Month Day to Month Day
  const monthNames = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const monthRangePattern = new RegExp(
    `\\b(?:from\\s+)?(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|thru|-|–|until|till)\\s*(?:(${monthNames})\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`,
    'i'
  );
  const mMatch = text.match(monthRangePattern);
  if (mMatch) {
    const baseYear = parseInt(baseDateStr.split('-')[0], 10);
    const year = mMatch[5] ? parseInt(mMatch[5], 10) : baseYear;
    const m1 = parseMonthNameToNumber(mMatch[1]);
    const d1 = parseInt(mMatch[2], 10);
    const m2 = mMatch[3] ? parseMonthNameToNumber(mMatch[3]) : m1;
    const d2 = parseInt(mMatch[4], 10);

    let start = `${year}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
    let end = `${year}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    const dates = generateCalendarDatesArray(start, end);
    return { startDate: start, endDate: end, totalDays: dates.length, dates };
  }

  // 3. 7-Day / Weekly with an explicit single date (e.g. "last 7 days up to 2026-09-10" or "weekly progress for 2026-09-10")
  const explicitSingleDate = resolveExplicitDate(text, baseDateStr);
  let resolvedEndDate = explicitSingleDate;

  if (!resolvedEndDate) {
    // If no explicit date mentioned in text, check if any logged dates in the app are newer than baseDateStr
    const sortedLogged = [...availableLoggedDates].sort();
    if (sortedLogged.length > 0 && sortedLogged[sortedLogged.length - 1] > baseDateStr) {
      resolvedEndDate = sortedLogged[sortedLogged.length - 1];
    } else {
      resolvedEndDate = baseDateStr;
    }
  }

  // 7 calendar days ending on resolvedEndDate inclusive (e.g., 2026-09-04 to 2026-09-10)
  const [ey, em, ed] = resolvedEndDate.split('-').map(Number);
  const endDateObj = new Date(Date.UTC(ey, em - 1, ed));
  const startDateObj = new Date(endDateObj);
  startDateObj.setUTCDate(startDateObj.getUTCDate() - 6);
  const resolvedStartDate = startDateObj.toISOString().split('T')[0];

  const dates = generateCalendarDatesArray(resolvedStartDate, resolvedEndDate);
  return {
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    totalDays: 7,
    dates,
  };
}

/**
 * Performs a rigorous multi-day 7-calendar-day progress analysis according to the user's 14 exact requirements:
 * 1. Total calories consumed across all 7 days
 * 2. Average daily calories consumed across all 7 calendar days
 * 3. Average daily protein
 * 4. Average daily carbohydrates
 * 5. Average daily fat
 * 6. Average daily fiber
 * 7. Total activity calories burned
 * 8. Total activity duration
 * 9. Weight entries and weight trend
 * 10. Number of days with recorded food intake
 * 11. Number of days with recorded activity
 * 12. Calorie-target consistency
 * 13. Protein-target consistency
 * 14. Short overall assessment
 *
 * Denominator rule: When calculating 7-day averages, the entire requested 7-calendar-day period is used as the denominator
 * unless the user explicitly asks for an average only across days with recorded data.
 * Missing values are not invented; days without logs are treated as unrecorded.
 * Strict Read-Only operation: Never modifies Google Sheets.
 */
export function generateMultiDayWeeklyAnalysis(params: {
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  progressEntries: ProgressEntry[];
  dailySummaries?: DailySummaryEntry[];
  profile?: ProfileData | null;
  startDate: string;
  endDate: string;
  isAverageAcrossRecordedOnly?: boolean;
}): { markdown: string; result: any } {
  const {
    foodLog = [],
    activityLog = [],
    progressEntries = [],
    dailySummaries = [],
    profile,
    startDate,
    endDate,
    isAverageAcrossRecordedOnly = false,
  } = params;

  const dates = generateCalendarDatesArray(startDate, endDate);
  const totalCalendarDays = dates.length > 0 ? dates.length : 7;

  // Targets from Profile
  const calorieTarget = profile?.dailyCalorieTarget || 1650;
  const proteinTarget = profile?.proteinTargetG || 140;
  const carbTarget = profile?.carbTargetG || 160;
  const fatTarget = profile?.fatTargetG || 50;
  const profileWeight = profile?.weightKg ?? 82;

  // Map food entries by normalized date
  const foodMap = new Map<string, FoodLogEntry[]>();
  foodLog.forEach((item) => {
    const d = normalizeDateString(item.date);
    if (!foodMap.has(d)) foodMap.set(d, []);
    foodMap.get(d)!.push(item);
  });

  // Map daily summaries by normalized date
  const summaryMap = new Map<string, DailySummaryEntry>();
  dailySummaries.forEach((s) => {
    const d = normalizeDateString(s.date);
    summaryMap.set(d, s);
  });

  // Inspect each calendar day in the period
  interface DayRecordedFood {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    itemsCount: number;
  }
  const recordedFoodDates: DayRecordedFood[] = [];
  const unrecordedFoodDates: string[] = [];

  dates.forEach((d) => {
    const items = foodMap.get(d) || [];
    if (items.length > 0) {
      const c = items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
      const p = items.reduce((s, i) => s + (Number(i.protein) || 0), 0);
      const carbs = items.reduce((s, i) => s + (Number(i.carbs) || 0), 0);
      const fat = items.reduce((s, i) => s + (Number(i.fat) || 0), 0);
      const fiber = items.reduce((s, i) => s + (Number(i.fiber) || 0), 0);
      recordedFoodDates.push({
        date: d,
        calories: c,
        protein: p,
        carbs,
        fat,
        fiber,
        itemsCount: items.length,
      });
    } else if (summaryMap.has(d) && (summaryMap.get(d)!.totalCalories > 0 || summaryMap.get(d)!.totalProtein > 0)) {
      const ds = summaryMap.get(d)!;
      recordedFoodDates.push({
        date: d,
        calories: ds.totalCalories,
        protein: ds.totalProtein,
        carbs: ds.totalCarbs,
        fat: ds.totalFat,
        fiber: ds.totalFiber,
        itemsCount: 0,
      });
    } else {
      unrecordedFoodDates.push(d);
    }
  });

  // Totals across all 7 days
  const totalCalories = recordedFoodDates.reduce((s, r) => s + r.calories, 0);
  const totalProtein = recordedFoodDates.reduce((s, r) => s + r.protein, 0);
  const totalCarbs = recordedFoodDates.reduce((s, r) => s + r.carbs, 0);
  const totalFat = recordedFoodDates.reduce((s, r) => s + r.fat, 0);
  const totalFiber = recordedFoodDates.reduce((s, r) => s + r.fiber, 0);

  // Denominator calculation rule:
  // Use the entire requested 7-calendar-day period as the denominator unless the user explicitly asks for an average only across recorded days
  const denominator = isAverageAcrossRecordedOnly
    ? recordedFoodDates.length > 0
      ? recordedFoodDates.length
      : totalCalendarDays
    : totalCalendarDays;

  const avgDailyCalories = totalCalories / denominator;
  const avgDailyProtein = totalProtein / denominator;
  const avgDailyCarbs = totalCarbs / denominator;
  const avgDailyFat = totalFat / denominator;
  const avgDailyFiber = totalFiber / denominator;

  // Supplementary averages across recorded days only
  const avgCaloriesRecordedOnly =
    recordedFoodDates.length > 0 ? totalCalories / recordedFoodDates.length : 0;
  const avgProteinRecordedOnly =
    recordedFoodDates.length > 0 ? totalProtein / recordedFoodDates.length : 0;
  const avgCarbsRecordedOnly =
    recordedFoodDates.length > 0 ? totalCarbs / recordedFoodDates.length : 0;
  const avgFatRecordedOnly =
    recordedFoodDates.length > 0 ? totalFat / recordedFoodDates.length : 0;
  const avgFiberRecordedOnly =
    recordedFoodDates.length > 0 ? totalFiber / recordedFoodDates.length : 0;

  // Activity calculation
  const actMap = new Map<string, ActivityLogEntry[]>();
  activityLog.forEach((act) => {
    const d = normalizeDateString(act.date);
    if (!actMap.has(d)) actMap.set(d, []);
    actMap.get(d)!.push(act);
  });

  interface DayRecordedActivity {
    date: string;
    durationMinutes: number;
    caloriesBurned: number;
    activities: string[];
  }
  const recordedActivityDates: DayRecordedActivity[] = [];
  const zeroActivityDates: string[] = [];

  dates.forEach((d) => {
    const acts = actMap.get(d) || [];
    if (acts.length > 0) {
      const duration = acts.reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);
      const burned = acts.reduce((s, a) => s + (Number(a.caloriesBurned) || 0), 0);
      recordedActivityDates.push({
        date: d,
        durationMinutes: duration,
        caloriesBurned: burned,
        activities: acts.map((a) => a.activity),
      });
    } else {
      zeroActivityDates.push(d);
    }
  });

  const totalActivityBurned = recordedActivityDates.reduce((s, a) => s + a.caloriesBurned, 0);
  const totalActivityMinutes = recordedActivityDates.reduce((s, a) => s + a.durationMinutes, 0);

  // Weight entries and trend (Item 9) - Read ALL existing Progress entries
  const validAllWeights = getSortedProgressEntries(progressEntries || []);

  const periodWeights = validAllWeights.filter((p) => {
    const d = normalizeDateString(p.date);
    return d >= startDate && d <= endDate;
  });

  let periodWeightSection = '';
  if (periodWeights.length > 0) {
    periodWeightSection = `• **Weight Entries in this 7-Day Period** (${periodWeights.length}): ${periodWeights
      .map((w) => `${w.weightKg.toFixed(1)} kg on ${w.date}${w.notes ? ` (${w.notes})` : ''}`)
      .join(', ')}`;
  } else {
    periodWeightSection = `• **Weight Entries in this 7-Day Period**: None recorded between ${startDate} and ${endDate}.`;
  }

  let progressRecordsSection = '';
  if (validAllWeights.length === 0) {
    progressRecordsSection =
      `  - Total Progress entries recorded: 0\n` +
      `  - Baseline Weight: Not established\n` +
      `  - Weight Change from Baseline: Cannot be calculated\n` +
      `  - Trend Analysis: No recorded weight entries exist in Progress sheet yet. (Note: No body-composition changes or fat/muscle loss are inferred from calorie numbers alone).`;
  } else if (validAllWeights.length === 1) {
    const w0 = validAllWeights[0];
    progressRecordsSection =
      `  - Total Progress entries recorded: 1\n` +
      `  - Baseline Weight: ${w0.weightKg.toFixed(1)} kg (established on ${w0.date})\n` +
      `  - Latest Weight: ${w0.weightKg.toFixed(1)} kg on ${w0.date}\n` +
      `  - Weight Change from Baseline: 0.0 kg (baseline established)\n` +
      `  - Trend Analysis: Baseline established; more recorded entries are needed to evaluate a multi-point trend. (No body-composition changes or fat/muscle loss are inferred from calorie numbers alone).`;
  } else {
    // First/oldest Progress entry = permanent baseline.
    // Last/newest Progress entry = latest recorded weight.
    // Previous = entry immediately before latest.
    const firstW = validAllWeights[0];
    const latestW = validAllWeights[validAllWeights.length - 1];
    const previousW = validAllWeights[validAllWeights.length - 2];
    const netChange = Number((latestW.weightKg - firstW.weightKg).toFixed(1));
    const sign = netChange > 0 ? '+' : '';
    const diffFromPrev = Number((latestW.weightKg - previousW.weightKg).toFixed(1));
    const signPrev = diffFromPrev > 0 ? '+' : '';
    progressRecordsSection =
      `  - Total Progress entries recorded: ${validAllWeights.length}\n` +
      `  - Baseline Weight: ${firstW.weightKg.toFixed(1)} kg (established on ${firstW.date})\n` +
      `  - Latest Recorded Weight: ${latestW.weightKg.toFixed(1)} kg on ${latestW.date}\n` +
      `  - Previous Recorded Weight: ${previousW.weightKg.toFixed(1)} kg on ${previousW.date}\n` +
      `  - Change Since Previous Entry: ${signPrev}${diffFromPrev.toFixed(1)} kg\n` +
      `  - Weight Change from Baseline: ${sign}${netChange.toFixed(1)} kg (compared to original baseline ${firstW.weightKg.toFixed(1)} kg)\n` +
      `  - Trend Analysis: ${sign}${netChange.toFixed(1)} kg net change across ${validAllWeights.length} recorded entries (${firstW.date} to ${latestW.date}). (No body-composition changes are inferred from calorie numbers alone).`;
  }

  // Calorie consistency (Item 12)
  let calorieMetCount = 0;
  const calorieDaysBreakdown = recordedFoodDates.map((r) => {
    const isWithin = r.calories <= calorieTarget;
    if (isWithin) calorieMetCount++;
    const diff = calorieTarget - r.calories;
    const diffText = diff >= 0 ? `${Math.round(diff)} kcal remaining` : `${Math.round(Math.abs(diff))} kcal over target`;
    return `    • ${r.date}: ${Math.round(r.calories)} kcal (${diffText})`;
  });

  let calorieConsistencySection = '';
  if (recordedFoodDates.length > 0) {
    calorieConsistencySection =
      `• **Adherence on Recorded Days**: ${calorieMetCount} of ${recordedFoodDates.length} recorded days remained within the daily calorie target (${calorieTarget} kcal/day).\n` +
      calorieDaysBreakdown.join('\n') +
      `\n• **Unrecorded Days**: ${unrecordedFoodDates.length} days had no recorded food intake.`;
  } else {
    calorieConsistencySection = `• **Adherence**: No food entries recorded across the 7-day period to assess calorie consistency.`;
  }

  // Protein consistency (Item 13)
  let proteinMetCount = 0;
  const proteinDaysBreakdown = recordedFoodDates.map((r) => {
    const reached = r.protein >= proteinTarget;
    if (reached) proteinMetCount++;
    const diff = r.protein - proteinTarget;
    const diffText = diff >= 0 ? `reached (+${diff.toFixed(1)}g over)` : `missed (${Math.abs(diff).toFixed(1)}g under)`;
    return `    • ${r.date}: ${r.protein.toFixed(1)} g (${diffText})`;
  });

  let proteinConsistencySection = '';
  if (recordedFoodDates.length > 0) {
    proteinConsistencySection =
      `• **Adherence on Recorded Days**: ${proteinMetCount} of ${recordedFoodDates.length} recorded days reached the daily protein target (${proteinTarget.toFixed(1)} g/day).\n` +
      proteinDaysBreakdown.join('\n') +
      `\n• **Unrecorded Days**: ${unrecordedFoodDates.length} days had no recorded food intake.`;
  } else {
    proteinConsistencySection = `• **Adherence**: No food entries recorded across the 7-day period to assess protein consistency.`;
  }

  // Short overall assessment (Item 14)
  let assessmentSection = '';
  const trackingRatio = `${recordedFoodDates.length} of ${totalCalendarDays} days`;
  if (recordedFoodDates.length === 0) {
    assessmentSection =
      `• **Tracking Continuity**: No meal logs exist for this 7-day window. Consistent daily food logging is the most vital foundation for evaluating weekly nutrition.\n` +
      `• **Next Steps**: Begin recording breakfast, lunch, and dinner to establish a comprehensive multi-day nutritional baseline.\n` +
      `• *(General non-medical personal tracking reference only; no clinical conclusions or body-composition inferences).*`;
  } else {
    const daysOverCalorie = recordedFoodDates.filter((r) => r.calories > calorieTarget);
    let calorieManagementAssessment = '';
    if (daysOverCalorie.length === 0) {
      calorieManagementAssessment = `consistently within the daily target (${Math.round(calorieTarget)} kcal/day) across all ${recordedFoodDates.length} recorded day(s)`;
    } else {
      const overDetails = daysOverCalorie
        .map((r) => `${r.date} (${Math.round(r.calories)} kcal, +${Math.round(r.calories - calorieTarget)} kcal above target)`)
        .join(', ');
      const maxOver = Math.max(...daysOverCalorie.map((r) => r.calories - calorieTarget));
      if (maxOver > 200) {
        calorieManagementAssessment = `above daily target on ${daysOverCalorie.length} recorded day(s) (${overDetails}); calorie intake was substantially above target on those days`;
      } else {
        calorieManagementAssessment = `slightly above target on ${daysOverCalorie.length} recorded day(s) (${overDetails})`;
      }
    }

    assessmentSection =
      `• **Tracking Continuity**: Food intake was recorded on ${trackingRatio}. Logging each day across the full 7-day period will provide an unbroken weekly foundation.\n` +
      `• **Calorie Management**: Calorie intake was ${calorieManagementAssessment}.\n` +
      `• **Protein Distribution**: Daily protein intake averaged ${avgProteinRecordedOnly.toFixed(1)} g on recorded days vs the ${proteinTarget.toFixed(1)} g/day target. Distributing lean protein sources evenly across main meals will support target attainment.\n` +
      `• **Physical Activity**: ${recordedActivityDates.length} active day(s) logged with ${totalActivityMinutes} minutes total duration and ~${Math.round(totalActivityBurned)} kcal burned.\n` +
      `• *(General non-medical personal tracking reference only; no clinical claims or body-composition changes are inferred from calorie numbers alone).*`;
  }

  const formatKcal = (n: number) => Math.round(n).toLocaleString();

  const markdown =
`### 📊 WEEKLY / 7-DAY PROGRESS ANALYSIS
**Date Range**: ${startDate} to ${endDate}

1. **Total calories consumed across all ${totalCalendarDays} days**:
• **${formatKcal(totalCalories)} kcal** total consumed across the ${totalCalendarDays}-day period.
${recordedFoodDates.length > 0 ? `  - Recorded intake days (${recordedFoodDates.length}): ${recordedFoodDates.map((r) => `${r.date}: ${formatKcal(r.calories)} kcal`).join('; ')}.\n` : ''}${unrecordedFoodDates.length > 0 ? `  - Days with no recorded food intake (${unrecordedFoodDates.length}): ${unrecordedFoodDates.join(', ')} (no food logged; values not invented).\n` : ''}
2. **Average daily calories consumed across all ${totalCalendarDays} calendar days**:
• **${avgDailyCalories.toFixed(1)} kcal/day** across all ${totalCalendarDays} calendar days (${formatKcal(totalCalories)} kcal ÷ ${totalCalendarDays} calendar days).
${recordedFoodDates.length > 0 && recordedFoodDates.length < totalCalendarDays ? `  *(Note: Across the ${recordedFoodDates.length} days with recorded food intake, daily intake averaged ${avgCaloriesRecordedOnly.toFixed(1)} kcal/day vs Daily Target of ${formatKcal(calorieTarget)} kcal/day).*` : ''}

3. **Average daily protein**:
• **${avgDailyProtein.toFixed(1)} g/day** across all ${totalCalendarDays} calendar days (${totalProtein.toFixed(1)} g ÷ ${totalCalendarDays} calendar days).
  *(Daily Target: ${proteinTarget.toFixed(1)} g/day${recordedFoodDates.length > 0 && recordedFoodDates.length < totalCalendarDays ? `; average on recorded days: ${avgProteinRecordedOnly.toFixed(1)} g/day` : ''}).*

4. **Average daily carbohydrates**:
• **${avgDailyCarbs.toFixed(1)} g/day** across all ${totalCalendarDays} calendar days (${totalCarbs.toFixed(1)} g ÷ ${totalCalendarDays} calendar days).
  *(Daily Target: ${carbTarget.toFixed(1)} g/day${recordedFoodDates.length > 0 && recordedFoodDates.length < totalCalendarDays ? `; average on recorded days: ${avgCarbsRecordedOnly.toFixed(1)} g/day` : ''}).*

5. **Average daily fat**:
• **${avgDailyFat.toFixed(1)} g/day** across all ${totalCalendarDays} calendar days (${totalFat.toFixed(1)} g ÷ ${totalCalendarDays} calendar days).
  *(Daily Target: ${fatTarget.toFixed(1)} g/day${recordedFoodDates.length > 0 && recordedFoodDates.length < totalCalendarDays ? `; average on recorded days: ${avgFatRecordedOnly.toFixed(1)} g/day` : ''}).*

6. **Average daily fiber**:
• **${avgDailyFiber.toFixed(1)} g/day** across all ${totalCalendarDays} calendar days (${totalFiber.toFixed(1)} g ÷ ${totalCalendarDays} calendar days).${recordedFoodDates.length > 0 && recordedFoodDates.length < totalCalendarDays ? `\n  *(Average on recorded days: ${avgFiberRecordedOnly.toFixed(1)} g/day).*` : ''}

7. **Total activity calories burned**:
• **${Math.round(totalActivityBurned)} kcal** burned across the ${totalCalendarDays}-day period.
${recordedActivityDates.length > 0 ? `  - Active days (${recordedActivityDates.length}): ${recordedActivityDates.map((a) => `${a.date}: ${a.activities.join(', ')} (${a.durationMinutes} min, ${Math.round(a.caloriesBurned)} kcal)`).join('; ')}.\n` : ''}${zeroActivityDates.length > 0 ? `  - Days with zero recorded activity (${zeroActivityDates.length}): ${zeroActivityDates.length === totalCalendarDays ? `All ${totalCalendarDays} days` : zeroActivityDates.join(', ')}.\n` : ''}
8. **Total activity duration**:
• **${totalActivityMinutes} minutes** of recorded physical activity across the ${totalCalendarDays}-day period.

9. **Weight entries and weight trend**:
• **Current Profile Weight**: ${profileWeight.toFixed(1)} kg (from Profile sheet).
${periodWeightSection}
• **Progress Records Status**:
${progressRecordsSection}

10. **Number of days with recorded food intake**:
• **${recordedFoodDates.length} of ${totalCalendarDays} days** with recorded food intake.
${recordedFoodDates.length > 0 ? `  - Days with recorded data (${recordedFoodDates.length}): ${recordedFoodDates.map((r) => `${r.date} (${formatKcal(r.calories)} kcal, ${r.protein.toFixed(1)}g protein)`).join('; ')}.\n` : ''}  - Days with no recorded food intake (${unrecordedFoodDates.length}): ${unrecordedFoodDates.length > 0 ? unrecordedFoodDates.join(', ') : 'None (full 7 days logged)'}. *(Missing values are not invented; days without logs are treated as unrecorded).*

11. **Number of days with recorded activity**:
• **${recordedActivityDates.length} of ${totalCalendarDays} days** with recorded physical activity.
${recordedActivityDates.length > 0 ? `  - Active days (${recordedActivityDates.length}): ${recordedActivityDates.map((a) => `${a.date} (${a.durationMinutes} min, ${Math.round(a.caloriesBurned)} kcal)`).join('; ')}.\n` : ''}  - Days with zero recorded activity (${zeroActivityDates.length}): ${zeroActivityDates.length > 0 ? (zeroActivityDates.length === totalCalendarDays ? `All ${totalCalendarDays} days` : zeroActivityDates.join(', ')) : 'None'}.

12. **Calorie-target consistency**:
• **Daily Calorie Target**: ${formatKcal(calorieTarget)} kcal/day.
${calorieConsistencySection}

13. **Protein-target consistency**:
• **Daily Protein Target**: ${proteinTarget.toFixed(1)} g/day.
${proteinConsistencySection}

14. **Short overall assessment**:
${assessmentSection}`;

  return {
    markdown,
    result: {
      startDate,
      endDate,
      totalCalendarDays,
      totalCalories,
      avgDailyCalories,
      totalProtein,
      avgDailyProtein,
      totalCarbs,
      avgDailyCarbs,
      totalFat,
      avgDailyFat,
      totalFiber,
      avgDailyFiber,
      totalActivityBurned,
      totalActivityMinutes,
      recordedFoodDates,
      unrecordedFoodDates,
      recordedActivityDates,
      zeroActivityDates,
      calorieTarget,
      proteinTarget,
      profileWeight,
    },
  };
}

export interface ProgressAnalysisResult {
  periodDays: number;
  loggedDaysCount: number;
  isPeriodIncomplete: boolean;
  startDate: string;
  endDate: string;
  avgCalories: number;
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  proteinMetCount: number;
  proteinMissedCount: number;
  dailyStats: DayNutritionStats[];
  activityDaysCount: number;
  totalActivityBurned: number;
  totalActivityMinutes: number;
  currentProfileWeight: number;
  avgProtein?: number;
  weightEntriesCount: number;
  weightStatus: 'NONE' | 'BASELINE_ONLY' | 'TREND_AVAILABLE';
  weightBaseline?: { date: string; weightKg: number };
  weightPrevious?: { date: string; weightKg: number };
  weightTrend?: {
    first: { date: string; weightKg: number };
    latest: { date: string; weightKg: number };
    previous: { date: string; weightKg: number };
    netChange: number;
    changeFromPrevious: number;
  };
  markdown: string;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (m >= 1 && m <= 12 && !isNaN(d)) {
      return `${months[m - 1]} ${d}`;
    }
  }
  return dateStr;
}

export function generateProgressAnalysis(params: {
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  progressEntries: ProgressEntry[];
  profile?: ProfileData | null;
  referenceDate?: string;
  windowDays?: number;
}): ProgressAnalysisResult {
  const {
    foodLog = [],
    activityLog = [],
    progressEntries = [],
    profile,
    referenceDate = getSystemTodayDate(),
    windowDays = 7,
  } = params;

  // Determine date window (last windowDays up to referenceDate)
  const windowDates: string[] = [];
  const refParts = referenceDate.split('-').map(Number);
  const baseDate = new Date(Date.UTC(refParts[0], refParts[1] - 1, refParts[2]));

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() - i);
    windowDates.push(d.toISOString().split('T')[0]);
  }

  const startDate = windowDates[0];
  const endDate = windowDates[windowDates.length - 1];

  // Group food log entries by normalized date
  const foodByDate = new Map<string, FoodLogEntry[]>();
  foodLog.forEach((item) => {
    const d = normalizeDateString(item.date);
    if (!foodByDate.has(d)) {
      foodByDate.set(d, []);
    }
    foodByDate.get(d)!.push(item);
  });

  // Identify which dates in the window have logged food
  const loggedDatesInWindow = windowDates.filter((d) => (foodByDate.get(d)?.length || 0) > 0);

  // If no food in this exact window, check if user has other recent logged dates
  let targetDatesToAnalyze = loggedDatesInWindow;
  let periodLabel = 'this week';
  if (loggedDatesInWindow.length === 0 && foodByDate.size > 0) {
    // Collect up to last windowDays distinct logged dates from the food log
    const allLoggedDates = Array.from(foodByDate.keys()).sort();
    targetDatesToAnalyze = allLoggedDates.slice(-windowDays);
    periodLabel = 'recent logged period';
  }

  const loggedDaysCount = targetDatesToAnalyze.length;
  const isPeriodIncomplete = loggedDaysCount < windowDays;

  // Calculate daily totals for analyzed dates
  const dailyStats: DayNutritionStats[] = targetDatesToAnalyze.map((dateStr) => {
    const items = foodByDate.get(dateStr) || [];
    return {
      date: dateStr,
      calories: items.reduce((s, i) => s + (Number(i.calories) || 0), 0),
      protein: items.reduce((s, i) => s + (Number(i.protein) || 0), 0),
      carbs: items.reduce((s, i) => s + (Number(i.carbs) || 0), 0),
      fat: items.reduce((s, i) => s + (Number(i.fat) || 0), 0),
      fiber: items.reduce((s, i) => s + (Number(i.fiber) || 0), 0),
    };
  });

  // Targets from profile
  const calorieTarget = profile?.dailyCalorieTarget || 1650;
  const proteinTarget = profile?.proteinTargetG || 140;
  const carbTarget = profile?.carbTargetG || 160;
  const fatTarget = profile?.fatTargetG || 50;

  // Aggregate stats
  const totalCalories = dailyStats.reduce((s, d) => s + d.calories, 0);
  const avgCalories = loggedDaysCount > 0 ? totalCalories / loggedDaysCount : 0;
  const totalProtein = dailyStats.reduce((s, d) => s + d.protein, 0);
  const avgProtein = loggedDaysCount > 0 ? totalProtein / loggedDaysCount : 0;
  const totalCarbs = dailyStats.reduce((s, d) => s + d.carbs, 0);
  const avgCarbs = loggedDaysCount > 0 ? totalCarbs / loggedDaysCount : 0;
  const totalFat = dailyStats.reduce((s, d) => s + d.fat, 0);
  const avgFat = loggedDaysCount > 0 ? totalFat / loggedDaysCount : 0;
  const totalFiber = dailyStats.reduce((s, d) => s + d.fiber, 0);
  const avgFiber = loggedDaysCount > 0 ? totalFiber / loggedDaysCount : 0;

  // Protein consistency
  let proteinMetCount = 0;
  dailyStats.forEach((d) => {
    if (d.protein >= proteinTarget) {
      proteinMetCount++;
    }
  });
  const proteinMissedCount = loggedDaysCount - proteinMetCount;

  // Activity stats
  const activityMap = new Map<string, ActivityLogEntry[]>();
  activityLog.forEach((act) => {
    const d = normalizeDateString(act.date);
    if (!activityMap.has(d)) {
      activityMap.set(d, []);
    }
    activityMap.get(d)!.push(act);
  });

  let totalActivityBurned = 0;
  let totalActivityMinutes = 0;
  let activityDaysCount = 0;
  targetDatesToAnalyze.forEach((d) => {
    const acts = activityMap.get(d) || [];
    if (acts.length > 0) {
      activityDaysCount++;
      acts.forEach((a) => {
        totalActivityBurned += Number(a.caloriesBurned) || 0;
        totalActivityMinutes += Number(a.durationMinutes) || 0;
      });
    }
  });

  // Weight analysis
  // Read the Progress sheet rows in actual chronological/row order. Never infer baseline or latest from the weight value.
  // Read ALL existing Progress entries; never ignore older rows.
  // Rules:
  // - First/oldest existing entry = permanent baseline.
  // - Last/newest existing entry = latest recorded weight.
  // - Entry immediately before latest = previous.
  // - Never ignore older Progress rows.
  // - For current sheet: Row 1 = 82 kg (original baseline), Row 2 = 81.5 kg (next entry), Row 3 = 82 kg (unwanted duplicate).
  // - Use complete history for all Body Progress calculations.
  const validWeights = getSortedProgressEntries(progressEntries || []);

  let weightStatus: 'NONE' | 'BASELINE_ONLY' | 'TREND_AVAILABLE' = 'NONE';
  let weightBaseline: { date: string; weightKg: number } | undefined;
  let weightPrevious: { date: string; weightKg: number } | undefined;
  let weightTrend:
    | {
        first: { date: string; weightKg: number };
        latest: { date: string; weightKg: number };
        previous: { date: string; weightKg: number };
        netChange: number;
        changeFromPrevious: number;
      }
    | undefined;

  if (validWeights.length === 1) {
    weightStatus = 'BASELINE_ONLY';
    weightBaseline = {
      date: validWeights[0].date,
      weightKg: validWeights[0].weightKg,
    };
  } else if (validWeights.length > 1) {
    weightStatus = 'TREND_AVAILABLE';
    const first = validWeights[0];
    const latest = validWeights[validWeights.length - 1];
    const previous = validWeights[validWeights.length - 2];
    weightBaseline = {
      date: first.date,
      weightKg: first.weightKg,
    };
    weightPrevious = {
      date: previous.date,
      weightKg: previous.weightKg,
    };
    weightTrend = {
      first: { date: first.date, weightKg: first.weightKg },
      latest: { date: latest.date, weightKg: latest.weightKg },
      previous: { date: previous.date, weightKg: previous.weightKg },
      netChange: Number((latest.weightKg - first.weightKg).toFixed(1)),
      changeFromPrevious: Number((latest.weightKg - previous.weightKg).toFixed(1)),
    };
  }

  // Helper formatting
  const formatKcal = (num: number): string => {
    if (Number.isInteger(num)) return num.toString();
    return Number(num.toFixed(1)).toString();
  };

  // --- Build Structured Markdown ---
  // REQUIREMENT 2: Clearly distinguish between Logged facts/calculated statistics and General recommendations
  // REQUIREMENT 3: Always state the number of days of available data when period is incomplete
  // REQUIREMENT 4: Report actual logged protein values and how many days met/missed
  // REQUIREMENT 5: Weight based only on actual entries. If 1 entry, state baseline established and more needed
  // REQUIREMENT 6: Recommendations general, labeled as non-medical tracking guidance
  // REQUIREMENT 7: Do not infer fat loss, muscle loss, or body composition changes from calorie intake alone

  let factsMarkdown = `### 📊 PART 1: LOGGED FACTS & CALCULATED STATISTICS\n\n`;

  // 1. Data Availability & Intake Summary
  factsMarkdown += `**Data Availability & Calorie Intake**:\n`;
  if (loggedDaysCount === 0) {
    factsMarkdown += `• No food log entries available for ${startDate} to ${endDate} (0 of ${windowDays} days logged).\n`;
  } else {
    const daysDesc = isPeriodIncomplete
      ? `based on ${loggedDaysCount} logged days (${loggedDaysCount} of ${windowDays} days logged; incomplete period, does not represent a full 7-day average)`
      : `based on ${loggedDaysCount} logged days (full ${windowDays}-day week)`;

    factsMarkdown += `• **Daily Calorie Target**: ${formatKcal(calorieTarget)} kcal/day\n`;
    factsMarkdown += `• **Average calorie intake ${periodLabel}**: ${formatKcal(
      avgCalories
    )} kcal/day, ${daysDesc}.\n`;

    const calDiff = avgCalories - calorieTarget;
    if (calDiff >= 0) {
      factsMarkdown += `• **Average variance vs target**: +${formatKcal(calDiff)} kcal/day over daily intake target.\n`;
    } else {
      factsMarkdown += `• **Average variance vs target**: ${formatKcal(
        Math.abs(calDiff)
      )} kcal/day remaining vs daily intake target.\n`;
    }
  }

  // 2. Protein Consistency
  factsMarkdown += `\n**Protein Consistency**:\n`;
  if (loggedDaysCount === 0) {
    factsMarkdown += `• Protein target: ${proteinTarget} g/day. No logged food entries available to evaluate protein consistency.\n`;
  } else {
    // Example format:
    // “Protein target: 131.2 g/day. You reached 113.8 g on Sept 9 and 72 g on Sept 10. 0 of 2 logged days reached the target.”
    const dailyProteinDescriptions = dailyStats.map(
      (d) => `${formatKcal(d.protein)} g on ${formatShortDate(d.date)}`
    );

    let proteinListSentence = '';
    if (dailyProteinDescriptions.length === 1) {
      proteinListSentence = `You reached ${dailyProteinDescriptions[0]}.`;
    } else if (dailyProteinDescriptions.length === 2) {
      proteinListSentence = `You reached ${dailyProteinDescriptions[0]} and ${dailyProteinDescriptions[1]}.`;
    } else {
      const allExceptLast = dailyProteinDescriptions.slice(0, -1).join(', ');
      const last = dailyProteinDescriptions[dailyProteinDescriptions.length - 1];
      proteinListSentence = `You reached ${allExceptLast}, and ${last}.`;
    }

    factsMarkdown += `• **Protein target**: ${proteinTarget} g/day. ${proteinListSentence} **${proteinMetCount} of ${loggedDaysCount} logged days reached the target**`;
    if (proteinMissedCount > 0) {
      factsMarkdown += ` (${proteinMissedCount} missed the target).`;
    } else {
      factsMarkdown += ` (100% adherence on logged days).`;
    }
    factsMarkdown += `\n• **Average protein intake**: ${avgProtein.toFixed(1)} g/day (Target: ${proteinTarget} g/day).\n`;
  }

  // 3. Macronutrient & Fiber Averages
  if (loggedDaysCount > 0) {
    factsMarkdown += `\n**Average Macronutrients & Fiber (Across ${loggedDaysCount} logged days)**:\n`;
    factsMarkdown += `• **Carbohydrates**: ${avgCarbs.toFixed(1)} g/day (Target: ${carbTarget} g/day)\n`;
    factsMarkdown += `• **Fat**: ${avgFat.toFixed(1)} g/day (Target: ${fatTarget} g/day)\n`;
    factsMarkdown += `• **Fiber**: ${avgFiber.toFixed(1)} g/day\n`;
  }

  // 4. Physical Activity Consistency
  factsMarkdown += `\n**Physical Activity (Logged Facts)**:\n`;
  if (activityDaysCount === 0) {
    factsMarkdown += `• No physical activities logged for the analyzed period.\n`;
  } else {
    factsMarkdown += `• **Active Days**: ${activityDaysCount} of ${loggedDaysCount} logged days had recorded physical activity.\n`;
    factsMarkdown += `• **Total Activity Duration**: ${totalActivityMinutes} minutes\n`;
    factsMarkdown += `• **Total Calories Burned**: ${Math.round(totalActivityBurned)} kcal\n`;
  }

  // 5. Weight Logged Facts (Requirement 5: Separate Profile Weight from Progress Entries)
  const profileWeightKg = profile?.weightKg ?? 82;
  factsMarkdown += `\n**Weight Progress & Trend (Actual Recorded Entries)**:\n`;
  factsMarkdown += `• **Current Profile Weight**: ${profileWeightKg} kg (from Profile sheet)\n`;
  factsMarkdown += `• **Total Weight Entries Recorded**: ${validWeights.length}\n`;

  if (weightStatus === 'NONE') {
    factsMarkdown += `• **Latest Recorded Weight**: No recorded weight entries\n`;
    factsMarkdown += `• **Baseline Weight**: Not established\n`;
    factsMarkdown += `• **Weight Change Since Baseline**: Cannot be calculated\n`;
    factsMarkdown += `• **Trend Analysis**: Not enough recorded weight data\n`;
  } else if (weightStatus === 'BASELINE_ONLY' && weightBaseline) {
    factsMarkdown += `• **Latest Recorded Weight**: ${weightBaseline.weightKg.toFixed(
      1
    )} kg on ${formatShortDate(weightBaseline.date)}\n`;
    factsMarkdown += `• **Baseline Weight**: ${weightBaseline.weightKg.toFixed(1)} kg (established on ${formatShortDate(
      weightBaseline.date
    )})\n`;
    factsMarkdown += `• **Weight Change Since Baseline**: 0.0 kg (baseline established; more entries needed to calculate a trend)\n`;
    factsMarkdown += `• **Trend Analysis**: Baseline established. More entries are needed to calculate a trend.\n`;
  } else if (weightStatus === 'TREND_AVAILABLE' && weightTrend) {
    const sign = weightTrend.netChange > 0 ? '+' : '';
    const signPrev = weightTrend.changeFromPrevious > 0 ? '+' : '';
    factsMarkdown += `• **Baseline Weight**: ${weightTrend.first.weightKg.toFixed(1)} kg (permanent baseline, established on ${formatShortDate(
      weightTrend.first.date
    )})\n`;
    factsMarkdown += `• **Latest Recorded Weight**: ${weightTrend.latest.weightKg.toFixed(1)} kg on ${formatShortDate(
      weightTrend.latest.date
    )}\n`;
    factsMarkdown += `• **Previous Recorded Weight**: ${weightTrend.previous.weightKg.toFixed(1)} kg on ${formatShortDate(
      weightTrend.previous.date
    )}\n`;
    factsMarkdown += `• **Change Since Previous Entry**: ${signPrev}${weightTrend.changeFromPrevious.toFixed(1)} kg\n`;
    factsMarkdown += `• **Weight Change Since Baseline**: ${sign}${weightTrend.netChange.toFixed(1)} kg (compared to baseline ${weightTrend.first.weightKg.toFixed(1)} kg)\n`;
    factsMarkdown += `• **Trend Analysis**: ${sign}${weightTrend.netChange.toFixed(1)} kg over ${
      validWeights.length
    } recorded entries (${formatShortDate(weightTrend.first.date)} to ${formatShortDate(weightTrend.latest.date)}).\n`;
  }

  // --- PART 2: GENERAL RECOMMENDATIONS ---
  // Requirement 2: Clearly distinguish
  // Requirement 6: Keep recommendations general, labeled as tracking/nutrition guidance, no medical claims
  // Requirement 7: Do not infer fat loss, muscle loss, or body-composition changes from calorie intake alone
  let guidanceMarkdown = `\n---\n\n### 💡 PART 2: GENERAL TRACKING & NUTRITION GUIDANCE\n`;
  guidanceMarkdown += `*(General tracking and nutrition guidance for personal reference only. Not medical advice. No body-composition changes, fat loss, or muscle changes are inferred from calorie numbers alone.)*\n\n`;

  const guidancePoints: string[] = [];

  // Data completeness tip
  if (isPeriodIncomplete) {
    guidancePoints.push(
      `• **Tracking Continuity**: With ${loggedDaysCount} of ${windowDays} days logged, your current metrics reflect only logged days. Aim to log meals consistently across all 7 days to establish a complete weekly picture of your nutrition habits.`
    );
  } else {
    guidancePoints.push(
      `• **Consistent Logging**: Excellent job recording all ${windowDays} days this week! Full weekly logging provides reliable data to evaluate your routine.`
    );
  }

  // Protein consistency tip
  if (proteinMissedCount > 0) {
    guidancePoints.push(
      `• **Protein Distribution**: To reach your ${proteinTarget} g/day protein target more consistently, consider including a dedicated protein source (e.g. eggs, chicken breast, paneer, Greek yogurt, lentils, or tofu) in every major meal rather than relying on one heavy meal.`
    );
  } else if (loggedDaysCount > 0) {
    guidancePoints.push(
      `• **Protein Consistency**: Great adherence on logged days meeting your ${proteinTarget} g/day target. Continuing this regular distribution supports your active daily routine.`
    );
  }

  // Weight tracking tip (strictly no fat/muscle loss inference from calories alone)
  if (weightStatus === 'BASELINE_ONLY') {
    guidancePoints.push(
      `• **Weight Trend Tracking**: A single baseline weight entry does not indicate body-composition changes or a trend. For reliable trend evaluation, consider weighing yourself 1–2 times per week under consistent conditions (such as morning, after waking and before breakfast).`
    );
  } else if (weightStatus === 'TREND_AVAILABLE') {
    guidancePoints.push(
      `• **Weight Trend Evaluation**: Weight naturally fluctuates day-to-day due to hydration, glycogen, and sodium. Focus on the multi-week trajectory across consistent morning check-ins rather than single-day fluctuations.`
    );
  } else {
    guidancePoints.push(
      `• **Establishing a Baseline**: Logging a regular weight check-in will give you an objective baseline to compare over coming weeks.`
    );
  }

  // Fiber & Hydration general guidance
  guidancePoints.push(
    `• **Fiber & Balanced Fuel**: Aim to balance meals with vegetables, whole grains, or fruits to maintain steady energy throughout the day.`
  );

  guidanceMarkdown += guidancePoints.join('\n\n');

  const fullMarkdown = `${factsMarkdown}\n${guidanceMarkdown}`;

  return {
    periodDays: windowDays,
    loggedDaysCount,
    isPeriodIncomplete,
    startDate,
    endDate,
    avgCalories,
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    proteinMetCount,
    proteinMissedCount,
    dailyStats,
    activityDaysCount,
    totalActivityBurned,
    totalActivityMinutes,
    currentProfileWeight: profileWeightKg,
    avgProtein,
    weightEntriesCount: validWeights.length,
    weightStatus,
    weightBaseline,
    weightPrevious,
    weightTrend,
    markdown: fullMarkdown,
  };
}

/**
 * Dedicated Progress & Weight-Tracking Status report.
 * Strictly distinguishes:
 * 1. Current Profile Weight (Profile sheet) vs actual recorded weight entries (Progress sheet)
 * 2. Logged Facts vs Calculated Observations vs General Guidance
 * 3. Exact 0-entry reporting:
 *    - Total Weight Entries Recorded = 0
 *    - Latest Recorded Weight = No recorded weight entries
 *    - Baseline Weight = Not established
 *    - Weight Change Since Baseline = Cannot be calculated
 *    - Trend Analysis = Not enough recorded weight data
 */
export function generateProgressAndWeightStatus(params: {
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  progressEntries: ProgressEntry[];
  profile?: ProfileData | null;
  referenceDate?: string;
  windowDays?: number;
}): {
  markdown: string;
  result: ProgressAnalysisResult;
} {
  const result = generateProgressAnalysis(params);
  const { profile } = params;
  const currentProfileWeight = profile?.weightKg ?? 82;

  const validWeights = (params.progressEntries || [])
    .filter((p) => p && typeof p.weightKg === 'number' && p.weightKg > 20 && p.weightKg < 300)
    .sort((a, b) => a.date.localeCompare(b.date));

  let latestRecordedWeightText = 'No recorded weight entries';
  let previousRecordedWeightText = 'None recorded';
  let baselineWeightText = 'Not established';
  let weightChangeText = 'Cannot be calculated';
  let previousChangeText = 'None';
  let trendAnalysisText = 'Not enough recorded weight data';

  if (validWeights.length === 1) {
    const entry = validWeights[0];
    latestRecordedWeightText = `${entry.weightKg.toFixed(1)} kg on ${formatShortDate(entry.date)}`;
    previousRecordedWeightText = `None recorded prior to baseline`;
    baselineWeightText = `${entry.weightKg.toFixed(1)} kg (established on ${formatShortDate(entry.date)})`;
    weightChangeText = `0.0 kg (baseline established; more entries needed to calculate a trend)`;
    previousChangeText = `N/A`;
    trendAnalysisText = `Baseline established. More recorded entries are needed to calculate a trend.`;
  } else if (validWeights.length >= 2) {
    // First/oldest Progress entry = permanent baseline.
    // Last/newest Progress entry = latest recorded weight.
    // Previous = entry immediately before latest.
    const first = validWeights[0];
    const latest = validWeights[validWeights.length - 1];
    const previous = validWeights[validWeights.length - 2];
    const netChange = Number((latest.weightKg - first.weightKg).toFixed(1));
    const sign = netChange > 0 ? '+' : '';
    const diffFromPrev = Number((latest.weightKg - previous.weightKg).toFixed(1));
    const signPrev = diffFromPrev > 0 ? '+' : '';

    latestRecordedWeightText = `${latest.weightKg.toFixed(1)} kg on ${formatShortDate(latest.date)}`;
    previousRecordedWeightText = `${previous.weightKg.toFixed(1)} kg on ${formatShortDate(previous.date)}`;
    baselineWeightText = `${first.weightKg.toFixed(1)} kg (established on ${formatShortDate(first.date)})`;
    weightChangeText = `${sign}${netChange.toFixed(1)} kg (compared to baseline ${first.weightKg.toFixed(1)} kg)`;
    previousChangeText = `${signPrev}${diffFromPrev.toFixed(1)} kg`;
    trendAnalysisText = `${sign}${netChange.toFixed(1)} kg across ${validWeights.length} recorded entries (${formatShortDate(
      first.date
    )} to ${formatShortDate(latest.date)})`;
  }

  let markdown = `### 📊 PROGRESS & WEIGHT-TRACKING STATUS\n\n`;

  // LOGGED FACTS
  markdown += `#### 📋 LOGGED FACTS\n`;
  markdown += `• **Current Profile Weight**: ${currentProfileWeight} kg (from Profile sheet)\n`;
  markdown += `• **Total Weight Entries Recorded**: ${validWeights.length}\n`;
  markdown += `• **Baseline Weight**: ${baselineWeightText}\n`;
  markdown += `• **Latest Recorded Weight**: ${latestRecordedWeightText}\n`;
  if (validWeights.length >= 2) {
    markdown += `• **Previous Recorded Weight**: ${previousRecordedWeightText}\n`;
  }
  markdown += `• **Food Logged Days**: ${result.loggedDaysCount} of ${result.periodDays} days in analyzed window (${result.startDate} to ${result.endDate})\n`;
  markdown += `• **Physical Activity Days**: ${result.activityDaysCount} active days recorded (${result.totalActivityMinutes} min total, ~${Math.round(
    result.totalActivityBurned
  )} kcal burned)\n\n`;

  // CALCULATED OBSERVATIONS
  markdown += `#### 📈 CALCULATED OBSERVATIONS\n`;
  if (validWeights.length >= 2) {
    markdown += `• **Change Since Previous Entry**: ${previousChangeText}\n`;
  }
  markdown += `• **Weight Change Since Baseline**: ${weightChangeText}\n`;
  markdown += `• **Trend Analysis**: ${trendAnalysisText}\n`;

  if (result.loggedDaysCount > 0) {
    const avgCal = result.avgCalories;
    const target = result.calorieTarget;
    const diff = avgCal - target;
    const diffStr =
      diff >= 0
        ? `+${diff.toFixed(1)} kcal/day over target`
        : `${Math.abs(diff).toFixed(1)} kcal/day remaining vs target`;
    markdown += `• **Average Daily Calorie Intake**: ${avgCal.toFixed(1)} kcal/day (Target: ${target} kcal/day; ${diffStr}; based on ${
      result.loggedDaysCount
    } logged days${result.isPeriodIncomplete ? ', incomplete period' : ''})\n`;
    markdown += `• **Protein Target Consistency**: ${result.proteinMetCount} of ${result.loggedDaysCount} logged days reached target of ${
      result.proteinTarget
    } g/day (Average: ${result.avgProtein?.toFixed(1) || '0'} g/day)\n\n`;
  } else {
    markdown += `• **Nutrition Metrics**: No food entries logged in analyzed window to calculate averages.\n\n`;
  }

  // GENERAL GUIDANCE
  markdown += `#### 💡 GENERAL TRACKING GUIDANCE\n`;
  markdown += `*(Non-medical personal tracking reference only. No body-composition changes or fat/muscle loss are inferred from calorie numbers alone.)*\n`;
  if (validWeights.length === 0) {
    markdown += `• **Establishing a Baseline**: The Profile sheet contains your current profile weight (${currentProfileWeight} kg), but no recorded weight entries exist in your Progress sheet yet. When you explicitly record a weight (e.g. *"My weight today is 81.5 kg"* or via the **Log Weight** button), it will establish your baseline weight.\n`;
    markdown += `• **Subsequent Weigh-ins**: Later recorded weights will then be compared against that established baseline to evaluate progress over time.\n`;
  } else if (validWeights.length === 1) {
    markdown += `• **Baseline Established**: Your baseline is established at ${validWeights[0].weightKg.toFixed(
      1
    )} kg. Weighing in 1–2 times per week under consistent conditions (such as morning, fasted) will build enough data points to observe a trend.\n`;
  } else {
    markdown += `• **Trend Evaluation**: Focus on multi-week trajectories across consistent morning weigh-ins rather than day-to-day water or glycogen fluctuations.\n`;
  }

  return { markdown, result };
}
