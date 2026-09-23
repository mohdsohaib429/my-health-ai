import React, { useState, useMemo } from 'react';
import { Utensils, Dumbbell, Calendar, Search, CheckCircle2 } from 'lucide-react';
import { FoodLogEntry, ActivityLogEntry, DailySummaryEntry } from '../types';

interface HistoryViewProps {
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  dailySummaries: DailySummaryEntry[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  foodLog,
  activityLog,
  dailySummaries,
}) => {
  const [subTab, setSubTab] = useState<'food' | 'activity' | 'summary'>('food');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMeal, setFilterMeal] = useState<string>('all');

  // Helper to format friendly date headers
  const formatHeaderDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return dateStr;
  };

  // Grouped & Sorted Food Log (Newest dates on top)
  const groupedFoodLog = useMemo(() => {
    const filtered = foodLog.filter((item) => {
      const matchesSearch =
        item.food.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.date.includes(searchQuery);
      const matchesMeal = filterMeal === 'all' || item.meal === filterMeal;
      return matchesSearch && matchesMeal;
    });

    const groups: { [date: string]: FoodLogEntry[] } = {};
    for (const item of filtered) {
      const d = item.date || 'Unknown Date';
      if (!groups[d]) groups[d] = [];
      groups[d].push(item);
    }

    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((date) => {
      const entries = groups[date].slice().reverse(); // Newest logged item in that day first
      const totalCals = entries.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
      const totalProtein = entries.reduce((sum, i) => sum + (Number(i.protein) || 0), 0);

      return {
        date,
        entries,
        totalCals: Math.round(totalCals),
        totalProtein: totalProtein.toFixed(1),
      };
    });
  }, [foodLog, searchQuery, filterMeal]);

  // Filter & Sort Activity Log (Newest dates on top)
  const filteredActivityLog = useMemo(() => {
    return activityLog
      .filter((item) => {
        return (
          item.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.date.includes(searchQuery)
        );
      })
      .slice()
      .reverse();
  }, [activityLog, searchQuery]);

  // Filter & Sort Daily Summaries (Newest dates on top)
  const filteredSummaries = useMemo(() => {
    return dailySummaries
      .filter((item) => item.date.includes(searchQuery))
      .slice()
      .reverse();
  }, [dailySummaries, searchQuery]);

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
            Records
          </span>
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">Logs & Summaries</h2>
        </div>
      </div>

      {/* Sub-tab pills */}
      <div className="flex bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl">
        <button
          onClick={() => setSubTab('food')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'food'
              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Food Log ({foodLog.length})</span>
        </button>
        <button
          onClick={() => setSubTab('activity')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'activity'
              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5" />
          <span>Activity ({activityLog.length})</span>
        </button>
        <button
          onClick={() => setSubTab('summary')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'summary'
              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily Summary</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700/80 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
          <Search className="w-4 h-4 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            placeholder={
              subTab === 'food'
                ? 'Search foods or dates...'
                : subTab === 'activity'
                ? 'Search activities or dates...'
                : 'Filter by date YYYY-MM-DD...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none"
          />
        </div>

        {subTab === 'food' && (
          <select
            value={filterMeal}
            onChange={(e) => setFilterMeal(e.target.value)}
            className="bg-white dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700/80 rounded-xl px-2.5 py-2 text-xs text-stone-700 dark:text-stone-200 focus:outline-none"
          >
            <option value="all">All Meals</option>
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
            <option value="Snack">Snack</option>
          </select>
        )}
      </div>

      {/* FOOD LOG TAB (Grouped Date-Wise, Newest First) */}
      {subTab === 'food' && (
        <div className="space-y-4">
          {groupedFoodLog.length > 0 ? (
            groupedFoodLog.map((group) => (
              <div key={group.date} className="space-y-2">
                {/* Date Classification Header */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {formatHeaderDate(group.date)}
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">
                      ({group.date})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {group.totalCals} kcal • {group.totalProtein}g P
                  </span>
                </div>

                {/* Items for this date */}
                <div className="space-y-2">
                  {group.entries.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-white dark:bg-[#1A221E] p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                            {item.food}
                          </span>
                          <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                            {item.meal}
                          </span>
                          {item.sourceLabel === 'Food Database value: estimated' ? (
                            <span className="text-[9px] bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              DB (estimated)
                            </span>
                          ) : item.sourceType === 'FROM_DATABASE' || (!item.isEstimate && item.sourceType !== 'NEW_ESTIMATE') ? (
                            <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              From DB
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded">
                              Newly estimated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 flex flex-wrap gap-x-2">
                          <span>
                            {item.quantity} {item.unit}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            P: {item.protein.toFixed(1)}g
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            C: {item.carbs.toFixed(1)}g
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            F: {item.fat.toFixed(1)}g
                          </span>
                          {item.fiber > 0 && <span>Fib: {item.fiber.toFixed(1)}g</span>}
                        </div>
                      </div>
                      <div className="text-right pl-3 flex-shrink-0">
                        <span className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
                          {Math.round(item.calories)}
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block">kcal</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white dark:bg-[#1A221E] rounded-xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
              No food logs found matching your criteria.
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY LOG TAB */}
      {subTab === 'activity' && (
        <div className="space-y-2">
          {filteredActivityLog.length > 0 ? (
            filteredActivityLog.map((act, idx) => (
              <div
                key={act.id || idx}
                className="bg-white dark:bg-[#1A221E] p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    {act.activity}
                  </span>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Duration: {act.durationMinutes} minutes
                  </div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">
                    {act.date} {act.notes ? `• ${act.notes}` : ''}
                  </span>
                </div>
                <div className="text-right pl-3 flex-shrink-0">
                  <span className="text-sm font-extrabold text-orange-600">
                    {act.caloriesBurned ? Math.round(act.caloriesBurned) : '--'}
                  </span>
                  <span className="text-[10px] text-stone-400 block">kcal burned</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white dark:bg-[#1A221E] rounded-xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
              No activity logs found.
            </div>
          )}
        </div>
      )}

      {/* DAILY SUMMARY TAB */}
      {subTab === 'summary' && (
        <div className="space-y-2">
          {filteredSummaries.length > 0 ? (
            filteredSummaries.map((summary, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#1A221E] p-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                  <span className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                    {summary.date}
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-stone-900 dark:text-stone-100">
                      {Math.round(summary.totalCalories)} / {Math.round(summary.calorieTarget)} kcal
                    </span>
                    <span
                      className={`text-[10px] font-semibold block ${
                        summary.difference <= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {summary.difference <= 0
                        ? `${Math.abs(Math.round(summary.difference))} kcal remaining vs target`
                        : `${Math.round(summary.difference)} kcal over target`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Protein</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {summary.totalProtein.toFixed(0)}g
                    </span>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Carbs</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {summary.totalCarbs.toFixed(0)}g
                    </span>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Fat</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {summary.totalFat.toFixed(0)}g
                    </span>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Activity</span>
                    <span className="font-bold text-orange-600">
                      {Math.round(summary.activityBurned)} kcal
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white dark:bg-[#1A221E] rounded-xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
              No daily summaries logged yet. Summaries update automatically as you log meals!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
