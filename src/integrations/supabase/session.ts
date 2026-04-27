// Thin accessor for the current Supabase access token. Day 2 wires this to
// supabase.auth.getSession(). Until then it returns null and the AI proxy
// returns 401 — mock mode (EXPO_PUBLIC_USE_AI_MOCK=true) keeps the app usable
// during development.

let tokenGetter: () => Promise<string | null> = async () => null;

export function setSupabaseTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  return tokenGetter();
}
