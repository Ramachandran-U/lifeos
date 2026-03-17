import { MealSuggestion, BloodReportResult, FoodRecognition } from '../types';

export const MOCK_MEAL_SUGGESTION: MealSuggestion = {
  meals: [
    {
      name: 'Grilled Chicken Salad with Quinoa',
      calories: 480,
      protein: 38,
      carbs: 42,
      fat: 16,
      description: 'Mixed greens with grilled chicken breast, quinoa, cherry tomatoes, cucumber, and olive oil dressing',
    },
    {
      name: 'Greek Yoghurt Parfait',
      calories: 320,
      protein: 24,
      carbs: 36,
      fat: 8,
      description: 'Plain Greek yoghurt layered with mixed berries, granola, and a drizzle of honey',
    },
    {
      name: 'Salmon with Roasted Vegetables',
      calories: 520,
      protein: 42,
      carbs: 28,
      fat: 24,
      description: 'Baked salmon fillet with roasted broccoli, sweet potato, and a lemon herb sauce',
    },
  ],
};

export const MOCK_FOOD_RECOGNITION: FoodRecognition = {
  items: [
    { name: 'Grilled Chicken Breast', quantity: '1 piece (~150g)', quantityG: 150, calories: 248, protein: 46, carbs: 0, fat: 5 },
    { name: 'Brown Rice', quantity: '1 cup (~195g)', quantityG: 195, calories: 216, protein: 5, carbs: 45, fat: 2 },
    { name: 'Steamed Broccoli', quantity: '1 cup (~91g)', quantityG: 91, calories: 31, protein: 3, carbs: 6, fat: 0 },
  ],
};

export const MOCK_BLOOD_REPORT: BloodReportResult = {
  markers: [
    { marker: 'Haemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13.5-17.5', status: 'normal' },
    { marker: 'Vitamin D', value: 18, unit: 'ng/mL', referenceRange: '30-100', status: 'low' },
    { marker: 'Total Cholesterol', value: 210, unit: 'mg/dL', referenceRange: '<200', status: 'high' },
    { marker: 'Fasting Glucose', value: 92, unit: 'mg/dL', referenceRange: '70-100', status: 'normal' },
    { marker: 'TSH', value: 2.1, unit: 'mIU/L', referenceRange: '0.4-4.0', status: 'normal' },
    { marker: 'Vitamin B12', value: 380, unit: 'pg/mL', referenceRange: '200-900', status: 'normal' },
    { marker: 'Iron', value: 65, unit: 'mcg/dL', referenceRange: '60-170', status: 'normal' },
  ],
  summary: 'Most markers are within normal range. Vitamin D is low, which is common and easily addressable. Total cholesterol is slightly elevated — worth monitoring with dietary adjustments.',
  suggestions: [
    'Start a Vitamin D3 supplement (2000-4000 IU daily) and get 15 min of morning sunlight',
    'Increase omega-3 intake with fatty fish 2-3x per week to help with cholesterol',
    'Add more soluble fibre (oats, beans, fruits) to help lower LDL cholesterol',
    'Retest Vitamin D and cholesterol in 3 months to track improvement',
  ],
};
