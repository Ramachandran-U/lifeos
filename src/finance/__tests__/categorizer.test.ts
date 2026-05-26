import { normalizeMerchantForCache, categorizeByRule } from '../categorizer';
import type { TransactionCategory } from '@/ai/types';

describe('normalizeMerchantForCache', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeMerchantForCache('  Swiggy   Foods  ')).toBe('swiggy foods');
  });

  it('strips channel prefixes (UPI / IMPS / NEFT / RTGS)', () => {
    expect(normalizeMerchantForCache('UPI/Swiggy')).toBe('swiggy');
    expect(normalizeMerchantForCache('IMPS-Amazon Pay')).toBe('amazon pay');
    expect(normalizeMerchantForCache('NEFT: Landlord')).toBe('landlord');
  });

  it('removes long digit runs (ref numbers)', () => {
    expect(normalizeMerchantForCache('Swiggy 123456789')).toBe('swiggy');
    // short numbers are kept (could be meaningful, e.g. "7 eleven")
    expect(normalizeMerchantForCache('7 Eleven')).toBe('7 eleven');
  });

  it('removes timestamps', () => {
    expect(normalizeMerchantForCache('ZOMATO 19:19:23')).toBe('zomato');
    expect(normalizeMerchantForCache('UBER 20-04-2026')).toBe('uber');
  });

  it('strips punctuation but preserves ampersand', () => {
    expect(normalizeMerchantForCache('Toni & Guy!!!')).toBe('toni & guy');
    expect(normalizeMerchantForCache('AMAZON.PAY*IN')).toBe('amazon pay in');
  });

  it('collapses two raw variants of the same merchant to one key', () => {
    const a = normalizeMerchantForCache('UPI/123456789/Swiggy Pvt Ltd');
    const b = normalizeMerchantForCache('swiggy pvt ltd');
    expect(a).toBe(b);
  });
});

describe('categorizeByRule', () => {
  const cases: Array<[string, TransactionCategory]> = [
    ['Swiggy order', 'food_delivery'],
    ['ZOMATO', 'food_delivery'],
    ['BigBasket', 'groceries'],
    ['Zepto Instamart', 'groceries'],
    ['Dominos Pizza', 'dining_out'],
    ['Ola cabs', 'transport'],
    ['IRCTC ticket', 'transport'],
    ['HPCL fuel', 'fuel'],
    ['Netflix monthly', 'subscriptions'],
    ['BookMyShow', 'entertainment'],
    ['Amazon retail', 'shopping'],
    ['Airtel postpaid', 'utilities'],
    ['Rent to landlord', 'rent'],
    ['Apollo Pharmacy', 'health'],
    ['Coursera subscription', 'education'],
    ['MakeMyTrip flight', 'travel'],
    ['Zerodha brokerage', 'investments'],
    ['HDFC Life premium', 'insurance'],
    ['Monthly Salary credit', 'income'],
    ['ATM cash withdrawal', 'cash_withdrawal'],
    ['Lakme Salon', 'personal_care'],
    ['GST service charge', 'fees_charges'],
  ];

  it.each(cases)('classifies "%s" as %s', (merchant, expected) => {
    expect(categorizeByRule(merchant)).toBe(expected);
  });

  it('returns null when no rule matches', () => {
    expect(categorizeByRule('Totally Unknown Merchant XYZ')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(categorizeByRule('swiggy')).toBe('food_delivery');
    expect(categorizeByRule('SWIGGY')).toBe('food_delivery');
  });

  it('matches the first rule when a merchant could hit several (deterministic order)', () => {
    // "reliance fresh" is in groceries; "reliance digital" in shopping; "reliance petrol" in fuel.
    // Each should resolve to its own bucket without bleed.
    expect(categorizeByRule('reliance fresh')).toBe('groceries');
    expect(categorizeByRule('reliance digital')).toBe('shopping');
    expect(categorizeByRule('reliance petrol')).toBe('fuel');
  });
});
