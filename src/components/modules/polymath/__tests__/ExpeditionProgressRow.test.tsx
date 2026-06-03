import { render, screen, fireEvent } from '@testing-library/react-native';
import { ExpeditionProgressRow } from '@/components/modules/polymath/ExpeditionProgressRow';
import type { Expedition, ExpeditionProgress } from '@/explore/expeditions';

const makeExpedition = (id: string, title: string, totalSteps: number): Expedition => ({
  id,
  userId: 'user_1',
  title,
  theme: 'curiosity',
  domain: 'polymath',
  steps: [],
  totalSteps,
  source: 'curated',
  seedSparkId: null,
  createdAt: '2026-06-01T00:00:00.000Z',
});

const makeProgress = (expeditionId: string, completed: number[]): ExpeditionProgress => ({
  id: `prog_${expeditionId}`,
  userId: 'user_1',
  expeditionId,
  status: 'active',
  currentStep: completed.length,
  completedSteps: completed,
  startedAt: '2026-06-01T00:00:00.000Z',
  lastActivityAt: '2026-06-02T00:00:00.000Z',
  completedAt: null,
  updatedAt: '2026-06-02T00:00:00.000Z',
});

describe('ExpeditionProgressRow', () => {
  it('renders null (no section header) when there are no expeditions', () => {
    render(<ExpeditionProgressRow expeditions={[]} onPress={() => {}} />);
    expect(screen.queryByText('ACTIVE EXPEDITIONS')).toBeNull();
  });

  it('renders the title, percent and step count for an expedition', () => {
    render(
      <ExpeditionProgressRow
        expeditions={[
          { expedition: makeExpedition('e1', 'Origins of jazz', 4), progress: makeProgress('e1', [0, 1]) },
        ]}
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('ACTIVE EXPEDITIONS')).toBeTruthy();
    expect(screen.getByText('Origins of jazz')).toBeTruthy();
    // 2 of 4 steps completed → 50%
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('2/4 steps')).toBeTruthy();
  });

  it('fires onPress with the expedition id when a card is tapped', () => {
    const onPress = jest.fn();
    render(
      <ExpeditionProgressRow
        expeditions={[
          { expedition: makeExpedition('e9', 'Tap target', 2), progress: makeProgress('e9', [0]) },
        ]}
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByText('Tap target'));
    expect(onPress).toHaveBeenCalledWith('e9');
  });
});
