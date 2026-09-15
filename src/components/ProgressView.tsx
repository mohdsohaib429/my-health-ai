import React, { useState } from 'react';
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Calendar,
  PlusCircle,
  Check,
  Info,
  Activity,
  Flame,
  Sparkles,
} from 'lucide-react';
import { ProgressEntry, FoodLogEntry, ActivityLogEntry, ProfileData } from '../types';
import { generateProgressAnalysis, formatShortDate } from '../services/progressAnalysis';
import { getSortedProgressEntries } from '../services/googleSheetsService';

interface ProgressViewProps {
  progressEntries: ProgressEntry[];
  baselineWeight: number;
  onLogWeight: (weight: number, notes?: string) => void;
  foodLog?: FoodLogEntry[];
  activityLog?: ActivityLogEntry[];
  profile?: ProfileData | null;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  progressEntries,
  baselineWeight,
  onLogWeight,
  foodLog = [],
  activityLog = [],
  profile,
}) => {
  const [newWeight, setNewWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Read ALL existing Progress entries; never ignore older rows.
  // Rules:
  // - First/oldest existing entry = permanent baseline.
  // - Last/newest existing entry = latest recorded weight.
  // - Entry immediately before latest = previous.
  // - Never ignore older Progress rows.
  // - For current sheet: Row 1 = 82 kg (original baseline), Row 2 = 81.5 kg (next entry), Row 3 = 82 kg (unwanted duplicate).
  // - Use complete history for all Body Progress calculations.
  const sortedEntries = getSortedProgressEntries(progressEntries || []);

  const profileWeight = profile?.weightKg ?? baselineWeight;
  const hasRecordedWeights = sortedEntries.length > 0;
  const baselineEntry = hasRecordedWeights ? sortedEntries[0] : null;
  const latestEntry = hasRecordedWeights ? sortedEntries[sortedEntries.length - 1] : null;
  const previousEntry = sortedEntries.length >= 2 ? sortedEntries[sortedEntries.length - 2] : null;

  const totalChange =
    baselineEntry && latestEntry && sortedEntries.length >= 2
      ? Number((latestEntry.weightKg - baselineEntry.weightKg).toFixed(1))
      : 0;

  const changeFromPrevious =
    previousEntry && latestEntry && sortedEntries.length >= 2
      ? Number((latestEntry.weightKg - previousEntry.weightKg).toFixed(1))
      : 0;

  // Generate Progress & Consistency Analysis
  const analysis = generateProgressAnalysis({
    foodLog,
    activityLog,
    progressEntries: sortedEntries,
    profile,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newWeight);
    if (!val || isNaN(val) || val <= 20 || val >= 300) return;

    onLogWeight(val, notes.trim() || undefined);
    setNewWeight('');
    setNotes('');
    setShowInput(false);
  };

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700">
            Body Progress
          </span>
          <h2 className="text-xl font-extrabold text-stone-900">Weight & Trend</h2>
        </div>
        <button
          onClick={() => setShowInput(!showInput)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>{showInput ? 'Cancel' : 'Log Weight'}</span>
        </button>
      </div>

      {/* Log weight form */}
      {showInput && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3"
        >
          <h3 className="text-xs font-bold text-stone-900">Record Today's Weight</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 81.5"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Morning, fasted..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            Save Weight Entry
          </button>
        </form>
      )}

      {/* Summary Cards: Baseline, Latest, Previous, Changes, and Profile Weight */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Baseline Weight */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-stone-500 block truncate">Baseline Weight</span>
          <div className="flex items-baseline gap-1 mt-1">
            {baselineEntry ? (
              <>
                <span className="text-lg sm:text-xl font-black text-stone-900">{baselineEntry.weightKg.toFixed(1)}</span>
                <span className="text-xs text-stone-500 font-medium">kg</span>
              </>
            ) : (
              <span className="text-xs font-semibold text-stone-400">Not set</span>
            )}
          </div>
          <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
            {baselineEntry ? `Est. on ${formatShortDate(baselineEntry.date)}` : 'First entry'}
          </span>
        </div>

        {/* Latest Recorded Weight */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-stone-500 block truncate">Latest Recorded</span>
          <div className="flex items-baseline gap-1 mt-1">
            {latestEntry ? (
              <>
                <span className="text-lg sm:text-xl font-black text-stone-900">{latestEntry.weightKg.toFixed(1)}</span>
                <span className="text-xs text-stone-500 font-medium">kg</span>
              </>
            ) : (
              <span className="text-xs font-semibold text-stone-400">No entries</span>
            )}
          </div>
          <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
            {latestEntry ? formatShortDate(latestEntry.date) : 'Total: 0'}
          </span>
        </div>

        {/* Previous Recorded Weight */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-stone-500 block truncate">Previous Weight</span>
          <div className="flex items-baseline gap-1 mt-1">
            {previousEntry ? (
              <>
                <span className="text-lg sm:text-xl font-black text-stone-900">{previousEntry.weightKg.toFixed(1)}</span>
                <span className="text-xs text-stone-500 font-medium">kg</span>
              </>
            ) : sortedEntries.length === 1 ? (
              <span className="text-xs font-semibold text-stone-500">None prior</span>
            ) : (
              <span className="text-xs font-semibold text-stone-400">None</span>
            )}
          </div>
          <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
            {previousEntry ? `Est. on ${formatShortDate(previousEntry.date)}` : 'Preceding check-in'}
          </span>
        </div>

        {/* Change vs Baseline */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-stone-500 block truncate">Change vs Baseline</span>
          <div className="flex items-baseline gap-1 mt-1">
            {sortedEntries.length === 0 ? (
              <span className="text-xs font-semibold text-stone-400">Cannot calculate</span>
            ) : sortedEntries.length === 1 ? (
              <span className="text-xs font-bold text-amber-700">0.0 kg (Baseline)</span>
            ) : (
              <>
                <span
                  className={`text-lg sm:text-xl font-black ${
                    totalChange <= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {totalChange > 0 ? `+${totalChange.toFixed(1)}` : totalChange.toFixed(1)}
                </span>
                <span className="text-xs text-stone-500 font-medium">kg</span>
              </>
            )}
          </div>
          <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
            {sortedEntries.length <= 1 ? 'Need more entries' : 'Latest minus baseline'}
          </span>
        </div>

        {/* Change vs Previous */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-stone-500 block truncate">Change vs Previous</span>
          <div className="flex items-baseline gap-1 mt-1">
            {sortedEntries.length < 2 ? (
              <span className="text-xs font-semibold text-stone-400">N/A</span>
            ) : (
              <>
                <span
                  className={`text-lg sm:text-xl font-black ${
                    changeFromPrevious <= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {changeFromPrevious > 0 ? `+${changeFromPrevious.toFixed(1)}` : changeFromPrevious.toFixed(1)}
                </span>
                <span className="text-xs text-stone-500 font-medium">kg</span>
              </>
            )}
          </div>
          <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
            {sortedEntries.length < 2 ? 'Single entry' : 'Latest minus previous'}
          </span>
        </div>

        {/* Current Profile Weight */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-stone-500 block truncate">Profile Weight</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-black text-stone-900">{profileWeight.toFixed(1)}</span>
            <span className="text-xs text-stone-500 font-medium">kg</span>
          </div>
          <span className="text-[9px] text-stone-400 block mt-0.5 truncate">Profile sheet (separate)</span>
        </div>
      </div>

      {/* Zero Entries Status Card (When no progress entries exist) */}
      {sortedEntries.length === 0 && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs text-stone-800 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-stone-900">
            <Info className="w-4 h-4 text-stone-500 shrink-0" />
            <span>Progress & Weight-Tracking Status</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-600 bg-white p-3 rounded-xl border border-stone-200/80 text-[11px]">
            <div>• <strong className="text-stone-800">Current Profile Weight:</strong> {profileWeight.toFixed(1)} kg <span className="text-stone-400">(from Profile sheet)</span></div>
            <div>• <strong className="text-stone-800">Total Weight Entries Recorded:</strong> 0</div>
            <div>• <strong className="text-stone-800">Latest Recorded Weight:</strong> No recorded weight entries</div>
            <div>• <strong className="text-stone-800">Baseline Weight:</strong> Not established</div>
            <div>• <strong className="text-stone-800">Weight Change Since Baseline:</strong> Cannot be calculated</div>
            <div>• <strong className="text-stone-800">Trend Analysis:</strong> Not enough recorded weight data</div>
          </div>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Your Profile sheet stores your profile weight ({profileWeight.toFixed(1)} kg), but no entries have been written to your Progress records yet. Logging your first weight entry will establish your baseline.
          </p>
        </div>
      )}

      {/* Baseline alert when entries exist */}
      {sortedEntries.length === 1 ? (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Baseline Weight Established:</span> A baseline of{' '}
            <strong>{sortedEntries[0].weightKg.toFixed(1)} kg</strong> was established on{' '}
            <strong>{formatShortDate(sortedEntries[0].date)}</strong>. (Current Profile Weight: <strong>{profileWeight.toFixed(1)} kg</strong>). More entries are needed to
            calculate a trend.
          </div>
        </div>
      ) : sortedEntries.length > 1 ? (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-800 flex items-start gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-stone-900">Baseline Preserved:</span> The first/oldest Progress entry is permanently preserved as your baseline at{' '}
            <strong>{baselineEntry?.weightKg.toFixed(1)} kg</strong> (established on {baselineEntry ? formatShortDate(baselineEntry.date) : ''}). Latest recorded weight is <strong>{latestEntry?.weightKg.toFixed(1)} kg</strong> ({latestEntry ? formatShortDate(latestEntry.date) : ''}), with previous check-in at <strong>{previousEntry?.weightKg.toFixed(1)} kg</strong> (Change: <strong>{changeFromPrevious > 0 ? `+${changeFromPrevious.toFixed(1)}` : `${changeFromPrevious.toFixed(1)}`} kg</strong> vs previous, <strong>{totalChange > 0 ? `+${totalChange.toFixed(1)}` : `${totalChange.toFixed(1)}`} kg</strong> vs baseline). Total entries: <strong>{sortedEntries.length}</strong>.
          </div>
        </div>
      ) : null}

      {/* Progress & Consistency Analysis Section (Requirements 1-7) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Progress & Consistency Analysis
              </h3>
              <p className="text-[11px] text-stone-500">
                7-day review • Logged facts & calculated statistics vs general guidance
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
            {analysis.loggedDaysCount} of {analysis.periodDays} days logged
          </span>
        </div>

        {/* PART 1: LOGGED FACTS & CALCULATED STATISTICS (Requirement 2) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Part 1: Logged Facts & Calculated Statistics
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Calorie Intake Fact */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-stone-500 block">
                Calorie Intake (This Week)
              </span>
              <div className="text-sm font-bold text-stone-900">
                {analysis.loggedDaysCount > 0
                  ? `Average: ${analysis.avgCalories.toFixed(1)} kcal/day`
                  : 'No food entries logged'}
              </div>
              <p className="text-[11px] text-stone-600 leading-snug">
                {analysis.loggedDaysCount > 0 ? (
                  <>
                    Based on <strong>{analysis.loggedDaysCount} logged days</strong>.
                    {analysis.isPeriodIncomplete && (
                      <span className="text-amber-700 block mt-0.5 font-medium">
                        (Incomplete period; does not represent a full 7-day average)
                      </span>
                    )}
                  </>
                ) : (
                  'Start logging meals to calculate weekly averages.'
                )}
              </p>
              <div className="text-[10px] text-stone-500 pt-1">
                Target: {analysis.calorieTarget} kcal/day
              </div>
            </div>

            {/* Protein Consistency Fact (Requirement 4) */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-stone-500 block">
                Protein Consistency
              </span>
              <div className="text-sm font-bold text-stone-900">
                Target: {analysis.proteinTarget} g/day
              </div>
              <div className="text-[11px] text-stone-700 leading-snug">
                {analysis.dailyStats.length > 0 ? (
                  <>
                    <span>
                      {analysis.dailyStats.map((d, i) => (
                        <span key={d.date}>
                          {i > 0 && i === analysis.dailyStats.length - 1 ? ' and ' : i > 0 ? ', ' : ''}
                          <strong>{d.protein.toFixed(1)} g</strong> on {formatShortDate(d.date)}
                        </span>
                      ))}
                      .{' '}
                    </span>
                    <span className="font-bold text-stone-900 block mt-1">
                      {analysis.proteinMetCount} of {analysis.loggedDaysCount} logged days reached the target.
                    </span>
                  </>
                ) : (
                  <span className="text-stone-500">No protein data logged in this period.</span>
                )}
              </div>
            </div>
          </div>

          {/* Physical Activity & Weight facts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-stone-500 block">
                Physical Activity (Logged)
              </span>
              <div className="text-stone-900 font-semibold">
                {analysis.activityDaysCount} active days • {analysis.totalActivityMinutes} min total
              </div>
              <div className="text-[11px] text-stone-500">
                Total calories burned: ~{Math.round(analysis.totalActivityBurned)} kcal
              </div>
            </div>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-stone-500 block">
                Weight Tracking (Recorded Facts)
              </span>
              <div className="text-stone-900 font-semibold">
                {analysis.weightStatus === 'NONE' && '0 entries recorded'}
                {analysis.weightStatus === 'BASELINE_ONLY' &&
                  `Baseline: ${analysis.weightBaseline?.weightKg.toFixed(1)} kg`}
                {analysis.weightStatus === 'TREND_AVAILABLE' &&
                  `Latest: ${analysis.weightTrend?.latest.weightKg.toFixed(1)} kg (${analysis.weightTrend?.netChange && analysis.weightTrend.netChange > 0 ? '+' : ''}${
                    analysis.weightTrend?.netChange
                  } kg vs baseline)`}
              </div>
              <div className="text-[11px] text-stone-500">
                Current Profile Weight: {analysis.currentProfileWeight} kg (from Profile sheet)
              </div>
              <div className="text-[10px] text-stone-400">
                {analysis.weightStatus === 'BASELINE_ONLY' &&
                  'Baseline established. More entries needed to calculate a trend.'}
                {analysis.weightStatus === 'TREND_AVAILABLE' &&
                  `Calculated over ${analysis.weightEntriesCount} actual recorded entries.`}
                {analysis.weightStatus === 'NONE' && 'Baseline Weight: Not established'}
              </div>
            </div>
          </div>
        </div>

        {/* PART 2: GENERAL RECOMMENDATIONS (Requirements 2, 6, 7) */}
        <div className="border-t border-stone-100 pt-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Part 2: General Tracking & Nutrition Guidance
            </span>
          </div>
          <p className="text-[10px] text-stone-500 italic">
            *(General tracking and nutrition guidance for personal reference only. Not medical advice. No
            body-composition changes, fat loss, or muscle changes are inferred from calorie numbers
            alone).*
          </p>

          <div className="space-y-1.5 text-xs text-stone-700 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
            {analysis.isPeriodIncomplete && (
              <div className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">•</span>
                <span>
                  <strong>Tracking Continuity:</strong> You have logged {analysis.loggedDaysCount} of{' '}
                  {analysis.periodDays} days. Logging every day builds a more complete picture of your
                  daily dietary habits.
                </span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="text-emerald-700 font-bold">•</span>
              <span>
                <strong>Protein Distribution:</strong> Aim to include a dedicated protein source with
                each meal (such as eggs, chicken breast, paneer, lentils, Greek yogurt, or tofu) to help
                reach your daily {analysis.proteinTarget} g target consistently.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-700 font-bold">•</span>
              <span>
                <strong>Weight Check-in Guidance:</strong> Weigh yourself 1–2 times per week under
                consistent conditions (e.g., morning after waking and before eating) to build enough
                data points for trend evaluation.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Weight Trend List (In actual chronological/row order from oldest/baseline to newest/latest) */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Recorded Weight Entries</h3>
            <p className="text-[11px] text-stone-400">
              Chronological order (Row 1 = permanent baseline, subsequent rows = check-ins)
            </p>
          </div>
          <span className="text-xs text-stone-400">
            {sortedEntries.length} {sortedEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {sortedEntries.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {sortedEntries.map((entry, idx) => {
              const isBaselineItem = idx === 0;
              const isLatestItem = idx === sortedEntries.length - 1 && sortedEntries.length > 1;
              const prevItem = idx > 0 ? sortedEntries[idx - 1] : null;

              const diffFromBaseline = baselineEntry
                ? Number((entry.weightKg - baselineEntry.weightKg).toFixed(1))
                : 0;

              const diffFromPrev = prevItem
                ? Number((entry.weightKg - prevItem.weightKg).toFixed(1))
                : 0;

              return (
                <div
                  key={idx}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      {entry.sheetRowNumber !== undefined ? entry.sheetRowNumber : idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-sm">
                          {entry.weightKg.toFixed(1)} kg
                        </span>
                        {isBaselineItem ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded">
                            Permanent Baseline Established
                          </span>
                        ) : isLatestItem ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                            Latest Recorded Weight
                          </span>
                        ) : (
                          <span className="text-[10px] bg-stone-100 text-stone-600 font-medium px-1.5 py-0.5 rounded">
                            Progress Weight Entry
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 block mt-0.5">
                        {entry.date} {entry.notes ? `• ${entry.notes}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold text-stone-600 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                      {isBaselineItem
                        ? 'Baseline (Row 1)'
                        : `${diffFromBaseline > 0 ? `+${diffFromBaseline.toFixed(1)}` : `${diffFromBaseline.toFixed(1)}`} kg vs baseline`}
                    </span>
                    {prevItem && (
                      <span className="text-[9px] text-stone-400">
                        {diffFromPrev > 0 ? `+${diffFromPrev.toFixed(1)}` : `${diffFromPrev.toFixed(1)}`} kg vs previous ({prevItem.weightKg.toFixed(1)} kg)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-stone-500 space-y-1">
            <p className="font-semibold text-stone-700">No weight entries recorded yet.</p>
            <p className="text-[11px] text-stone-400">
              Your profile weight is {profileWeight.toFixed(1)} kg. Click <strong>Log Weight</strong> above or type "My weight today is {profileWeight.toFixed(1)} kg" to establish your baseline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

