import {
  startOAuth,
  completeOAuth,
  getAccessToken as getToken,
  isConnected,
  clearTokens,
  type OAuthConfig,
} from '@/integrations/google/oauth';

export const AUTH_SCOPES = 'openid email profile';

const AUTH_CONFIG: OAuthConfig = {
  scopes: AUTH_SCOPES,
  tokenKey: 'lifeos_gauth_tokens',
  verifierKey: 'lifeos_gauth_pkce_verifier',
  redirectPath: '/google-auth-callback',
};

export function startGoogleAuthOAuth(clientId: string): Promise<void> {
  return startOAuth(clientId, AUTH_CONFIG);
}

export function handleGoogleAuthCallback(code: string, clientId: string): Promise<void> {
  return completeOAuth(code, clientId, AUTH_CONFIG);
}

export function clearGoogleAuthTokens(): void {
  clearTokens(AUTH_CONFIG);
}

export function isGoogleAuthConnected(): boolean {
  return isConnected(AUTH_CONFIG);
}

export function getGoogleAuthAccessToken(clientId: string): Promise<string | null> {
  return getToken(clientId, AUTH_CONFIG);
}
