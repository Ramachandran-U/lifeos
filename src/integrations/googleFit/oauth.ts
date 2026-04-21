import {
  startOAuth,
  completeOAuth,
  getAccessToken as getToken,
  isConnected,
  clearTokens,
  type OAuthConfig,
} from '@/integrations/google/oauth';

export const FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  'https://www.googleapis.com/auth/fitness.blood_pressure.read',
].join(' ');

const FIT_CONFIG: OAuthConfig = {
  scopes: FIT_SCOPES,
  tokenKey: 'lifeos_gfit_tokens',
  verifierKey: 'lifeos_gfit_pkce_verifier',
  redirectPath: '/fit-callback',
};

export function startFitOAuth(clientId: string): Promise<void> {
  return startOAuth(clientId, FIT_CONFIG);
}

export function handleFitCallback(code: string, clientId: string): Promise<void> {
  return completeOAuth(code, clientId, FIT_CONFIG);
}

export function clearFitTokens(): void {
  clearTokens(FIT_CONFIG);
}

export function isFitConnected(): boolean {
  return isConnected(FIT_CONFIG);
}

export function getFitAccessToken(clientId: string): Promise<string | null> {
  return getToken(clientId, FIT_CONFIG);
}
