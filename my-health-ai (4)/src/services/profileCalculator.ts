import { ProfileData } from '../types';

export interface ProfileInput {
  age?: number;
  dateOfBirth?: string;
  sex: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
}

export function calculateAgeFromDob(dob: string): number {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export const ACTIVITY_LEVEL_OPTIONS = [
  {
    value: 'Sedentary',
    label: 'Sedentary',
    description: 'Office worker, little to no regular exercise',
    multiplier: 1.2,
  },
  {
    value: 'Lightly Active',
    label: 'Lightly Active',
    description: 'Light exercise or sports 1–3 days per week',
    multiplier: 1.375,
  },
  {
    value: 'Moderately Active',
    label: 'Moderately Active',
    description: 'Moderate exercise or sports 3–5 days per week',
    multiplier: 1.55,
  },
  {
    value: 'Very Active',
    label: 'Very Active',
    description: 'Heavy exercise or hard sports 6–7 days per week',
    multiplier: 1.725,
  },
  {
    value: 'Extra Active',
    label: 'Extra Active',
    description: 'Very hard exercise, physical labor, or training 2x/day',
    multiplier: 1.9,
  },
];

export const GOAL_OPTIONS = [
  {
    value: 'Lose Fat / Toned Body',
    label: 'Lose Fat / Toned Body',
    description: '15% calorie deficit with high protein to preserve lean muscle',
    multiplier: 0.85,
  },
  {
    value: 'Aggressive Fat Loss',
    label: 'Aggressive Fat Loss',
    description: '20% calorie deficit for accelerated fat reduction',
    multiplier: 0.8,
  },
  {
    value: 'Maintain Healthy Weight',
    label: 'Maintain Healthy Weight',
    description: 'Calorie balance (100% TDEE) for energy and steady weight',
    multiplier: 1.0,
  },
  {
    value: 'Build Muscle / Lean Bulk',
    label: 'Build Muscle / Lean Bulk',
    description: '10% calorie surplus with high protein for muscle growth',
    multiplier: 1.1,
  },
  {
    value: 'Weight Gain / Muscle Gain',
    label: 'Weight Gain / Muscle Gain',
    description: '15% calorie surplus for strength and mass development',
    multiplier: 1.15,
  },
];

export function getActivityMultiplier(activityLevel: string): number {
  const norm = (activityLevel || '').toLowerCase().trim();
  if (norm.includes('sedentary')) return 1.2;
  if (norm.includes('light')) return 1.375;
  if (norm.includes('moderate')) return 1.55;
  if (norm.includes('very')) return 1.725;
  if (norm.includes('extra') || norm.includes('extreme')) return 1.9;
  return 1.2; // default safe fallback
}

export function getGoalMultiplier(goal: string): number {
  const norm = (goal || '').toLowerCase().trim();
  if (norm.includes('aggressive')) return 0.8;
  if (norm.includes('lose') || norm.includes('fat') || norm.includes('cut') || norm.includes('toned')) return 0.85;
  if (norm.includes('muscle') || norm.includes('bulk') || norm.includes('gain')) {
    if (norm.includes('lean') || norm.includes('toned')) return 1.1;
    return 1.15;
  }
  if (norm.includes('maintain')) return 1.0;
  return 0.85; // default
}

/**
 * Calculates BMR using the Mifflin-St Jeor equation.
 * Male: 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 * Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 * Other: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 78
 */
export function calculateBmr(
  age: number,
  sex: string,
  heightCm: number,
  weightKg: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const lowerSex = (sex || '').toLowerCase().trim();
  let bmr = base;
  if (lowerSex === 'male') {
    bmr = base + 5;
  } else if (lowerSex === 'female') {
    bmr = base - 161;
  } else {
    bmr = base - 78;
  }
  return Math.round(bmr * 100) / 100;
}

/**
 * Calculates Estimated TDEE based on BMR and Activity Level.
 */
export function calculateTdee(bmr: number, activityLevel: string): number {
  const multiplier = getActivityMultiplier(activityLevel);
  return Math.round(bmr * multiplier * 100) / 100;
}

/**
 * Calculates Daily Calorie Target based on TDEE and Goal.
 */
export function calculateCalorieTarget(tdee: number, goal: string): number {
  const multiplier = getGoalMultiplier(goal);
  return Math.round(tdee * multiplier * 1000) / 1000;
}

/**
 * Calculates Macronutrient Targets:
 * - Protein: 1.6g per kg of bodyweight
 * - Fat: 30% of total calories / 9 kcal per gram
 * - Carbohydrates: Remaining calories / 4 kcal per gram
 */
export function calculateMacroTargets(
  calorieTarget: number,
  weightKg: number
): { proteinTargetG: number; fatTargetG: number; carbTargetG: number } {
  const proteinTargetG = Math.round(weightKg * 1.6 * 10) / 10;
  const fatTargetG = Math.round(((calorieTarget * 0.3) / 9) * 10000) / 10000;
  const proteinCalories = proteinTargetG * 4;
  const fatCalories = fatTargetG * 9;
  const remainingCalories = Math.max(0, calorieTarget - proteinCalories - fatCalories);
  const carbTargetG = Math.round((remainingCalories / 4) * 1000000) / 1000000;

  return {
    proteinTargetG,
    fatTargetG,
    carbTargetG,
  };
}

/**
 * Computes a complete ProfileData object from user-provided inputs.
 */
export function calculateFullProfile(input: ProfileInput): ProfileData {
  const age = input.dateOfBirth ? calculateAgeFromDob(input.dateOfBirth) : (input.age || 0);
  const bmr = calculateBmr(age, input.sex, input.heightCm, input.weightKg);
  const tdee = calculateTdee(bmr, input.activityLevel);
  const dailyCalorieTarget = calculateCalorieTarget(tdee, input.goal);
  const { proteinTargetG, fatTargetG, carbTargetG } = calculateMacroTargets(
    dailyCalorieTarget,
    input.weightKg
  );

  return {
    age,
    dateOfBirth: input.dateOfBirth,
    sex: input.sex.trim(),
    heightCm: Math.round(input.heightCm * 10) / 10,
    weightKg: Math.round(input.weightKg * 10) / 10,
    activityLevel: input.activityLevel.trim(),
    goal: input.goal.trim(),
    bmr,
    tdee,
    dailyCalorieTarget,
    proteinTargetG,
    fatTargetG,
    carbTargetG,
  };
}

/**
 * Checks whether a user's Profile is complete and valid.
 * Existing users with a complete Profile continue normally without being asked again.
 */
export function isProfileComplete(profile: ProfileData | null | undefined): boolean {
  if (!profile) return false;
  if (typeof profile.age !== 'number' || profile.age <= 0) return false;
  if (!profile.sex || profile.sex?.trim() === '' || profile.sex?.trim().toLowerCase() === 'unspecified') {
    return false;
  }
  if (typeof profile.heightCm !== 'number' || profile.heightCm <= 0) return false;
  if (typeof profile.weightKg !== 'number' || profile.weightKg <= 0) return false;
  if (!profile.activityLevel || profile.activityLevel?.trim() === '') return false;
  if (!profile.goal || profile.goal?.trim() === '') return false;
  if (typeof profile.dailyCalorieTarget !== 'number' || profile.dailyCalorieTarget <= 0) return false;
  if (typeof profile.proteinTargetG !== 'number' || profile.proteinTargetG <= 0) return false;
  return true;
}
