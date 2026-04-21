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
  // Credit-card debit: "Rs.X is debited from your HDFC Bank Credit Card ending NNNN towards MERCHANT on DATE at TIME"
  // Check this FIRST because the savings-account pattern's "(to|at)" would incorrectly
  // snap onto "at 19:19:23" at the end of these bodies.
  const debitCard = body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+|is\s+)?debited\s+from\s+your\s+HDFC[\s\S]{0,80}?Credit\s+Card[\s\S]{0,60}?\s+(?:towards|at|to)\s+([^\n]+?)\s+on\s+\d/i,
  );
  // Savings-account debit: "Rs.X debited from A/c ... to MERCHANT on DATE"
  const debitAcct = !debitCard ? body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+|is\s+)?debited\s+from[\s\S]{0,200}?(?:to|at)\s+([A-Za-z][^\n]*?)\s+on\s+\d/i,
  ) : null;
  const credit = !debitCard && !debitAcct ? body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+|is\s+)?credited\s+to[\s\S]{0,200}?(?:from|by)\s+([A-Za-z][^\n]*?)\s+on\s+\d/i,
  ) : null;

  const m = debitCard ?? debitAcct ?? credit;
  if (!m) {
    // Last-resort: amount + debited via Credit Card, merchant unknown.
    const fallback = body.match(
      /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been\s+|is\s+)?debited[\s\S]{0,200}?Credit Card/i,
    );
    if (!fallback) return null;
    return {
      amount: toPaise(fallback[1]),
      direction: 'debit',
      merchant: 'Unknown',
      confidence: 0.45,
    };
  }

  const refMatch = body.match(/UPI[- ]Ref[- ](?:No\.?\s*)?([A-Z0-9]+)/i)
    ?? body.match(/Ref\s*(?:No\.?)?\s*([A-Z0-9]+)/i);

  return {
    amount: toPaise(m[1]),
    direction: (debitCard || debitAcct) ? 'debit' : 'credit',
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
  const amt = body.match(/(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+(?:was\s+|has been\s+)?(debited|credited)/i);
  if (!amt) return null;

  // Merchant candidates — tried in order. Skip boilerplate like "your A/c no. XXnnnn".
  const candidates = [
    body.match(/Info[:\-]\s*([^\n]+?)(?:\.|\n|$)/i),                    // "Info- UPI/P2A/xxxxx/MERCHANT NAME"
    body.match(/\b(?:towards|to|at)\s+([A-Z0-9][^\n]{2,80}?)(?:\s+on\b|\s+Ref|\s+UPI|\.|\n)/i),
    body.match(/\bfrom\s+(?!your\s+A\/c)([A-Z0-9][^\n]{2,80}?)(?:\s+on\b|\s+Ref|\s+UPI|\.|\n)/i),
  ];
  const merchMatch = candidates.find((m): m is RegExpMatchArray => !!m) ?? null;
  const refMatch = body.match(/(?:Transaction ID|UTR|Ref(?:\s*No\.?)?)\s*:?\s*([A-Z0-9]+)/i);

  return {
    amount: toPaise(amt[1]),
    direction: amt[2].toLowerCase() === 'debited' ? 'debit' : 'credit',
    merchant: merchMatch ? cleanMerchant(merchMatch[1]) : 'Unknown',
    refId: refMatch?.[1],
    confidence: merchMatch ? 0.75 : 0.5,
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export function detectSource(from: string): TxSource | null {
  const f = from.toLowerCase();
  if (f.includes('hdfcbank')) return 'hdfc';
  if (f.includes('icicibank')) return 'icici';
  if (f.includes('axisbank') || f.includes('axis.bank')) return 'axis';
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
