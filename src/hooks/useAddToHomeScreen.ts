import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { resolveA2HS, type A2HSVariant } from './addToHomeScreen';

const DISMISS_KEY = 'lifeos_a2hs_dismissed';
const SHOWN_COUNT_KEY = 'lifeos_a2hs_shown_count';
const LAST_SHOWN_KEY = 'lifeos_a2hs_last_shown';
const OFFER_SPACING_MS = 7 * 24 * 60 * 60 * 1000;
const OFFER_CAP = 3;

/**
 * install_prompt_v2 trigger discipline (§3.3): may the event-triggered
 * InstallSheet auto-open right now? False when permanently dismissed, after
 * 3 lifetime shows, or within 7 days of the last show. The Profile row's
 * manual open bypasses this gate by design.
 */
export function shouldOfferInstall(): boolean {
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return false;
    const count = Number(localStorage.getItem(SHOWN_COUNT_KEY) ?? '0');
    if (count >= OFFER_CAP) return false;
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY) ?? '0');
    if (last > 0 && Date.now() - last < OFFER_SPACING_MS) return false;
    return true;
  } catch {
    // Storage blocked (private mode) — never auto-offer.
    return false;
  }
}

/**
 * Record the outcome of an InstallSheet offer. 'declined' (Not now / Got it /
 * the ✕) increments the shown count and stamps the spacing window; the third
 * decline becomes the permanent dismissal. 'accepted' (Install tap, or the
 * browser's `appinstalled` event) dismisses permanently — never auto-shown
 * again.
 */
export function recordInstallOffer(outcome: 'accepted' | 'declined'): void {
  try {
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, '1');
      return;
    }
    const count = Number(localStorage.getItem(SHOWN_COUNT_KEY) ?? '0') + 1;
    localStorage.setItem(SHOWN_COUNT_KEY, String(count));
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    if (count >= OFFER_CAP) localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore — the offer caps just won't persist */
  }
}

/** The Chromium-only `beforeinstallprompt` event (not in the standard DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Android fires `beforeinstallprompt` once, often before React mounts — so we
// capture it at module load (web only) and stash it for a one-tap install.
let deferredInstall: BeforeInstallPromptEvent | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // suppress Chrome's mini-infobar; we trigger it ourselves
    deferredInstall = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    // Installed for real — the install offer retires permanently (§3.3).
    recordInstallOffer('accepted');
  });
}

export interface UseAddToHomeScreenResult {
  /** Which prompt to show, or null when it shouldn't appear. */
  variant: A2HSVariant | null;
  /** Android only: a captured prompt is available for a one-tap install. */
  canInstall: boolean;
  /** Trigger the native Android install prompt (no-op if unavailable). */
  install: () => void;
  /** Dismiss the prompt and remember it. */
  dismiss: () => void;
}

/**
 * Decides whether to show the in-app "Add to Home Screen" prompt for the current
 * browser, and exposes the Android one-tap install when Chrome offers it. All
 * the decision logic is the pure `resolveA2HS`; this only reads the live env.
 */
export function useAddToHomeScreen(): UseAddToHomeScreenResult {
  const [variant, setVariant] = useState<A2HSVariant | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* storage blocked (private mode) — treat as not dismissed */
    }

    const displayModeStandalone =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false;
    const navStandalone =
      'standalone' in navigator
        ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
        : false;

    const next = resolveA2HS({
      isWeb: true,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      navigatorStandalone: navStandalone,
      displayModeStandalone,
      dismissed,
    });
    setVariant(next);
    setCanInstall(next === 'android' && deferredInstall !== null);
  }, []);

  const install = useCallback(() => {
    if (deferredInstall) {
      void deferredInstall.prompt();
      // Once consumed it can't be reused; collapse the prompt.
      deferredInstall = null;
      setVariant(null);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore — dismissal just won't persist */
    }
    setVariant(null);
  }, []);

  return { variant, canInstall, install, dismiss };
}
