import { syncRecentEmails } from './fetcher';
import { parseTransactionEmail } from '../parsers/emailParsers';
import { categorizeBatch } from '../categorizer';
import { upsertTransactions, type TxRecord } from '../db/transactionDb';

type GmailMessage = Awaited<ReturnType<typeof syncRecentEmails>>[number];
type ParsedTx = NonNullable<ReturnType<typeof parseTransactionEmail>>;

export interface FinanceSyncResult {
  /** Emails fetched from Gmail. */
  total: number;
  /** Emails that parsed into a transaction. */
  parsed: number;
  /** Emails that did not look like a transaction. */
  skipped: number;
  /** Rows newly persisted (upsert insert count). */
  ingested: number;
}

/**
 * Sync finance from Gmail end-to-end: fetch recent transaction emails → parse →
 * categorize (rules + AI batch) → upsert into the on-device finance store.
 *
 * This is the SINGLE source of truth for the pipeline — both the Finance store
 * (`useTransactionStore.sync`) and the voice agent's `syncFinance` tool call it,
 * so the two can never drift. Web-only (the finance store is Dexie/IndexedDB);
 * callers guard `Platform.OS === 'web'` before invoking. Returns a compact
 * summary the caller can narrate or render.
 */
export async function syncFinanceFromGmail(clientId: string): Promise<FinanceSyncResult> {
  const messages = await syncRecentEmails(clientId);

  // Single pass: parse each email once, partitioning into transactions vs skips.
  const parsed: { message: GmailMessage; tx: ParsedTx }[] = [];
  let skipped = 0;
  for (const m of messages) {
    const tx = parseTransactionEmail(m.from, `${m.subject}\n${m.body}`);
    if (tx) parsed.push({ message: m, tx });
    else skipped += 1;
  }

  const categories = await categorizeBatch(
    parsed.map(({ tx }) => ({ merchant: tx.merchant, amount: tx.amount, direction: tx.direction, channel: tx.channel })),
    { maxAiItems: 50, batchSize: 25 },
  );

  const records: TxRecord[] = parsed.map(({ message, tx }, i) => ({
    id: message.id,
    date: message.date || new Date().toISOString().slice(0, 10),
    amount: tx.amount,
    direction: tx.direction,
    merchant: tx.merchant,
    category: categories[i] ?? 'other',
    source: tx.source,
    rawEmailId: message.id,
    confidence: tx.confidence,
    userCorrected: false,
  }));

  const ingested = await upsertTransactions(records);
  return { total: messages.length, parsed: parsed.length, skipped, ingested };
}
