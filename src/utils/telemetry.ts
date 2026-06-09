/**
 * LifeOS consumer telemetry SDK.
 *
 * Rules:
 *  - Anonymous: the only identifier is a device-scoped UUID stored locally.
 *    Never linked to user_id, email, or name in the outbound payload.
 *  - Opt-in: events are dropped unless `useTelemetryStore.enabled === true`.
 *    Default is OFF (see Settings → Privacy).
 *  - Fire-and-forget: `track()` never throws and never blocks the caller.
 *    Network errors are swallowed (best-effort delivery).
 *  - Server-side allowlist: event names that aren't on the Worker's list
 *    will 400, but we don't gate them client-side — that lets us iterate
 *    on the server allowlist without app updates.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTelemetryStore } from '@/store/useTelemetryStore';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const DEVICE_ID_KEY = 'lifeos_telemetry_device_id';

/**
 * Canonical event names. Use `EVENTS.x` at every call site so typos become
 * compile-time errors and `git grep EVENTS.x` returns every emission point.
 * String values MUST match the Worker's allowlist exactly — adding a new key
 * here without updating the allowlist will result in a 400 server-side.
 */
export const EVENTS = {
  aiCall: 'ai_call',
  aiSchemaFailure: 'ai_schema_failure',
  discoveryChatAbandoned: 'discovery_chat_abandoned',
  discoveryChatCompleted: 'discovery_chat_completed',
  eveningReflectCompleted: 'evening_reflect_completed',
  firstBlockCompleted: 'first_block_completed',
  goalCreated: 'goal_created',
  // Goals lifecycle (keep in sync with the Worker's ALLOWED_EVENTS).
  goalCompleted: 'goal_completed',
  goalDetailOpened: 'goal_detail_opened',
  goalPostponed: 'goal_postponed',
  goalRemoved: 'goal_removed',
  goalRestored: 'goal_restored',
  goalResumed: 'goal_resumed',
  goalDecomposeStarted: 'goal_decompose_started',
  goalDecomposeSucceeded: 'goal_decompose_succeeded',
  goalDecomposeAbandoned: 'goal_decompose_abandoned',
  onboardingFinished: 'onboarding_finished',
  onboardingV2Started: 'onboarding_v2_started',
  profileInferenceRun: 'profile_inference_run',
  routineBlockCompleted: 'routine_block_completed',
  routineEdited: 'routine_edited',
  routineGenerated: 'routine_generated',
  routineReplanned: 'routine_replanned',
  slotFilled: 'slot_filled',
  tomorrowRoutineFailed: 'tomorrow_routine_failed',
  tomorrowRoutineGenerated: 'tomorrow_routine_generated',
  uiCrash: 'ui_crash',
  storageUsage: 'storage_usage',
  appOpened: 'app_opened',
  // Explore v2 — sparks + expeditions + constellation
  domainNudgeShown: 'domain_nudge_shown',
  domainNudgeAccepted: 'domain_nudge_accepted',
  domainNudgeDismissed: 'domain_nudge_dismissed',
  sparkShown: 'spark_shown',
  sparkSaved: 'spark_saved',
  sparkDismissed: 'spark_dismissed',
  sparkThreadPulled: 'spark_thread_pulled',
  chasingShown: 'chasing_shown',
  chasingThreadPulled: 'chasing_thread_pulled',
  frontierShown: 'frontier_shown',
  frontierExplored: 'frontier_explored',
  expeditionStarted: 'expedition_started',
  expeditionStepCompleted: 'expedition_step_completed',
  expeditionCompleted: 'expedition_completed',
  expeditionAbandoned: 'expedition_abandoned',
  constellationSynapseFormed: 'constellation_synapse_formed',
  curiosityStreakDay: 'curiosity_streak_day',
  priorityChange: 'priority_change',
  priorityReplanNow: 'priority_replan_now',
  priorityReplanTomorrow: 'priority_replan_tomorrow',
  priorityUndo: 'priority_undo',
  overcommitmentShown: 'overcommitment_shown',
  overcommitmentAccepted: 'overcommitment_accepted',
  overcommitmentDismissed: 'overcommitment_dismissed',
  // Retention mechanics (Aurora Alive W1+). NOTE: the Worker's ALLOWED_EVENTS
  // allowlist must be deployed with these names BEFORE a client release, or
  // the events 400 server-side (client track() fails silently — no user impact).
  streakFreezeEarned: 'streak_freeze_earned',
  streakFreezeUsed: 'streak_freeze_used',
  streakMilestone: 'streak_milestone',
  streakLost: 'streak_lost',
  streakRecovered: 'streak_recovered',
  questGenerated: 'quest_generated',
  questCompleted: 'quest_completed',
  questClaimed: 'quest_claimed',
  questRerolled: 'quest_rerolled',
  chestGranted: 'chest_granted',
  chestOpened: 'chest_opened',
  companionNamed: 'companion_named',
  companionTapped: 'companion_tapped',
  comebackDetected: 'comeback_detected',
  comebackClaimed: 'comeback_claimed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

let deviceIdMemo: string | null = null;
let deviceIdLoadPromise: Promise<string> | null = null;

/**
 * Resolve the anonymous device id, creating one on first call. Reused by the
 * mutation log so log entries share the same device identity as telemetry.
 */
export async function getDeviceId(): Promise<string> {
  return loadOrCreateDeviceId();
}

async function loadOrCreateDeviceId(): Promise<string> {
  if (deviceIdMemo) return deviceIdMemo;
  if (deviceIdLoadPromise) return deviceIdLoadPromise;

  deviceIdLoadPromise = (async () => {
    try {
      const storage =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.localStorage
          : null;
      const existing = storage
        ? storage.getItem(DEVICE_ID_KEY)
        : await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing) {
        deviceIdMemo = existing;
        return existing;
      }
      const next = generateUuid();
      if (storage) storage.setItem(DEVICE_ID_KEY, next);
      else await AsyncStorage.setItem(DEVICE_ID_KEY, next);
      deviceIdMemo = next;
      return next;
    } catch {
      // Storage failure → ephemeral session-local id so we don't break the caller.
      const fallback = generateUuid();
      deviceIdMemo = fallback;
      return fallback;
    }
  })();

  return deviceIdLoadPromise;
}

function generateUuid(): string {
  // RFC4122 v4 — good enough for an anonymous device id.
  // crypto.randomUUID is widely available on RN 0.76+ and modern web.
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  // Fallback when randomUUID isn't available.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fire-and-forget event tracking. Returns immediately; the network write
 * happens in the background. Safe to call from any code path.
 */
export function track(event: EventName, props: Record<string, unknown> = {}): void {
  // Opt-in gate. Read directly from store to avoid hook coupling.
  const enabled = useTelemetryStore.getState().enabled;
  if (!enabled || !PROXY_URL) return;

  void sendInBackground(event, props).catch(() => {
    // Swallow — telemetry must never affect UX.
  });
}

async function sendInBackground(event: EventName, props: Record<string, unknown>): Promise<void> {
  const deviceId = await loadOrCreateDeviceId();
  const body = {
    device_id: deviceId,
    event,
    props,
    app_version: Constants.expoConfig?.version || 'dev',
    platform: Platform.OS,
  };
  try {
    await fetch(`${PROXY_URL}/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Best-effort delivery. No retry queue — keeps the SDK tiny.
  }
}

/**
 * Pre-warm the device id so the first `track()` call doesn't pay the
 * storage round-trip. Safe to call from app boot.
 */
export function preloadTelemetry(): void {
  void loadOrCreateDeviceId();
}
