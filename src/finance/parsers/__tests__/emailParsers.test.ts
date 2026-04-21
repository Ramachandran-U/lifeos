import {
  parseHdfc,
  parseIcici,
  parseAxis,
  detectSource,
  parseTransactionEmail,
} from '../emailParsers';

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
