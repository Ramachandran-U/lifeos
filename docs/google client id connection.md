# Google Client ID Connection — Learnings & State

Scratch notes capturing what we've learned about the Gmail OAuth integration so we can pick it back up later.

## What we're trying to do

Connect the user's Gmail account so LifeOS can read transaction emails (Finance tab → "Connect Gmail" button). Read-only scope: `https://www.googleapis.com/auth/gmail.readonly`. Runs **web-only** — mobile uses a different flow not yet built.

## How the app implements it

**File**: [src/finance/gmail/oauth.ts](src/finance/gmail/oauth.ts)

- **PKCE flow, no client secret** — entirely browser-side.
- `startGmailOAuth(clientId)` generates a PKCE verifier, stores it in `sessionStorage`, redirects to `accounts.google.com/o/oauth2/v2/auth`.
- `handleOAuthCallback(code, clientId)` POSTs to `https://oauth2.googleapis.com/token` with the code + verifier, stores the returned tokens in `localStorage` under `lifeos_gmail_tokens`.
- `redirect_uri` is hard-derived as `${window.location.origin}/gmail-callback`.
- Button handler in [app/(tabs)/finance.tsx:189](app/(tabs)/finance.tsx#L189) reads `process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID`. If empty, it alerts "not configured".

## Config that must line up

1. **`.env` at repo root** needs `EXPO_PUBLIC_GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com`.
   - `EXPO_PUBLIC_` prefix is mandatory — only those get inlined into the web bundle.
   - After changing `.env` you MUST restart `npx expo start` (the env is baked into the bundle at startup; HMR won't pick it up).
   - Verify it's loaded by looking at the Expo startup line: `env: export ... EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
2. **Expo runs on port 8081** — the redirect URI is derived from `window.location.origin`, so the dev server must be on whichever port was registered in Google Cloud Console.
3. **Google Cloud Console → Credentials → OAuth 2.0 Client**:
   - **Authorized JavaScript origins**: `http://localhost:8081` (no path, no trailing slash)
   - **Authorized redirect URIs**: `http://localhost:8081/gmail-callback` (path required, no trailing slash)
4. **OAuth consent screen** in Testing mode requires the signing-in Gmail account to be added as a **Test user**. Production mode is also fine for personal use.

## Errors we've hit (in order) and the fix for each

| Symptom | Root cause | Fix |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured` alert | Var missing from `.env`, or `.env` not in the path Expo loads, or server not restarted | Put var in `C:\personal\Project X\lifeos\.env` (main repo, not the worktree copy). Restart Expo. Confirm the startup `env: export` line lists the var. |
| `Error 400: redirect_uri_mismatch` from Google consent page | Redirect URI not registered on the OAuth client | Add `http://localhost:8081/gmail-callback` under Authorized redirect URIs. |
| `Invalid Origin: URIs must not contain a path or end with "/"` when saving the origin | Confused JavaScript origin with redirect URI | Origin goes in "Authorized JavaScript origins" (host only), redirect goes in "Authorized redirect URIs". |
| `Error 403: access_denied` after consent | App in Testing mode, signing-in account not added as test user | Add the account under OAuth consent → Test users. Allow ~5 min to propagate. |
| `oauth2.googleapis.com/token 400` in browser console (current blocker) | Most likely: client is type "Web application" with a client secret attached — our PKCE code sends no secret, so Google rejects with `invalid_client`. Need to confirm the response body. | Two options: (a) temporarily send `client_secret` from `.env` (dev only), (b) recreate OAuth client without a secret so Google treats it as public PKCE. |

## Current state (as of 2026-04-21)

- `.env` has the client ID: `503288697198-h45abmmpqcafo11i0khvh1910ncc3m9g.apps.googleusercontent.com`
- Expo dev server is running on http://localhost:8081 with the env var loaded
- Origin and redirect URI are registered correctly
- Test user is added on the consent screen
- **Stuck**: token exchange returns HTTP 400 — need to read the JSON body from the Network tab response to confirm it's `invalid_client` before picking a fix.

## Where to pick back up

1. Open browser DevTools → Network → click the failed `token` request → copy the JSON response body.
2. If `error: invalid_client` → pick fix (a) or (b) above.
3. If `error: invalid_grant` → the code verifier is being lost across the redirect (sessionStorage wiped) — investigate why; may need to persist verifier somewhere more durable.
4. If `error: redirect_uri_mismatch` again → the redirect URI on the token POST doesn't exactly equal the one on the initial auth request (check for trailing slashes, http vs https).
5. Once the token exchange succeeds, verify `lifeos_gmail_tokens` lands in localStorage and the Finance tab flips to the connected state.

## Files involved

- [src/finance/gmail/oauth.ts](src/finance/gmail/oauth.ts) — PKCE flow, token storage, refresh
- [app/(tabs)/finance.tsx](app/(tabs)/finance.tsx) — Connect Gmail button, reads env var
- [.env](.env) — holds `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `app/gmail-callback.tsx` (if it exists) — handles `?code=...` after Google redirects back

## Things worth double-checking later

- Does the callback route (`/gmail-callback`) exist in `app/`? If Expo Router doesn't match it, Google's redirect lands on a 404 and the code never reaches `handleOAuthCallback`.
- PKCE verifier is kept in `sessionStorage` — fine because the redirect returns to the same origin, but if anything blows away session state between redirect out and redirect back, the token exchange fails.
- The hard-coded redirect `${window.location.origin}/gmail-callback` assumes Expo Router serves that path. Verify by loading `http://localhost:8081/gmail-callback` directly; it should render the callback screen, not a 404.
