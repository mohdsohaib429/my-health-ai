import React, { useState } from 'react';
import {
  User,
  Target,
  Flame,
  Activity,
  ExternalLink,
  Database,
  Plus,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
  Users,
  UserCheck,
  Sparkles,
  Edit3,
  SunMoon,
  ChevronDown,
} from 'lucide-react';
import { ProfileData, FoodDatabaseItem, GoogleSheetFile } from '../types';
import { isProfileComplete } from '../services/profileCalculator';

interface ProfileViewProps {
  profile: ProfileData | null;
  foodDatabase: FoodDatabaseItem[];
  selectedSheet: GoogleSheetFile | null;
  sheetTabs: string[];
  userEmail?: string | null;
  onOpenSheetSelector: () => void;
  onAddFoodToDatabase: (item: FoodDatabaseItem) => void;
  onRunIntegrityCheck?: () => void;
  onSwitchAccount?: () => void;
  onOpenOnboarding?: () => void;
  onOpenDeleteDataModal: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}


const AccordionSection = ({ title, description, children, defaultOpen = true }: { title: string, description?: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h3 className="text-sm font-bold text-stone-950 dark:text-[#DCE6E1]">{title}</h3>
          {description && <p className="text-xs text-stone-600 dark:text-[#87958E] mt-0.5">{description}</p>}
        </div>
        <ChevronDown className={`w-5 h-5 text-stone-600 dark:text-[#87958E] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-stone-100 dark:border-[#303B35]' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  foodDatabase,
  selectedSheet,
  sheetTabs,
  userEmail,
  onOpenSheetSelector,
  onAddFoodToDatabase,
  onRunIntegrityCheck,
  onSwitchAccount,
  onOpenOnboarding,
  onOpenDeleteDataModal,
  theme,
  toggleTheme,
}) => {
  const [showAddFood, setShowAddFood] = useState(false);
  const [newFood, setNewFood] = useState<Partial<FoodDatabaseItem>>({
    food: '',
    serving: 100,
    unit: 'g',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 2,
    fiber: 1,
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFood.food) return;

    onAddFoodToDatabase({
      food: newFood.food.trim(),
      serving: Number(newFood.serving) || 1,
      unit: newFood.unit?.trim() || 'g',
      calories: Number(newFood.calories) || 0,
      protein: Number(newFood.protein) || 0,
      carbs: Number(newFood.carbs) || 0,
      fat: Number(newFood.fat) || 0,
      fiber: Number(newFood.fiber) || 0,
    });

    setNewFood({
      food: '',
      serving: 100,
      unit: 'g',
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 2,
      fiber: 1,
    });
    setShowAddFood(false);
  };

  const requiredTabs = [
    'Profile',
    'Food Log',
    'Activity Log',
    'Daily Summary',
    'Progress',
    'Food Database',
  ];

  const profileReady = isProfileComplete(profile);

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto min-h-screen p-4 md:p-6">
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700">
            Health Parameters
          </span>
          <h2 className="text-xl font-extrabold text-stone-950 dark:text-[#DCE6E1]">Profile & Database</h2>
        </div>
        {profileReady && onOpenOnboarding && (
          <button
            id="profile-edit-targets-btn"
            onClick={onOpenOnboarding}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile & Targets</span>
          </button>
        )}
      </div>

      {/* Uninitialized Profile Alert Banner for New Users */}
      {!profileReady && (
        <div
          id="profile-uninitialized-banner"
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950">
                Personalized Profile Setup Required
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                No profile data exists for this account yet. We do not assume default measurements or targets. Please provide your age, sex, height, weight, activity level, and goal to calculate your custom BMR, TDEE, calorie target, and macros.
              </p>
            </div>
          </div>

          {onOpenOnboarding && (
            <div className="pt-1 flex justify-end">
              <button
                id="profile-start-onboarding-btn"
                onClick={onOpenOnboarding}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Complete Profile Onboarding</span>
              </button>
            </div>
          )}
        </div>
      )}

      <AccordionSection title="User Stats" description="Profile information" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl border border-stone-100 dark:border-[#303B35] bg-stone-50 dark:bg-[#232D28]">
            <span className="text-[10px] text-stone-800 dark:text-[#87958E] block font-semibold">Date of Birth</span>
            <span className="font-bold text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile?.dateOfBirth ? profile.dateOfBirth : (profile?.age ? `${profile.age} years` : '—')}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-stone-100 dark:border-[#303B35] bg-stone-50 dark:bg-[#232D28]">
            <span className="text-[10px] text-stone-800 dark:text-[#87958E] block font-semibold">Sex</span>
            <span className="font-bold text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile?.sex ? profile.sex : '—'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-stone-100 dark:border-[#303B35] bg-stone-50 dark:bg-[#232D28]">
            <span className="text-[10px] text-stone-800 dark:text-[#87958E] block font-semibold">Height</span>
            <span className="font-bold text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile?.heightCm ? `${profile.heightCm} cm` : '—'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-stone-100 dark:border-[#303B35] bg-stone-50 dark:bg-[#232D28]">
            <span className="text-[10px] text-stone-800 dark:text-[#87958E] block font-semibold">Weight</span>
            <span className="font-bold text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile?.weightKg ? `${profile.weightKg} kg` : '—'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-stone-100 dark:border-[#303B35] bg-stone-50 dark:bg-[#232D28]">
            <span className="text-[10px] text-stone-800 dark:text-[#87958E] block font-semibold">Activity</span>
            <span className="font-bold text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile?.activityLevel ? profile.activityLevel : '—'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-stone-100 dark:border-[#303B35] bg-stone-50 dark:bg-[#232D28]">
            <span className="text-[10px] text-stone-800 dark:text-[#87958E] block font-semibold">Goal</span>
            <span className="font-bold text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile?.goal ? profile.goal : '—'}
            </span>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="Target Metrics" description="Calculated targets based on your profile" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="bg-stone-50 dark:bg-[#232D28] p-3 rounded-xl border border-stone-100 dark:border-[#303B35]">
            <span className="text-[10px] font-semibold text-stone-800 dark:text-[#87958E] block">Calorie Target</span>
            <span className="text-sm font-black text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile ? profile.dailyCalorieTarget : '—'}{' '}
              {profileReady && <span className="text-[10px] font-normal">kcal</span>}
            </span>
          </div>
          <div className="bg-stone-50 dark:bg-[#232D28] p-3 rounded-xl border border-stone-100 dark:border-[#303B35]">
            <span className="text-[10px] font-semibold text-stone-800 dark:text-[#87958E] block">Protein Target</span>
            <span className="text-sm font-black text-emerald-700">
              {profileReady && profile ? profile.proteinTargetG : '—'}{' '}
              {profileReady && <span className="text-[10px] font-normal">g</span>}
            </span>
          </div>
          <div className="bg-stone-50 dark:bg-[#232D28] p-3 rounded-xl border border-stone-100 dark:border-[#303B35]">
            <span className="text-[10px] font-semibold text-stone-800 dark:text-[#87958E] block">Carb Target</span>
            <span className="text-sm font-black text-blue-700">
              {profileReady && profile ? profile.carbTargetG : '—'}{' '}
              {profileReady && <span className="text-[10px] font-normal">g</span>}
            </span>
          </div>
          <div className="bg-stone-50 dark:bg-[#232D28] p-3 rounded-xl border border-stone-100 dark:border-[#303B35]">
            <span className="text-[10px] font-semibold text-stone-800 dark:text-[#87958E] block">Fat Target</span>
            <span className="text-sm font-black text-amber-700">
              {profileReady && profile ? profile.fatTargetG : '—'}{' '}
              {profileReady && <span className="text-[10px] font-normal">g</span>}
            </span>
          </div>
          <div className="bg-stone-50 dark:bg-[#232D28] p-3 rounded-xl border border-stone-100 dark:border-[#303B35]">
            <span className="text-[10px] font-semibold text-stone-800 dark:text-[#87958E] block">BMR</span>
            <span className="text-sm font-black text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile ? profile.bmr : '—'}{' '}
              {profileReady && <span className="text-[10px] font-normal">kcal</span>}
            </span>
          </div>
          <div className="bg-stone-50 dark:bg-[#232D28] p-3 rounded-xl border border-stone-100 dark:border-[#303B35]">
            <span className="text-[10px] font-semibold text-stone-800 dark:text-[#87958E] block">TDEE</span>
            <span className="text-sm font-black text-stone-950 dark:text-[#EEF4F1]">
              {profileReady && profile ? profile.tdee : '—'}{' '}
              {profileReady && <span className="text-[10px] font-normal">kcal</span>}
            </span>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="App Theme" description="Customize appearance" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                <SunMoon className="w-5 h-5 text-emerald-700" />
             </div>
             <div>
                <h3 className="text-xs font-bold text-stone-950 dark:text-[#DCE6E1]">App Theme</h3>
                <p className="text-xs text-stone-600 dark:text-[#87958E]">Toggle Light/Dark Mode</p>
             </div>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
          </button>
        </div>
      </AccordionSection>

      <AccordionSection title="Google Sheet Connection" description="Manage your data source" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-950 dark:text-[#DCE6E1]">Connection Status</h3>
              <p className="text-xs text-stone-600 dark:text-[#87958E]">
                {selectedSheet ? selectedSheet.name : 'Running in Local / Demo Mode'}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSheetSelector}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
          >
            {selectedSheet ? 'Switch' : 'Select'}
          </button>
        </div>

        {selectedSheet && (
          <div className="pt-2 border-t border-stone-100 dark:border-[#303B35] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-stone-600 truncate max-w-[240px]">
              ID: {selectedSheet.id}
            </span>
            {selectedSheet.webViewLink && (
              <a
                href={selectedSheet.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-emerald-600 font-semibold hover:underline"
              >
                <span>Open in Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Tab verification */}
        <div className="pt-2 border-t border-stone-100 dark:border-[#303B35]">
          <span className="text-[11px] font-semibold text-stone-600 uppercase block mb-1.5">
            Detected Tabs:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {requiredTabs.map((tab) => {
              const exists = sheetTabs.length === 0 || sheetTabs.includes(tab);
              return (
                <span
                  key={tab}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${
                    exists
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {tab}
                </span>
              );
            })}
          </div>
        </div>

        {/* 6-Sheet Data Integrity Audit */}
        {onRunIntegrityCheck && (
          <div className="pt-3 border-t border-stone-100 dark:border-[#303B35] flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-stone-950 block dark:text-[#DCE6E1]">
                6-Sheet Data Integrity Check
              </span>
              <span className="text-[11px] text-stone-600 block">
                Inspects Profile, Food Log, Activity Log, Daily Summary, Progress, and Food Database
              </span>
            </div>
            <button
              onClick={onRunIntegrityCheck}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit</span>
            </button>
          </div>
        )}
        
        {/* Destructive Data Management */}
        <div className="pt-3 border-t border-red-100 dark:border-[#303B35]">
            <h3 className="text-xs font-bold text-red-700 mb-1">Danger Zone</h3>
            <p className="text-[11px] text-red-600 mb-3">Permanent deletion of all tracking data.</p>
            <button
                onClick={onOpenDeleteDataModal}
                className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200 transition-colors"
            >
                Delete All My Tracking Data
            </button>
        </div>
      </AccordionSection>

      <AccordionSection title="Food Database" description="Saved nutrition references" defaultOpen={false}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-stone-950 dark:text-[#DCE6E1]">Database Items</h3>
            <span className="text-xs text-stone-600">({foodDatabase.length} items)</span>
          </div>
          <button
            onClick={() => setShowAddFood(!showAddFood)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Food</span>
          </button>
        </div>

        {/* Add food form */}
        {showAddFood && (
          <form
            onSubmit={handleAddSubmit}
            className="p-3 bg-stone-50 dark:bg-[#232D28] border border-stone-200 dark:border-[#303B35] rounded-xl space-y-2.5 text-xs"
          >
            <h4 className="font-bold text-stone-950 dark:text-[#EEF4F1]">Add New Food</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Food Name</label>
                <input
                  type="text"
                  placeholder="e.g. Oatmeal cooked"
                  value={newFood.food}
                  onChange={(e) => setNewFood({ ...newFood, food: e.target.value })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Serving</label>
                <input
                  type="number"
                  value={newFood.serving}
                  onChange={(e) => setNewFood({ ...newFood, serving: parseFloat(e.target.value) })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Unit</label>
                <input
                  type="text"
                  placeholder="g, piece, cup"
                  value={newFood.unit}
                  onChange={(e) => setNewFood({ ...newFood, unit: e.target.value })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Calories</label>
                <input
                  type="number"
                  value={newFood.calories}
                  onChange={(e) => setNewFood({ ...newFood, calories: parseFloat(e.target.value) })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Protein (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newFood.protein}
                  onChange={(e) => setNewFood({ ...newFood, protein: parseFloat(e.target.value) })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Carbs (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newFood.carbs}
                  onChange={(e) => setNewFood({ ...newFood, carbs: parseFloat(e.target.value) })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-600 dark:text-[#87958E] block font-semibold">Fat (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newFood.fat}
                  onChange={(e) => setNewFood({ ...newFood, fat: parseFloat(e.target.value) })}
                  required
                  className="w-full bg-white dark:bg-[#1C2420] border border-stone-200 dark:border-[#303B35] rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddFood(false)}
                className="px-3 py-1 bg-stone-200 dark:bg-[#303B35] text-stone-700 dark:text-[#87958E] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-lg"
              >
                Save
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-stone-100 dark:divide-[#303B35] max-h-60 overflow-y-auto">
          {foodDatabase.map((item, idx) => (
            <div
              key={idx}
              className="py-2.5 flex items-center justify-between text-xs"
            >
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-stone-950 dark:text-[#EEF4F1]">{item.food}</span>
                  {item.isEstimate && (
                    <span className="text-[9px] bg-amber-50 dark:bg-[#303B35] text-amber-700 dark:text-[#AAB8B1] border border-amber-200 dark:border-[#303B35] px-1.5 py-0.5 rounded font-medium">
                      Estimated
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-stone-700 dark:text-[#87958E] block mt-0.5 font-semibold">
                  Per {item.serving} {item.unit} • P: {item.protein}g • C: {item.carbs}g • F:{' '}
                  {item.fat}g {item.fiber > 0 ? `• Fib: ${item.fiber}g` : ''}
                  {item.notes ? ` • Note: ${item.notes}` : ''}
                </span>
              </div>
              <span className="font-bold text-stone-950 dark:text-[#DCE6E1]">{Math.round(item.calories)} kcal</span>
            </div>
          ))}
        </div>
      </AccordionSection>
    </div>
  );
};
