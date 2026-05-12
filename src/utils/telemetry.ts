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

let deviceIdMemo: string | null = null;
let deviceIdLoadPromise: Promise<string> | null = null;

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
export function track(event: string, props: Record<string, unknown> = {}): void {
  // Opt-in gate. Read directly from store to avoid hook coupling.
  const enabled = useTelemetryStore.getState().enabled;
  if (!enabled || !PROXY_URL) return;

  void sendInBackground(event, props).catch(() => {
    // Swallow — telemetry must never affect UX.
  });
}

async function sendInBackground(event: string, props: Record<string, unknown>): Promise<void> {
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
