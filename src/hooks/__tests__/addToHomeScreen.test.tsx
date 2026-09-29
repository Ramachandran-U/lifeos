/**
 * Pure A2HS eligibility — deterministic over an injected env (no DOM/RN).
 */
import { resolveA2HS, type A2HSEnv } from '../addToHomeScreen';

const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
  iPadOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  androidFacebook:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/450.0]',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const env = (over: Partial<A2HSEnv> & { userAgent: string }): A2HSEnv => ({
  isWeb: true,
  maxTouchPoints: 0,
  navigatorStandalone: false,
  displayModeStandalone: false,
  dismissed: false,
  ...over,
});

describe('resolveA2HS — shows the right variant', () => {
  it('iOS Safari (not installed) → ios', () => {
    expect(resolveA2HS(env({ userAgent: UA.iosSafari }))).toBe('ios');
  });

  it('iPadOS (Mac UA + touch) Safari → ios', () => {
    expect(resolveA2HS(env({ userAgent: UA.iPadOS, maxTouchPoints: 5 }))).toBe('ios');
  });

  it('Android Chrome → android', () => {
    expect(resolveA2HS(env({ userAgent: UA.androidChrome }))).toBe('android');
  });

  it('Android Samsung Internet → android', () => {
    expect(resolveA2HS(env({ userAgent: UA.androidSamsung }))).toBe('android');
  });
});

describe('resolveA2HS — stays hidden', () => {
  it('iOS Chrome (CriOS) → null (A2HS is Safari-only on iOS)', () => {
    expect(resolveA2HS(env({ userAgent: UA.iosChrome }))).toBeNull();
  });

  it('a real Mac (Mac UA, no touch) → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.macSafari, maxTouchPoints: 0 }))).toBeNull();
  });

  it('Android WebView (; wv) → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.androidWebView }))).toBeNull();
  });

  it('Android Facebook in-app browser → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.androidFacebook }))).toBeNull();
  });

  it('desktop Chrome → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.desktopChrome }))).toBeNull();
  });

  it('already installed via navigator.standalone → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.iosSafari, navigatorStandalone: true }))).toBeNull();
  });

  it('already installed via display-mode: standalone → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.androidChrome, displayModeStandalone: true }))).toBeNull();
  });

  it('previously dismissed → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.iosSafari, dismissed: true }))).toBeNull();
  });

  it('not a web build → null', () => {
    expect(resolveA2HS(env({ userAgent: UA.iosSafari, isWeb: false }))).toBeNull();
  });
});
