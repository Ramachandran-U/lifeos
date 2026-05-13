import { createGoogleOAuthClient } from '@/integrations/google/oauth';

export const FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  'https://www.googleapis.com/auth/fitness.blood_pressure.read',
].join(' ');

const client = createGoogleOAuthClient({
  scopes: FIT_SCOPES,
  tokenKey: 'lifeos_gfit_tokens',
  verifierKey: 'lifeos_gfit_pkce_verifier',
  redirectPath: '/fit-callback',
});

export const startFitOAuth = client.start;
export const handleFitCallback = client.complete;
export const clearFitTokens = client.clear;
export const isFitConnected = client.isConnected;
export const getFitAccessToken = client.getAccessToken;
export const consumeFitReturnPath = client.consumeReturnPath;
