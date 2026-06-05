/**
 * Active rabbit-hole tree (Explore v3). Holds the ONE tree the user is currently
 * wandering, in memory, plus view state (focus sheet, tile layouts, prefetch).
 * The cursor — not the map — is what "back" moves; no action ever deletes a node.
 *
 * Plain `create` (matching useGameStore): the pure transforms in
 * `@/explore/rabbitHoleTree` already return new immutable state, so immer buys
 * nothing here. Persistence + AI + scoring live in `@/explore/rabbitHoleActions`,
 * which calls these setters then writes the blob — the store stays side-effect-free.
 */
import { create } from 'zustand';
import {
  appendChild,
  climbToParent,
  moveCursor,
  type RabbitHoleAnchor,
  type RabbitHoleDirection,
  type RabbitHoleNode,
  type RabbitHoleScoring,
  type RabbitHoleTreeData,
} from '@/explore/rabbitHoleTree';
import type { GeneratedNode } from '@/explore/rabbitHole';

export interface TileLayoutEntry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const prefetchKey = (parentId: string, direction: RabbitHoleDirection): string => `${parentId}:${direction}`;

interface RabbitHoleState {
  treeId: string | null;
  sparkId: string | null;
  anchor: RabbitHoleAnchor | null;
  nodeMap: Record<string, RabbitHoleNode>;
  rootId: string | null;
  cursorId: string | null; // the cursor — "back" moves THIS, never the map
  scoring: RabbitHoleScoring | null;
  xpAwarded: number;
  title: string | null;
  isAdvancing: boolean;
  sheetOpen: boolean; // phone: Focus sheet open (NOT a screen toggle)
  tileLayouts: Record<string, TileLayoutEntry>; // for the grow-from-tile overlay
  prefetchCache: Record<string, GeneratedNode>; // `${parentId}:${direction}` → node
  revision: number; // bumped on every nodeMap mutation → memo key for layout

  hydrate: (args: {
    treeId: string;
    sparkId: string;
    anchor: RabbitHoleAnchor;
    treeData: RabbitHoleTreeData;
    scoring: RabbitHoleScoring;
    xpAwarded: number;
    title: string | null;
  }) => void;
  resetTree: () => void;
  applyAppendChild: (parentId: string, direction: RabbitHoleDirection, child: RabbitHoleNode) => void;
  jumpTo: (nodeId: string, visitedAt?: string) => void;
  climb: (visitedAt?: string) => void;
  setScoring: (scoring: RabbitHoleScoring, xpAwarded: number) => void;
  setTitle: (title: string | null) => void;
  setAdvancing: (v: boolean) => void;
  setSheetOpen: (v: boolean) => void;
  setTileLayout: (nodeId: string, layout: TileLayoutEntry) => void;
  setPrefetch: (parentId: string, direction: RabbitHoleDirection, node: GeneratedNode) => void;
  takePrefetch: (parentId: string, direction: RabbitHoleDirection) => GeneratedNode | undefined;
}

const EMPTY = {
  treeId: null,
  sparkId: null,
  anchor: null,
  nodeMap: {} as Record<string, RabbitHoleNode>,
  rootId: null,
  cursorId: null,
  scoring: null,
  xpAwarded: 0,
  title: null,
  isAdvancing: false,
  sheetOpen: false,
  tileLayouts: {} as Record<string, TileLayoutEntry>,
  prefetchCache: {} as Record<string, GeneratedNode>,
  revision: 0,
} as const;

export const useRabbitHoleStore = create<RabbitHoleState>((set, get) => ({
  ...EMPTY,

  hydrate: ({ treeId, sparkId, anchor, treeData, scoring, xpAwarded, title }) =>
    set({
      ...EMPTY,
      treeId,
      sparkId,
      anchor,
      nodeMap: treeData.nodeMap,
      rootId: treeData.rootId,
      cursorId: treeData.cursorId,
      scoring,
      xpAwarded,
      title,
      revision: 0,
    }),

  resetTree: () => set({ ...EMPTY }),

  applyAppendChild: (parentId, direction, child) => {
    const { nodeMap, rootId, cursorId, revision } = get();
    if (!rootId || !cursorId) return;
    const next = appendChild({ nodeMap, rootId, cursorId }, parentId, direction, child);
    set({ nodeMap: next.nodeMap, cursorId: next.cursorId, revision: revision + 1 });
  },

  jumpTo: (nodeId, visitedAt) => {
    const { nodeMap, rootId, cursorId } = get();
    if (!rootId || !cursorId) return;
    const next = moveCursor({ nodeMap, rootId, cursorId }, nodeId, visitedAt);
    set({ nodeMap: next.nodeMap, cursorId: next.cursorId });
  },

  climb: (visitedAt) => {
    const { nodeMap, rootId, cursorId } = get();
    if (!rootId || !cursorId) return;
    const next = climbToParent({ nodeMap, rootId, cursorId }, visitedAt);
    set({ nodeMap: next.nodeMap, cursorId: next.cursorId });
  },

  setScoring: (scoring, xpAwarded) => set({ scoring, xpAwarded }),
  setTitle: (title) => set({ title }),
  setAdvancing: (isAdvancing) => set({ isAdvancing }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),

  setTileLayout: (nodeId, layout) =>
    set((s) => ({ tileLayouts: { ...s.tileLayouts, [nodeId]: layout } })),

  setPrefetch: (parentId, direction, node) =>
    set((s) => ({ prefetchCache: { ...s.prefetchCache, [prefetchKey(parentId, direction)]: node } })),

  takePrefetch: (parentId, direction) => {
    const key = prefetchKey(parentId, direction);
    const node = get().prefetchCache[key];
    if (!node) return undefined;
    set((s) => {
      const next = { ...s.prefetchCache };
      delete next[key];
      return { prefetchCache: next };
    });
    return node;
  },
}));
