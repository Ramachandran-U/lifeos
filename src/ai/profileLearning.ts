/**
 * Continuous profile learning — derives `inferredPreferences` from actual
 * behaviour over the last N days. Pure, local computation: no AI call.
 *
 * Run periodically (e.g. once a week per user) from app focus on the Today
 * screen. Writes to the user's `UserProfile.inferredPreferences` slot.
 */

import { format, subDays } from 'date-fns';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { getRoutineBlocksInRange } from '@/db/queries/routine';
import { getUserProfile, upsertUserProfile } from '@/db/queries/userProfile';
import type { InferredPreferences, UserProfile } from './types';

const DEFAULT_LOOKBACK_DAYS = 30;
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly

function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export interface InferenceResult {
  preferences: InferredPreferences;
  sampleSize: { events: number; blocks: number };
  /** True if there was enough signal to write back. */
  hasSignal: boolean;
}

/**
 * Compute fresh InferredPreferences from the last `lookbackDays` of events +
 * routine blocks. Pure function — no DB writes.
 */
export function computeInferredPreferences(lookbackDays: number = DEFAULT_LOOKBACK_DAYS): InferenceResult {
  const events = getEventsLastNDays(lookbackDays);
  const today = format(new Date(), 'yyyy-MM-dd');
  const start = format(subDays(new Date(), lookbackDays), 'yyyy-MM-dd');
  const blocks = getRoutineBlocksInRange(start, today);

  // --- productiveHours: top 3 hours by `*_completed` event count ---
  const hourCounts: Record<number, number> = {};
  for (const e of events) {
    if (!e.eventType.includes('completed')) continue;
    hourCounts[e.hour] = (hourCounts[e.hour] ?? 0) + 1;
  }
  const productiveHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([h]) => Number(h))
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);

  // --- preferredBlockMinutes: median duration of completed routine blocks ---
  const completedDurations: number[] = [];
  for (const b of blocks) {
    if (b.status !== 'completed') continue;
    const start = hhmmToMinutes(b.startTime);
    const end = hhmmToMinutes(b.endTime);
    if (start === null || end === null) continue;
    const dur = end - start;
    if (dur > 0 && dur <= 240) completedDurations.push(dur); // sanity cap 4h
  }
  const preferredBlockMinutes = median(completedDurations);

  // --- droppedHabits: titles with skipped count ≥ 3 AND skipped > completed ---
  const titleStats: Record<string, { skipped: number; completed: number }> = {};
  for (const b of blocks) {
    const key = b.title.trim();
    if (!key) continue;
    if (!titleStats[key]) titleStats[key] = { skipped: 0, completed: 0 };
    if (b.status === 'skipped') titleStats[key].skipped += 1;
    else if (b.status === 'completed') titleStats[key].completed += 1;
  }
  const droppedHabits = Object.entries(titleStats)
    .filter(([, s]) => s.skipped >= 3 && s.skipped > s.completed)
    .sort(([, a], [, b]) => b.skipped - a.skipped)
    .slice(0, 5)
    .map(([t]) => t);

  // --- preferredRestDays: 2 days of week with the worst completion rate ---
  // Use blocks (not events) — completion rate per dayOfWeek across the window.
  const dowStats: Record<number, { completed: number; total: number }> = {};
  for (const b of blocks) {
    const dow = new Date(`${b.date}T00:00:00`).getDay();
    if (!dowStats[dow]) dowStats[dow] = { completed: 0, total: 0 };
    dowStats[dow].total += 1;
    if (b.status === 'completed') dowStats[dow].completed += 1;
  }
  const preferredRestDays = Object.entries(dowStats)
    .filter(([, s]) => s.total >= 3)
    .map(([dow, s]) => ({ dow: Number(dow), rate: s.completed / s.total }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 2)
    .map((x) => x.dow);

  const preferences: InferredPreferences = {
    productiveHours,
    preferredBlockMinutes,
    droppedHabits,
    preferredRestDays,
  };

  const hasSignal =
    events.length >= 10 ||
    blocks.length >= 10 ||
    productiveHours.length > 0 ||
    droppedHabits.length > 0;

  return {
    preferences,
    sampleSize: { events: events.length, blocks: blocks.length },
    hasSignal,
  };
}

function parseIsoToMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Refresh a user's `inferredPreferences` and persist to the user profile.
 * Returns the inference result (whether or not it was written). When
 * `force=false`, no-ops if the last refresh was within the weekly window.
 */
export async function refreshInferredPreferences(
  userId: string,
  force: boolean = false,
): Promise<InferenceResult | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;

  if (!force) {
    const lastMs = parseIsoToMs(profile.inferredPreferences.lastInferredAt);
    if (Date.now() - lastMs < REFRESH_INTERVAL_MS) return null;
  }

  const result = computeInferredPreferences();
  // Always stamp lastInferredAt — even if signal is thin — so we don't recompute on every focus.
  const next: UserProfile = {
    ...profile,
    inferredPreferences: result.hasSignal
      ? { ...result.preferences, lastInferredAt: new Date().toISOString() }
      : { ...profile.inferredPreferences, lastInferredAt: new Date().toISOString() },
    lastUpdated: new Date().toISOString(),
  };
  await upsertUserProfile(userId, next);
  return result;
}
