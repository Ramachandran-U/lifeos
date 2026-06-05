jest.mock('@/components/shared/AuroraBackground', () => ({ AuroraBackground: () => null }));

import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RabbitHoleScreen } from '@/components/modules/polymath/RabbitHoleScreen';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';

// Minimal safe-area metrics so SafeAreaView renders deterministically in tests.
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

beforeEach(() => useRabbitHoleStore.getState().resetTree());

describe('RabbitHoleScreen', () => {
  // Smoke: the composition (header + depth badge + map pane) mounts without a
  // tree loaded. This is the one piece the per-component tests don't cover.
  it('mounts the header with no tree loaded', () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <RabbitHoleScreen seed={null} onExit={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('DEPTH 0 / 12')).toBeTruthy();
  });
});
