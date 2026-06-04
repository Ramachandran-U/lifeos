import { calculateBMI, bmiCategory, weightTrend, summarizeVitals, calorieTargets } from '../health';

describe('calculateBMI', () => {
  it('computes BMI from kg and cm', () => {
    expect(calculateBMI(70, 175)).toBeCloseTo(22.9, 1);
  });
  it('returns 0 for invalid inputs', () => {
    expect(calculateBMI(0, 170)).toBe(0);
    expect(calculateBMI(70, 0)).toBe(0);
  });
});

describe('bmiCategory', () => {
  it('classifies bands', () => {
    expect(bmiCategory(17)).toBe('underweight');
    expect(bmiCategory(22)).toBe('healthy');
    expect(bmiCategory(27)).toBe('overweight');
    expect(bmiCategory(32)).toBe('obese');
  });
  it('handles boundaries', () => {
    expect(bmiCategory(18.5)).toBe('healthy');
    expect(bmiCategory(25)).toBe('overweight');
    expect(bmiCategory(30)).toBe('obese');
  });
});

describe('weightTrend', () => {
  it('returns nulls for empty logs', () => {
    expect(weightTrend([])).toEqual({ latest: null, delta: null, direction: null });
  });
  it('returns latest with no delta for single entry', () => {
    const r = weightTrend([{ date: '2026-01-01', weight: 70 }]);
    expect(r.latest).toBe(70);
    expect(r.delta).toBeNull();
  });
  it('detects downward trend', () => {
    const r = weightTrend([
      { date: '2026-01-01', weight: 75 },
      { date: '2026-01-08', weight: 74 },
    ]);
    expect(r.direction).toBe('down');
    expect(r.delta).toBe(-1);
  });
  it('detects flat trend for tiny change', () => {
    const r = weightTrend([
      { date: '2026-01-01', weight: 70 },
      { date: '2026-01-08', weight: 70.1 },
    ]);
    expect(r.direction).toBe('flat');
  });
});

describe('summarizeVitals', () => {
  it('prompts when vitals missing', () => {
    const r = summarizeVitals({});
    expect(r.bmi).toBeNull();
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
  it('summarises a healthy user', () => {
    const r = summarizeVitals({ weightKg: 70, heightCm: 175, trendDirection: 'flat' });
    expect(r.category).toBe('healthy');
    expect(r.bmi).toBeCloseTo(22.9, 1);
  });
  it('flags overweight with up trend', () => {
    const r = summarizeVitals({ weightKg: 90, heightCm: 175, trendDirection: 'up' });
    expect(r.category).toBe('overweight');
    expect(r.suggestions.some((s) => /calorie/i.test(s))).toBe(true);
  });
});

describe('calorieTargets', () => {
  it('falls back to the generic 2000 target when vitals are missing', () => {
    const r = calorieTargets({ weightKg: null, heightCm: null, age: null });
    expect(r.estimated).toBe(false);
    expect(r.calories).toBe(2000);
  });

  it('derives a maintenance target from vitals (sex-neutral Mifflin-St Jeor)', () => {
    // BMR = 10*75 + 6.25*178 - 5*30 - 78 = 1635; TDEE = 1635 * 1.45 ≈ 2371 → round to 2370
    const r = calorieTargets({ weightKg: 75, heightCm: 178, age: 30, goalType: 'maintain' });
    expect(r.estimated).toBe(true);
    expect(r.calories).toBe(2370);
    // protein 1.6 g/kg → 120g; fat 25% of energy; carbs fill the rest
    expect(r.protein).toBe(120);
    expect(r.fat).toBe(Math.round((2370 * 0.25) / 9));
    expect(r.carbs).toBe(Math.max(0, Math.round((2370 - 120 * 4 - r.fat * 9) / 4)));
  });

  it('applies a deficit for lose_weight and a surplus for build_strength', () => {
    const base = calorieTargets({ weightKg: 75, heightCm: 178, age: 30, goalType: 'maintain' });
    const cut = calorieTargets({ weightKg: 75, heightCm: 178, age: 30, goalType: 'lose_weight' });
    const bulk = calorieTargets({ weightKg: 75, heightCm: 178, age: 30, goalType: 'build_strength' });
    expect(cut.calories).toBeLessThan(base.calories);
    expect(bulk.calories).toBeGreaterThan(base.calories);
    // lose_weight pushes protein higher (1.8 g/kg) to spare muscle
    expect(cut.protein).toBe(Math.round(1.8 * 75));
  });

  it('never recommends below the 1200 kcal floor', () => {
    const r = calorieTargets({ weightKg: 40, heightCm: 150, age: 70, goalType: 'lose_weight' });
    expect(r.calories).toBeGreaterThanOrEqual(1200);
  });

  it('uses the exact male BMR constant + activity factor when provided', () => {
    // BMR = 10*75 + 6.25*178 - 5*30 + 5 = 1717.5; moderate 1.55 => 2662 -> 2660
    const r = calorieTargets({ weightKg: 75, heightCm: 178, age: 30, goalType: 'maintain', sex: 'male', activityLevel: 'moderate' });
    expect(r.calories).toBe(2660);
  });

  it('uses the female BMR constant', () => {
    // BMR = 1551.5; sedentary 1.2 => 1861.8 -> 1860
    const r = calorieTargets({ weightKg: 75, heightCm: 178, age: 30, goalType: 'maintain', sex: 'female', activityLevel: 'sedentary' });
    expect(r.calories).toBe(1860);
  });

  it('scales the target with activity level', () => {
    const base = { weightKg: 75, heightCm: 178, age: 30, goalType: 'maintain', sex: 'male' } as const;
    const sedentary = calorieTargets({ ...base, activityLevel: 'sedentary' });
    const active = calorieTargets({ ...base, activityLevel: 'active' });
    expect(active.calories).toBeGreaterThan(sedentary.calories);
  });

  // The "stuck at 2000 kcal" bug: age is required by Mifflin–St Jeor, so a
  // missing/invalid age must keep returning the generic fallback even when every
  // other vital is supplied.
  it('returns the generic 2000 fallback when age is missing or invalid', () => {
    const full = { weightKg: 75, heightCm: 178, sex: 'male', activityLevel: 'moderate' } as const;
    expect(calorieTargets({ ...full, age: null }).estimated).toBe(false);
    expect(calorieTargets({ ...full, age: null }).calories).toBe(2000);
    expect(calorieTargets({ ...full, age: 0 }).calories).toBe(2000);
    expect(calorieTargets({ ...full, age: -1 }).calories).toBe(2000);
  });

  it('moves off the generic 2000 once age is supplied, and lowers with age', () => {
    const base = { weightKg: 75, heightCm: 178, sex: 'male', activityLevel: 'moderate', goalType: 'maintain' } as const;
    const young = calorieTargets({ ...base, age: 25 });
    const older = calorieTargets({ ...base, age: 55 });
    expect(young.estimated).toBe(true);
    expect(young.calories).not.toBe(2000);
    // BMR loses 5 kcal per year of age → the older target is lower.
    expect(older.calories).toBeLessThan(young.calories);
  });

  it('floors men at 1500 kcal and women at 1200', () => {
    // Small/older/sedentary + a deficit would otherwise land below both floors.
    const base = { weightKg: 50, heightCm: 160, age: 70, activityLevel: 'sedentary', goalType: 'lose_weight' } as const;
    expect(calorieTargets({ ...base, sex: 'male' }).calories).toBe(1500);
    expect(calorieTargets({ ...base, sex: 'female' }).calories).toBe(1200);
  });
});
