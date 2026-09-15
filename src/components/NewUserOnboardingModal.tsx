import React, { useState, useEffect } from 'react';
import {
  User,
  Activity,
  Target,
  Flame,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  X,
  ChevronRight,
  Shield,
  Loader2,
} from 'lucide-react';
import { ProfileData } from '../types';
import {
  ACTIVITY_LEVEL_OPTIONS,
  GOAL_OPTIONS,
  calculateFullProfile,
  isProfileComplete,
} from '../services/profileCalculator';

interface NewUserOnboardingModalProps {
  isOpen: boolean;
  userEmail?: string | null;
  initialProfile?: ProfileData | null;
  isSaving?: boolean;
  onConfirm: (calculatedProfile: ProfileData) => Promise<void> | void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const NewUserOnboardingModal: React.FC<NewUserOnboardingModalProps> = ({
  isOpen,
  userEmail,
  initialProfile,
  isSaving = false,
  onConfirm,
  onClose,
  canDismiss = false,
}) => {
  // Form input states
  const [dateOfBirth, setDateOfBirth] = useState<string>(initialProfile?.dateOfBirth || '');
  const [sex, setSex] = useState<string>(initialProfile?.sex && initialProfile.sex !== 'Unspecified' ? initialProfile.sex : 'Male');
  const [heightCm, setHeightCm] = useState<string>(initialProfile?.heightCm ? String(initialProfile.heightCm) : '');
  const [weightKg, setWeightKg] = useState<string>(initialProfile?.weightKg ? String(initialProfile.weightKg) : '');
  const [activityLevel, setActivityLevel] = useState<string>(
    initialProfile?.activityLevel || 'Sedentary'
  );
  const [goal, setGoal] = useState<string>(
    initialProfile?.goal || 'Lose Fat / Toned Body'
  );

  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial profile if provided and changed
  useEffect(() => {
    if (initialProfile && isProfileComplete(initialProfile)) {
      setDateOfBirth(initialProfile.dateOfBirth || '');
      setSex(initialProfile.sex);
      setHeightCm(String(initialProfile.heightCm));
      setWeightKg(String(initialProfile.weightKg));
      setActivityLevel(initialProfile.activityLevel);
      setGoal(initialProfile.goal);
    }
  }, [initialProfile]);

  if (!isOpen) return null;

  const parsedHeight = parseFloat(heightCm);
  const parsedWeight = parseFloat(weightKg);

  const isValid =
    Boolean(dateOfBirth) &&
    Boolean(sex) &&
    !isNaN(parsedHeight) &&
    parsedHeight >= 80 &&
    parsedHeight <= 250 &&
    !isNaN(parsedWeight) &&
    parsedWeight >= 30 &&
    parsedWeight <= 350 &&
    Boolean(activityLevel) &&
    Boolean(goal);

  // Calculate live preview if inputs are valid
  const calculatedPreview: ProfileData | null = isValid
    ? calculateFullProfile({
        dateOfBirth,
        sex,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        activityLevel,
        goal,
      })
    : null;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!dateOfBirth) {
      setErrorMessage('Please enter your date of birth.');
      return;
    }
    if (!sex || sex === 'Unspecified') {
      setErrorMessage('Please select your sex for metabolic calculation.');
      return;
    }
    if (isNaN(parsedHeight) || parsedHeight < 80 || parsedHeight > 250) {
      setErrorMessage('Please enter a valid height in centimeters (80–250 cm).');
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 350) {
      setErrorMessage('Please enter a valid weight in kilograms (30–350 kg).');
      return;
    }
    if (!activityLevel) {
      setErrorMessage('Please select your regular activity level.');
      return;
    }
    if (!goal) {
      setErrorMessage('Please select your primary health goal.');
      return;
    }

