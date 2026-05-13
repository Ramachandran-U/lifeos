import { getGoogleAuthAccessToken } from './oauth';

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

export async function fetchGoogleProfile(clientId: string): Promise<GoogleProfile> {
  const token = await getGoogleAuthAccessToken(clientId);
  if (!token) throw new Error('Google auth token missing');
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as GoogleProfile;
  if (!json.email) throw new Error('Google did not return an email address');
  return json;
}
