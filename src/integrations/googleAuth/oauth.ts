import { createGoogleOAuthClient } from '@/integrations/google/oauth';

export const AUTH_SCOPES = 'openid email profile';

const client = createGoogleOAuthClient({
  scopes: AUTH_SCOPES,
  tokenKey: 'lifeos_gauth_tokens',
  verifierKey: 'lifeos_gauth_pkce_verifier',
  redirectPath: '/google-auth-callback',
});

export const startGoogleAuthOAuth = client.start;
export const handleGoogleAuthCallback = client.complete;
export const clearGoogleAuthTokens = client.clear;
export const isGoogleAuthConnected = client.isConnected;
export const getGoogleAuthAccessToken = client.getAccessToken;