    setStep('confirm');
  };

  const handleFinalConfirm = async () => {
    if (!calculatedPreview) return;
    try {
      await onConfirm(calculatedPreview);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save profile. Please try again.');
    }
  };

  return (
    <div
      id="new-user-onboarding-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="new-user-onboarding-dialog"
        className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-stone-900"
      >
        {/* Modal Header */}
        <div
          id="onboarding-header"
          className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="onboarding-title" className="text-base font-bold text-stone-900">
                {step === 'input' ? 'Welcome to My Health AI' : 'Confirm Your Health Targets'}
              </h2>
              <p id="onboarding-subtitle" className="text-xs text-stone-500">
                {userEmail ? (
                  <>
                    Account: <span className="font-semibold text-stone-700">{userEmail}</span>
                  </>
                ) : (
                  'Personalized Health & Nutrition Onboarding'
                )}
              </p>
            </div>
          </div>
          {canDismiss && onClose && (
            <button
              id="onboarding-close-btn"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div id="onboarding-body" className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Privacy and Isolation Notice */}
          <div
            id="onboarding-privacy-badge"
            className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-950"
          >
            <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Your Isolated Profile:</strong> We do not assume default values. Your BMR, TDEE, and nutrition targets are calculated specifically from your measurements and saved directly into your own dedicated Profile.
            </p>
          </div>

          {errorMessage && (
            <div
              id="onboarding-error-banner"
              className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'input' ? (
            <form id="onboarding-form" onSubmit={handleProceedToConfirm} className="space-y-4">
              {/* Row 1: Age & Sex */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div id="field-age" className="space-y-1">
                  <label htmlFor="onboarding-input-dob" className="block text-xs font-bold text-stone-700">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="onboarding-input-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div id="field-sex" className="space-y-1">
                  <label htmlFor="onboarding-select-sex" className="block text-xs font-bold text-stone-700">
                    Sex <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="onboarding-select-sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Diverse</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Height & Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div id="field-height" className="space-y-1">
                  <label htmlFor="onboarding-input-height" className="block text-xs font-bold text-stone-700">
                    Height (cm) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="onboarding-input-height"
                    type="number"
                    step="0.5"
                    min="80"
                    max="250"
                    placeholder="e.g. 175"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <span className="text-[10px] text-stone-400 block">175 cm ≈ 5 ft 9 in</span>
                </div>

                <div id="field-weight" className="space-y-1">
                  <label htmlFor="onboarding-input-weight" className="block text-xs font-bold text-stone-700">
                    Weight (kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="onboarding-input-weight"
                    type="number"
                    step="0.1"
                    min="30"
                    max="350"
                    placeholder="e.g. 72.5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <span className="text-[10px] text-stone-400 block">70 kg ≈ 154 lbs</span>
                </div>
              </div>

              {/* Row 3: Activity Level */}
              <div id="field-activity-level" className="space-y-1.5">
                <label htmlFor="onboarding-select-activity" className="block text-xs font-bold text-stone-700">
                  Activity Level <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1.5">
                  {ACTIVITY_LEVEL_OPTIONS.map((opt) => {
                    const isSelected = activityLevel === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        id={`onboarding-activity-${opt.value.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => setActivityLevel(opt.value)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-400 text-stone-900 shadow-xs'
                            : 'bg-stone-50/60 border-stone-200 hover:border-stone-300 text-stone-700'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold block">{opt.label}</span>
                          <span className="text-[11px] text-stone-500 block leading-tight">
                            {opt.description}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ml-2 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {opt.multiplier}x
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Goal */}
              <div id="field-goal" className="space-y-1.5">
                <label htmlFor="onboarding-select-goal" className="block text-xs font-bold text-stone-700">
                  Primary Health Goal <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1.5">
                  {GOAL_OPTIONS.map((g) => {
                    const isSelected = goal === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        id={`onboarding-goal-${g.value.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => setGoal(g.value)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-400 text-stone-900 shadow-xs'
                            : 'bg-stone-50/60 border-stone-200 hover:border-stone-300 text-stone-700'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold block">{g.label}</span>
                          <span className="text-[11px] text-stone-500 block leading-tight">
                            {g.description}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Target Calculation Preview Card */}
              {calculatedPreview && (
                <div
                  id="onboarding-live-preview-card"
                  className="p-3.5 bg-stone-900 text-stone-100 rounded-2xl shadow-sm space-y-2.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      Live Calculated Formula Preview
                    </span>
                    <span className="text-[10px] text-stone-400">Mifflin-St Jeor</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-stone-800/80 p-2 rounded-xl">
                      <span className="text-[9px] text-stone-400 block">BMR</span>
                      <span className="text-sm font-black text-white">
                        {calculatedPreview.bmr}{' '}
                        <span className="text-[9px] font-normal text-stone-400">kcal</span>
                      </span>
                    </div>
                    <div className="bg-stone-800/80 p-2 rounded-xl">
                      <span className="text-[9px] text-stone-400 block">Est. TDEE</span>
                      <span className="text-sm font-black text-white">
                        {calculatedPreview.tdee}{' '}
                        <span className="text-[9px] font-normal text-stone-400">kcal</span>
                      </span>
                    </div>
                    <div className="bg-emerald-950/80 border border-emerald-700/50 p-2 rounded-xl">
                      <span className="text-[9px] text-emerald-300 block">Calorie Target</span>
                      <span className="text-sm font-black text-emerald-400">
                        {calculatedPreview.dailyCalorieTarget}{' '}
                        <span className="text-[9px] font-normal text-emerald-300">kcal</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-stone-800/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-stone-400 block">Protein (1.6g/kg)</span>
                      <span className="font-bold text-emerald-400">
                        {calculatedPreview.proteinTargetG}g
                      </span>
                    </div>
                    <div className="bg-stone-800/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-stone-400 block">Fat (30%)</span>
                      <span className="font-bold text-amber-400">
                        {calculatedPreview.fatTargetG}g
                      </span>
                    </div>
                    <div className="bg-stone-800/60 p-1.5 rounded-lg">
                      <span className="text-[9px] text-stone-400 block">Carbs (Balance)</span>
                      <span className="font-bold text-blue-400">
                        {calculatedPreview.carbTargetG}g
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="onboarding-review-btn"
                  disabled={!isValid}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Review & Confirm Targets</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* Confirmation Step */
            <div id="onboarding-confirm-step" className="space-y-4">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Summary of Provided Metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-stone-100">
                    <span className="text-[10px] text-stone-500 block">Date of Birth</span>
                    <span className="font-bold text-stone-900">{dateOfBirth}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-100">
                    <span className="text-[10px] text-stone-500 block">Sex</span>
                    <span className="font-bold text-stone-900">{sex}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-100">
                    <span className="text-[10px] text-stone-500 block">Height</span>
                    <span className="font-bold text-stone-900">{parsedHeight} cm</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-100">
                    <span className="text-[10px] text-stone-500 block">Weight</span>
                    <span className="font-bold text-stone-900">{parsedWeight} kg</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-100">
                    <span className="text-[10px] text-stone-500 block">Activity</span>
                    <span className="font-bold text-stone-900">{activityLevel}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-100">
                    <span className="text-[10px] text-stone-500 block">Goal</span>
                    <span className="font-bold text-stone-900">{goal}</span>
                  </div>
                </div>
              </div>

              {/* Calculated Targets Display */}
              {calculatedPreview && (
                <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Your Calculated Targets (To be saved in Profile)
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-semibold text-emerald-800 block">
                        Daily Calorie Target
                      </span>
                      <span className="text-lg font-black text-emerald-950">
                        {calculatedPreview.dailyCalorieTarget}{' '}
                        <span className="text-xs font-normal">kcal</span>
                      </span>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[10px] font-semibold text-stone-500 block">
                        Estimated TDEE
                      </span>
                      <span className="text-lg font-black text-stone-900">
                        {calculatedPreview.tdee}{' '}
                        <span className="text-xs font-normal">kcal</span>
                      </span>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[10px] font-semibold text-stone-500 block">
                        BMR (Mifflin-St Jeor)
                      </span>
                      <span className="text-lg font-black text-stone-900">
                        {calculatedPreview.bmr}{' '}
                        <span className="text-xs font-normal">kcal</span>
                      </span>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[10px] font-semibold text-stone-500 block">
                        Protein Target
                      </span>
                      <span className="text-lg font-black text-emerald-700">
                        {calculatedPreview.proteinTargetG}{' '}
                        <span className="text-xs font-normal">g</span>
                      </span>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[10px] font-semibold text-stone-500 block">
                        Fat Target
                      </span>
                      <span className="text-lg font-black text-amber-700">
                        {calculatedPreview.fatTargetG}{' '}
                        <span className="text-xs font-normal">g</span>
                      </span>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[10px] font-semibold text-stone-500 block">
                        Carbohydrate Target
                      </span>
                      <span className="text-lg font-black text-blue-700">
                        {calculatedPreview.carbTargetG}{' '}
                        <span className="text-xs font-normal">g</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  id="onboarding-back-btn"
                  onClick={() => setStep('input')}
                  disabled={isSaving}
                  className="w-1/3 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  id="onboarding-confirm-btn"
                  onClick={handleFinalConfirm}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
