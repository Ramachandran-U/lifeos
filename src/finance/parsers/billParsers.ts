/**
 * Parsers for recurring-commitment emails: subscription renewals and bills /
 * invoices. Distinct from emailParsers.ts (which parses *past* bank
 * transactions) — these surface *upcoming* commitments for a subscription audit
 * and bill-due reminders.
 *
 * Every function here is PURE (no I/O, no `Date.now`) so it's deterministic and
 * unit-tested directly. The Gmail query in fetcher.ts pre-filters candidates;
 * this layer extracts merchant + amount + due/renewal date and classifies
 * subscription-vs-bill, requiring a recurring keyword so stray marketing or
 * plain transaction alerts are dropped.
 *
 * India-centric like the bank parsers: amounts in Rs./INR/₹ → paise (integer);
 * ambiguous numeric dates are read day-first (DD/MM/YYYY).
 */

export type RecurringKind = 'subscription' | 'bill';

export interface ParsedRecurring {
  kind: RecurringKind;
  /** Best-effort biller/service name. */
  merchant: string;
  /** Amount in paise (integer). 0 when no amount could be extracted. */
  amount: number;
  /** Renewal date (subscription) or payment due date (bill), YYYY-MM-DD. */
  dueDate?: string;
  /** Billing cadence when stated. */
  cadence?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  /** 0–1 — rises with each independent signal (amount, date, cadence). */
  confidence: number;
}

// ─── small shared helpers (kept local to stay decoupled from emailParsers) ───

function toPaise(amountStr: string): number {
  const rupees = Number.parseFloat(amountStr.replace(/,/g, '').trim());
  return Number.isFinite(rupees) ? Math.round(rupees * 100) : 0;
}

function cleanMerchant(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/[.;:,]+$/g, '').trim().slice(0, 80);
}

// ─── amount ──────────────────────────────────────────────────────────────────

const CUR = '(?:Rs\\.?|INR|₹)';
const NUM = '([\\d,]+(?:\\.\\d{1,2})?)';

