export type BMICategory = 'underweight' | 'healthy' | 'overweight' | 'obese';

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Number((weightKg / (m * m)).toFixed(1));
}

export function bmiCategory(bmi: number): BMICategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function bmiCategoryLabel(c: BMICategory): string {
  return { underweight: 'Underweight', healthy: 'Healthy', overweight: 'Overweight', obese: 'Obese' }[c];
}

export function weightTrend(logs: { date: string; weight: number }[]): {
  latest: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'flat' | null;
} {
  if (logs.length === 0) return { latest: null, delta: null, direction: null };
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].weight;
  if (sorted.length === 1) return { latest, delta: null, direction: null };
  const first = sorted[0].weight;
  const delta = Number((latest - first).toFixed(1));
  const direction = delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'flat';
  return { latest, delta, direction };
}

export interface VitalsSummary {
  bmi: number | null;
  category: BMICategory | null;
  headline: string;
  detail: string;
  suggestions: string[];
}

export function summarizeVitals(input: {
  weightKg?: number | null;
  heightCm?: number | null;
  trendDirection?: 'up' | 'down' | 'flat' | null;
}): VitalsSummary {
  const { weightKg, heightCm, trendDirection } = input;

  if (!weightKg || !heightCm) {
    return {
      bmi: null,
      category: null,
      headline: 'Add your vitals',
      detail: 'Log your weight and height to see your BMI and health summary.',
      suggestions: [
        !heightCm ? 'Set your height in profile' : null,
        !weightKg ? 'Log today\'s weight' : null,
      ].filter((s): s is string => !!s),
    };
  }

  const bmi = calculateBMI(weightKg, heightCm);
  const category = bmiCategory(bmi);

  const headline = {
    underweight: 'Below a healthy range',
    healthy: 'In a healthy range',
    overweight: 'Slightly above healthy range',
    obese: 'Above a healthy range',
  }[category];

  const trendNote =
    trendDirection === 'down'
      ? ' Weight is trending down.'
      : trendDirection === 'up'
        ? ' Weight is trending up.'
        : trendDirection === 'flat'
          ? ' Weight is stable.'
          : '';

  const detail = `BMI ${bmi} — ${bmiCategoryLabel(category).toLowerCase()}.${trendNote}`;

  const suggestions: string[] = [];
  if (category === 'underweight') {
    suggestions.push('Focus on nutrient-dense meals and strength training.');
  } else if (category === 'overweight' || category === 'obese') {
    suggestions.push('Aim for a small daily calorie deficit.');
    suggestions.push('Target 7–10k steps and 2–3 strength sessions a week.');
  } else {
    suggestions.push('Keep your current routine — maintain protein and sleep.');
  }
  if (trendDirection === 'up' && category !== 'underweight') {
    suggestions.push('Review recent calorie intake for unintentional surplus.');
  }

  return { bmi, category, headline, detail, suggestions };
}

// ─── Calorie & macro targets ─────────────────────────────────────────────────
// Replaces the old hard-coded 2000 kcal. Uses the Mifflin-St Jeor equation for
// BMR, an activity multiplier for TDEE, then a goal-driven adjustment.
//
// BMR sex constant: male +5, female -161 (Mifflin-St Jeor). When sex is unknown
// we fall back to the midpoint offset -78, which sits within ~80 kcal of either
// estimate — fine for an editable target.
const SEX_OFFSET: Record<string, number> = { male: 5, female: -161 };
const NEUTRAL_SEX_OFFSET = -78;

// Activity multipliers (TDEE = BMR × factor). Defaults to 'light'/1.45-ish when
// the user hasn't picked one.
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};
const DEFAULT_ACTIVITY_FACTOR = 1.45;

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Sedentary', hint: 'Little / no exercise' },
  { value: 'light', label: 'Light', hint: '1–3 days/week' },
  { value: 'moderate', label: 'Moderate', hint: '3–5 days/week' },
  { value: 'active', label: 'Active', hint: '6–7 days/week' },
  { value: 'very_active', label: 'Very active', hint: 'Hard daily / physical job' },
];

