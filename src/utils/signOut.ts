import { Platform } from 'react-native';
import { setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';
import { clearGoogleAuthTokens } from '@/integrations/googleAuth/oauth';
import { clearFitTokens } from '@/integrations/googleFit/oauth';
import { clearCalendarTokens } from '@/integrations/googleCalendar/oauth';
import { clearGmailTokens } from '@/finance/gmail/oauth';
import { signOut as supabaseSignOut } from '@/integrations/supabase/auth';
import { clearAllLocalData } from '@/db/clearLocalData';

/**
 * Single source of truth for fully signing the user out. Tolerates Supabase
 * being unconfigured or its session already expired — those should not block
 * the local cleanup.
 */
export async function signOutEverything(): Promise<void> {
  try {
    await supabaseSignOut();
  } catch {
    // Supabase not configured, or session already gone — ignore.
  }

  if (Platform.OS === 'web') {
    clearGoogleAuthTokens();
    clearFitTokens();
    clearCalendarTokens();
    clearGmailTokens();
  }

  // Purge ALL on-device data so a shared device never leaks the previous
  // account's health / finance / contact data to the next sign-in. The
  // per-entity health stores are global (not user-scoped), so clearing just the
  // session is not enough. (Defect C1 — verified live 2026-06-13.)
  await clearAllLocalData();

  setWebSession(null);
  useUserStore.getState().reset();

  // On web a soft SPA navigation would leave already-hydrated zustand stores
  // (gamification, domain history, …) holding the previous user's data IN MEMORY
  // — which would then re-persist under the next session, re-introducing the
  // leak. A hard reload to root rebuilds every store from the now-empty storage;
  // the auth guard then routes the cleared session to the sign-in screen.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    window.location.replace('/');
  }
}
