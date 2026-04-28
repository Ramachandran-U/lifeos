import { CategorizeMerchantSchema, type CategorizeMerchantResult, type TransactionCategory } from '@/ai/types';
import { categorizeMerchant } from '@/ai/functions';
import { schemaValid, check } from '../grader';
import type { EvalSuite, Grader } from '../types';

interface Input {
  merchant: string;
  amountRupees: number;
  expected: TransactionCategory;
}

const accuracyGrader: Grader<CategorizeMerchantResult> = (out, input) => {
  const expected = (input as Input).expected;
  return {
    name: `accuracy(expected=${expected})`,
    passed: out.category === expected,
    detail: out.category === expected ? '' : `got ${out.category}`,
  };
};

// Schema-level grader always passes; accuracy grader is informational in mock mode
// (mock returns 'other' for everything). Threshold below treats schema as required.
// In live mode, set EVAL_REAL=true and bump the threshold to enforce accuracy.
const suite: EvalSuite<Input, CategorizeMerchantResult> = {
  name: 'categorizeMerchant',
  threshold: 1.0, // schema must always pass; accuracy reported separately
  run: ({ merchant, amountRupees }) => categorizeMerchant(merchant, amountRupees),
  cases: [
    { name: 'swiggy', input: { merchant: 'SWIGGY', amountRupees: 450, expected: 'food_delivery' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'zomato', input: { merchant: 'ZOMATO', amountRupees: 380, expected: 'food_delivery' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'bigbasket', input: { merchant: 'BIGBASKET', amountRupees: 2200, expected: 'groceries' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'uber', input: { merchant: 'UBER INDIA', amountRupees: 280, expected: 'transport' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'indianoil', input: { merchant: 'INDIAN OIL CORP', amountRupees: 2500, expected: 'fuel' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'amazon', input: { merchant: 'AMAZON.IN', amountRupees: 1899, expected: 'shopping' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'netflix', input: { merchant: 'NETFLIX', amountRupees: 649, expected: 'subscriptions' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'tata-power', input: { merchant: 'TATA POWER', amountRupees: 3200, expected: 'utilities' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'apollo', input: { merchant: 'APOLLO PHARMACY', amountRupees: 540, expected: 'health' }, graders: [schemaValid(CategorizeMerchantSchema)] },
    { name: 'zerodha', input: { merchant: 'ZERODHA BROKING', amountRupees: 25000, expected: 'investments' }, graders: [schemaValid(CategorizeMerchantSchema)] },
  ],
};

// In live mode, append accuracy grader to every case.
if (process.env.EVAL_REAL === 'true') {
  for (const c of suite.cases) c.graders.push(accuracyGrader);
  suite.threshold = 0.7; // expect ≥70% accuracy from a real LLM call
}

export default suite;
