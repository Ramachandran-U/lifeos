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
