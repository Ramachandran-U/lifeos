/**
 * install_prompt_v2 trigger discipline (Acceptance #4) —
 * shouldOfferInstall / recordInstallOffer persistence semantics.
 *
 * Keys: lifeos_a2hs_dismissed ('1'), lifeos_a2hs_shown_count (int-as-string),
 * lifeos_a2hs_last_shown (epoch-ms-as-string); 7 days = 604800000ms; cap = 3.
 *
 * NOTE: named .test.tsx (not .test.ts) so jest's `components` project
 * discovers it — src/hooks .test.ts files are matched by neither project.
 */
import { shouldOfferInstall, recordInstallOffer } from '@/hooks/useAddToHomeScreen';

const WEEK_MS = 604800000;

// jest-expo's environment has no localStorage — install an in-memory one.
const store = new Map<string, string>();
beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  });
});

beforeEach(() => store.clear());

describe('shouldOfferInstall', () => {
  it("returns false when lifeos_a2hs_dismissed === '1'", () => {
    store.set('lifeos_a2hs_dismissed', '1');
    expect(shouldOfferInstall()).toBe(false);
  });

  it('returns false when lifeos_a2hs_shown_count >= 3', () => {
    store.set('lifeos_a2hs_shown_count', '3');
    expect(shouldOfferInstall()).toBe(false);
  });

  it('returns false when shown count exceeds the cap', () => {
    store.set('lifeos_a2hs_shown_count', '7');
    expect(shouldOfferInstall()).toBe(false);
  });

  it('returns false when Date.now() − Number(lifeos_a2hs_last_shown) < 604800000', () => {
    store.set('lifeos_a2hs_last_shown', String(Date.now() - (WEEK_MS - 1000)));
    expect(shouldOfferInstall()).toBe(false);
  });

  it('returns true when the last show is at least 7 days old', () => {
    store.set('lifeos_a2hs_shown_count', '1');
    store.set('lifeos_a2hs_last_shown', String(Date.now() - WEEK_MS - 1000));
    expect(shouldOfferInstall()).toBe(true);
  });

  it('returns true otherwise (clean slate)', () => {
    expect(shouldOfferInstall()).toBe(true);
  });
});

describe('recordInstallOffer', () => {
  it("'declined' increments the shown count and stamps last_shown", () => {
    const before = Date.now();
    recordInstallOffer('declined');
    expect(store.get('lifeos_a2hs_shown_count')).toBe('1');
    expect(Number(store.get('lifeos_a2hs_last_shown'))).toBeGreaterThanOrEqual(before);
    expect(store.get('lifeos_a2hs_dismissed')).toBeUndefined();
  });

  it("'declined' called three times sets lifeos_a2hs_dismissed = '1'", () => {
    recordInstallOffer('declined');
    recordInstallOffer('declined');
    expect(store.get('lifeos_a2hs_dismissed')).toBeUndefined();
    recordInstallOffer('declined');
    expect(store.get('lifeos_a2hs_shown_count')).toBe('3');
    expect(store.get('lifeos_a2hs_dismissed')).toBe('1');
    expect(shouldOfferInstall()).toBe(false);
  });

  it("'accepted' permanently dismisses without touching the counters", () => {
    recordInstallOffer('accepted');
    expect(store.get('lifeos_a2hs_dismissed')).toBe('1');
    expect(store.get('lifeos_a2hs_shown_count')).toBeUndefined();
    expect(shouldOfferInstall()).toBe(false);
  });

  it('a fresh decline re-arms only after the 7-day spacing window', () => {
    recordInstallOffer('declined');
    expect(shouldOfferInstall()).toBe(false); // within the window
    store.set('lifeos_a2hs_last_shown', String(Date.now() - WEEK_MS - 1));
    expect(shouldOfferInstall()).toBe(true); // window cleared, count 1 < 3
  });
});
