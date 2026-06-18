import { formatInr, prettyCategory, categoryColor, CATEGORY_COLORS } from '@/finance/display';

describe('formatInr', () => {
  it('renders paise as ₹ rupees with no decimals', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(10000)).toBe('₹100'); // 10000 paise = ₹100
  });

  it('uses Indian digit grouping (lakh/crore), not Western thousands', () => {
    // 12345600 paise = ₹123456 → "1,23,456" in en-IN (not "123,456").
    expect(formatInr(12345600)).toBe('₹1,23,456');
  });

  it('rounds to whole rupees', () => {
    expect(formatInr(12340)).toBe('₹123'); // 123.40 → 123
    expect(formatInr(12380)).toBe('₹124'); // 123.80 → 124
  });

  it('handles negative amounts (refunds / cashback) without crashing', () => {
    expect(formatInr(-50000)).toBe('₹-500');
  });
});

describe('prettyCategory', () => {
  it('title-cases snake_case category keys', () => {
    expect(prettyCategory('food_delivery')).toBe('Food Delivery');
    expect(prettyCategory('fees_charges')).toBe('Fees Charges');
    expect(prettyCategory('rent')).toBe('Rent');
  });
});

describe('categoryColor', () => {
  it('returns the mapped colour for a known category', () => {
    expect(categoryColor('groceries', '#000')).toBe(CATEGORY_COLORS.groceries);
  });

  it('falls back for an unknown category instead of returning undefined', () => {
    expect(categoryColor('not_a_category', '#888')).toBe('#888');
    expect(categoryColor('', '#888')).toBe('#888');
  });

  it('every TransactionCategory key has a colour (no missing entries)', () => {
    for (const [key, value] of Object.entries(CATEGORY_COLORS)) {
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      // round-trips through the lookup
      expect(categoryColor(key, '#fallback')).toBe(value);
    }
  });
});
