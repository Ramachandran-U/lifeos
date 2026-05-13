/**
 * Currency formatting. Scoped for multi-currency later — for now the whole
 * app is INR, but every call site goes through this module so adding
 * USD/EUR/etc. means updating `CURRENCIES` and a user preference, not
 * grepping every screen.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';

interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  /** Ranges shown as suggestion chips for "target amount" and "monthly savings". */
  targetPresets: number[];
  savingsPresets: number[];
  /** Income brackets keyed by id — labels are currency-localised. */
  incomeBrackets: Array<{ value: string; min: number; max: number | null }>;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN',
    targetPresets: [500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000],
    savingsPresets: [10_000, 25_000, 50_000, 100_000, 200_000],
    incomeBrackets: [
      { value: 'under_6lpa',   min: 0,         max: 600_000 },
      { value: '6_12lpa',      min: 600_000,   max: 1_200_000 },
      { value: '12_25lpa',     min: 1_200_000, max: 2_500_000 },
      { value: '25_50lpa',     min: 2_500_000, max: 5_000_000 },
      { value: '50_100lpa',    min: 5_000_000, max: 10_000_000 },
      { value: '100lpa_plus',  min: 10_000_000, max: null },
    ],
  },
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    targetPresets: [25_000, 50_000, 100_000, 250_000, 500_000],
    savingsPresets: [500, 1_000, 2_000, 3_000, 5_000],
    incomeBrackets: [
      { value: 'under_30k',  min: 0,       max: 30_000 },
      { value: '30k_50k',    min: 30_000,  max: 50_000 },
      { value: '50k_75k',    min: 50_000,  max: 75_000 },
      { value: '75k_100k',   min: 75_000,  max: 100_000 },
      { value: '100k_150k',  min: 100_000, max: 150_000 },
      { value: '150k_plus',  min: 150_000, max: null },
    ],
  },
  EUR: { code: 'EUR', symbol: '€', locale: 'en-IE', targetPresets: [25_000, 50_000, 100_000, 250_000, 500_000], savingsPresets: [500, 1_000, 2_000, 3_000, 5_000], incomeBrackets: [] },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', targetPresets: [25_000, 50_000, 100_000, 250_000, 500_000], savingsPresets: [500, 1_000, 2_000, 3_000, 5_000], incomeBrackets: [] },
  AED: { code: 'AED', symbol: 'AED ', locale: 'en-AE', targetPresets: [100_000, 250_000, 500_000, 1_000_000, 2_500_000], savingsPresets: [2_000, 5_000, 10_000, 15_000, 25_000], incomeBrackets: [] },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG', targetPresets: [50_000, 100_000, 250_000, 500_000, 1_000_000], savingsPresets: [1_000, 2_500, 5_000, 10_000, 15_000], incomeBrackets: [] },
};

// Single source of truth for the app's active currency. When a user
// preference is added later, read it here instead of hard-coding.
export const ACTIVE_CURRENCY: CurrencyCode = 'INR';

export function getCurrency(code: CurrencyCode = ACTIVE_CURRENCY): CurrencyConfig {
  return CURRENCIES[code];
}

/** Compact notation for numbers (₹12.5L, ₹1.2Cr). INR-aware. */
export function formatMoneyCompact(amount: number, code: CurrencyCode = ACTIVE_CURRENCY): string {
  const cfg = getCurrency(code);
  if (!Number.isFinite(amount)) return `${cfg.symbol}0`;
  const abs = Math.abs(amount);
  if (code === 'INR') {
    if (abs >= 1e7) return `${cfg.symbol}${(amount / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
    if (abs >= 1e5) return `${cfg.symbol}${(amount / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
    if (abs >= 1000) return `${cfg.symbol}${(amount / 1000).toFixed(0)}K`;
    return `${cfg.symbol}${amount.toLocaleString(cfg.locale, { maximumFractionDigits: 0 })}`;
  }
  if (abs >= 1e6) return `${cfg.symbol}${(amount / 1e6).toFixed(1)}M`;
  if (abs >= 1000) return `${cfg.symbol}${(amount / 1000).toFixed(0)}K`;
  return `${cfg.symbol}${amount.toLocaleString(cfg.locale, { maximumFractionDigits: 0 })}`;
}

/** Full value with locale-aware grouping (₹12,50,000). */
export function formatMoney(amount: number, code: CurrencyCode = ACTIVE_CURRENCY): string {
  const cfg = getCurrency(code);
  return `${cfg.symbol}${amount.toLocaleString(cfg.locale, { maximumFractionDigits: 0 })}`;
}

/** Strip currency symbols/commas/spaces and return a finite number or 0. */
export function parseMoneyInput(raw: string): number {
  if (!raw) return 0;
  const n = Number.parseFloat(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function formatIncomeBracketLabel(
  bracket: { min: number; max: number | null },
  code: CurrencyCode = ACTIVE_CURRENCY,
): string {
  const lo = formatMoneyCompact(bracket.min, code);
  if (bracket.max === null) return `${lo}+`;
  const hi = formatMoneyCompact(bracket.max, code);
  return bracket.min === 0 ? `Under ${hi}` : `${lo} – ${hi}`;
}
