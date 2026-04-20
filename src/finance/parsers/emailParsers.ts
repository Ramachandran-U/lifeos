/**
 * Bank-specific transaction email parsers. Each parser returns the extracted
 * numeric amount in paise (integer) alongside merchant + direction + confidence.
 * Dispatcher routes on sender domain.
 */

import type { TxDirection, TxSource } from '@/finance/db/transactionDb';

export interface ParsedTx {
  amount: number;
  direction: TxDirection;
  merchant: string;
  refId?: string;
  confidence: number;
}

function toPaise(amountStr: string): number {
  const cleaned = amountStr.replace(/,/g, '').trim();
  const rupees = Number.parseFloat(cleaned);
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

function cleanMerchant(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[.;:,]+$/g, '')
    .trim()
    .slice(0, 80);
}

// ─── HDFC ───────────────────────────────────────────────────────────────────

export function parseHdfc(body: string): ParsedTx | null {
  const debit = body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+)?debited\s+from[\s\S]{0,200}?(?:to|at)\s+([^\n]+?)(?:\s+on\b|\s+Ref|\.|\n)/i,
  );
  const credit = body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+)?credited\s+to[\s\S]{0,200}?(?:from|by)\s+([^\n]+?)(?:\s+on\b|\s+Ref|\.|\n)/i,
  );

  const m = debit ?? credit;
  if (!m) return null;

  const refMatch = body.match(/UPI[- ]Ref[- ](?:No\.?\s*)?([A-Z0-9]+)/i)
    ?? body.match(/Ref\s*(?:No\.?)?\s*([A-Z0-9]+)/i);

  return {
    amount: toPaise(m[1]),
    direction: debit ? 'debit' : 'credit',
    merchant: cleanMerchant(m[2]),
    refId: refMatch?.[1],
    confidence: 0.85,
  };
}

// ─── ICICI ──────────────────────────────────────────────────────────────────

export function parseIcici(body: string): ParsedTx | null {
  const amt = body.match(/INR\s*([\d,]+\.?\d*)\s+(?:has been\s+)?(debited|credited)/i)
    ?? body.match(/Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+)?(debited|credited)/i);
  if (!amt) return null;

  const merchMatch = body.match(/(?:at|to|from)\s+([A-Z0-9][A-Z0-9 .&'\-]+?)(?:\s+on\b|\s+Ref|\s+UPI|\.|\n)/i);
  const refMatch = body.match(/Ref\s*(?:No\.?)?\s*([A-Z0-9]+)/i);

  return {
    amount: toPaise(amt[1]),
    direction: amt[2].toLowerCase() === 'debited' ? 'debit' : 'credit',
    merchant: merchMatch ? cleanMerchant(merchMatch[1]) : 'Unknown',
    refId: refMatch?.[1],
    confidence: merchMatch ? 0.8 : 0.55,
  };
}

// ─── Axis ───────────────────────────────────────────────────────────────────

export function parseAxis(body: string): ParsedTx | null {
  const amt = body.match(/(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+(?:has been\s+)?(debited|credited)/i);
  if (!amt) return null;

  const merchMatch = body.match(/(?:at|to|from)\s+([^\n]+?)(?:\s+on\b|\s+txn|\s+UPI|\.|\n)/i);
  const refMatch = body.match(/(?:Transaction ID|UTR|Ref)\s*:?\s*([A-Z0-9]+)/i);

  return {
    amount: toPaise(amt[1]),
    direction: amt[2].toLowerCase() === 'debited' ? 'debit' : 'credit',
    merchant: merchMatch ? cleanMerchant(merchMatch[1]) : 'Unknown',
    refId: refMatch?.[1],
    confidence: merchMatch ? 0.8 : 0.55,
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export function detectSource(from: string): TxSource | null {
  const f = from.toLowerCase();
  if (f.includes('hdfcbank')) return 'hdfc';
  if (f.includes('icicibank')) return 'icici';
  if (f.includes('axisbank')) return 'axis';
  return null;
}

export function parseTransactionEmail(
  from: string,
  body: string,
): (ParsedTx & { source: TxSource }) | null {
  const source = detectSource(from);
  if (!source) return null;

  const parsed =
    source === 'hdfc' ? parseHdfc(body) :
    source === 'icici' ? parseIcici(body) :
    parseAxis(body);

  if (!parsed || parsed.amount <= 0) return null;
  return { ...parsed, source };
}
