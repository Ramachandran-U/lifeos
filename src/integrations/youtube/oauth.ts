import { createGoogleOAuthClient } from '@/integrations/google/oauth';

/**
 * Read-only YouTube access — used to import the user's subscriptions into the
 * Explore engine's interests. Reuses the shared Google PKCE driver (same
 * recipe as Calendar/Fit/Gmail), so the token exchange runs server-side on the
 * Worker. Web-only.
 */
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

const client = createGoogleOAuthClient({
  scopes: YOUTUBE_SCOPES,
  tokenKey: 'lifeos_youtube_tokens',
  verifierKey: 'lifeos_youtube_pkce_verifier',
  redirectPath: '/youtube-callback',
});

export const startYouTubeOAuth = client.start;
export const handleYouTubeCallback = client.complete;
export const clearYouTubeTokens = client.clear;
export const isYouTubeConnected = client.isConnected;
export const getYouTubeAccessToken = client.getAccessToken;
export const consumeYouTubeReturnPath = client.consumeReturnPath;
