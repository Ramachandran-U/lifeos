/**
 * P4-02 Proactive Daily Briefing.
 *
 * Generates 1-3 short morning lines once per day and caches them so the
 * Today screen doesn't re-call the model on every focus. The cache is keyed
 * by date and persisted (localStorage on web, AsyncStorage on native), so a
 * briefing survives reloads and is regenerated only when the day rolls over.
 *
 * Generation is mock-gated inside `generateDailyBriefing`, and any failure
 * falls back silently to `null` — the Today screen then shows its static
 * blocks-count line, so the banner is never empty.
 */

import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { generateDailyBriefing } from '@/ai/functions';
import type { DailyBriefingInput } from '@/ai/types';

interface CachedBriefing {
  date: string; // YYYY-MM-DD
  lines: string[];
}

interface BriefingState {
  cache: CachedBriefing | null;
  setCache: (c: CachedBriefing) => void;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

const useBriefingStore = create<BriefingState>()(
  persist(
    (set) => ({
      cache: null,
      setCache: (cache) => set({ cache }),
    }),
    { name: 'lifeos_daily_briefing_v1', storage },
  ),
);

/**
 * Returns the briefing text (lines joined with newlines) for `today`, or null
 * while generating / on failure. Pass `input` = null to skip generation (e.g.
 * before the user has any data loaded).
 */
export function useDailyBriefing(
  input: DailyBriefingInput | null,
  today: string,
): string | null {
  const cache = useBriefingStore((s) => s.cache);
  const setCache = useBriefingStore((s) => s.setCache);
  const [lines, setLines] = useState<string[] | null>(
    cache?.date === today ? cache.lines : null,
  );
  // Guard against duplicate in-flight requests within a session (persist on
  // native resolves async, so `cache` may still be null across early renders).
  const requestedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input) return;
    if (cache?.date === today && cache.lines.length) {
      setLines(cache.lines);
      return;
    }
    if (requestedRef.current === today) return;
    requestedRef.current = today;

    let cancelled = false;
    generateDailyBriefing(input)
      .then((res) => {
        if (cancelled || !res || !res.lines.length) return;
        setLines(res.lines);
        setCache({ date: today, lines: res.lines });
      })
      .catch(() => {
        // Allow a retry on a later focus if this attempt failed outright.
        requestedRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [input, today, cache, setCache]);

  return lines && lines.length ? lines.join('\n') : null;
}
