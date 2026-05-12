/**
 * Register the device's Expo push token with the Worker so admin broadcasts
 * can reach it.
 *
 * Call this after the user grants notification permission. Safe to call
 * repeatedly — Worker upserts by token, just bumping last_seen.
 *
 * Web is skipped (Expo's push system targets native; web push needs a
 * separate flow we haven't built).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const DEVICE_ID_KEY = 'lifeos_telemetry_device_id';

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

export async function registerPushToken(): Promise<boolean> {
  if (Platform.OS === 'web' || !PROXY_URL) return false;

  const bearer = await getSupabaseAccessToken();
  if (!bearer) return false;

  let pushToken: string;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    pushToken = tokenResp.data;
  } catch {
    return false;
  }

  if (!pushToken) return false;

  const device_id = await readDeviceId();
  try {
    const res = await fetch(`${PROXY_URL}/v1/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        token: pushToken,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version || 'dev',
        device_id,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
