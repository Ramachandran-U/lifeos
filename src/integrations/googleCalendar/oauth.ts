import { createGoogleOAuthClient } from '@/integrations/google/oauth';

export const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.events';

const client = createGoogleOAuthClient({
  scopes: CALENDAR_SCOPES,
  tokenKey: 'lifeos_gcal_tokens',
  verifierKey: 'lifeos_gcal_pkce_verifier',
  redirectPath: '/calendar-callback',
});

export const startCalendarOAuth = client.start;
export const handleCalendarCallback = client.complete;
export const clearCalendarTokens = client.clear;
export const isCalendarConnected = client.isConnected;
export const getCalendarAccessToken = client.getAccessToken;
