import {
  isConcreteNode,
  buildMockNode,
  generateRabbitHoleNode,
  type GeneratedNode,
  type RabbitHoleInput,
} from '../rabbitHole';

function node(over: Partial<GeneratedNode> = {}): GeneratedNode {
  return {
    title: 'The mechanism beneath chess',
    body: 'Under every visible move in chess there is a smaller, more universal rule doing the work. Naming it explicitly is what separates a practitioner from a teacher.',
    goDeeperHint: 'the underlying invariant',
    goSidewaysHint: 'where else this shows up',
    ...over,
  };
}

const baseInput: RabbitHoleInput = {
  parent: { title: 'Chess', body: 'A two-player abstract strategy game…' },
  anchor: { title: 'The hidden grammar of chess', seedInterest: 'chess', adjacentField: 'linguistics' },
  direction: 'deeper',
};

describe('isConcreteNode', () => {
  it('accepts a substantive node with both hints', () => {
    expect(isConcreteNode(node())).toBe(true);
  });
  it('rejects too-short bodies', () => {
    expect(isConcreteNode(node({ body: 'Brief.' }))).toBe(false);
  });
  it('rejects empty hints', () => {
    expect(isConcreteNode(node({ goDeeperHint: '' }))).toBe(false);
    expect(isConcreteNode(node({ goSidewaysHint: '' }))).toBe(false);
  });
  it('rejects filler/cliche content', () => {
    expect(isConcreteNode(node({ body: 'Remember: everything is connected and the possibilities are endless once you let curiosity drive.' }))).toBe(false);
    expect(isConcreteNode(node({ title: 'Did you know?' }))).toBe(false);
  });
  it('rejects too-long titles', () => {
    expect(isConcreteNode(node({ title: 'x'.repeat(100) }))).toBe(false);
  });
});

describe('buildMockNode', () => {
  it('produces a concrete deeper node', () => {
    const n = buildMockNode({ ...baseInput, direction: 'deeper' });
    expect(isConcreteNode(n)).toBe(true);
    expect(n.title.toLowerCase()).toContain('chess');
  });
  it('produces a concrete sideways node that names the adjacent field', () => {
    const n = buildMockNode({ ...baseInput, direction: 'sideways' });
    expect(isConcreteNode(n)).toBe(true);
    expect(n.title.toLowerCase()).toContain('linguistics');
  });
  it('handles missing seedInterest / adjacentField gracefully', () => {
    const n = buildMockNode({ parent: baseInput.parent, anchor: { title: 'A spark' }, direction: 'sideways' });
    expect(isConcreteNode(n)).toBe(true);
  });

  it('is deterministic — same input always produces same output', () => {
    const n1 = buildMockNode(baseInput);
    const n2 = buildMockNode(baseInput);
    expect(n1.title).toBe(n2.title);
    expect(n1.body).toBe(n2.body);
  });

  it('depth traversal: four consecutive deeper taps produce unique bodies (with pathHistory)', () => {
    // Mirror the real runtime path where advanceRabbitHole passes pathHistory
    let parent = baseInput.parent;
    const visited: string[] = [];
    const bodies: string[] = [];
    for (let depth = 0; depth < 4; depth++) {
      const n = buildMockNode({ ...baseInput, parent, direction: 'deeper', pathHistory: visited });
      bodies.push(n.body);
      visited.push(parent.title);
      parent = { title: n.title, body: n.body };
    }
    // pathHistory.length cycles the template index, so each depth hits a distinct lens
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it('depth traversal: four consecutive sideways taps produce unique bodies (with pathHistory)', () => {
    let parent = baseInput.parent;
    const visited: string[] = [];
    const bodies: string[] = [];
    for (let depth = 0; depth < 4; depth++) {
      const n = buildMockNode({ ...baseInput, parent, direction: 'sideways', pathHistory: visited });
      bodies.push(n.body);
      visited.push(parent.title);
      parent = { title: n.title, body: n.body };
    }
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it('different parent titles produce different body content', () => {
    // Bodies always embed p (parentTitle), so different parents → different bodies
    const fromChess = buildMockNode({ ...baseInput, parent: { title: 'Chess', body: 'A game.' }, direction: 'deeper' });
    const fromJazz = buildMockNode({ ...baseInput, parent: { title: 'Jazz improvisation', body: 'Music.' }, direction: 'deeper' });
    expect(fromChess.body).not.toBe(fromJazz.body);
  });
});

describe('generateRabbitHoleNode (mock mode)', () => {
  const prev = process.env.USE_AI_MOCK;
  beforeAll(() => { process.env.USE_AI_MOCK = 'true'; });
  afterAll(() => { process.env.USE_AI_MOCK = prev; });

  it('returns a concrete node without hitting the network', async () => {
    const n = await generateRabbitHoleNode(baseInput);
    expect(isConcreteNode(n)).toBe(true);
  });
  it('respects the direction', async () => {
    const deep = await generateRabbitHoleNode({ ...baseInput, direction: 'deeper' });
    const side = await generateRabbitHoleNode({ ...baseInput, direction: 'sideways' });
    expect(deep.title).not.toBe(side.title);
  });
});
