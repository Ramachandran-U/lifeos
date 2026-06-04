import {
  parseBillOrSubscription,
  extractAmountPaise,
  findDueDate,
  extractMerchantFromSender,
} from '../billParsers';

describe('parseBillOrSubscription — subscriptions', () => {
  it('parses a Netflix renewal (amount + charge date + cadence)', () => {
    const out = parseBillOrSubscription(
      'Netflix <info@account.netflix.com>',
      'Your Netflix membership',
      'Your next payment of ₹649 will be charged on 15 Jun 2026. Your plan renews monthly.',
    );
    expect(out).toEqual({
      kind: 'subscription',
      merchant: 'Netflix',
      amount: 64900,
      dueDate: '2026-06-15',
      cadence: 'monthly',
      confidence: 1,
    });
  });

  it('parses a Spotify renewal with a day-first numeric date and /month cadence', () => {
    const out = parseBillOrSubscription(
      'Spotify <no-reply@spotify.com>',
      'Your Spotify Premium subscription renews soon',
      'Your subscription will renew on 20/06/2026 for Rs. 119/month.',
    );
    expect(out).toMatchObject({
      kind: 'subscription',
      merchant: 'Spotify',
      amount: 11900,
      dueDate: '2026-06-20',
      cadence: 'monthly',
    });
  });

  it('keeps a renewal reminder that has a date but no amount', () => {
    const out = parseBillOrSubscription(
      'Gold Gym <noreply@goldgym.com>',
      'Membership renewal reminder',
      'Your membership is due for renewal on 10 Jul 2026.',
    );
    expect(out).toMatchObject({ kind: 'subscription', amount: 0, dueDate: '2026-07-10' });
    expect(out?.confidence).toBeCloseTo(0.7, 5);
  });
});

describe('parseBillOrSubscription — bills', () => {
  it('parses a postpaid bill (labelled amount + due date)', () => {
    const out = parseBillOrSubscription(
      'Airtel <bills@airtel.com>',
      'Your Airtel bill is ready',
      'Your bill amount is Rs. 999. Due date: 28-06-2026.',
    );
    expect(out).toMatchObject({
      kind: 'bill',
      merchant: 'Airtel',
      amount: 99900,
      dueDate: '2026-06-28',
    });
    expect(out?.cadence).toBeUndefined();
  });

  it('parses an electricity bill ("amount payable" + "due by <text date>")', () => {
    const out = parseBillOrSubscription(
      'BESCOM <noreply@bescom.org>',
      'Electricity bill due',
      'Amount payable INR 1,540.00, payment due by 30 June 2026.',
    );
    expect(out).toMatchObject({ kind: 'bill', merchant: 'BESCOM', amount: 154000, dueDate: '2026-06-30' });
  });

  it('prefers "total amount due" over a nearby "minimum amount due"', () => {
    const out = parseBillOrSubscription(
      'HDFC Bank <statements@hdfcbank.net>',
      'Your credit card statement',
      'Total amount due Rs. 12,340.50, minimum amount due Rs. 620. Payment due date 05/07/2026.',
    );
    expect(out).toMatchObject({ kind: 'bill', amount: 1234050, dueDate: '2026-07-05' });
  });
});

describe('parseBillOrSubscription — rejects non-recurring noise', () => {
  it('returns null for a marketing email (no recurring keyword)', () => {
    expect(
      parseBillOrSubscription('Myntra <offers@myntra.com>', 'Mega Sale is live', 'Up to 70% off everything. Shop now!'),
    ).toBeNull();
  });

  it('returns null for a plain bank transaction alert (no recurring keyword)', () => {
    expect(
      parseBillOrSubscription(
        'alerts@hdfcbank.net',
        'Transaction alert',
        'Rs. 500 debited from your account at AMAZON on 01-06-2026.',
      ),
    ).toBeNull();
  });

  it('returns null when a recurring keyword has neither an amount nor a date', () => {
    expect(
      parseBillOrSubscription('Acme <a@acme.com>', 'Manage your subscription', 'You can manage your subscription anytime.'),
    ).toBeNull();
  });
});

describe('extractAmountPaise', () => {
  it('reads a labelled amount', () => {
    expect(extractAmountPaise('Total amount due Rs. 1,200')).toBe(120000);
  });
  it('falls back to the first currency-prefixed number', () => {
    expect(extractAmountPaise('charged ₹649 today')).toBe(64900);
  });
  it('ignores bare numbers with no currency marker', () => {
    expect(extractAmountPaise('your account 1234 was updated')).toBe(0);
  });
});

describe('findDueDate', () => {
  it('reads a day-first numeric date', () => {
    expect(findDueDate('Due date: 28-06-2026')).toBe('2026-06-28');
  });
  it('reads a contextual text date', () => {
    expect(findDueDate('payment due on 5 Aug 2026')).toBe('2026-08-05');
  });
  it('reads a "Mon DD, YYYY" date', () => {
    expect(findDueDate('charged on Jun 15, 2026')).toBe('2026-06-15');
  });
  it('reads an ISO date', () => {
    expect(findDueDate('renews 2026-12-01')).toBe('2026-12-01');
  });
  it('returns null when there is no date', () => {
    expect(findDueDate('no date here')).toBeNull();
  });
});

describe('extractMerchantFromSender', () => {
  it('prefers the display name', () => {
    expect(extractMerchantFromSender('Netflix <info@netflix.com>')).toBe('Netflix');
  });
  it('derives from the domain when there is no display name', () => {
    expect(extractMerchantFromSender('bills@airtel.com')).toBe('Airtel');
  });
  it('strips noisy subdomains to the brand label', () => {
    expect(extractMerchantFromSender('noreply@account.netflix.com')).toBe('Netflix');
  });
});
