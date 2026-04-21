import {
  startOAuth,
  completeOAuth,
  getAccessToken as getToken,
  isConnected,
  clearTokens,
  type OAuthConfig,
} from '@/integrations/google/oauth';

export const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.events';

const CALENDAR_CONFIG: OAuthConfig = {
  scopes: CALENDAR_SCOPES,
  tokenKey: 'lifeos_gcal_tokens',
  verifierKey: 'lifeos_gcal_pkce_verifier',
  redirectPath: '/calendar-callback',
};

export function startCalendarOAuth(clientId: string): Promise<void> {
  return startOAuth(clientId, CALENDAR_CONFIG);
}

export function handleCalendarCallback(code: string, clientId: string): Promise<void> {
  return completeOAuth(code, clientId, CALENDAR_CONFIG);
}

export function clearCalendarTokens(): void {
  clearTokens(CALENDAR_CONFIG);
}

export function isCalendarConnected(): boolean {
  return isConnected(CALENDAR_CONFIG);
}

export function getCalendarAccessToken(clientId: string): Promise<string | null> {
  return getToken(clientId, CALENDAR_CONFIG);
}
