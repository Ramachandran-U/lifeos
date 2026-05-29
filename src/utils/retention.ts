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

async function readLast(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(KEY);
    }
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function writeLast(value: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, value);
      return;
    }
    await AsyncStorage.setItem(KEY, value);
  } catch {
    // Non-fatal — at worst we re-emit tomorrow.
  }
}

/**
 * Emit `app_opened` if today's date hasn't been recorded yet. Idempotent
 * within the same UTC day. Fire-and-forget — never throws to caller.
 */
export function maybeEmitAppOpened(installIso: string | null | undefined): void {
  void (async () => {
    const last = await readLast();
    const today = todayUtc();
    if (last === today) return;
    track(EVENTS.appOpened, { days_since_install: daysSince(installIso) });
    await writeLast(today);
  })();
}

// Exported for tests.
export const _internal = { daysSince, todayUtc };
