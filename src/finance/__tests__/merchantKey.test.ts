import { normalizeMerchantForCache } from '@/finance/merchantKey';

describe('normalizeMerchantForCache', () => {
  it('collapses case and surrounding whitespace to one key', () => {
    const a = normalizeMerchantForCache('Swiggy');
    expect(normalizeMerchantForCache('swiggy')).toBe(a);
    expect(normalizeMerchantForCache('  SWIGGY  ')).toBe(a);
    expect(a).toBe('swiggy');
  });

  it('strips a leading UPI/IMPS/NEFT/RTGS channel prefix', () => {
    expect(normalizeMerchantForCache('UPI/Swiggy')).toBe('swiggy');
    expect(normalizeMerchantForCache('IMPS-Swiggy')).toBe('swiggy');
  });

  it('drops long reference-number digit runs so the same payee dedupes', () => {
    expect(normalizeMerchantForCache('UPI/123456789/Swiggy Pvt Ltd')).toBe(
      normalizeMerchantForCache('swiggy pvt ltd'),
    );
    // The canonical P2P example: noisy UPI label collapses to the person.
    expect(normalizeMerchantForCache('UPI/123456789/ANJALI HARI')).toBe(
      normalizeMerchantForCache('Anjali Hari'),
    );
  });

  it('removes embedded timestamps', () => {
    expect(normalizeMerchantForCache('Cafe 12:30:45')).toBe('cafe');
  });

  it('strips punctuation but keeps ampersands and alphanumerics', () => {
    expect(normalizeMerchantForCache('Tom & Jerry!!')).toBe('tom & jerry');
    expect(normalizeMerchantForCache('Amazon.in')).toBe('amazon in');
  });

  it('handles an empty / punctuation-only string without throwing', () => {
    expect(normalizeMerchantForCache('')).toBe('');
    expect(normalizeMerchantForCache('   ')).toBe('');
    expect(normalizeMerchantForCache('!!!')).toBe('');
  });
});
