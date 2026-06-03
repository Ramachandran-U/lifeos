import { render, screen } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { SyncStatus } from '@/components/shared/SyncStatus';
import { useSyncStore } from '@/store/useSyncStore';

describe('SyncStatus', () => {
  afterEach(() => {
    useSyncStore.setState({ phase: 'idle', lastSyncedAt: null });
  });

  it('shows "Sync off" when the engine is disabled', () => {
    useSyncStore.setState({ phase: 'disabled' });
    render(<SyncStatus />);
    expect(screen.getByText('Sync off')).toBeTruthy();
  });

  it('prompts to sign in when signed out', () => {
    useSyncStore.setState({ phase: 'signed_out' });
    render(<SyncStatus />);
    expect(screen.getByText('Sign in to sync')).toBeTruthy();
  });

  it('shows "Syncing…" while pushing', () => {
    useSyncStore.setState({ phase: 'pushing' });
    render(<SyncStatus />);
    expect(screen.getByText('Syncing…')).toBeTruthy();
  });

  it('shows "Syncing…" while pulling', () => {
    useSyncStore.setState({ phase: 'pulling' });
    render(<SyncStatus />);
    expect(screen.getByText('Syncing…')).toBeTruthy();
  });

  it('shows the "not yet" synced label when idle with no prior sync', () => {
    useSyncStore.setState({ phase: 'idle', lastSyncedAt: null });
    render(<SyncStatus />);
    expect(screen.getByText('Synced · not yet')).toBeTruthy();
  });

  it('shows "just now" right after a successful sync', () => {
    useSyncStore.setState({ phase: 'idle', lastSyncedAt: Date.now() });
    render(<SyncStatus />);
    expect(screen.getByText('Synced · just now')).toBeTruthy();
  });
});
