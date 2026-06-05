const upsert = jest.fn();
jest.mock('@/db/queries/constellationEdges', () => ({
  upsertConstellationEdge: (row: unknown) => upsert(row),
  listConstellationEdges: () => [],
}));

import { buildThreadEdges, detectSynapsePairs, emitThreadToConstellation } from '../rabbitHoleConstellation';
import {
  createTree,
  appendChild,
  nodeFromGenerated,
  type RabbitHoleAnchor,
  type RabbitHoleDirection,
  type RabbitHoleNode,
  type RabbitHoleTreeData,
} from '../rabbitHoleTree';
import { projectConstellation, countSynapses, type ConstellationInput } from '../constellation';
import type { CategorizedInterest } from '../isCrossCategory';
import type { GeneratedNode } from '../rabbitHole';

const TS = '2026-06-05T10:00:00.000Z';
const gen = (title: string): GeneratedNode => ({
  title,
  body: 'A concrete, substantive node body that comfortably clears the twenty-character minimum.',
  goDeeperHint: 'deeper',
  goSidewaysHint: 'sideways',
});
const n = (id: string, parentId: string | null, via: RabbitHoleDirection | null, title: string): RabbitHoleNode =>
  nodeFromGenerated(gen(title), { id, parentId, arrivedVia: via, createdAt: TS });

const interests: CategorizedInterest[] = [
  { name: 'biology', category: 'science' },
  { name: 'geometry', category: 'math' },
];
const anchor: RabbitHoleAnchor = { title: 'Why hexagons?', seedInterest: 'biology', adjacentField: 'geometry' };

/** A 5-node deeper path (cursor at the deepest) plus one substantive sideways branch off the root. */
function pathWithBranch(): RabbitHoleTreeData {
  let t = createTree(n('root', null, null, 'Root'));
  let pid = 'root';
  for (let i = 1; i <= 4; i++) {
    t = appendChild(t, pid, 'deeper', n(`d${i}`, pid, 'deeper', `Concept ${i}`));
    pid = `d${i}`;
  }
  // sideways branch off root (a real lateral jump), continued one step
  t = appendChild(t, 'root', 'sideways', n('s', 'root', 'sideways', 'Sideways'));
  t = appendChild(t, 's', 'deeper', n('sa', 's', 'deeper', 'Sideways deep'));
  // cursor sits at the bottom of the deeper path
  t = { ...t, cursorId: 'd4' };
  return t;
}

describe('buildThreadEdges', () => {
  it('emits led_to edges along the active path and a synapse edge for the cross-category branch', () => {
    const edges = buildThreadEdges(pathWithBranch(), anchor, interests);
    const ledTo = edges.filter((e) => e.relation === 'led_to');
    const synapse = edges.filter((e) => e.relation === 'synapse');
    expect(ledTo).toHaveLength(4); // root→d1→d2→d3→d4 = 4 edges
    expect(ledTo[0]).toEqual({ fromId: 'concept:root', toId: 'concept:concept 1', relation: 'led_to' });
    expect(synapse).toEqual([{ fromId: 'interest:biology', toId: 'interest:geometry', relation: 'synapse' }]);
  });

  it('omits the synapse edge when the anchor is same-category', () => {
    const sameCat: CategorizedInterest[] = [{ name: 'biology', category: 'science' }, { name: 'geometry', category: 'science' }];
    const edges = buildThreadEdges(pathWithBranch(), anchor, sameCat);
    expect(edges.some((e) => e.relation === 'synapse')).toBe(false);
  });

  it('omits the synapse edge when no sideways jump was taken (deeper-only)', () => {
    let t = createTree(n('root', null, null, 'Root'));
    t = appendChild(t, 'root', 'deeper', n('d1', 'root', 'deeper', 'Deep'));
    expect(buildThreadEdges(t, anchor, interests).some((e) => e.relation === 'synapse')).toBe(false);
  });
});

describe('detectSynapsePairs', () => {
  it('returns the sorted category pair for a cross-category tree with a sideways jump', () => {
    expect(detectSynapsePairs(pathWithBranch(), anchor, interests)).toEqual(['math|science']);
  });
  it('returns nothing without a sideways jump', () => {
    const t = createTree(n('root', null, null, 'Root'));
    expect(detectSynapsePairs(t, anchor, interests)).toEqual([]);
  });
});

describe('emitThreadToConstellation', () => {
  beforeEach(() => upsert.mockReset());

  it('upserts every edge with a deterministic id and is idempotent across re-emits', () => {
    const tree = pathWithBranch();
    emitThreadToConstellation({ userId: 'u1', treeData: tree, anchor, interests, sourceTreeId: 't1', now: TS });
    const firstIds = upsert.mock.calls.map((c) => (c[0] as { id: string }).id).sort();
    expect(firstIds).toContain('u1:synapse:interest:biology->interest:geometry');
    expect(firstIds.filter((id) => id.includes(':led_to:'))).toHaveLength(4);

    upsert.mockReset();
    emitThreadToConstellation({ userId: 'u1', treeData: tree, anchor, interests, sourceTreeId: 't1', now: TS });
    const secondIds = upsert.mock.calls.map((c) => (c[0] as { id: string }).id).sort();
    expect(secondIds).toEqual(firstIds); // same ids → upsert dedupes, no duplicate edges
  });
});

describe('projectConstellation merges extra edges', () => {
  it('renders rabbit-hole edges as nodes + edges (synapse counted)', () => {
    const input: ConstellationInput = {
      interests: [{ id: 'i1', name: 'biology', category: 'science' }, { id: 'i2', name: 'geometry', category: 'math' }],
      sparks: [],
      expeditions: [],
      extraEdges: [
        { fromId: 'concept:root', toId: 'concept:concept 1', relation: 'led_to' },
        { fromId: 'interest:biology', toId: 'interest:geometry', relation: 'synapse' },
      ],
    };
    const c = projectConstellation(input);
    expect(c.nodes.find((node) => node.id === 'concept:root')).toBeTruthy(); // endpoint node created
    expect(c.edges.some((e) => e.relation === 'led_to')).toBe(true);
    expect(countSynapses(c)).toBe(1);
  });
});
