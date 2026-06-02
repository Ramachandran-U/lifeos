/**
 * Supabase client AppState auto-refresh wiring (the daily-Gmail-reconnect fix).
 * On native, foreground must start token auto-refresh and background must stop
 * it; on web it's a no-op (the browser refreshes). This is the exact code that
 * fixed sessions lapsing overnight, so it needs a regression guard.
 */
const mockClient = { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(), getSession: jest.fn() } };
const mockAddEventListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockClient }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../session', () => ({ setSupabaseTokenGetter: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: mockAddEventListener } }));

import { wireAppStateAutoRefresh, isSupabaseConfigured } from '../client';
import { Platform } from 'react-native';

beforeEach(() => jest.clearAllMocks());
afterEach(() => { Platform.OS = 'ios' as typeof Platform.OS; });

describe('wireAppStateAutoRefresh', () => {
  test('web → no listener registered (browser handles refresh)', () => {
    Platform.OS = 'web' as typeof Platform.OS;
    wireAppStateAutoRefresh(mockClient);
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  test('native foreground starts, background stops, token auto-refresh', () => {
    Platform.OS = 'ios' as typeof Platform.OS;
    wireAppStateAutoRefresh(mockClient);
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    const handler = mockAddEventListener.mock.calls[0][1] as (s: string) => void;
    handler('active');
    expect(mockClient.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockClient.auth.stopAutoRefresh).not.toHaveBeenCalled();

    handler('background');
    expect(mockClient.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('isSupabaseConfigured', () => {
  test('returns a boolean reflecting whether URL + anon key are set', () => {
    expect(typeof isSupabaseConfigured()).toBe('boolean');
  });
});
