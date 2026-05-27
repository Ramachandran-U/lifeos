import {
  projectConstellation,
  countSynapses,
  constellationStats,
  type ConstellationInput,
} from '../constellation';

const baseInput: ConstellationInput = {
  interests: [
    { id: 'i1', name: 'Chess', category: 'other', explorationDepth: 'hobbyist' },
    { id: 'i2', name: 'Jazz', category: 'music', explorationDepth: 'taste' },
    { id: 'i3', name: 'Cooking', category: 'other' },
  ],
  sparks: [
    { id: 's1', title: 'Chess × Jazz', seedInterest: 'Chess', adjacentField: 'Jazz', status: 'saved' },
    { id: 's2', title: 'Bread baking science', seedInterest: 'Cooking', adjacentField: 'microbiology', status: 'explored' },
    { id: 's3', title: 'Dismissed spark', seedInterest: 'Chess', adjacentField: '', status: 'dismissed' },
  ],
  expeditions: [
    { id: 'e1', title: '7 days of jazz', theme: 'jazz', seedSparkId: 's1', status: 'completed' },
    { id: 'e2', title: 'Fermentation basics', theme: 'ferment', seedSparkId: null, status: 'active' },
  ],
};

describe('projectConstellation', () => {
  const c = projectConstellation(baseInput);

  it('is deterministic (same input -> identical output)', () => {
    const c2 = projectConstellation(baseInput);
    expect(c).toEqual(c2);
  });

  it('creates interest nodes with depth-based salience', () => {
    const chess = c.nodes.find((n) => n.label === 'Chess');
    expect(chess?.type).toBe('interest');
    expect(chess?.salience).toBe(2); // hobbyist
    const jazz = c.nodes.find((n) => n.label === 'Jazz');
    expect(jazz?.salience).toBe(1); // taste
  });

  it('creates spark nodes only for saved/explored (not dismissed)', () => {
    expect(c.nodes.find((n) => n.id === 'spark:s1')).toBeDefined();
    expect(c.nodes.find((n) => n.id === 'spark:s2')).toBeDefined();
    expect(c.nodes.find((n) => n.id === 'spark:s3')).toBeUndefined();
  });

  it('creates expedition nodes with status-based salience', () => {
    const e1 = c.nodes.find((n) => n.id === 'expedition:e1');
    expect(e1?.salience).toBe(3); // completed
    const e2 = c.nodes.find((n) => n.id === 'expedition:e2');
    expect(e2?.salience).toBe(2); // active
  });

  it('links a spark to its seed interest via "within"', () => {
    expect(c.edges.find((e) => e.fromId === 'spark:s1' && e.relation === 'within')).toBeDefined();
  });

  it('forms a synapse between two interests of DIFFERENT categories linked by a spark', () => {
    // s1 bridges Chess (other) and Jazz (music) → synapse
    const syn = c.edges.find((e) => e.relation === 'synapse');
    expect(syn).toBeDefined();
    expect([syn!.fromId, syn!.toId].sort()).toEqual(['interest:chess', 'interest:jazz']);
  });

  it('creates a concept node when adjacentField does not match an interest', () => {
    // s2 adjacentField "microbiology" is not an interest → concept node + within edge
    expect(c.nodes.find((n) => n.type === 'concept' && n.label === 'microbiology')).toBeDefined();
  });

  it('links spark -> expedition via led_to when seedSparkId matches', () => {
    expect(c.edges.find((e) => e.relation === 'led_to' && e.fromId === 'spark:s1' && e.toId === 'expedition:e1')).toBeDefined();
  });

  it('does NOT create a led_to edge when seedSparkId is null', () => {
    expect(c.edges.find((e) => e.toId === 'expedition:e2' && e.relation === 'led_to')).toBeUndefined();
  });
});

describe('countSynapses', () => {
  it('counts cross-discipline edges', () => {
    const c = projectConstellation(baseInput);
    expect(countSynapses(c)).toBe(1); // Chess × Jazz
  });
  it('returns 0 with no cross-category links', () => {
    const c = projectConstellation({ interests: baseInput.interests, sparks: [], expeditions: [] });
    expect(countSynapses(c)).toBe(0);
  });
});

describe('constellationStats', () => {
  it('measures breadth (categories) and depth (salience sum)', () => {
    const s = constellationStats(baseInput);
    expect(s.breadth).toBe(2); // other + music
    expect(s.depth).toBe(4); // hobbyist(2) + taste(1) + default(1)
  });
});
