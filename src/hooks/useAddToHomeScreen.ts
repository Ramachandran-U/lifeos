import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { resolveA2HS, type A2HSVariant } from './addToHomeScreen';

const DISMISS_KEY = 'lifeos_a2hs_dismissed';

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
