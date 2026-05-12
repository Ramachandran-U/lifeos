/**
 * Google OAuth token exchange proxy.
 *
 * Why this exists: Google "Web application" OAuth clients require a
 * client_secret even for PKCE flows. We don't want that secret in the app
 * bundle (Metro inlines `EXPO_PUBLIC_*` vars into every platform build, so a
 * client-side secret is recoverable from any APK/IPA). The Worker holds it
 * as a Wrangler secret and performs the exchange server-side.
 */

import type { Env } from '../index';

interface AuthCodeBody {
  grant_type: 'authorization_code';
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

interface RefreshBody {
  grant_type: 'refresh_token';
  refresh_token: string;
}

type Body = AuthCodeBody | RefreshBody;

export async function handleGoogleToken(
  req: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_CLIENT_ID/SECRET not configured on Worker' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: body.grant_type,
  });

  if (body.grant_type === 'authorization_code') {
    if (!body.code || !body.code_verifier || !body.redirect_uri) {
      return new Response(JSON.stringify({ error: 'missing code/code_verifier/redirect_uri' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    params.set('code', body.code);
    params.set('code_verifier', body.code_verifier);
    params.set('redirect_uri', body.redirect_uri);
  } else if (body.grant_type === 'refresh_token') {
    if (!body.refresh_token) {
      return new Response(JSON.stringify({ error: 'missing refresh_token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    params.set('refresh_token', body.refresh_token);
  } else {
    return new Response(JSON.stringify({ error: 'unsupported grant_type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const googleRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const text = await googleRes.text();
  return new Response(text, {
    status: googleRes.status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
