// Thin accessor for the current Supabase access token. `client.ts` wires this
// to `supabase.auth.getSession()` at module init. Anything that needs to call
// the proxy/voice AI endpoints reads through here so it does not have to
// import the Supabase client directly. Returns null when there is no session,
// in which case the proxy returns 401 — mock mode
// (EXPO_PUBLIC_USE_AI_MOCK=true) keeps the app usable during development.

let tokenGetter: () => Promise<string | null> = async () => null;

export function setSupabaseTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  return tokenGetter();
}
