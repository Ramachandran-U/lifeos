import {
  CURRENCIES,
  ACTIVE_CURRENCY,
  getCurrency,
  formatMoneyCompact,
  formatMoney,
  parseMoneyInput,
  formatIncomeBracketLabel,
} from '@/utils/currency';

// Money logic feeds the Finance tab and onboarding day-7. Bugs here mis-state
// real targets/savings, so the boundaries are pinned explicitly.

describe('getCurrency / ACTIVE_CURRENCY', () => {
  it('defaults to the app-wide active currency (INR)', () => {
    expect(ACTIVE_CURRENCY).toBe('INR');
    expect(getCurrency().code).toBe('INR');
    expect(getCurrency().symbol).toBe('₹');
  });

  it('resolves an explicit currency code', () => {
    expect(getCurrency('USD').symbol).toBe('$');
    expect(getCurrency('EUR').symbol).toBe('€');
    expect(getCurrency('GBP').symbol).toBe('£');
  });

  it('every configured currency has presets and a symbol', () => {
    (Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>).forEach((code) => {
      const cfg = CURRENCIES[code];
      expect(cfg.symbol.length).toBeGreaterThan(0);
      expect(cfg.targetPresets.length).toBeGreaterThan(0);
      expect(cfg.savingsPresets.length).toBeGreaterThan(0);
    });
  });
});

describe('formatMoneyCompact — INR (lakh/crore)', () => {
  it.each([
    [0, '₹0'],
    [999, '₹999'],
    [5_000, '₹5K'],
    [1_000_000, '₹10L'],      // 10 lakh
    [20_000_000, '₹2.0Cr'],   // 2 crore (1 decimal below 100Cr)
    [150_000_000, '₹15Cr'],   // 15 crore (no decimal at/above 100Cr range)
  ])('formats %d as %s', (amount, expected) => {
    expect(formatMoneyCompact(amount)).toBe(expected);
  });

  it('returns ₹0 for non-finite input', () => {
    expect(formatMoneyCompact(Number.NaN)).toBe('₹0');
    expect(formatMoneyCompact(Number.POSITIVE_INFINITY)).toBe('₹0');
  });
});

describe('formatMoneyCompact — non-INR (millions)', () => {
  it.each([
    [999, '$999'],
    [5_000, '$5K'],
    [1_500_000, '$1.5M'],
  ])('formats %d USD as %s', (amount, expected) => {
    expect(formatMoneyCompact(amount, 'USD')).toBe(expected);
  });
});

describe('formatMoney — full grouped value', () => {
  it('prefixes the active symbol and preserves the integer value', () => {
    const out = formatMoney(1_250_000); // ICU grouping varies, so assert robustly
    expect(out.startsWith('₹')).toBe(true);
    expect(out.replace(/[^\d]/g, '')).toBe('1250000');
  });

  it('uses the requested currency symbol', () => {
    expect(formatMoney(1000, 'USD').startsWith('$')).toBe(true);
  });
});

describe('parseMoneyInput', () => {
  it('strips symbols/commas and returns the number', () => {
    expect(parseMoneyInput('₹12,50,000')).toBe(1_250_000);
    expect(parseMoneyInput('$1,000')).toBe(1000);
    expect(parseMoneyInput('12.5')).toBe(12.5);
  });

  it('returns 0 for empty, garbage, or negative input', () => {
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput('abc')).toBe(0);
    expect(parseMoneyInput('-5')).toBe(0);
  });
});

describe('formatIncomeBracketLabel', () => {
  it('renders an open-ended (max:null) bracket with a trailing +', () => {
    expect(formatIncomeBracketLabel({ min: 10_000_000, max: null })).toBe('₹1.0Cr+');
  });

  it('renders a zero-floor bracket as "Under …"', () => {
    expect(formatIncomeBracketLabel({ min: 0, max: 600_000 })).toBe('Under ₹6.0L');
  });

  it('renders a mid bracket as a range', () => {
    expect(formatIncomeBracketLabel({ min: 600_000, max: 1_200_000 })).toBe('₹6.0L – ₹12L');
  });
});
