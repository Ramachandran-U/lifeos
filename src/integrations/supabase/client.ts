import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setSupabaseTokenGetter } from './session';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const storage = Platform.OS === 'web'
  ? undefined // supabase-js falls back to localStorage on web
  : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Wire the proxy/voice token accessor to the live Supabase session.
setSupabaseTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

/** Minimal surface of the Supabase client this needs (keeps it mockable). */
type AutoRefreshable = { auth: { startAutoRefresh: () => unknown; stopAutoRefresh: () => unknown } };

/**
 * Drive Supabase token auto-refresh off AppState on native: start on
 * foreground, stop on background. supabase-js's timer does NOT run reliably
 * while a React Native app is backgrounded, so without this the access token
 * silently lapses overnight and the user is signed out by next-day boot — which
 * broke Gmail sync (its token refresh needs a live Supabase bearer) and stale
 * height/weight identity on a ~daily cadence. Web refreshes via the browser, so
 * it's a native-only no-op. Exported for unit testing; invoked once below.
 */
export function wireAppStateAutoRefresh(client: AutoRefreshable): void {
  if (Platform.OS === 'web') return;
  // Lazy native-only require so the web bundle never has to resolve AppState
  // (mirrors the platform-guarded require pattern in src/db/index.ts).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppState } = require('react-native') as typeof import('react-native');
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void client.auth.startAutoRefresh();
    else void client.auth.stopAutoRefresh();
  });
}

wireAppStateAutoRefresh(supabase);

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
