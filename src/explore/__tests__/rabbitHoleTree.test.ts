import {
  // types
  type RabbitHoleDirection,
  type RabbitHoleNode,
  type RabbitHoleTreeData,
  // schemas / constants
  RabbitHoleTreeDataSchema,
  parseTreeData,
  DEPTH_TIERS,
  RABBIT_HOLE_MAX_DEPTH,
  // helpers
  asLookup,
  pathToRoot,
  depthOf,
  childrenOf,
  allDescendants,
  maxDeeperDepth,
  isNodeSubstantive,
  isSubstantiveBranch,
  realizedBranchCount,
  newlyCrossedDepthTiers,
  nodeFromGenerated,
  createTree,
  appendChild,
  moveCursor,
  climbToParent,
  isAtDepthCap,
} from '../rabbitHoleTree';
import type { GeneratedNode } from '../rabbitHole';

const TS = '2026-06-05T10:00:00.000Z';

function gen(over: Partial<GeneratedNode> = {}): GeneratedNode {
  return {
    title: 'The mechanism beneath flocking',
    body: 'Under every visible move in a flock there is a smaller, more universal rule doing the work, and naming it is what lets you transfer it elsewhere.',
    goDeeperHint: 'the underlying invariant',
    goSidewaysHint: 'where else this shows up',
    ...over,
  };
}

function node(
  id: string,
  parentId: string | null,
  arrivedVia: RabbitHoleDirection | null,
  over: Partial<GeneratedNode> = {},
): RabbitHoleNode {
  return nodeFromGenerated(gen(over), { id, parentId, arrivedVia, createdAt: TS });
}

/** root --deeper--> n1 --deeper--> n2 ; root --sideways--> s1 --deeper--> s1a */
function sampleTree(): RabbitHoleTreeData {
  let t = createTree(node('root', null, null, { title: 'Why do murmurations stay together?' }));
  t = appendChild(t, 'root', 'deeper', node('n1', 'root', 'deeper', { title: 'Local rules, global order' }));
  t = appendChild(t, 'n1', 'deeper', node('n2', 'n1', 'deeper', { title: 'Boids: three steering rules' }));
  t = appendChild(t, 'root', 'sideways', node('s1', 'root', 'sideways', { title: 'Schooling fish vs flocks' }));
  t = appendChild(t, 's1', 'deeper', node('s1a', 's1', 'deeper', { title: 'The lateral-line sense' }));
  return t;
}

describe('traversal helpers', () => {
  const t = sampleTree();
  const m = asLookup(t.nodeMap);

  it('pathToRoot returns root → node inclusive', () => {
    expect(pathToRoot('n2', m).map((n) => n.id)).toEqual(['root', 'n1', 'n2']);
    expect(pathToRoot('s1a', m).map((n) => n.id)).toEqual(['root', 's1', 's1a']);
    expect(pathToRoot('root', m).map((n) => n.id)).toEqual(['root']);
  });

  it('depthOf counts edges from the root', () => {
    expect(depthOf('root', m)).toBe(0);
    expect(depthOf('n1', m)).toBe(1);
    expect(depthOf('n2', m)).toBe(2);
    expect(depthOf('s1a', m)).toBe(2);
  });

  it('childrenOf returns only realized children', () => {
    expect(childrenOf('root', m).map((n) => n.id).sort()).toEqual(['n1', 's1']);
    expect(childrenOf('n2', m)).toEqual([]); // both forks still ghosts
  });

  it('allDescendants walks the whole subtree', () => {
    expect(allDescendants('root', m).map((n) => n.id).sort()).toEqual(['n1', 'n2', 's1', 's1a']);
    expect(allDescendants('s1', m).map((n) => n.id)).toEqual(['s1a']);
  });

  it('maxDeeperDepth measures the longest deeper-only chain', () => {
    expect(maxDeeperDepth('root', m)).toBe(2); // root → n1 → n2 (sideways not counted)
    expect(maxDeeperDepth('s1', m)).toBe(1);
    expect(maxDeeperDepth('n2', m)).toBe(0);
  });
});

describe('substance + breadth gates (Q2-resolved)', () => {
  const t = sampleTree();
  const m = asLookup(t.nodeMap);

  it('isNodeSubstantive accepts concrete nodes and rejects filler', () => {
    expect(isNodeSubstantive(t.nodeMap.n2)).toBe(true);
    const filler = node('f', 'root', 'deeper', { body: 'Stay curious — everything is connected and the possibilities are endless.' });
    expect(isNodeSubstantive(filler)).toBe(false);
  });

  it('isSubstantiveBranch requires a concrete child that was continued', () => {
    // s1 is concrete AND has a realized deeper fork (s1a) → substantive
    expect(isSubstantiveBranch('s1', m)).toBe(true);
  });

  it('a lone sideways stub does NOT qualify (anti-farming floor)', () => {
    let stub = createTree(node('root', null, null));
    stub = appendChild(stub, 'root', 'sideways', node('only', 'root', 'sideways'));
    expect(isSubstantiveBranch('only', asLookup(stub.nodeMap))).toBe(false);
  });

  it('realizedBranchCount counts fork-nodes with BOTH forks realized + a substantive sideways branch', () => {
    // root forked both ways and the sideways branch was continued → exactly 1
    expect(realizedBranchCount('root', m)).toBe(1);
  });

  it('realizedBranchCount ignores a both-realized node whose sideways branch is a stub', () => {
    let t2 = createTree(node('root', null, null));
    t2 = appendChild(t2, 'root', 'deeper', node('d', 'root', 'deeper'));
    t2 = appendChild(t2, 'root', 'sideways', node('s', 'root', 'sideways')); // stub, never continued
    expect(realizedBranchCount('root', asLookup(t2.nodeMap))).toBe(0);
  });
});

