/**
 * Day-7 retention helper. Fires `app_opened` once per UTC day per device with a
 * `days_since_install` prop so the admin dashboard can chart the cohort
 * retention curve without the client doing any aggregation.
 *
 * Storage: a single key (`lifeos_app_opened_last`) tracks the YYYY-MM-DD of the
 * last emission. If today differs, we emit and update. Cross-platform via the
 * same localStorage/AsyncStorage split telemetry already uses.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track, EVENTS } from './telemetry';

const KEY = 'lifeos_app_opened_last';
const COMEBACK_KEY = 'lifeos_comeback_last';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(installIso: string | null | undefined, now = new Date()): number {
  if (!installIso) return 0;
  const installMs = Date.parse(installIso);
  if (Number.isNaN(installMs)) return 0;
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((now.getTime() - installMs) / dayMs));
}

async function read(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // Non-fatal — at worst we re-emit tomorrow.
  }
}

/**
 * The last-open day BEFORE this session touched storage, sampled once per
 * process. Both the app_opened emitter and the comeback detector read through
 * this, so whichever runs first, the comeback gap is always computed against
 * the genuinely previous open — never against the value maybeEmitAppOpened
 * just wrote for today.
 */
let previousOpenDay: string | null | undefined;
async function samplePreviousOpenDay(): Promise<string | null> {
  if (previousOpenDay === undefined) previousOpenDay = await read(KEY);
  return previousOpenDay;
}

/**
 * Emit `app_opened` if today's date hasn't been recorded yet. Idempotent
 * within the same UTC day. Fire-and-forget — never throws to caller.
 */
export function maybeEmitAppOpened(installIso: string | null | undefined): void {
  void (async () => {
    const last = await samplePreviousOpenDay();
    const today = todayUtc();
    if (last === today) return;
    track(EVENTS.appOpened, { days_since_install: daysSince(installIso) });
    await write(KEY, today);
  })();
}

// ── Comeback detection (R4, flag: comeback_v1) ──────────────────────────────

/** A return counts as a comeback after this many days away… */
export const COMEBACK_MIN_GAP_DAYS = 3;
/** …and up to this many — beyond it, treat the return as a fresh start, not a
 *  "welcome back" (a year-later reinstall shouldn't open on a callback). */
export const COMEBACK_MAX_GAP_DAYS = 90;

export interface ComebackEvaluation {
  lastOpenDay: string | null;
  lastComebackDay: string | null;
  today: string;
}

/**
 * Pure comeback rule: a 3–90 day gap since the previous open, at most once
 * per day (the COMEBACK_KEY mark dedupes re-mounts; the gap requirement
 * itself dedupes the rest of the episode — tomorrow's gap is 1).
 * Returns the gap in days, or null.
 */
export function evaluateComeback({ lastOpenDay, lastComebackDay, today }: ComebackEvaluation): number | null {
  if (!lastOpenDay) return null; // first ever open — a welcome, not a comeback
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastOpenDay}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  const gap = Math.round(ms / 86_400_000);
  if (gap < COMEBACK_MIN_GAP_DAYS || gap > COMEBACK_MAX_GAP_DAYS) return null;
  if (lastComebackDay === today) return null; // already handled this return
  return gap;
}

/** Async adapter: evaluate against real storage. Read-only — call
 *  markComebackHandled() once the comeback surface has actually been shown. */
export async function detectComeback(now = new Date()): Promise<number | null> {
  const [lastOpenDay, lastComebackDay] = await Promise.all([
    samplePreviousOpenDay(),
    read(COMEBACK_KEY),
  ]);
  return evaluateComeback({ lastOpenDay, lastComebackDay, today: now.toISOString().slice(0, 10) });
}

export async function markComebackHandled(now = new Date()): Promise<void> {
  await write(COMEBACK_KEY, now.toISOString().slice(0, 10));
}

// Exported for tests.
export const _internal = {
  daysSince,
  todayUtc,
  resetSessionSample(): void {
    previousOpenDay = undefined;
  },
};
