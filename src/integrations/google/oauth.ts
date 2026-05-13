/**
 * Shared Google OAuth 2.0 (PKCE) driver. Parameterised by scope + storage key
 * so each integration (Auth/SSO, Fit, Calendar, ...) gets its own token bucket
 * without duplicating the handshake code. Web-only.
 *
 * Per-integration modules should call `createGoogleOAuthClient(cfg)` once and
 * re-export the bound functions — see `googleAuth/oauth.ts` for the canonical
 * pattern.
 */

import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

async function workerTokenExchange(body: Record<string, string>): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}> {
  const bearer = await getSupabaseAccessToken();
  if (!bearer) throw new Error('Sign in required to connect Google.');
  const res = await fetch(`${PROXY_URL}/v1/google/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? `${res.status}`;
    throw Object.assign(new Error(`Google token exchange failed: ${err}`), { code: err });
  }
  return json as { access_token: string; refresh_token?: string; expires_in?: number };
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

function returnPathKey(cfg: OAuthConfig): string {
  return `${cfg.verifierKey}_return`;
}

/** Reads + clears the stored return path from sessionStorage. */
export function consumeReturnPath(cfg: OAuthConfig): string | null {
  if (typeof window === 'undefined') return null;
  const key = returnPathKey(cfg);
  const value = sessionStorage.getItem(key);
  if (value) sessionStorage.removeItem(key);
  return value;
}

export async function startOAuth(clientId: string, cfg: OAuthConfig): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Google OAuth is web-only');
  const verifier = generateVerifier();
  const challenge = await challengeFor(verifier);
  sessionStorage.setItem(cfg.verifierKey, verifier);
  // Stash the page we're leaving so the callback can send the user back.
  // Skip if we somehow start from a callback route to avoid loops.
  const here = `${window.location.pathname}${window.location.search}`;
  if (!here.includes('-callback')) {
    sessionStorage.setItem(returnPathKey(cfg), here);
  }

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

  const json = await workerTokenExchange({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: getRedirectUri(cfg.redirectPath),
  });
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
  refreshToken: string,
  cfg: OAuthConfig,
): Promise<GoogleTokens> {
  const json = await workerTokenExchange({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
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
    const next = await refreshAccessToken(tokens.refresh_token, cfg);
    return next.access_token;
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'invalid_grant') {
      clearTokens(cfg);
    }
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
  /** Returns the path the user was on when `start` was called, then clears it. */
  consumeReturnPath(): string | null;
}

export function createGoogleOAuthClient(cfg: OAuthConfig): GoogleOAuthClient {
  return {
    start: (clientId) => startOAuth(clientId, cfg),
    complete: (code, clientId) => completeOAuth(code, clientId, cfg),
    clear: () => clearTokens(cfg),
    isConnected: () => isConnected(cfg),
    getAccessToken: (clientId) => getAccessToken(clientId, cfg),
    consumeReturnPath: () => consumeReturnPath(cfg),
  };
}
