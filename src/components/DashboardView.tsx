import React, { useState } from 'react';
import {
  Flame,
  Zap,
  Dumbbell,
  Sparkles,
  ChevronRight,
  PlusCircle,
  Clock,
  Utensils,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { ProfileData, FoodLogEntry, ActivityLogEntry } from '../types';
import { isProfileComplete } from '../services/profileCalculator';
import { CaloriesDetailsModal } from './CaloriesDetailsModal';

interface DashboardViewProps {
  profile: ProfileData | null;
  todayFoodLog: FoodLogEntry[];
  todayActivityLog: ActivityLogEntry[];
  onOpenChatWithPrompt: (prompt: string) => void;
  onNavigateToChat: () => void;
  onOpenOnboarding?: () => void;
  onOpenTerminology: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  todayFoodLog,
  todayActivityLog,
  onOpenChatWithPrompt,
  onNavigateToChat,
  onOpenOnboarding,
  onOpenTerminology,
}) => {
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  // Aggregate today's totals
  const totalCaloriesConsumed = todayFoodLog.reduce((sum, item) => sum + (item.calories || 0), 0);
  const totalProteinConsumed = todayFoodLog.reduce((sum, item) => sum + (item.protein || 0), 0);
  const totalCarbsConsumed = todayFoodLog.reduce((sum, item) => sum + (item.carbs || 0), 0);
  const totalFatConsumed = todayFoodLog.reduce((sum, item) => sum + (item.fat || 0), 0);
  const totalFiberConsumed = todayFoodLog.reduce((sum, item) => sum + (item.fiber || 0), 0);

  const totalActivityBurned = todayActivityLog.reduce(
    (sum, item) => sum + (item.caloriesBurned || 0),
    0
  );
  const totalActivityMinutes = todayActivityLog.reduce(
    (sum, item) => sum + (item.durationMinutes || 0),
    0
  );

  const isConfigured = isProfileComplete(profile);
  const calorieTarget = profile?.dailyCalorieTarget || 2000;
  const caloriesRemaining = Math.max(0, calorieTarget - totalCaloriesConsumed);
  const caloriePercent = Math.min(100, Math.round((totalCaloriesConsumed / calorieTarget) * 100));

  // Group foods by meal
  const mealsOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const mealsMap: Record<string, FoodLogEntry[]> = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
  };

  for (const item of todayFoodLog) {
    const mealKey = mealsMap[item.meal] ? item.meal : 'Snack';
    mealsMap[mealKey].push(item);
  }

  // Current formatted date
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 pb-24">
      {/* Date Header */}
      <div className="flex items-center justify-between py-4 px-2">
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700">
            Daily Summary
          </span>
          <h2 className="text-2xl font-black text-stone-950 tracking-tight mt-0.5">{todayFormatted}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTerminology}
            className="flex items-center gap-1 px-3 py-2 bg-stone-900 dark:bg-[#202923] border border-stone-200 dark:border-[#303B35] text-white dark:!text-[#F8FAFC] text-xs font-bold rounded-lg transition-all shadow-sm hover:shadow-md hover:bg-stone-800 dark:hover:bg-[#232D28] active:scale-95"
          >
            Terminology
          </button>
          <button
            onClick={onNavigateToChat}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </div>
      </div>

      {/* Main Calorie Card */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wide">Calories Today</span>
              <button 
                onClick={() => setIsDetailsModalOpen(true)}
                className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
              >
                Details
              </button>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-black text-stone-950 tracking-tighter">
                {Math.round(totalCaloriesConsumed)}
              </span>
              <span className="text-sm font-semibold text-stone-500">
                / {Math.round(calorieTarget)} <span className="text-[10px] font-medium">kcal</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2.5 text-[10px]">
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                {Math.round(caloriesRemaining)} kcal left
              </span>
              {totalActivityBurned > 0 && (
                <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded">
                  +{Math.round(totalActivityBurned)} kcal
                </span>
              )}
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Flame className="w-6 h-6" />
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                caloriePercent > 100
                  ? 'bg-rose-500'
                  : caloriePercent > 85
                  ? 'bg-amber-500'
                  : 'bg-emerald-700'
              }`}
              style={{ width: `${caloriePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-stone-500 font-medium mt-2">
            <span>{caloriePercent}% of budget</span>
            <span>{isConfigured && profile ? `${profile.dailyCalorieTarget} kcal` : 'Unconfigured'}</span>
          </div>
        </div>
      </div>

      {/* Macro Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        {/* Protein */}
        <div className="bg-white rounded-xl p-3 border border-stone-200 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
            <span className="font-bold text-stone-700">Protein</span>
            <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded">
              {isConfigured && profile?.proteinTargetG ? `${profile.proteinTargetG}g` : '—'}
            </span>
          </div>
          <div className="text-xl font-black text-stone-950 tracking-tight">
            {totalProteinConsumed.toFixed(1)}
            <span className="text-xs font-semibold text-stone-500 ml-0.5">g</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-700 h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  isConfigured && profile?.proteinTargetG
                    ? Math.min(100, Math.round((totalProteinConsumed / profile.proteinTargetG) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div className="bg-white rounded-xl p-3 border border-stone-200 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
            <span className="font-bold text-stone-700">Carbs</span>
            <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1 py-0.5 rounded">
              {isConfigured && profile?.carbTargetG ? `${profile.carbTargetG}g` : '—'}
            </span>
          </div>
          <div className="text-xl font-black text-stone-950 tracking-tight">
            {totalCarbsConsumed.toFixed(1)}
            <span className="text-xs font-semibold text-stone-500 ml-0.5">g</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-700 h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  isConfigured && profile?.carbTargetG
                    ? Math.min(100, Math.round((totalCarbsConsumed / profile.carbTargetG) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Fat */}
        <div className="bg-white rounded-xl p-3 border border-stone-200 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
            <span className="font-bold text-stone-700">Fat</span>
            <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1 py-0.5 rounded">
              {isConfigured && profile?.fatTargetG ? `${profile.fatTargetG}g` : '—'}
            </span>
          </div>
          <div className="text-xl font-black text-stone-950 tracking-tight">
            {totalFatConsumed.toFixed(1)}
            <span className="text-xs font-semibold text-stone-500 ml-0.5">g</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-amber-700 h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  isConfigured && profile?.fatTargetG
                    ? Math.min(100, Math.round((totalFatConsumed / profile.fatTargetG) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Fiber */}
        <div className="bg-white rounded-xl p-3 border border-stone-200 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
            <span className="font-bold text-stone-700">Fiber</span>
            <span className="text-[9px] text-teal-700 font-bold bg-teal-50 px-1 py-0.5 rounded">25g+</span>
          </div>
          <div className="text-xl font-black text-stone-950 tracking-tight">
            {totalFiberConsumed.toFixed(1)}
            <span className="text-xs font-semibold text-stone-500 ml-0.5">g</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-teal-700 h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round((totalFiberConsumed / 28) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Activity Card */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-stone-950">Activity</h3>
              <p className="text-[10px] text-stone-500 font-medium">
                {totalActivityMinutes} min total
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg">
            {Math.round(totalActivityBurned)} kcal
          </span>
        </div>

        {todayActivityLog.length > 0 ? (
          <div className="space-y-2">
            {todayActivityLog.map((act, idx) => (
              <div
                key={act.id || idx}
                className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-[#232D28] border border-stone-100 dark:border-[#303B35] text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <span className="font-semibold text-stone-800 dark:text-[#EEF4F1]">{act.activity}</span>
                </div>
                <div className="flex items-center gap-3 text-stone-600 dark:text-[#AAB8B1]">
                  <span>{act.durationMinutes} min</span>
                  {act.caloriesBurned && (
                    <span className="font-medium text-orange-600 dark:text-[#36A77C]">
                      ~{Math.round(act.caloriesBurned)} kcal
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-xs text-stone-500">
            No activity recorded today yet.
            <button
              onClick={() => onOpenChatWithPrompt('I walked for 30 minutes')}
              className="text-emerald-700 font-semibold ml-1 underline"
            >
              Log a walk
            </button>
          </div>
        )}
      </div>

      {/* Quick AI Suggestions / Chat Shortcuts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-stone-700 px-1">
          <span>Quick Log / Ask AI</span>
          <button
            onClick={onNavigateToChat}
            className="text-emerald-700 flex items-center gap-0.5 hover:underline"
          >
            Open Chat <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => onOpenChatWithPrompt('Breakfast: 2 eggs, 2 rotis and one cup of milk')}
            className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl transition-all active:scale-95 shadow-2xs"
          >
            🍳 2 eggs & 2 rotis
          </button>
          <button
            onClick={() => onOpenChatWithPrompt('Lunch: 150g chicken and 200g rice')}
            className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl transition-all active:scale-95 shadow-2xs"
          >
            🍗 150g chicken + rice
          </button>
          <button
            onClick={() => onOpenChatWithPrompt('Walked for 35 minutes')}
            className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl transition-all active:scale-95 shadow-2xs"
          >
            🚶 Walked 35 mins
          </button>
          <button
            onClick={() => onOpenChatWithPrompt('How much protein do I have left?')}
            className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl transition-all active:scale-95 shadow-2xs"
          >
            ❓ Protein left today?
          </button>
          <button
            onClick={() => onOpenChatWithPrompt('Analyze my day')}
            className="flex-shrink-0 text-xs font-medium px-3 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl transition-all active:scale-95 shadow-2xs"
          >
            📊 Analyze my day
          </button>
        </div>
      </div>

      {/* Today's Meals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-stone-950 tracking-tight">Today's Meals</h3>
          <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            {todayFoodLog.length} {todayFoodLog.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {mealsOrder.map((meal) => {
          const items = mealsMap[meal];
          const mealCalories = items.reduce((s, i) => s + (i.calories || 0), 0);

          return (
            <div
              key={meal}
              className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-stone-950">{meal}</span>
                  {items.length > 0 && (
                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {mealCalories > 0 && (
                    <span className="text-xs font-black text-stone-900">
                      {Math.round(mealCalories)} kcal
                    </span>
                  )}
                  <button
                    onClick={() => onOpenChatWithPrompt(`Log ${meal}: `)}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title={`Log ${meal}`}
                  >
                    <PlusCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {items.length > 0 ? (
                <div className="divide-y divide-stone-100">
                  {items.map((food, idx) => (
                    <div
                      key={food.id || idx}
                      className="py-3 flex items-center justify-between text-xs"
                    >
                      <div className="pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-stone-900 dark:text-[#EEF4F1]">{food.food}</span>
                          {food.isEstimate ? (
                            <span
                              className="text-[9px] font-bold bg-amber-50 dark:bg-[#303B35] text-amber-700 dark:text-[#AAB8B1] border border-amber-200 dark:border-[#303B35] px-1.5 py-0.5 rounded"
                              title="Estimated nutrition value"
                            >
                              Est.
                            </span>
                          ) : (
                            <span
                              className="text-[9px] font-bold bg-emerald-50 dark:bg-[#303B35] text-emerald-700 dark:text-[#36A77C] border border-emerald-200 dark:border-[#303B35] px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              title="From your Food Database"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              DB
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-[#87958E] font-medium mt-1">
                          {food.quantity} {food.unit} • P: {food.protein.toFixed(1)}g • C:{' '}
                          {food.carbs.toFixed(1)}g • F: {food.fat.toFixed(1)}g
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-black text-stone-950 dark:text-[#EEF4F1] text-sm">
                          {Math.round(food.calories)}
                        </span>
                        <span className="text-[9px] text-stone-400 dark:text-[#87958E] font-semibold block">kcal</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2 text-center text-[10px] font-medium text-stone-400">
                  No {meal.toLowerCase()} items logged.
                </div>
              )}
            </div>
          );
        })}
      </div>
      <CaloriesDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        foodLog={todayFoodLog}
      />
    </div>
  );
};
