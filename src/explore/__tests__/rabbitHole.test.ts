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

  it('dive mode keeps SIDEWAYS within the same idea (no cross-field jump)', () => {
    const n = buildMockNode({ ...baseInput, direction: 'sideways', mode: 'dive' });
    expect(isConcreteNode(n)).toBe(true);
    const hay = `${n.title} ${n.body}`.toLowerCase();
    expect(hay).toContain('chess');         // stays on the topic
    expect(hay).not.toContain('linguistics'); // does NOT jump to the adjacent field
  });

  it('bridge mode (default) still crosses to the adjacent field on sideways', () => {
    const n = buildMockNode({ ...baseInput, direction: 'sideways', mode: 'bridge' });
    expect(n.title.toLowerCase()).toContain('linguistics');
  });

  it('varies title AND body by parent + depth so consecutive fallbacks differ (regression: same card at every depth)', () => {
    const d1 = buildMockNode({ ...baseInput, direction: 'deeper', depth: 1 });
    // Depth 2's parent IS the depth-1 node (same anchor). The old anchor-only
    // mock returned an identical node here — going deeper showed the same card.
    const d2 = buildMockNode({
      parent: { title: d1.title, body: d1.body },
      anchor: baseInput.anchor,
      direction: 'deeper',
      depth: 2,
    });
    expect(d2.title).not.toBe(d1.title);
    expect(d2.body).not.toBe(d1.body);
    expect(isConcreteNode(d1)).toBe(true);
    expect(isConcreteNode(d2)).toBe(true);

    // And a third hop stays distinct from the second.
    const d3 = buildMockNode({
      parent: { title: d2.title, body: d2.body },
      anchor: baseInput.anchor,
      direction: 'deeper',
      depth: 3,
    });
    expect(d3.title).not.toBe(d2.title);
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
