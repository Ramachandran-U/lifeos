/**
 * Gmail OAuth 2.0 with PKCE — web-only. No client secret, runs entirely client-side.
 * Tokens persisted to localStorage; auto-refreshed via refresh_token when expired.
 */

export const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY = 'lifeos_gmail_tokens';
const VERIFIER_KEY = 'lifeos_gmail_pkce_verifier';

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

function getRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/gmail-callback`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

function generateVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

async function challengeFor(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier));
}

export async function startGmailOAuth(clientId: string): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Gmail OAuth is web-only');
  const verifier = generateVerifier();
  const challenge = await challengeFor(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleOAuthCallback(code: string, clientId: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('Missing PKCE verifier — start the OAuth flow again');

  const clientSecret = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;
  const body = new URLSearchParams({
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  storeTokens({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  sessionStorage.removeItem(VERIFIER_KEY);
}

function readTokens(): GmailTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as GmailTokens) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens: GmailTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearGmailTokens(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

export function isGmailConnected(): boolean {
  return !!readTokens();
}

async function refreshAccessToken(clientId: string, refreshToken: string): Promise<GmailTokens> {
  const clientSecret = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;
  const body = new URLSearchParams({
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  const json = await res.json();
  const next: GmailTokens = {
    access_token: json.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  storeTokens(next);
  return next;
}

export async function getAccessToken(clientId: string): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 30_000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  try {
    const next = await refreshAccessToken(clientId, tokens.refresh_token);
    return next.access_token;
  } catch {
    return null;
  }
}