describe('depth tiers (Q5-resolved)', () => {
  it('exposes exactly two tiers', () => {
    expect(DEPTH_TIERS).toEqual([3, 5]);
  });

  it('newlyCrossedDepthTiers pays each tier once as it is crossed', () => {
    expect(newlyCrossedDepthTiers(0, 2)).toEqual([]);
    expect(newlyCrossedDepthTiers(0, 3)).toEqual([3]);
    expect(newlyCrossedDepthTiers(0, 5)).toEqual([3, 5]);
    expect(newlyCrossedDepthTiers(3, 5)).toEqual([5]); // tier 3 already paid
    expect(newlyCrossedDepthTiers(5, 9)).toEqual([]); // both paid
  });
});

describe('pure tree transforms', () => {
  it('createTree seeds a single-root tree with the cursor on the root', () => {
    const t = createTree(node('root', null, null));
    expect(t.rootId).toBe('root');
    expect(t.cursorId).toBe('root');
    expect(Object.keys(t.nodeMap)).toEqual(['root']);
  });

  it('appendChild realizes the chosen fork, keeps the other a ghost, and moves the cursor', () => {
    let t = createTree(node('root', null, null));
    t = appendChild(t, 'root', 'deeper', node('c', 'root', 'deeper'));
    expect(t.nodeMap.root.forks[0]).toMatchObject({ direction: 'deeper', childId: 'c', state: 'realized' });
    expect(t.nodeMap.root.forks[1]).toMatchObject({ direction: 'sideways', childId: null, state: 'ghost' });
    expect(t.cursorId).toBe('c');
  });

  it('appendChild is a no-op on an already-realized fork or a missing parent', () => {
    let t = createTree(node('root', null, null));
    t = appendChild(t, 'root', 'deeper', node('c1', 'root', 'deeper'));
    const after = appendChild(t, 'root', 'deeper', node('c2', 'root', 'deeper'));
    expect(after).toBe(t); // same reference — nothing changed
    expect(appendChild(t, 'ghost-parent', 'deeper', node('x', 'ghost-parent', 'deeper'))).toBe(t);
  });

  it('does not mutate the input data (immutability)', () => {
    const t = createTree(node('root', null, null));
    const before = JSON.stringify(t);
    appendChild(t, 'root', 'deeper', node('c', 'root', 'deeper'));
    expect(JSON.stringify(t)).toBe(before);
  });

  it('climbToParent moves the cursor up but NEVER deletes the child (the core fix)', () => {
    let t = createTree(node('root', null, null));
    t = appendChild(t, 'root', 'deeper', node('c', 'root', 'deeper'));
    expect(t.cursorId).toBe('c');
    t = climbToParent(t);
    expect(t.cursorId).toBe('root');
    expect(t.nodeMap.c).toBeDefined(); // child still on the map — not sliced away
    expect(t.nodeMap.root.forks[0].childId).toBe('c'); // fork stays realized
  });

  it('climbToParent at the root is a no-op', () => {
    const t = createTree(node('root', null, null));
    expect(climbToParent(t)).toBe(t);
  });

  it('moveCursor jumps to any node and can stamp visitedAt', () => {
    const t = sampleTree();
    const jumped = moveCursor(t, 'n1', '2026-06-05T11:00:00.000Z');
    expect(jumped.cursorId).toBe('n1');
    expect(jumped.nodeMap.n1.visitedAt).toBe('2026-06-05T11:00:00.000Z');
    expect(moveCursor(t, 'does-not-exist')).toBe(t);
  });
});

describe('per-branch depth cap', () => {
  it('isAtDepthCap fires only at MAX_DEPTH along the focused path', () => {
    let t = createTree(node('root', null, null));
    let parentId = 'root';
    for (let i = 1; i <= RABBIT_HOLE_MAX_DEPTH; i++) {
      const id = `n${i}`;
      t = appendChild(t, parentId, 'deeper', node(id, parentId, 'deeper'));
      parentId = id;
    }
    expect(depthOf(t.cursorId, asLookup(t.nodeMap))).toBe(RABBIT_HOLE_MAX_DEPTH);
    expect(isAtDepthCap(t)).toBe(true);
    // one level up the same branch is below the cap
    expect(isAtDepthCap(moveCursor(t, `n${RABBIT_HOLE_MAX_DEPTH - 1}`))).toBe(false);
  });
});

describe('Zod boundary', () => {
  const valid = createTree(node('root', null, null));

  it('parseTreeData accepts a well-formed tree', () => {
    expect(() => parseTreeData(valid)).not.toThrow();
  });

  it('rejects a node body shorter than 20 chars', () => {
    const bad = { ...valid, nodeMap: { root: { ...valid.nodeMap.root, body: 'too short' } } };
    expect(RabbitHoleTreeDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a node without exactly two forks', () => {
    const bad = { ...valid, nodeMap: { root: { ...valid.nodeMap.root, forks: [valid.nodeMap.root.forks[0]] } } };
    expect(RabbitHoleTreeDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-ISO createdAt', () => {
    const bad = { ...valid, nodeMap: { root: { ...valid.nodeMap.root, createdAt: 'yesterday' } } };
    expect(RabbitHoleTreeDataSchema.safeParse(bad).success).toBe(false);
  });
});
