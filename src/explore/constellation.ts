/**
 * Constellation projection (Explore v2). A PURE, deterministic read-model over
 * the user's interests, explored/saved sparks, and expeditions — the growing
 * star-map of their mind. It is a projection, never a source of truth: drop it
 * and re-project from the same inputs to get an identical graph.
 *
 * "Synapses" (cross-discipline edges between interests of different categories)
 * are the prestige signal the gamification layer rewards.
 */

export type NodeType = 'interest' | 'spark' | 'expedition' | 'concept';
export type EdgeRelation = 'within' | 'synapse' | 'led_to';

export interface ConstellationNode {
  id: string;
  type: NodeType;
  label: string;
  salience: number;
  sourceRef: string;
}

export interface ConstellationEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: EdgeRelation;
  weight: number;
}

export interface Constellation {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
}

export interface ConstellationInterest { id: string; name: string; category: string; explorationDepth?: string }
export interface ConstellationSpark { id: string; title: string; seedInterest: string; adjacentField: string; status: string }
export interface ConstellationExpedition { id: string; title: string; theme: string; seedSparkId: string | null; status: string }

export interface ConstellationInput {
  interests: ConstellationInterest[];
  sparks: ConstellationSpark[];
  expeditions: ConstellationExpedition[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const interestId = (name: string) => `interest:${norm(name)}`;
const conceptId = (label: string) => `concept:${norm(label)}`;

const DEPTH_SALIENCE: Record<string, number> = { taste: 1, hobbyist: 2, deep_dive: 3 };

export function projectConstellation(input: ConstellationInput): Constellation {
  const nodes = new Map<string, ConstellationNode>();
  const edges = new Map<string, ConstellationEdge>();

  const addNode = (n: ConstellationNode) => {
    const existing = nodes.get(n.id);
    if (existing) existing.salience = Math.max(existing.salience, n.salience);
    else nodes.set(n.id, n);
  };
  const addEdge = (fromId: string, toId: string, relation: EdgeRelation) => {
    if (fromId === toId || !nodes.has(fromId) || !nodes.has(toId)) return;
    const [a, b] = relation === 'synapse' && fromId > toId ? [toId, fromId] : [fromId, toId];
    const id = `${relation}:${a}->${b}`;
    const existing = edges.get(id);
    if (existing) existing.weight += 1;
    else edges.set(id, { id, fromId: a, toId: b, relation, weight: 1 });
  };

  // 1. Interest nodes
  const interestByName = new Map<string, ConstellationInterest>();
  for (const i of input.interests) {
    addNode({ id: interestId(i.name), type: 'interest', label: i.name, salience: DEPTH_SALIENCE[i.explorationDepth ?? ''] ?? 1, sourceRef: i.id });
    interestByName.set(norm(i.name), i);
  }

  // 2. Spark nodes (saved/explored only) + edges
  for (const s of input.sparks) {
    if (s.status !== 'saved' && s.status !== 'explored') continue;
    const sId = `spark:${s.id}`;
    addNode({ id: sId, type: 'spark', label: s.title, salience: 1, sourceRef: s.id });

    const seed = interestByName.get(norm(s.seedInterest));
    if (seed) addEdge(sId, interestId(seed.name), 'within');

    const adj = interestByName.get(norm(s.adjacentField));
    if (adj && seed && adj.category !== seed.category) {
      addEdge(interestId(seed.name), interestId(adj.name), 'synapse');
    } else if (s.adjacentField.trim()) {
      const cId = conceptId(s.adjacentField);
      addNode({ id: cId, type: 'concept', label: s.adjacentField.trim(), salience: 1, sourceRef: norm(s.adjacentField) });
      addEdge(sId, cId, 'within');
    }
  }

  // 3. Expedition nodes + led_to edges
  for (const e of input.expeditions) {
    const eId = `expedition:${e.id}`;
    addNode({ id: eId, type: 'expedition', label: e.title, salience: e.status === 'completed' ? 3 : 2, sourceRef: e.id });
    if (e.seedSparkId) addEdge(`spark:${e.seedSparkId}`, eId, 'led_to');
  }

  return {
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function countSynapses(c: Constellation): number {
  return c.edges.filter((e) => e.relation === 'synapse').length;
}

export function constellationStats(input: ConstellationInput): { breadth: number; depth: number } {
  const cats = new Set(input.interests.map((i) => i.category));
  const depth = input.interests.reduce((acc, i) => acc + (DEPTH_SALIENCE[i.explorationDepth ?? ''] ?? 1), 0);
  return { breadth: cats.size, depth };
}
