import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { aiSuggestions, suggestionOutcomes } from '../schema';

const isWeb = Platform.OS === 'web';

export type SuggestionVariant = 'single_shot' | 'agent';

export interface LogAiSuggestionInput {
  userId: string;
  task: string;                  // e.g. 'routine.generate', 'goal.decompose'
  variant: SuggestionVariant;
  model?: string;
  input: unknown;                // canonicalised + hashed before storage; raw not retained
  outputSummary?: string;
  outputRef?: string;
}

export interface RecordOutcomeInput {
  suggestionId: string;
  windowDays: number;            // 14 for kill/keep; other windows allowed for exploration
  blocksTotal?: number;
  blocksCompleted?: number;
  domainScoreDelta?: number;
}

function canonicalise(input: unknown): string {
  // Stable JSON: sort object keys recursively so equivalent inputs hash identically.
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = walk((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(walk(input));
}

export async function hashSuggestionInput(input: unknown): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalise(input));
}

/**
 * Logs an AI suggestion for outcome tracking.
 *
 * Web returns the generated id without persisting — outcome tracking is a
 * native concern; web sessions are dev/preview and don't drive the kill/keep
 * decision. If we ever need web-side aggregation, add a webStorage path.
 *
 * See migration 0004_ai_suggestions.sql for the kill/keep hypothesis this
 * table exists to inform.
 */
export async function logAiSuggestion(input: LogAiSuggestionInput): Promise<string> {
  const id = nanoid();
  const inputHash = await hashSuggestionInput(input.input);
  if (isWeb) return id;

  db.insert(aiSuggestions).values({
    id,
    userId: input.userId,
    task: input.task,
    variant: input.variant,
    model: input.model,
    inputHash,
    outputSummary: input.outputSummary,
    outputRef: input.outputRef,
    createdAt: new Date().toISOString(),
  }).run();
  return id;
}

export function recordSuggestionOutcome(input: RecordOutcomeInput): void {
  if (isWeb) return;
  const completionRate =
    input.blocksTotal && input.blocksTotal > 0 && input.blocksCompleted != null
      ? input.blocksCompleted / input.blocksTotal
      : null;

  db.insert(suggestionOutcomes).values({
    id: nanoid(),
    suggestionId: input.suggestionId,
    windowDays: input.windowDays,
    blocksTotal: input.blocksTotal,
    blocksCompleted: input.blocksCompleted,
    completionRate: completionRate,
    domainScoreDelta: input.domainScoreDelta,
    measuredAt: new Date().toISOString(),
  }).run();
}

export interface SuggestionWithOutcome {
  id: string;
  userId: string;
  task: string;
  variant: SuggestionVariant;
  model: string | null;
  inputHash: string;
  outputSummary: string | null;
  outputRef: string | null;
  createdAt: string;
  outcome?: {
    windowDays: number;
    blocksTotal: number | null;
    blocksCompleted: number | null;
    completionRate: number | null;
    domainScoreDelta: number | null;
    measuredAt: string;
  };
}

/**
 * Reads suggestions (most recent first) with their most recent outcome row,
 * if any. Used by the production-outcomes eval report.
 */
export function listSuggestionsWithOutcomes(
  task?: string,
  limit = 500,
): SuggestionWithOutcome[] {
  if (isWeb) return [];
  const suggestionRows = task
    ? db.select().from(aiSuggestions).where(eq(aiSuggestions.task, task)).all()
    : db.select().from(aiSuggestions).all();

  const outcomeRows = db.select().from(suggestionOutcomes).all();
  const outcomeBySuggestion = new Map<string, typeof outcomeRows[number]>();
  for (const o of outcomeRows) {
    const existing = outcomeBySuggestion.get(o.suggestionId);
    if (!existing || existing.measuredAt < o.measuredAt) {
      outcomeBySuggestion.set(o.suggestionId, o);
    }
  }

  return suggestionRows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((s) => {
      const o = outcomeBySuggestion.get(s.id);
      return {
        id: s.id,
        userId: s.userId,
        task: s.task,
        variant: s.variant as SuggestionVariant,
        model: s.model,
        inputHash: s.inputHash,
        outputSummary: s.outputSummary,
        outputRef: s.outputRef,
        createdAt: s.createdAt,
        outcome: o
          ? {
              windowDays: o.windowDays,
              blocksTotal: o.blocksTotal,
              blocksCompleted: o.blocksCompleted,
              completionRate: o.completionRate,
              domainScoreDelta: o.domainScoreDelta,
              measuredAt: o.measuredAt,
            }
          : undefined,
      };
    });
}
