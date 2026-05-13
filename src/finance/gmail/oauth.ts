/**
 * Gmail OAuth — thin wrapper around the shared Google OAuth driver.
 * Public API unchanged so the rest of the finance module keeps working.
 */

import {
  startOAuth,
  completeOAuth,
  getAccessToken as getToken,
  isConnected,
  clearTokens,
  type OAuthConfig,
} from '@/integrations/google/oauth';

export const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

const GMAIL_CONFIG: OAuthConfig = {
  scopes: GMAIL_SCOPES,
  tokenKey: 'lifeos_gmail_tokens',
  verifierKey: 'lifeos_gmail_pkce_verifier',
  redirectPath: '/gmail-callback',
};

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export function startGmailOAuth(clientId: string): Promise<void> {
  return startOAuth(clientId, GMAIL_CONFIG);
}

export function handleOAuthCallback(code: string, clientId: string): Promise<void> {
  return completeOAuth(code, clientId, GMAIL_CONFIG);
}

export function clearGmailTokens(): void {
  clearTokens(GMAIL_CONFIG);
}

export function isGmailConnected(): boolean {
  return isConnected(GMAIL_CONFIG);
}

export function getAccessToken(clientId: string): Promise<string | null> {
  return getToken(clientId, GMAIL_CONFIG);
}
