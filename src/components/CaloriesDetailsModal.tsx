import React from 'react';
import { X, Utensils, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FoodLogEntry } from '../types';

interface CaloriesDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  foodLog: FoodLogEntry[];
}

export const CaloriesDetailsModal: React.FC<CaloriesDetailsModalProps> = ({ isOpen, onClose, foodLog }) => {
  const mealsOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const mealsMap: Record<string, FoodLogEntry[]> = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
  };

  for (const item of foodLog) {
    const mealKey = mealsMap[item.meal] ? item.meal : 'Snack';
    mealsMap[mealKey].push(item);
  }

  const totalCalories = foodLog.reduce((sum, item) => sum + (item.calories || 0), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-stone-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-950">Calories Details</h2>
                  <p className="text-xs font-semibold text-stone-500">Breakdown of today's intake</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {foodLog.length === 0 ? (
                <div className="text-center py-10 text-stone-500 font-medium">No food logged today.</div>
              ) : (
                <>
                  {mealsOrder.map((meal) => {
                    const items = mealsMap[meal];
                    if (items.length === 0) return null;

                    const mealCalories = items.reduce((s, i) => s + (i.calories || 0), 0);
                    return (
                      <div key={meal}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                            <Utensils className="w-4 h-4 text-emerald-600" />
                            {meal}
                          </h3>
                          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                            {Math.round(mealCalories)} kcal
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items.map((food, idx) => (
                            <div key={food.id || idx} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-stone-900">{food.food}</span>
                                <span className="text-[11px] font-medium text-stone-500">{food.quantity} {food.unit}</span>
                              </div>
                              <span className="text-sm font-bold text-stone-900">{Math.round(food.calories)} kcal</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
                    <span className="text-base font-black text-stone-950">Total Calories</span>
                    <span className="text-base font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                      {Math.round(totalCalories)} kcal
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-stone-100">
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-black rounded-2xl transition-all active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
