import { Platform } from 'react-native';
import { setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';
import { clearGoogleAuthTokens } from '@/integrations/googleAuth/oauth';
import { clearFitTokens } from '@/integrations/googleFit/oauth';
import { clearCalendarTokens } from '@/integrations/googleCalendar/oauth';
import { clearGmailTokens } from '@/finance/gmail/oauth';
import { signOut as supabaseSignOut } from '@/integrations/supabase/auth';

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

  setWebSession(null);
  useUserStore.getState().reset();
}
