/**
 * Remember where the user was before kicking off a Google OAuth redirect,
 * so the callback screen can send them back instead of a generic home tab.
 */

const STORAGE_KEY = 'lifeos_oauth_return_path';

export function stashOAuthReturnPath(): void {
  if (typeof window === 'undefined') return;
  const path = `${window.location.pathname}${window.location.search}`;
  if (/callback/i.test(path)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    /* quota / private mode */
  }
}

export function takeOAuthReturnPath(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (!raw || raw === '/') return fallback;
  return raw.startsWith('/') ? raw : `/${raw}`;
}
