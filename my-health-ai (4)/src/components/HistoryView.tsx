import React, { useState } from 'react';
import { Utensils, Dumbbell, Calendar, Search, Filter, CheckCircle2 } from 'lucide-react';
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

  // Filter food log
  const filteredFoodLog = foodLog.filter((item) => {
    const matchesSearch =
      item.food.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.date.includes(searchQuery);
    const matchesMeal = filterMeal === 'all' || item.meal === filterMeal;
    return matchesSearch && matchesMeal;
  });

  // Filter activity log
  const filteredActivityLog = activityLog.filter((item) => {
    return (
      item.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.date.includes(searchQuery)
    );
  });

  // Filter daily summaries
  const filteredSummaries = dailySummaries.filter((item) => {
    return item.date.includes(searchQuery);
  });

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700">
            Records
          </span>
          <h2 className="text-xl font-extrabold text-stone-900">Logs & Summaries</h2>
        </div>
      </div>

      {/* Sub-tab pills */}
      <div className="flex bg-stone-100 p-1 rounded-xl">
        <button
          onClick={() => setSubTab('food')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'food'
              ? 'bg-white text-stone-900 shadow-2xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Food Log ({foodLog.length})</span>
        </button>
        <button
          onClick={() => setSubTab('activity')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'activity'
              ? 'bg-white text-stone-900 shadow-2xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5" />
          <span>Activity ({activityLog.length})</span>
        </button>
        <button
          onClick={() => setSubTab('summary')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'summary'
              ? 'bg-white text-stone-900 shadow-2xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily Summary</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
          <Search className="w-4 h-4 text-stone-400" />
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
            className="w-full bg-transparent text-stone-900 focus:outline-hidden"
          />
        </div>

        {subTab === 'food' && (
          <select
            value={filterMeal}
            onChange={(e) => setFilterMeal(e.target.value)}
            className="bg-white border border-stone-200 rounded-xl px-2.5 py-2 text-xs text-stone-700 focus:outline-hidden"
          >
            <option value="all">All Meals</option>
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
            <option value="Snack">Snack</option>
          </select>
        )}
      </div>

      {/* FOOD LOG TAB */}
      {subTab === 'food' && (
        <div className="space-y-2">
          {filteredFoodLog.length > 0 ? (
            filteredFoodLog.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">
                      {item.food}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                      {item.meal}
                    </span>
                    {item.sourceLabel === 'Food Database value: estimated' ? (
                      <span className="text-[9px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        DB (estimated)
                      </span>
                    ) : item.sourceType === 'FROM_DATABASE' || (!item.isEstimate && item.sourceType !== 'NEW_ESTIMATE') ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        From DB
                      </span>
                    ) : (
                      <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                        Newly estimated
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1 flex flex-wrap gap-x-2">
                    <span>
                      {item.quantity} {item.unit}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">
                      P: {item.protein.toFixed(1)}g
                    </span>
                    <span className="text-blue-700 font-medium">
                      C: {item.carbs.toFixed(1)}g
                    </span>
                    <span className="text-amber-700 font-medium">
                      F: {item.fat.toFixed(1)}g
                    </span>
                    {item.fiber > 0 && <span>Fib: {item.fiber.toFixed(1)}g</span>}
                  </div>
                  <span className="text-[10px] text-stone-600 mt-0.5 block">
                    {item.date}
                  </span>
                </div>
                <div className="text-right pl-3 flex-shrink-0">
                  <span className="text-sm font-extrabold text-stone-900">
                    {Math.round(item.calories)}
                  </span>
                  <span className="text-[10px] text-stone-600 block">kcal</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white rounded-xl border border-stone-200 text-xs text-stone-500">
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
                className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-stone-900 text-xs sm:text-sm">
                    {act.activity}
                  </span>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    Duration: {act.durationMinutes} minutes
                  </div>
                  <span className="text-[10px] text-stone-600 mt-0.5 block">
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
            <div className="text-center py-8 bg-white rounded-xl border border-stone-200 text-xs text-stone-500">
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
                className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="font-bold text-stone-900 text-xs sm:text-sm">
                    {summary.date}
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-stone-900">
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
                  <div className="bg-stone-50 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 block">Protein</span>
                    <span className="font-bold text-emerald-700">
                      {summary.totalProtein.toFixed(0)}g
                    </span>
                  </div>
                  <div className="bg-stone-50 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 block">Carbs</span>
                    <span className="font-bold text-blue-700">
                      {summary.totalCarbs.toFixed(0)}g
                    </span>
                  </div>
                  <div className="bg-stone-50 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 block">Fat</span>
                    <span className="font-bold text-amber-700">
                      {summary.totalFat.toFixed(0)}g
                    </span>
                  </div>
                  <div className="bg-stone-50 p-1.5 rounded-lg">
                    <span className="text-[10px] text-stone-500 block">Activity</span>
                    <span className="font-bold text-orange-600">
                      {Math.round(summary.activityBurned)} kcal
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white rounded-xl border border-stone-200 text-xs text-stone-500">
              No daily summaries logged yet. Summaries update automatically as you log meals!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
