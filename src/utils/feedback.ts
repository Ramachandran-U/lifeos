/**
 * Submit in-app feedback to the Worker. Fire-and-forget from the UI's POV
 * but the caller awaits so it can show a success state.
 *
 * Anonymous: device_id is included if available but no Bearer is sent.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const DEVICE_ID_KEY = 'lifeos_telemetry_device_id'; // shared with telemetry SDK

export interface FeedbackPayload {
  body: string;
  subject?: string;
  from_email?: string;
}

async function readDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(DEVICE_ID_KEY);
    }
    return await AsyncStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  if (!PROXY_URL) throw new Error('Feedback service is not configured.');
  if (!payload.body.trim()) throw new Error('Please write a message.');

  const device_id = await readDeviceId();
  const res = await fetch(`${PROXY_URL}/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body: payload.body.trim(),
      subject: payload.subject?.trim() || undefined,
      from_email: payload.from_email?.trim() || undefined,
      device_id,
      app_version: Constants.expoConfig?.version || 'dev',
      platform: Platform.OS,
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const message = (json as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
}
