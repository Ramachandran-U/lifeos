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
// We do NOT store biological sex yet (the users table has age + height only),
// so we use the sex-neutral midpoint of Mifflin-St Jeor: the male constant is
// +5 and the female constant is -161, so the average offset is -78. This sits
// within ~80 kcal of either sex's estimate — good enough for a target the user
// can edit, and avoids a schema migration. (Adding `sex` for an exact figure is
// tracked in the health backlog.)
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
 * Activity multiplier defaults to 1.45 (lightly-to-moderately active). We don't
 * collect an activity level yet; surfacing one is in the backlog.
 */
export function calorieTargets(input: {
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  goalType?: string | null;
  activityMultiplier?: number;
}): CalorieTargets {
  const { weightKg, heightCm, age, goalType } = input;
  if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return { ...DEFAULT_TARGETS };
  }

  const activity = input.activityMultiplier ?? 1.45;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78; // sex-neutral
  const tdee = bmr * activity;

  const tuning = GOAL_TUNING[(goalType as HealthGoalType) ?? 'maintain'] ?? GOAL_TUNING.maintain;
  // Floor at 1200 kcal — never recommend a target below a safe minimum.
  const calories = Math.max(1200, Math.round((tdee * tuning.calorieFactor) / 10) * 10);

  const protein = Math.round(tuning.proteinPerKg * weightKg);
  const fat = Math.round((calories * 0.25) / 9); // 25% of energy from fat
  // Remaining energy → carbs. Guard against a negative when protein+fat are high.
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat, estimated: true };
}
