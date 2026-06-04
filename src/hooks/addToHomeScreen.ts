/**
 * Pure "Add to Home Screen" eligibility logic — no React, no DOM, no RN imports,
 * so it unit-tests as a plain function. The hook (useAddToHomeScreen) gathers the
 * live environment and delegates here.
 *
 * Why this exists: a tester can run LifeOS straight from its URL and install it
 * to the home screen as a standalone app (the manifest + Apple meta tags are
 * already wired in app/+html.tsx). But neither platform makes that obvious —
 * iOS Safari shows no install UI at all, and Android's lives behind the ⋮ menu —
 * so we surface an in-app instructional prompt. This decides whether, and which
 * variant, to show.
 */

export type A2HSVariant = 'ios' | 'android';

export interface A2HSEnv {
  /** Web platform? (the prompt is web-only; native apps are already installed). */
  isWeb: boolean;
  userAgent: string;
  /** navigator.maxTouchPoints — used to spot iPadOS, which reports a Mac UA. */
  maxTouchPoints: number;
  /** iOS Safari's non-standard navigator.standalone (true once installed). */
  navigatorStandalone: boolean;
  /** matchMedia('(display-mode: standalone)').matches (true once installed). */
  displayModeStandalone: boolean;
  /** The user already dismissed the prompt (persisted). */
  dismissed: boolean;
}

// In-app browsers / embedded webviews where "Add to Home Screen" is unavailable
// (Instagram, Facebook, WhatsApp, Line, Google App, generic Android WebView).
const IN_APP_BROWSER = /(FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|GSA\/|; wv\)|\bwv\b)/i;

function isIOS(env: A2HSEnv): boolean {
  if (/iPhone|iPad|iPod/.test(env.userAgent)) return true;
  // iPadOS 13+ masquerades as desktop Safari ("Macintosh"); a touch count
  // disambiguates a real iPad from a Mac.
  if (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1) return true;
  return false;
}

/**
 * Returns which install-prompt variant to show, or null when it shouldn't show:
 * not web, already installed/standalone, already dismissed, an in-app webview,
 * or a browser/OS where A2HS isn't offered.
 */
export function resolveA2HS(env: A2HSEnv): A2HSVariant | null {
  if (!env.isWeb || env.dismissed) return null;
  if (env.navigatorStandalone || env.displayModeStandalone) return null; // already installed
  if (IN_APP_BROWSER.test(env.userAgent)) return null;

  if (isIOS(env)) {
    // iOS A2HS only works in real Safari — Chrome/Firefox/Edge on iOS can't.
    const isSafari = /Safari/.test(env.userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(env.userAgent);
    return isSafari ? 'ios' : null;
  }

  if (/Android/i.test(env.userAgent)) {
    // Chromium-family Android browsers expose install via the ⋮ menu (and may
    // fire beforeinstallprompt). Samsung Internet and Edge support it too.
    const installable = /(Chrome|Chromium|SamsungBrowser|EdgA)\//i.test(env.userAgent);
    return installable ? 'android' : null;
  }

  return null;
}
