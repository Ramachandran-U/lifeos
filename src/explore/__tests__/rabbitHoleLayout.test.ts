import { layoutTree } from '../rabbitHoleLayout';
import {
  createTree,
  appendChild,
  nodeFromGenerated,
  type RabbitHoleDirection,
  type RabbitHoleNode,
  type RabbitHoleTreeData,
} from '../rabbitHoleTree';
import type { GeneratedNode } from '../rabbitHole';

const TS = '2026-06-05T10:00:00.000Z';
const gen = (title: string): GeneratedNode => ({
  title,
  body: 'A concrete, substantive node body well over the twenty-character minimum.',
  goDeeperHint: 'deeper',
  goSidewaysHint: 'sideways',
});
const n = (id: string, parentId: string | null, via: RabbitHoleDirection | null): RabbitHoleNode =>
  nodeFromGenerated(gen(id), { id, parentId, arrivedVia: via, createdAt: TS });

function deeperChain(len: number): RabbitHoleTreeData {
  let t = createTree(n('root', null, null));
  let pid = 'root';
  for (let i = 1; i <= len; i++) {
    t = appendChild(t, pid, 'deeper', n(`d${i}`, pid, 'deeper'));
    pid = `d${i}`;
  }
  return t;
}

describe('layoutTree', () => {
  it('keeps a deeper-only chain in a single straight column', () => {
    const l = layoutTree(deeperChain(2));
    expect(l.nodes.root).toEqual({ col: 0, row: 0 });
    expect(l.nodes.d1).toEqual({ col: 0, row: 1 });
    expect(l.nodes.d2).toEqual({ col: 0, row: 2 });
  });

  it('reserves a ghost slot for every un-taken fork + a connector per fork', () => {
    const l = layoutTree(deeperChain(2));
    // un-taken forks: root.sideways, d1.sideways, d2.deeper, d2.sideways
    expect(l.ghosts).toHaveLength(4);
    // one connector per fork of each of the 3 nodes
    expect(l.connectors).toHaveLength(6);
    expect(l.connectors.filter((c) => c.toId == null)).toHaveLength(4); // ghost connectors
  });

  it('places a sideways child to the RIGHT of the parent deeper-subtree (no collision)', () => {
    let t = createTree(n('root', null, null));
    t = appendChild(t, 'root', 'deeper', n('d1', 'root', 'deeper'));
    t = appendChild(t, 'root', 'sideways', n('s1', 'root', 'sideways'));
    const l = layoutTree(t);
    expect(l.nodes.root).toEqual({ col: 0, row: 0 });
    expect(l.nodes.d1).toEqual({ col: 0, row: 1 }); // straight down
    expect(l.nodes.s1.row).toBe(1);
    expect(l.nodes.s1.col).toBeGreaterThan(l.nodes.d1.col); // elbow to the right
  });
});
