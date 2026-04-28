/**
 * Shared Google OAuth 2.0 (PKCE) driver. Parameterised by scope + storage key
 * so each integration (Auth/SSO, Fit, Calendar, ...) gets its own token bucket
 * without duplicating the handshake code. Web-only.
 *
 * Per-integration modules should call `createGoogleOAuthClient(cfg)` once and
 * re-export the bound functions — see `googleAuth/oauth.ts` for the canonical
 * pattern.
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface OAuthConfig {
  /** OAuth scopes, space-separated. */
  scopes: string;
  /** localStorage key for persisted tokens. */
  tokenKey: string;
  /** sessionStorage key for the PKCE verifier during the redirect round-trip. */
  verifierKey: string;
  /** Path under window.location.origin that Google will redirect to. */
  redirectPath: string;
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
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

async function challengeFor(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier));
}

function getRedirectUri(path: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${path}`;
}

export async function startOAuth(clientId: string, cfg: OAuthConfig): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Google OAuth is web-only');
  const verifier = generateVerifier();
  const challenge = await challengeFor(verifier);
  sessionStorage.setItem(cfg.verifierKey, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(cfg.redirectPath),
    response_type: 'code',
    scope: cfg.scopes,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeOAuth(
  code: string,
  clientId: string,
  cfg: OAuthConfig,
): Promise<void> {
  const verifier = sessionStorage.getItem(cfg.verifierKey);
  if (!verifier) throw new Error('Missing PKCE verifier — start the OAuth flow again');

  const clientSecret = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;
  const body = new URLSearchParams({
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(cfg.redirectPath),
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  storeTokens(cfg, {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  sessionStorage.removeItem(cfg.verifierKey);
}

function readTokens(cfg: OAuthConfig): GoogleTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cfg.tokenKey);
    return raw ? (JSON.parse(raw) as GoogleTokens) : null;
  } catch {
    return null;
  }
}

function storeTokens(cfg: OAuthConfig, tokens: GoogleTokens): void {
  localStorage.setItem(cfg.tokenKey, JSON.stringify(tokens));
}

export function clearTokens(cfg: OAuthConfig): void {
  if (typeof window !== 'undefined') localStorage.removeItem(cfg.tokenKey);
}

export function isConnected(cfg: OAuthConfig): boolean {
  return !!readTokens(cfg);
}

async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  cfg: OAuthConfig,
): Promise<GoogleTokens> {
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
  const next: GoogleTokens = {
    access_token: json.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  storeTokens(cfg, next);
  return next;
}

export async function getAccessToken(clientId: string, cfg: OAuthConfig): Promise<string | null> {
  const tokens = readTokens(cfg);
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 30_000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  try {
    const next = await refreshAccessToken(clientId, tokens.refresh_token, cfg);
    return next.access_token;
  } catch {
    return null;
  }
}

/**
 * Bind every OAuth helper to a single config. Per-integration modules use this
 * to expose a clean, unprefixed surface (`start`, `complete`, ...) without
 * repeating the `cfg` argument at every call site.
 */
export interface GoogleOAuthClient {
  start(clientId: string): Promise<void>;
  complete(code: string, clientId: string): Promise<void>;
  clear(): void;
  isConnected(): boolean;
  getAccessToken(clientId: string): Promise<string | null>;
}

export function createGoogleOAuthClient(cfg: OAuthConfig): GoogleOAuthClient {
  return {
    start: (clientId) => startOAuth(clientId, cfg),
    complete: (code, clientId) => completeOAuth(code, clientId, cfg),
    clear: () => clearTokens(cfg),
    isConnected: () => isConnected(cfg),
    getAccessToken: (clientId) => getAccessToken(clientId, cfg),
  };
}
