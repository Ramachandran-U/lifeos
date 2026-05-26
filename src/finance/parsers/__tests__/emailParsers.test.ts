import {
  parseHdfc,
  parseIcici,
  parseAxis,
  detectSource,
  parseTransactionEmail,
  normalizeUpiMerchant,
} from '../emailParsers';

describe('normalizeUpiMerchant', () => {
  it('extracts the tail name + p2a channel for person-to-account UPI', () => {
    const out = normalizeUpiMerchant('UPI/P2A/812943987621/ANJALI HARI');
    expect(out.channel).toBe('p2a');
    expect(out.merchant).toBe('ANJALI HARI');
  });

  it('extracts the tail name + p2m channel for person-to-merchant UPI', () => {
    const out = normalizeUpiMerchant('UPI/P2M/647451728232/TONI AND GUY');
    expect(out.channel).toBe('p2m');
    expect(out.merchant).toBe('TONI AND GUY');
  });

  it('strips the "not initiated by you" boilerplate tail', () => {
    const out = normalizeUpiMerchant(
      'UPI/P2M/138042056437/RAMESH TALAWAR If this transaction was not initiated by you, call us.',
    );
    expect(out.merchant).toBe('RAMESH TALAWAR');
    expect(out.channel).toBe('p2m');
  });

  it('drops the unique RRN so two transactions to the same payee share a merchant key', () => {
    const a = normalizeUpiMerchant('UPI/P2M/111111111111/SWIGGY');
    const b = normalizeUpiMerchant('UPI/P2M/222222222222/SWIGGY');
    expect(a.merchant).toBe(b.merchant);
  });

  it('returns no channel for a plain merchant string', () => {
    const out = normalizeUpiMerchant('AMAZON PAY');
    expect(out.channel).toBeUndefined();
    expect(out.merchant).toBe('AMAZON PAY');
  });
});

describe('detectSource', () => {
  it.each([
    ['alerts@hdfcbank.net', 'hdfc'],
    ['no-reply@icicibank.com', 'icici'],
    ['notifications@axisbank.com', 'axis'],
  ])('maps %s → %s', (from, expected) => {
    expect(detectSource(from)).toBe(expected);
  });

  it('returns null for unknown senders', () => {
    expect(detectSource('random@example.com')).toBeNull();
  });
});

describe('parseHdfc', () => {
  it('parses a real HDFC credit-card InstaAlert (towards MERCHANT on DATE at TIME)', () => {
    const body = `Dear Customer,

Greetings from HDFC Bank!

Rs.277.00 is debited from your HDFC Bank Credit Card ending 4834 towards PYU*Swiggy Food on 08 Apr, 2026 at 19:19:23.

To know your available balance, outstanding amount and transactions in detail, please visit MyCards.`;
    const out = parseHdfc(body)!;
    expect(out).toBeTruthy();
    expect(out.direction).toBe('debit');
    expect(out.amount).toBe(27700);
    expect(out.merchant).toBe('PYU*Swiggy Food');
  });

  it('parses a debit with merchant and ref', () => {
    const body = 'Rs. 1,250.50 has been debited from A/c XX1234 to AMAZON PAY on 2026-04-20. UPI-Ref-No 4567891234';
    const out = parseHdfc(body)!;
    expect(out.direction).toBe('debit');
    expect(out.amount).toBe(125050);
    expect(out.merchant).toBe('AMAZON PAY');
    expect(out.refId).toBe('4567891234');
  });

  it('parses a credit', () => {
    const body = 'Rs. 500 has been credited to A/c XX1234 from JOHN DOE on 2026-04-20.';
    const out = parseHdfc(body)!;
    expect(out.direction).toBe('credit');
    expect(out.amount).toBe(50000);
  });

  it('handles lakh-scale amounts with multiple comma groups', () => {
    const out = parseHdfc('Rs. 1,25,000.00 has been debited from A/c XX1234 to BUILDER PAYMENTS on 2026-04-20.')!;
    expect(out.amount).toBe(12500000); // ₹1,25,000 → paise
    expect(out.direction).toBe('debit');
  });

  it('rounds fractional paise correctly', () => {
    const out = parseHdfc('Rs. 99.99 has been debited from A/c XX1234 to APP STORE on 2026-04-20.')!;
    expect(out.amount).toBe(9999);
  });

  it('returns null on non-matching body', () => {
    expect(parseHdfc('unrelated email content')).toBeNull();
  });
});

describe('parseIcici', () => {
  it('parses INR debit', () => {
    const body = 'INR 899.00 debited at SWIGGY on 20-04-2026. Ref No 889922';
    const out = parseIcici(body)!;
    expect(out.direction).toBe('debit');
    expect(out.amount).toBe(89900);
    expect(out.merchant).toBe('SWIGGY');
    expect(out.refId).toBe('889922');
  });

  it('falls back to Unknown merchant with lower confidence', () => {
    const body = 'INR 100 debited. All good.';
    const out = parseIcici(body)!;
    expect(out.merchant).toBe('Unknown');
    expect(out.confidence).toBeLessThan(0.8);
  });
});

describe('parseAxis', () => {
  it('parses Axis debit with txn id', () => {
    const body = 'Rs. 2,000 debited at UBER on 20/04. Transaction ID: AX789456';
    const out = parseAxis(body)!;
    expect(out.direction).toBe('debit');
    expect(out.amount).toBe(200000);
    expect(out.merchant).toBe('UBER');
    expect(out.refId).toBe('AX789456');
  });
});

describe('parseTransactionEmail dispatcher', () => {
  it('routes HDFC email to HDFC parser', () => {
    const out = parseTransactionEmail(
      'alerts@hdfcbank.net',
      'Rs. 100 debited from A/c XX1234 to ZOMATO on 2026-04-20.',
    );
    expect(out?.source).toBe('hdfc');
    expect(out?.merchant).toBe('ZOMATO');
  });

  it('returns null for unknown source', () => {
    expect(parseTransactionEmail('spam@evil.com', 'Rs. 100 debited')).toBeNull();
  });

  it('returns null if amount is zero', () => {
    expect(parseTransactionEmail('alerts@hdfcbank.net', 'nothing matches here')).toBeNull();
  });
});