export const SEX_OPTIONS: { value: 'male' | 'female'; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const DEFAULT_TARGETS: CalorieTargets = {
  calories: 2000,
  protein: 100,
  carbs: 225,
  fat: 67,
  estimated: false,
};

export interface CalorieTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** true when derived from the user's vitals; false for the generic fallback. */
  estimated: boolean;
}

export type HealthGoalType =
  | 'build_strength'
  | 'lose_weight'
  | 'gain_endurance'
  | 'improve_sleep'
  | 'reduce_stress'
  | 'maintain';

// Selectable health goals (label + value). Shared by the day-3 onboarding and
// the vitals editor so both offer the same set. Only some shift the calorie
// target (see GOAL_TUNING); the rest are calorie-neutral (1.0×).
export const GOAL_OPTIONS: { value: HealthGoalType; label: string }[] = [
  { value: 'build_strength', label: 'Build strength' },
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'gain_endurance', label: 'Gain endurance' },
  { value: 'improve_sleep', label: 'Improve sleep' },
  { value: 'reduce_stress', label: 'Reduce stress' },
  { value: 'maintain', label: 'Maintain' },
];

// How a goal shifts TDEE and how much protein (g per kg bodyweight) it wants.
const GOAL_TUNING: Record<HealthGoalType, { calorieFactor: number; proteinPerKg: number }> = {
  lose_weight:    { calorieFactor: 0.82, proteinPerKg: 1.8 }, // ~18% deficit, protein-sparing
  build_strength: { calorieFactor: 1.10, proteinPerKg: 1.8 }, // lean surplus
  gain_endurance: { calorieFactor: 1.05, proteinPerKg: 1.6 },
  improve_sleep:  { calorieFactor: 1.0,  proteinPerKg: 1.4 },
  reduce_stress:  { calorieFactor: 1.0,  proteinPerKg: 1.4 },
  maintain:       { calorieFactor: 1.0,  proteinPerKg: 1.6 },
};

/**
 * Daily calorie + macro targets from the user's vitals and goal. Returns the
 * generic fallback (flagged `estimated: false`) when weight/height/age are
 * missing so the UI always has something sane to render.
 *
 * `sex` and `activityLevel` sharpen the estimate when known; both degrade
 * gracefully (sex-neutral offset, ~1.45 activity factor) when absent.
 * `activityMultiplier` overrides `activityLevel` when supplied (used by tests).
 */
export function calorieTargets(input: {
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  goalType?: string | null;
  sex?: string | null;
  activityLevel?: string | null;
  activityMultiplier?: number;
}): CalorieTargets {
  const { weightKg, heightCm, age, goalType, sex, activityLevel } = input;
  if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return { ...DEFAULT_TARGETS };
  }

  const activity =
    input.activityMultiplier ??
    (activityLevel ? ACTIVITY_FACTOR[activityLevel as ActivityLevel] ?? DEFAULT_ACTIVITY_FACTOR : DEFAULT_ACTIVITY_FACTOR);
  const offset = sex ? SEX_OFFSET[sex] ?? NEUTRAL_SEX_OFFSET : NEUTRAL_SEX_OFFSET;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + offset;
  const tdee = bmr * activity;

  const tuning = GOAL_TUNING[(goalType as HealthGoalType) ?? 'maintain'] ?? GOAL_TUNING.maintain;
  // Sex-aware safe floor — never recommend below the standard minimum: ~1500
  // kcal for men, ~1200 for women (and the sex-neutral case).
  const floor = sex === 'male' ? 1500 : 1200;
  const calories = Math.max(floor, Math.round((tdee * tuning.calorieFactor) / 10) * 10);

  const protein = Math.round(tuning.proteinPerKg * weightKg);
  const fat = Math.round((calories * 0.25) / 9); // 25% of energy from fat
  // Remaining energy → carbs. Guard against a negative when protein+fat are high.
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat, estimated: true };
}