// Labelled amounts, tried in order — "total amount due" must win over a nearby
// "minimum due". Each allows a short non-digit gap (e.g. "is Rs.") before the
// number. Falls back to the first currency-prefixed number anywhere.
const AMOUNT_LABELS: RegExp[] = [
  new RegExp(`total amount due[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
  new RegExp(`total due[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
  new RegExp(`amount payable[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
  new RegExp(`bill amount[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
  new RegExp(`amount due[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
  new RegExp(`payment of[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
  new RegExp(`(?:will be )?charged[^\\d₹]{0,15}${CUR}?\\s*${NUM}`, 'i'),
];
const GENERIC_AMOUNT = new RegExp(`${CUR}\\s*${NUM}`, 'i');

export function extractAmountPaise(text: string): number {
  for (const re of AMOUNT_LABELS) {
    const m = text.match(re);
    if (m) return toPaise(m[1]);
  }
  const g = text.match(GENERIC_AMOUNT);
  return g ? toPaise(g[1]) : 0;
}

// ─── date ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Ordered date-token patterns; the index selects how each is interpreted.
const DATE_PATTERNS: RegExp[] = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/, //                         2026-06-30 (ISO)
  /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/, //               28-06-2026 / 20/06/2026 (day-first)
  /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/, //      15 Jun 2026 / 30 June 2026
  /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/, //      Jun 15, 2026
];

function monthNum(name: string): number | null {
  return MONTHS[name.slice(0, 3).toLowerCase()] ?? null;
}

function tokenToIso(m: RegExpMatchArray, patternIndex: number): string | null {
  let y: number, mo: number | null, d: number;
  if (patternIndex === 0) {
    y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
  } else if (patternIndex === 1) {
    d = Number(m[1]); mo = Number(m[2]); y = Number(m[3]);
  } else if (patternIndex === 2) {
    d = Number(m[1]); mo = monthNum(m[2]); y = Number(m[3]);
  } else {
    mo = monthNum(m[1]); d = Number(m[2]); y = Number(m[3]);
  }
  if (!mo || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

function firstDateIn(text: string): string | null {
  let bestIso: string | null = null;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (let i = 0; i < DATE_PATTERNS.length; i++) {
    const m = text.match(DATE_PATTERNS[i]);
    if (m && m.index != null) {
      const iso = tokenToIso(m, i);
      if (iso && m.index < bestIdx) {
        bestIso = iso;
        bestIdx = m.index;
      }
    }
  }
  return bestIso;
}

const DATE_CONTEXT =
  /(due\s+(?:date|on|by)|renews?(?:\s+on)?|charged\s+on|next\s+payment|payable\s+(?:by|on)|bill\s+date)/i;

/**
 * The renewal / payment-due date. Prefers a date that follows a due/renew
 * context phrase; otherwise the first parseable date in the text.
 */
export function findDueDate(text: string): string | null {
  const ctx = text.match(DATE_CONTEXT);
  if (ctx && ctx.index != null) {
    const fromCtx = firstDateIn(text.slice(ctx.index, ctx.index + 60));
    if (fromCtx) return fromCtx;
  }
  return firstDateIn(text);
}

// ─── merchant ──────────────────────────────────────────────────────────────

const SENDER_NOISE = new Set([
  'www', 'mail', 'email', 'no', 'noreply', 'no-reply', 'donotreply', 'bills', 'billing',
  'alerts', 'alert', 'notifications', 'notification', 'account', 'accounts', 'statements',
  'statement', 'support', 'info', 'team', 'members', 'membership', 'offers', 'hello', 'help',
]);

/**
 * Pull a display name from the `From` header (`Netflix <info@netflix.com>` →
 * `Netflix`), falling back to the most meaningful domain label.
 */
export function extractMerchantFromSender(from: string): string {
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && !name.includes('@')) return cleanMerchant(name);
  }

  const emailMatch = from.match(/([A-Za-z0-9._-]+)@([A-Za-z0-9.-]+)/);
  if (emailMatch) {
    const parts = emailMatch[2].toLowerCase().split('.').filter(Boolean);
    const withoutTld = parts.slice(0, -1);
    const meaningful = withoutTld.filter((p) => !SENDER_NOISE.has(p));
    const label = meaningful[meaningful.length - 1] ?? withoutTld[withoutTld.length - 1] ?? parts[0];
    if (label) return cleanMerchant(label.charAt(0).toUpperCase() + label.slice(1));
  }
  return 'Unknown';
}

// ─── classification ──────────────────────────────────────────────────────────

function detectKind(text: string): RecurringKind | null {
  // Subscription wins when both appear (a "subscription renews" email may also
  // say "invoice"); a credit-card "statement … amount due" stays a bill.
  if (/\b(subscription|renew(?:s|al|ed|ing)?|membership|auto[- ]?renew)\b/i.test(text)) {
    return 'subscription';
  }
  if (/\b(bill|invoice|statement|amount\s+due|payment\s+due|amount\s+payable|due\s+date)\b/i.test(text)) {
    return 'bill';
  }
  return null;
}

function detectCadence(text: string): ParsedRecurring['cadence'] {
  if (/(per\s+year|annual(?:ly)?|yearly|\/yr|\/year|a\s+year)/i.test(text)) return 'yearly';
  if (/(per\s+quarter|quarterly)/i.test(text)) return 'quarterly';
  if (/(per\s+week|weekly|\/wk|a\s+week)/i.test(text)) return 'weekly';
  if (/(per\s+month|monthly|\/mo\b|\/month|a\s+month)/i.test(text)) return 'monthly';
  return undefined;
}

/**
 * Parse a subscription-renewal or bill email. Returns null when no recurring
 * keyword is present, or when neither an amount nor a due date can be found
 * (keeps precision high — a bare keyword isn't enough).
 */
export function parseBillOrSubscription(
  from: string,
  subject: string,
  body: string,
): ParsedRecurring | null {
  const text = `${subject}\n${body}`;
  const kind = detectKind(text);
  if (!kind) return null;

  const amount = extractAmountPaise(text);
  const dueDate = findDueDate(text);
  if (amount <= 0 && !dueDate) return null;

  const cadence = detectCadence(text);
  let confidence = 0.5;
  if (amount > 0) confidence += 0.2;
  if (dueDate) confidence += 0.2;
  if (cadence) confidence += 0.1;

  return {
    kind,
    merchant: extractMerchantFromSender(from),
    amount,
    dueDate: dueDate ?? undefined,
    cadence,
    confidence: Math.min(1, Math.round(confidence * 100) / 100),
  };
}
