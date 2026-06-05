/**
 * Deterministic tree layout (Explore v3, Phase 5). PURE: maps a RabbitHoleTree
 * to column/row cells for every node, reserved ghost slots for un-taken forks,
 * and connector specs — with NO measurement, so the render is a pure function of
 * the tree (memoizable, and rehydration looks identical).
 *
 * Geometry: row = depth. A `deeper` child sits directly below its parent (same
 * column → the straight gold spine); a `sideways` child is placed to the RIGHT
 * of the parent's entire deeper-subtree (an elbow), so branches never collide.
 * Ghost forks reserve their lane from the first render, so realizing one does
 * not reflow the tree at that moment.
 */
import type { RabbitHoleDirection, RabbitHoleTreeData } from './rabbitHoleTree';

export interface LayoutCell {
  col: number;
  row: number;
}

export interface GhostSlot {
  parentId: string;
  direction: RabbitHoleDirection;
  col: number;
  row: number;
}

export interface ConnectorSpec {
  fromId: string;
  /** Child node id, or null for a ghost (un-taken) fork. */
  toId: string | null;
  direction: RabbitHoleDirection;
  from: LayoutCell;
  to: LayoutCell;
}

export interface TreeLayout {
  nodes: Record<string, LayoutCell>;
  ghosts: GhostSlot[];
  connectors: ConnectorSpec[];
  cols: number; // total columns used (grid width)
  rows: number; // total rows used (grid height = max depth + 1, incl. ghost rows)
}

export function layoutTree(tree: RabbitHoleTreeData): TreeLayout {
  const nodes: Record<string, LayoutCell> = {};
  const ghosts: GhostSlot[] = [];
  const connectors: ConnectorSpec[] = [];
  let maxRow = 0;

  // Place a node and its forks; returns the max column index used by its subtree.
  const place = (nodeId: string, col: number, row: number): number => {
    nodes[nodeId] = { col, row };
    if (row > maxRow) maxRow = row;
    const node = tree.nodeMap[nodeId];
    if (!node) return col;
    let maxCol = col;
    const childRow = row + 1;
    if (childRow > maxRow) maxRow = childRow;

    // deeper (fork 0): straight down, same column.
    const deeper = node.forks[0];
    connectors.push({ fromId: nodeId, toId: deeper.childId, direction: 'deeper', from: { col, row }, to: { col, row: childRow } });
    if (deeper.childId) {
      maxCol = Math.max(maxCol, place(deeper.childId, col, childRow));
    } else {
      ghosts.push({ parentId: nodeId, direction: 'deeper', col, row: childRow });
    }

    // sideways (fork 1): a fresh column to the right of the deeper subtree.
    const sideways = node.forks[1];
    const sideCol = maxCol + 1;
    connectors.push({ fromId: nodeId, toId: sideways.childId, direction: 'sideways', from: { col, row }, to: { col: sideCol, row: childRow } });
    if (sideways.childId) {
      maxCol = Math.max(maxCol, place(sideways.childId, sideCol, childRow));
    } else {
      ghosts.push({ parentId: nodeId, direction: 'sideways', col: sideCol, row: childRow });
      maxCol = Math.max(maxCol, sideCol);
    }
    return maxCol;
  };

  const usedMaxCol = place(tree.rootId, 0, 0);
  return { nodes, ghosts, connectors, cols: usedMaxCol + 1, rows: maxRow + 1 };
}
