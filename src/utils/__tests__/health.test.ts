import { calculateBMI, bmiCategory, weightTrend, summarizeVitals } from '../health';

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
