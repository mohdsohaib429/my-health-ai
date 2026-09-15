import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface Term {
  term: string;
  explanation: string;
}

const terms: Term[] = [
  { term: 'BMR', explanation: 'Basal Metabolic Rate: The number of calories your body needs to function at rest.' },
  { term: 'TDEE', explanation: 'Total Daily Energy Expenditure: The total number of calories you burn in a day, including exercise.' },
  { term: 'BMI', explanation: 'Body Mass Index: A simple calculation using height and weight to categorize body weight.' },
  { term: 'Kcal', explanation: 'Kilocalorie: A unit of energy, often referred to as a "Calorie" in food labeling.' },
  { term: 'Calories', explanation: 'Units of energy found in food and drinks that provide fuel for your body.' },
  { term: 'Calorie Deficit', explanation: 'Consuming fewer calories than your body burns, leading to weight loss.' },
  { term: 'Calorie Surplus', explanation: 'Consuming more calories than your body burns, leading to weight gain.' },
  { term: 'Maintenance Calories', explanation: 'The number of calories needed to maintain your current weight.' },
  { term: 'Macros', explanation: 'Macronutrients: Protein, carbohydrates, and fats, which provide the bulk of energy.' },
  { term: 'Protein', explanation: 'A macronutrient essential for building and repairing tissues like muscle.' },
  { term: 'Carbohydrates', explanation: 'The body’s primary source of energy, found in foods like bread, fruit, and sugar.' },
  { term: 'Fat', explanation: 'A concentrated source of energy, important for hormone production and nutrient absorption.' },
  { term: 'Fiber', explanation: 'A type of carbohydrate that the body cannot digest, beneficial for digestion and satiety.' },
  { term: 'Active Calories', explanation: 'Calories burned during physical activity or exercise.' },
  { term: 'Serving Size', explanation: 'The amount of food typically eaten at one time, used for nutritional references.' },
];

interface TerminologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminologyModal: React.FC<TerminologyModalProps> = ({ isOpen, onClose }) => {
  return (
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
        className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
          <div className="flex items-center gap-2 text-stone-900 font-bold">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h2>Health & Fitness Terminology</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-4 space-y-4">
          {terms.map((item, idx) => (
            <div key={idx} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
              <h4 className="font-bold text-stone-900 text-sm">{item.term}</h4>
              <p className="text-stone-600 text-xs mt-1 leading-relaxed">{item.explanation}</p>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl text-sm transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
