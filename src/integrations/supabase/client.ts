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

// supabase-js's timer-based autoRefreshToken does NOT run reliably while a
// React Native app is backgrounded, so the access token silently lapses while
// the phone sits overnight and the user is effectively signed out by next-day
// boot. That broke two things on a ~daily cadence: Gmail sync (its token
// refresh needs a live Supabase bearer) and height/weight reads (identity went
// stale). Per Supabase's RN guidance, drive auto-refresh off AppState so it
// resumes on foreground. Web refreshes via the browser, so it's native-only.
if (Platform.OS !== 'web') {
  // Lazy native-only require so the web bundle never has to resolve AppState
  // (mirrors the platform-guarded require pattern in src/db/index.ts).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppState } = require('react-native') as typeof import('react-native');
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
