import { useFlagStore } from '@/store/useFlagStore';
import { insertChest, countChestsGrantedOnDay, type ChestSource } from '@/db/queries/chests';
import { localDayISO } from '@/db/queries/xpEvents';
import { track, EVENTS } from '@/utils/telemetry';

/**
 * Chest grant gate (variable_rewards_v1) — THE entry point feature code calls
 * when a peak moment lands. Mirrors tickQuestMetric's contract: a no-op while
 * the flag is off, capped, and it never throws into the moment that fired it.
 *
 * Cap: at most ONE chest per local day across ALL sources. Variable rewards
 * work on scarcity; two chests in a day reads as a slot machine, which is
 * exactly the compulsion loop the compassion constraint forbids. The cap also
 * makes grant triggers safely re-entrant (re-rendering a peak moment can't
 * double-grant).
 */
export function maybeGrantChest(
  userId: string,
  source: ChestSource,
  today: string = localDayISO(),
): string | null {
  try {
    if (!userId) return null;
    if (!useFlagStore.getState().isEnabled('variable_rewards_v1')) return null;
    if (countChestsGrantedOnDay(userId, today) >= 1) return null;
    const id = insertChest(userId, source, today);
    track(EVENTS.chestGranted, { source });
    return id;
  } catch {
    // Granting is additive sugar — never let it break a completion flow.
    return null;
  }
}
