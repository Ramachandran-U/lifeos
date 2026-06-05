import { render, screen } from '@testing-library/react-native';
import { RabbitHoleMapView } from '@/components/modules/polymath/RabbitHoleMapView';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';
import { createTree, appendChild, nodeFromGenerated, type RabbitHoleScoring } from '@/explore/rabbitHoleTree';
import type { GeneratedNode } from '@/explore/rabbitHole';

const TS = '2026-06-05T10:00:00.000Z';
const gen = (title: string): GeneratedNode => ({
  title,
  body: 'A concrete, substantive node body well over the twenty-character minimum.',
  goDeeperHint: 'deeper',
  goSidewaysHint: 'sideways',
});
const scoring: RabbitHoleScoring = {
  scoredDepthTier: 0, scoredBranchIds: [], scoredSynapsePairs: [], badgesFired: [], dailyMapCountKey: '2026-06-05',
};

beforeEach(() => useRabbitHoleStore.getState().resetTree());

describe('RabbitHoleMapView', () => {
  it('renders a tile per node plus reserved ghost forks', () => {
    let t = createTree(nodeFromGenerated(gen('Murmurations'), { id: 'root', parentId: null, arrivedVia: null, createdAt: TS }));
    t = appendChild(t, 'root', 'deeper', nodeFromGenerated(gen('Local rules'), { id: 'd1', parentId: 'root', arrivedVia: 'deeper', createdAt: TS }));
    useRabbitHoleStore.getState().hydrate({
      treeId: 't1', sparkId: 's1',
      anchor: { title: 'Murmurations', seedInterest: null, adjacentField: null },
      treeData: t, scoring, xpAwarded: 0, title: null,
    });

    render(<RabbitHoleMapView />);
    expect(screen.getByText('Murmurations')).toBeTruthy(); // root
    expect(screen.getByText('Local rules')).toBeTruthy(); // realized deeper child
    // un-taken forks render as tappable ghost tiles
    expect(screen.getAllByLabelText(/Open the (deeper|sideways) fork/).length).toBeGreaterThan(0);
  });

  it('renders nothing before a tree is loaded', () => {
    const { toJSON } = render(<RabbitHoleMapView />);
    expect(toJSON()).toBeNull();
  });
});
