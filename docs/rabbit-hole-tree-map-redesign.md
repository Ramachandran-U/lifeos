# Rabbit Hole → Constellation Map: A Navigable Decision-Tree Redesign

> **Status (2026-06-05): design complete and reconciled.** Produced via a three-discipline iteration (UI/UX, solution architecture, game design) — independent drafts → cross-critique & revise → lead synthesis. The six open questions were then resolved in a follow-up decision round; this document already incorporates those rulings (the four spec edits are folded into the relevant sections, and the former "Open Questions" section now records the decisions). Ships behind the `rabbitHoleTreeMap` feature flag (default off).

## North Star
Turn the rabbit hole from a screen you read into a **territory you wander** — a persistent, vertically-growing decision tree where every fork you ever opened stays drawn, "back" climbs the tree instead of deleting it, the path not taken is always a tappable dashed ghost beside the path you took, and curiosity is rewarded by the *shape* you leave behind, never by the act of tapping.

## How the disciplines were reconciled
- **Persistence (the one real architectural fork): single-row JSON blob wins.** UI/UX and Game Dev both converged on one `rabbitHoleTrees` row; the Solution Architect held out for two normalized tables (`explorationThreads` + `threadNodes`). I'm taking the **blob**. Rationale: the web render path must read synchronously (the localStorage shim returns values, not promises), the deterministic layout must be a pure function of one in-memory object, and the store holds the full `nodeMap` in memory anyway — so the Architect's "you can't jump-to by node ID" objection is moot (the in-memory `nodeMap` is keyed by id once hydrated). I **keep** the Architect's excellent in-memory model (normalized `nodeMap` + pure `pathToRoot`/`depthOf`/`childrenOf` helpers, Zod schemas, `ConnectorElbow` sub-component, `tileLayouts` cache) — those survive intact; only the *on-disk* shape changes from two tables to one row.
- **Two zoom levels coexist; never a full-screen toggle.** I reject the Architect's `viewMode: 'map' | 'node'` screen-swap. Phone = Focus is a bottom sheet over a dimmed-but-visible map; web ≥900pt = two simultaneous panes. The card grows out of its tile via a **Reanimated measured-origin overlay** (the Architect correctly flagged that the shared-element navigation API has no stable react-native-web support — adopted that fix, dropped the API).
- **Kill per-tap XP; score the shape.** The Architect's `addXP(userId, 8)` per advance is deleted (it's a dark pattern and an extra write on every move; it also had a real bug — `userId` was sourced from `thread.sparkId`). I adopt the Game Dev's **per-milestone idempotent scoring** (depth/breadth/synapse pay once each as the shape forms), which fits the append-only auto-saved tree — there is **no terminal save gate**. Naming a map is an optional identity flourish that pays nothing.
- **Synapse = true cross-category only.** The Architect's `arrivedVia === 'sideways'` test would let users farm the 50-XP prize. Synapse XP and the `connector` badge key off a **shared `isCrossCategory` helper** extracted from `constellation.ts`, using the anchor's `seedInterest` vs `adjacentField` category test. `sideways` is necessary but not sufficient.
- **Real tokens, no cyan.** Confirmed against `src/theme/colors.ts`: polymath is `colors.polymath` = `#FFD66B` gold (glyph `✦`), with `colors.polymathLight` for depth shading. The synapse celebration draws a `colors.primary` (violet) → `colors.polymath` (gold) gradient — "two worlds" reads stronger than violet→cyan anyway.
- **Spatial model: vertical deterministic auto-layout, View connectors, no canvas/SVG/pinch-zoom.** I reject pan/zoom canvas and ±2-depth virtualization. At the depth-12 cap with sparse forks we're at ~25–40 Views; orientation is preserved by **collapsing off-path subtrees**, not by virtualizing (which would break the active-path spine and ghost-lane reservation).

## Interaction Model

The governing law: **navigation moves a cursor over a persistent, append-only tree. No operation ever destroys a node.**

| User intent | Mechanic | Cost |
|---|---|---|
| **Go deeper / branch sideways into a new path** | Tap a `ghost` fork → generate node, append child, set fork `state: 'realized'`, move `cursorId` to the new child | One `cheap`-tier AI call |
| **Go back** | `cursorId = nodeMap[cursorId].parentId ?? cursorId`. Never touches `nodeMap` — the child you left stays drawn and settles `1→0.97→1` to prove it stayed | Free |
| **Take the other fork** at a fork you'd already left | If that fork is still a `ghost` → generate (first time = the `road_not_taken` moment). If already `realized` → free cursor jump to `fork.childId` | AI call if ghost; free if realized |
| **Jump to any visited node** | Tap its tile → `cursorId = node.id` | Free |
| **Re-take an explored fork** | `cursorId = fork.childId` | Free, awards nothing |
| **Collapse clutter** | Long-press a fork parent → its off-path subtree collapses to a `▸N` pill. **Default is fully expanded (Q6-resolved):** collapse is a deliberate user action, with ONE automatic exception — once the tree exceeds ~20 rendered nodes, off-path subtrees *deeper than the cursor* auto-collapse. The active path and the current node's direct ghosts NEVER collapse | Free |
| **Recenter** | `⌗` button → scroll cursor to center + re-stroke the active spine | Free |
| **Done / exit** | `router.back()`. The tree is already persisted (auto-saved on every move). Optional Exit Summary recaps the shape; naming is offered but never required | Free |

**Hardware/gesture back order:** close Focus sheet first → climb to parent → (at root) exit screen.

**The two forks self-describe their cost** so the user always knows what a tap will do:
- `● not yet opened` — ghost fork: an AI call + a new branch on the map.
- `✓ already explored` — realized fork: a free cursor jump.

Three readable rings of state encode "where you've been": **gold = my active path · solid neutral = been there, not now · dashed faint = could still go.**

## Tree-Map Design

### (a) Map overview — phone
Gold spine = active path (root→cursor); solid neutral tiles = visited-off-path; dashed faint tiles = ghost forks (pre-placed in the layout so the tree never reflows when one is realized). Straight vertical connector = `deeper`; elbow connector = `sideways`.

```
┌──────────────────────────────────────────┐
│  ‹    RABBIT HOLE · 7 nodes · 3 forks   ⌗ │  back · count(tap→trail list) · recenter
│  From: Why do murmurations stay together? │  anchor breadcrumb (pinned)
├──────────────────────────────────────────┤
│              ╭───────────╮                 │
│              │ ✦ ROOT     │ d0             │
│              ╰─────┬──────╯                 │  straight spine = DEEPER (gold)
│              ╭─────┴──────╮                 │
│              │ ↓ Local rules│ d1            │
│              ╰─────┬───┐                     │  elbow = a SIDEWAYS child
│         ╭────┴───╮  └──╮                    │
│         │↓ Boids  │d2  ╰╴╴╴╴╴╮              │
│         ╰────┬───╯      ┊⊕ ···┊ ghost(d2)  │  dashed tile+connector = un-taken fork
│         ╭────┴────╮     ╰╴╴╴╴╴╯              │
│         │◉ YOU ARE│d3   ↑ tap = take the    │
│         │  HERE(•)│      other path (free if │
│         ╰────┬────╯      already explored)   │
│         ┌╴╴╴╴┴╴╴╴╴┐                          │
│      ┊⊕ ···┊  ┊⊕ ···┊  ← your two NEXT       │
│      ╰╴╴╴╴╴╯  ╰╴╴╴╴╴╯    choices as ghosts   │
│                                          ▼ ▎│  scroll · depth rail (right edge)
├──────────────────────────────────────────┤
│              [ ▸ Open this node ]           │
└──────────────────────────────────────────┘
```

### (b) Focused node — bottom sheet (phone), grown from its tile
Tree dims to `0.35` but stays visible behind. Drag-down on the grab handle climbs to parent. Each fork button states its cost.

```
┌──────────────────────────────────────────┐
│ ░░░ tree dimmed-but-visible behind ░░░     │
│ ╭────────────────────────────────────────╮│  sheet, radii 20, from tile origin
│ │  ⌄ grab                          d3 ●●● ││  drag-down = climb to parent
│ │  ↻ SIDEWAYS · from "Local rules"        ││  arrival tag (colors.polymath) + crumb
│ │  Schooling fish vs. starling flocks     ││  Typography.Heading (Nunito)
│ │  Fish school with a lateral-line sense  ││  Typography.Body (DM Sans), ~30s read
│ │  flocks don't have — same three rules.  ││
│ │ ┌──────────────────┐┌──────────────────┐││
│ │ │↓ GO DEEPER        ││↻ BRANCH SIDEWAYS ││  minHeight 56, radii 16
│ │ │ the shared math   ││ a third medium   ││  left = polymath fill,
│ │ │ ● not yet opened  ││ ✓ already explored││  right = outline · ●=AI+new ✓=free
│ │ └──────────────────┘└──────────────────┘││
│ │  ‹ Climb to parent      ⊞ Jump to map    ││  both NON-destructive
│ ╰────────────────────────────────────────╯│
└──────────────────────────────────────────┘
```

### (c) Web — two simultaneous panes (≥900pt)
Map left (5–7 lanes), persistent Focus pane right. Clicking a tile updates the right pane; the selected tile gets a `colors.polymath` ring. No overlay, no toggle.

```
┌───────────────────────────────┬──────────────────────────────┐
│  RABBIT HOLE · 7 nodes · 3 fk ⌗│  ↻ SIDEWAYS · from "Local…"   │
│  From: Why do murmurations…    │  Schooling fish vs flocks      │
│         ╭ ✦ ROOT ╮ d0          │  Fish school with a lateral-   │
│         ╰───┬────╯             │  line sense flocks don't have… │
│      ╭──────┴─────╮ d1         │                                │
│      │ Local rules │           │  ┌───────────┐┌─────────────┐  │
│      ╰──┬────┐                 │  │↓ GO DEEPER ││↻ SIDEWAYS    │  │
│   ╭─────┴╮  ╰╴╴╴╮              │  │● not opened││✓ explored    │  │
│   │Boids ◉│d2  ┊⊕┊ ghost       │  └───────────┘└─────────────┘  │
│   ╰───────╯    ╰╴╴╯ ← selected │  ‹ Climb     ⊞ Recenter map    │
│   (ring = focus)               │                                │
└───────────────────────────────┴──────────────────────────────┘
```

### (d) Key states

```
LOADING NEXT (fork tapped — tree stays put)   ERROR (branch stays a retryable ghost)
┌────────────────────────────┐               ┌────────────────────────────┐
│   ╭──────╮                  │               │   ╭──────╮                  │
│   │ HERE │                  │               │   │ HERE │                  │
│   ╰──┬───╯                  │               │   ╰──┬───╯                  │
│   ┊░░░░░░░░┊ skeleton tile,  │               │  ⚠ Couldn't pull that      │
│   ┊░ pulse ┊ gold shimmer    │               │    thread.                  │
│   ╰────────╯                 │               │  [ Retry ] [ Take other fork]│
│   "Pulling the thread…" ◌    │               │  (tree intact; ghost stays) │
└────────────────────────────┘               └────────────────────────────┘

DEPTH CAP (per-branch, not global freeze)     EXIT SUMMARY (on Done — naming optional)
┌────────────────────────────┐               ┌────────────────────────────┐
│   ╭──────╮ gold ring         │               │  ✦ This rabbit hole         │
│   │ d12  │                   │               │   depth 5 · 2 branches · 1🔗 │
│   ╰──┬───╯                   │               │   (already banked as you     │
│  ╭───┴────────────────╮      │               │    explored — +100 XP total) │
│  │ 12 deep — a proper  │      │               │                             │
│  │ rabbit hole. Climb  │      │               │  Name it? (optional)        │
│  │ up & branch ↻ to    │      │               │  [____________________]     │
│  │ keep exploring.     │      │               │  [ Name & keep ]  [ Done ]   │
│  ╰────────────────────╯      │               │  (exit always persists tree) │
└────────────────────────────┘               └────────────────────────────┘

EMPTY (no thread yet)
┌────────────────────────────┐
│   ╭───────────╮              │
│   │ ✦  ?       │  root only   │
│   ╰───────────╯              │
│  Pull a thread from today's  │
│  spark to start wandering.   │
│       [ Go to Explore ]      │
└────────────────────────────┘
```

The Exit Summary is recap-only: because scoring is per-milestone, **the XP was already banked as the shape formed** — both buttons just exit. Naming is a label written onto the tree row, never a gate.

### Node visual encoding (real tokens only)

| Facet | Encoding |
|---|---|
| Arrival = deeper | Straight vertical **spine**; `↓` glyph + `DEEPER` micro-label; `colors.polymath`, `Typography.Heading` |
| Arrival = sideways | **Elbow** connector (horizontal jog → vertical drop); `↻` glyph + `SIDEWAYS` — shape distinguishes lateral from drill-down |
| Depth | Vertical row position *is* depth (primary); `d3` chip top-right; depth rail on right edge; fill deepens `colors.polymathLight` → `colors.polymath` with depth |
| Ghost (un-taken fork) | `borderStyle: 'dashed'`, opacity `0.4`, `⊕ ···`, dashed connector; pre-placed at `opacity: 0` from first render so realizing it never reflows |
| Active path | 2px `colors.polymath` connectors + gold-tinted tiles root→cursor; off-path = `colors.border` thin connectors, `colors.card` fill, `colors.textSecondary` |
| Visited-off-path | Solid tile, normal opacity, **neutral** (not gold) — "I was here, not now" |
| Cursor | Pulsing `colors.polymath` ring (`withRepeat`) + `◉` glyph |
| Collapsed subtree | `▸N` pill in `colors.surfaceAlt`, gold count |

## Data Model & State

### Persisted shape — ONE row, JSON blob

`rabbitHoleTrees` table (native: Drizzle / web: synchronous localStorage shim). The whole tree reads in one synchronous `get`. `sparks.threadId` (the existing unused column) is stamped with the tree id on creation.

```typescript
// c:\personal\Project X\lifeos\src\db\schema.ts  — APPEND after the sparks table
export const rabbitHoleTrees = sqliteTable('rabbit_hole_trees', {
  id:           text('id').primaryKey(),            // nanoid()
  userId:       text('user_id').notNull(),
  sparkId:      text('spark_id').notNull(),
  anchorJson:   text('anchor_json').notNull(),      // JSON: RabbitHoleAnchor
  treeJson:     text('tree_json').notNull(),         // JSON: { nodeMap, rootId, cursorId }
  scoringJson:  text('scoring_json').notNull(),      // JSON: RabbitHoleScoring (idempotency ledger)
  title:        text('title'),                       // null until named (optional)
  xpAwarded:    integer('xp_awarded').notNull().default(0), // running total banked so far
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
  deletedAt:    text('deleted_at'),
});
```

### TypeScript types

`c:\personal\Project X\lifeos\src\explore\rabbitHoleTree.ts` (new):

```typescript
import { z } from 'zod';

export type RabbitHoleDirection = 'deeper' | 'sideways';
export type ForkState = 'realized' | 'ghost';

export interface RabbitHoleFork {
  readonly direction: RabbitHoleDirection;
  readonly hint: string;                  // goDeeperHint / goSidewaysHint from GeneratedNode
  childId: string | null;                 // null = ghost; set when taken
  state: ForkState;
}

export interface RabbitHoleNode {
  readonly id: string;                    // nanoid()
  readonly parentId: string | null;       // null iff root
  readonly arrivedVia: RabbitHoleDirection | null; // null iff root
  readonly title: string;
  readonly body: string;                  // >= 20 chars (existing Zod contract)
  forks: readonly [RabbitHoleFork, RabbitHoleFork]; // [0]=deeper, [1]=sideways, ALWAYS
  readonly createdAt: string;             // ISO-8601
  visitedAt: string | null;
}

export interface RabbitHoleAnchor {
  readonly title: string;
  readonly seedInterest: string | null;
  readonly adjacentField: string | null;
}

// In-memory tree (lives inside treeJson and in the Zustand store)
export interface RabbitHoleTreeData {
  nodeMap: Record<string, RabbitHoleNode>;
  rootId: string;
  cursorId: string;
}

// Idempotency ledger — pay each shape-milestone once, even across re-hydration
export interface RabbitHoleScoring {
  scoredDepthTier: number;        // highest depth tier already paid (0=none, 3, 5)
  scoredBranchIds: string[];      // branch-root node ids already paid for breadth
  scoredSynapsePairs: string[];   // sorted "catA|catB" pairs paid for in THIS tree
  badgesFired: string[];          // BadgeId[] already toasted for this tree
  dailyMapCountKey: string;       // 'YYYY-MM-DD' bucket for diminishing-returns gate
}
```

### Zod schemas (validate at every persistence read boundary)

```typescript
export const RabbitHoleForkSchema = z.object({
  direction: z.enum(['deeper', 'sideways']),
  hint: z.string().min(1),
  childId: z.string().nullable(),
  state: z.enum(['realized', 'ghost']),
});

export const RabbitHoleNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable(),
  arrivedVia: z.enum(['deeper', 'sideways']).nullable(),
  title: z.string().min(1),
  body: z.string().min(20),
  forks: z.tuple([RabbitHoleForkSchema, RabbitHoleForkSchema]),
  createdAt: z.string().datetime(),
  visitedAt: z.string().datetime().nullable(),
});

export const RabbitHoleAnchorSchema = z.object({
  title: z.string().min(1),
  seedInterest: z.string().nullable(),
  adjacentField: z.string().nullable(),
});

export const RabbitHoleTreeDataSchema = z.object({
  nodeMap: z.record(z.string(), RabbitHoleNodeSchema),
  rootId: z.string().min(1),
  cursorId: z.string().min(1),
});

export const RabbitHoleScoringSchema = z.object({
  scoredDepthTier: z.number().int().min(0),
  scoredBranchIds: z.array(z.string()),
  scoredSynapsePairs: z.array(z.string()),
  badgesFired: z.array(z.string()),
  dailyMapCountKey: z.string(),
});
```

### Pure tree helpers (no side effects, fully unit-testable)

```typescript
export function pathToRoot(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): RabbitHoleNode[] {
  const path: RabbitHoleNode[] = [];
  let cur = m.get(nodeId);
  while (cur) { path.unshift(cur); cur = cur.parentId != null ? m.get(cur.parentId) : undefined; }
  return path;
}
export function depthOf(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): number {
  return pathToRoot(nodeId, m).length - 1;
}
export function childrenOf(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): RabbitHoleNode[] {
  const n = m.get(nodeId);
  if (!n) return [];
  return n.forks.filter(f => f.childId != null).map(f => m.get(f.childId!)).filter((x): x is RabbitHoleNode => x != null);
}
export function allDescendants(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): RabbitHoleNode[] {
  const out: RabbitHoleNode[] = []; const q = [nodeId];
  while (q.length) { const c = childrenOf(q.shift()!, m); out.push(...c); q.push(...c.map(x => x.id)); }
  return out;
}
export function maxDeeperDepth(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): number {
  const n = m.get(nodeId);
  if (!n) return 0;
  const deeper = n.forks[0];                 // index 0 is always 'deeper'
  return deeper.childId == null ? 0 : 1 + maxDeeperDepth(deeper.childId, m);
}
export function realizedBranchCount(rootId: string, m: ReadonlyMap<string, RabbitHoleNode>): number {
  // Q2-resolved gate: a "branch" = a fork node with BOTH children realized, AND its sideways
  // subtree is "substantive" = either (a) >= 2 nodes all isConcreteNode, OR (b) exactly 1
  // isConcreteNode node that itself has >= 1 realized fork. (b) keeps a one-deep stub from
  // qualifying while still rewarding a genuine "read one strong node, then went on" branch.
  let count = 0;
  const visit = (id: string) => {
    const n = m.get(id); if (!n) return;
    const realized = n.forks.filter(f => f.childId != null);
    if (realized.length >= 2) {
      const sideways = n.forks[1];
      if (sideways.childId != null && isSubstantiveBranch(sideways.childId, m)) count++;
    }
    realized.forEach(f => visit(f.childId!));
  };
  visit(rootId);
  return count;
}
```

**Invariants:** `forks[0]` is always `deeper`, `forks[1]` always `sideways` (index by constant, read `.direction` for display only). `parentId === null` iff root. Ghost: `childId === null && state === 'ghost'`. Realized: valid `childId && state === 'realized'`. `pathToRoot` is O(depth) — memoize in the render layer.

### State container — dedicated Zustand store (`immer` middleware)

`c:\personal\Project X\lifeos\src\store\useRabbitHoleStore.ts`. React Query is wrong here (rapidly-mutating local structure, not a remote cache). Synchronous reads; integrates with the existing store pattern. **Verify the `immer` middleware import path against `package.json` (Zustand v5 ships it at `zustand/middleware/immer`)** before writing.

```typescript
interface TileLayoutEntry { x: number; y: number; width: number; height: number; }

interface RabbitHoleState {
  treeId: string | null;
  anchor: RabbitHoleAnchor | null;
  nodeMap: Record<string, RabbitHoleNode>;
  rootId: string | null;
  cursorId: string | null;            // the cursor — "back" moves THIS, never the map
  sheetOpen: boolean;                  // phone: Focus sheet open (NOT a screen toggle)
  isAdvancing: boolean;
  tileLayouts: Record<string, TileLayoutEntry>;  // for the Reanimated grow-from-tile overlay
  prefetchCache: Record<string, RabbitHoleNode>; // key `${parentId}:${direction}`, flag-gated
  revision: number;                    // bumped on every nodeMap mutation → memo key for layout
}

interface RabbitHoleActions {
  loadTree(data: RabbitHoleTreeData, anchor: RabbitHoleAnchor, treeId: string): void;
  initTree(rootNode: RabbitHoleNode, anchor: RabbitHoleAnchor, treeId: string): void;
  jumpTo(nodeId: string): void;                            // cursorId = nodeId
  climbToParent(): void;                                   // cursorId = parent ?? self (the fix)
  appendChild(parentId: string, direction: RabbitHoleDirection, child: RabbitHoleNode): void; // realizes a ghost
  setSheetOpen(open: boolean): void;
  setAdvancing(v: boolean): void;
  setTileLayout(nodeId: string, layout: TileLayoutEntry): void;
  setPrefetch(parentId: string, direction: RabbitHoleDirection, node: RabbitHoleNode): void;
  reset(): void;
}
```

Stable selectors wrap the pure helpers (`selectFocusNode`, `selectPathToRoot`, `selectDepthOfCursor`, `selectIsAtDepthCap`). After any `nodeMap` mutation, persistence writes the whole `{nodeMap, rootId, cursorId}` blob synchronously (web shim) / via Drizzle (native).

## AI Integration

**The `GeneratedNode` contract is untouched.** Both generators stay drop-in:
- `generateRabbitHoleNode(input)` — single-shot, mock-first, anti-filler guard, curated fallback.
- `exploreThreadNode(input)` — tool-use agent grounded in real interests/sparks/expeditions (flag `exploreAgenticThread`, default ON). Same `{ title, body, goDeeperHint, goSidewaysHint }` output.

Input shape unchanged: `{ parent: {title, body}, anchor: {title, seedInterest?, adjacentField?}, direction }`. Model tier stays `'cheap'`.

`advanceRabbitHole(direction)` (`c:\personal\Project X\lifeos\src\explore\rabbitHoleActions.ts`):

1. Per-branch depth gate: `if (depthOf(cursorId, asMap(nodeMap)) >= MAX_DEPTH) return;` — `MAX_DEPTH` becomes a **per-path** limit via `depthOf`, replacing the old global `thread.length` check. The cap card renders for the focused branch only; other branches stay live.
2. Build `GeneratedNode` → map to a `RabbitHoleNode`, generate its **two fresh ghost forks** from `goDeeperHint`/`goSidewaysHint` (every node always has two forward choices).
3. `store.appendChild(cursorId, direction, child)` — flips the chosen fork from `ghost` → `realized`, stores `childId`, moves the cursor, bumps `revision`.
4. Persist the blob synchronously.
5. **`scoreTreeShape(userId)`** runs after the store mutates (see Gamification). **No `addXP` here** — add a comment: `// XP is scored by shape in scoreTreeShape, never per advance.`

**Both-fork handling & never-dead-end:** every node exposes both forks as ghosts immediately. Taking a ghost generates; re-taking a realized fork is a free cursor jump. The curated fallback inside `generateRabbitHoleNode` guarantees a tap never dead-ends; on a hard error the branch stays a **retryable ghost** (error state above), the rest of the tree is untouched.

**Cost control:** a tree lets users open both forks everywhere, so cost could creep. Mitigations: free re-takes, `'cheap'` tier, **no per-tap XP incentive**, and **prefetch deferred** behind `exploreAgenticPrefetch` (default OFF — keep off until cost-ledger data justifies it). Prefetched nodes use `prefetch_`-prefixed temp ids, are persisted only when actually taken, and **are excluded from `scoreTreeShape`** (speculative generation is not exploration). All generation goes through `generateRabbitHoleNode`/`exploreThreadNode` → `callAI` → `recordUsage`/`track`/spans, so cost telemetry stays populated with zero special wiring.

**Constellation feed (graceful degradation):** on a qualifying milestone, `emitThreadToConstellation` writes `led_to` edges along the active path and `synapse` edges for true cross-category sideways branches **directly to a local `constellationEdges` table** — not through `recordMutation` (the sync union has no rabbit-hole type, and the constellation rebuilds from source data on each `projectConstellation` call anyway). The rabbit-hole-local `connector` badge **always fires**; the constellation-global `synapse_formed` co-fire fires **if/when** the feed lands. Synapse detection uses the **shared `isCrossCategory` helper** extracted from `constellation.ts` so the two synapse counts never drift.

## Component Breakdown

| File path | New/Modify | Responsibility |
|---|---|---|
| `c:\personal\Project X\lifeos\src\explore\rabbitHoleTree.ts` | **New** | Types, Zod schemas, pure helpers (`pathToRoot`/`depthOf`/`childrenOf`/`allDescendants`/`maxDeeperDepth`/`realizedBranchCount`) |
| `c:\personal\Project X\lifeos\src\explore\rabbitHoleActions.ts` | **New** | `loadOrCreateThread`, `advanceRabbitHole` (NO addXP), `scoreTreeShape`, `computeSynapseXp`, `prefetchOtherFork` |
| `c:\personal\Project X\lifeos\src\explore\rabbitHoleConstellation.ts` | **New** | `emitThreadToConstellation`, `upsertConstellationEdge` (local table) |
| `c:\personal\Project X\lifeos\src\explore\isCrossCategory.ts` | **New** | Shared cross-category test extracted from `constellation.ts` (single source for synapse detection) |
| `c:\personal\Project X\lifeos\src\store\useRabbitHoleStore.ts` | **New** | Zustand+immer store: `nodeMap`, `cursorId`, `tileLayouts`, actions, selectors |
| `c:\personal\Project X\lifeos\src\db\schema.ts` | **Modify** | Append `rabbitHoleTrees` + `constellationEdges` tables; stamp `sparks.threadId` on create |
| `c:\personal\Project X\lifeos\src\db\queries\rabbitHoleTrees.ts` | **New** | Native Drizzle: `upsertTree`, `getTree`, `getSavedTrees`, `countTreesToday`, `countQualifyingTrees`, soft-delete prune |
| `c:\personal\Project X\lifeos\src\db\webStorage\rabbitHoleTrees.ts` | **New** | Synchronous localStorage shim, same surface, Zod-validated reads |
| `c:\personal\Project X\lifeos\src\explore\constellation.ts` | **Modify** | Read `constellationEdges` as an extra edge source in `projectConstellation`; export the cross-category test for the shared helper |
| `c:\personal\Project X\lifeos\src\config\flags.ts` | **Modify** | Add `rabbitHoleTreeMap: false`, `exploreAgenticPrefetch: false` |
| `c:\personal\Project X\lifeos\src\constants\gamification.ts` | **Modify** | Add `deep_diver`, `cartographer`, `road_not_taken`, `connector`, `archivist` to `BadgeId` + `BADGE_META` |
| `c:\personal\Project X\lifeos\src\store\useGameStore.ts` | **Modify** | Add `hasSynapsePair`/`recordSynapsePair` (cross-map ever-once de-dupe) + daily/lifetime tree counters in a persisted `polymath` slice |
| `c:\personal\Project X\lifeos\app\rabbit-hole.tsx` | **Modify** | Screen. `rabbitHoleTreeMap` off → legacy linear JSX (kept one sprint); on → `<RabbitHoleScreen />`. Wrap in error boundary |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleScreen.tsx` | **New** | Header, phone sheet-over-map vs web two-pane layout (via `useWindowDimensions`), Exit Summary host |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleMapView.tsx` | **New** | Deterministic single-pass layout (`column`/`depth` → x/y), memoized on `revision`; renders tiles + connectors; off-path collapse |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleMapNode.tsx` | **New** | One tile; `onLayout`→`setTileLayout`; realized/ghost/focused/visited states; bloom + cursor pulse |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\ConnectorElbow.tsx` | **New** | Direction-shaped connector: straight `View` for deeper; horizontal stub + vertical drop for sideways; `opacity 0→1` once both endpoints measured |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleNodeCard.tsx` | **New** | Focus reading panel; phone = Reanimated overlay grown from tile origin; web = static right pane; CLIMB UP = `climbToParent` (non-destructive) |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleForkButton.tsx` | **New** | Fork button (`minHeight 56`, `radii 16`); `● not yet opened` vs `✓ already explored`; ghost→`advanceRabbitHole`, realized→`jumpTo` |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleDepthBadge.tsx` | **New** | `DEPTH n / 12` pill; neutral→`colors.polymath` interpolation by depth |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleBreadcrumb.tsx` | **New** | Path-to-root trail list (a11y/screen-reader nav fallback behind the header count tap) |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\RabbitHoleExitSummary.tsx` | **New** | Recap sheet on Done; shape recap + optional name field; both buttons exit (XP already banked) |
| `c:\personal\Project X\lifeos\src\components\modules\polymath\ConstellationView.tsx` | **Unchanged** | Not modified; rebuilds from constellation source on next render |

## Gamification

**Principle: reward the residue of genuine curiosity, never the act of tapping.** `scoreTreeShape(userId)` runs after each store mutation and pays only *newly-achieved* shape milestones, idempotently via the `scoring` ledger on the tree row. There is no terminal save gate; naming pays nothing.

### XP curve (uses real `XP_VALUES`, scored per-milestone)

| Dimension | Trigger (computed from the live tree) | XP | Cap / idempotency |
|---|---|---|---|
| **Depth** | deeper-chain first crosses a tier | tier 3 → `+10`; tier 5 → `+20` (`expeditionStepComplete`) | one tier per crossing; `scoring.scoredDepthTier`; never per-node |
| **Breadth** | a branch qualifies: parent fork **realized** (both children) **AND** (sideways subtree ≥2 nodes all `isConcreteNode` **OR** 1 `isConcreteNode` node that itself has ≥1 realized fork) | `completeGoalTask: 15` each | max **3** paid; `scoring.scoredBranchIds`; substance-gated |
| **Synapse** | a sideways jump whose endpoints are in **different interest categories** (`isCrossCategory`) | `synapseFormed: 50` each | max **2** per tree; `scoring.scoredSynapsePairs` (this tree) **and** `useGameStore.hasSynapsePair` (ever-once across all maps) |

**Curve check:** a shallow 3-node straight line earns ~0–10 XP (less than one goal task). A real session (depth 5, two live branches, one true synapse) earns `20 + 30 + 50 = 100` XP — on par with `completeResource`. A poke feels minor; a real map earns its keep.

**Daily diminishing returns:** trees 1–2 today pay full; tree 3+ pays the depth tier only (breadth/synapse zeroed), gated by `scoring.dailyMapCountKey` + a daily bucket in the `polymath` slice. Wander freely; can't farm. **The taper must be legible, never silent (Q3-resolved):** on tree 3+ surface a small, non-judgmental cue (e.g. a "depth-only beyond today's free maps" chip near the depth badge) so a user never perceives missing XP as a bug.

### Badge table (each fires once per tree via `scoring.badgesFired`; award grants `earnBadge: 200` through the existing flow)

| Glyph | id | Label | Exact trigger |
|---|---|---|---|
| 🕳️ | `deep_diver` | Deep Diver | Tree reaches a deeper-chain of depth ≥ 5. Fires the instant the 5th-deep node blooms |
| 🗺️ | `cartographer` | Cartographer | Tree has ≥ 3 qualifying branches (Q2 gate above). Fires when the 3rd qualifies (no terminal save needed) |
| 🛤️ | `road_not_taken` | The Road Not Taken | A previously-ghost fork is **opened** (the second child generated at a fork you'd already left and climbed back from). Fires on that child's bloom. Re-walking a realized fork is free and fires nothing — this badge *proves* the back-without-destroy win |
| 🔗 | `connector` | Connector | Tree produces its first true cross-category synapse (`isCrossCategory`). Fires on that node's bloom. Rabbit-hole-local; distinct from constellation-global `synapse_formed` |
| 📚 | `archivist` | Archivist | User has 5 trees each with (depth ≥ 3 OR ≥ 1 synapse), **AND ≥ 2 of those 5 have depth ≥ 5 OR a true cross-category synapse** (Q4-resolved — certifies a real body of work, not 5 shallow stubs). Once-ever; cross-tree count in the `polymath` slice. If `isCrossCategory` proves rare in monitoring, swap the synapse arm for "≥ 2 qualifying branches" before relying on it |

`polymath_starter`, `expedition_complete`, `synapse_formed` reused untouched. On a true leap, `connector` fires immediately; `synapse_formed` queues behind it for the signature double-toast **if** the feed is wired. **Double-toast sequencing:** verify `AchievementToast` queues; if it overwrites, gate the second on a 1200ms `setTimeout`.

### Streaks & return hooks
- **One streak: `learning`.** `triggerStreak(userId, 'learning')` fires once per day on the **first qualifying shape-milestone** (not on open, not per tap). `curiosityStreakDay` telemetry fires alongside. 1-day grace; no nagging.
- **"Your Maps" history** (rehydratable saved trees) is the primary return hook — trivial because nothing is destroyed. **Parked as fast-follow.**
- **Unfinished map = gentle open loop:** a "Still wandering…" card with a soft pulse on its newest ghost branch (pre-placed ghosts make this free to render). Zero pushes by default.

### Juice / milestones (Reanimated v4 + haptics, web-safe; all durations from `MOTION_BUDGET`/`TIMING_CFG`, springs from `SPRING`, gated by `useMotionScale()`)

| Beat | Animation | Token | Haptic |
|---|---|---|---|
| Node bloom (every advance) | tile scale `0.6→1` from parent + connector draws | `SPRING.snappy` + `TIMING_CFG.normal` | `impactAsync(Light)` (no XP) |
| First branch (taught once) | not-taken ghost shimmers in + coachmark "Both paths stay on your map" | `TIMING_CFG.fast` | `selectionAsync()` |
| Climb up (back) | cursor ring re-seats on parent; left child settles `1→0.97→1` (proves it stayed) | `SPRING.standard` | `selectionAsync()` |
| Focus open | tapped tile shared-transform grows into sheet/pane; tree dims `→0.35` | `SPRING.soft` | `selectionAsync()` |
| Depth 5 → `deep_diver` | gold halo + zoom-out so you see how deep you went | `TIMING.slow` | `notificationAsync(Success)` |
| **First true synapse → `connector` (peak)** | edge draws in `colors.primary` violet → `colors.polymath` gold gradient; both endpoints pulse; double-toast queues; **confetti** | `EASING.bounce` | `notificationAsync(Success)` |
| Exit summary | zoom-to-fit settle; shape recap | `SPRING.soft` | `notificationAsync(Success)` |

**Confetti is reserved for two moments only:** the first cross-domain synapse (mid-wander peak) and the exit-summary settle — meaningful, never behind a save gate. (No confetti component exists today; reuse `AchievementToast` with a richer "synapse" variant, or scope a small confetti as a late enhancement.)

### Anti-patterns avoided
No per-tap XP (the deleted `addXP(userId, 8)` line). No fake urgency (no timers; `learning` grace kept). No engagement-bait caps (per-branch cap is an honest "big map" nod). No grind farms (substance gate + per-dimension caps + daily diminishing + ever-once synapse de-dupe). No hollow collectibles (any future silhouette is generated from the real tree shape). No notification spam (zero by default).

## Build Sequence

All steps land behind `rabbitHoleTreeMap` (default off); legacy linear JSX stays one sprint for A/B.

**Phase 1 — Data model (no UI).**
- `rabbitHoleTree.ts` (types, Zod, pure helpers) + unit tests (`pathToRoot`, `depthOf`, `childrenOf`, `maxDeeperDepth`, `realizedBranchCount`; Zod rejects short body / bad datetime / wrong fork count).
- Append `rabbitHoleTrees` + `constellationEdges` to `schema.ts`; `npx drizzle-kit generate`; verify additive (`IF NOT EXISTS`).
- `db/queries/rabbitHoleTrees.ts` (native) + `db/webStorage/rabbitHoleTrees.ts` (synchronous shim) — identical surface.

**Phase 2 — Store & actions (no UI).**
- `useRabbitHoleStore.ts` (verify `immer` import path first).
- `rabbitHoleActions.ts`: `advanceRabbitHole` (explicit "NO addXP" comment), `scoreTreeShape`, `computeSynapseXp`, `loadOrCreateThread`, `prefetchOtherFork`.
- Add `rabbitHoleTreeMap`/`exploreAgenticPrefetch` flags; add `hasSynapsePair`/`recordSynapsePair` + daily/lifetime counters to `useGameStore`.
- Tests: mock `generateRabbitHoleNode`; assert `advanceRabbitHole` appends + realizes fork + does NOT call `addXP`; `jumpTo` on a realized fork skips AI; `scoreTreeShape` computes correct XP for a fixture, banks once, is idempotent on re-run; `userId` comes from `useUserStore` (not `sparkId`).

**Phase 3 — Constellation feed & shared helper.**
- Extract `isCrossCategory.ts` from `constellation.ts`; rewire `constellation.ts` to use it.
- `rabbitHoleConstellation.ts` (`emitThreadToConstellation`, `upsertConstellationEdge`); extend `projectConstellation` to read `constellationEdges`.
- Tests: 5-node path + one cross-category sideways branch → assert `led_to` edges along path, `synapse` edge for the branch, idempotent.

**Phase 4 — Badges.**
- Add five `BadgeId`s + `BADGE_META`; wire `road_not_taken` in `advanceRabbitHole` (ghost→realized). Verify double-toast sequencing.

**Phase 5 — Components (all behind flag).**
- `RabbitHoleDepthBadge` → `RabbitHoleBreadcrumb` → `ConnectorElbow` → `RabbitHoleMapNode` (snapshot: realized/ghost/focused) → `RabbitHoleForkButton` (render: realized vs ghost vs disabled) → `RabbitHoleNodeCard` (verify CLIMB UP doesn't mutate `nodeMap`) → `RabbitHoleMapView` (3- and 7-node fixtures; connector renders after `onLayout`; ghost at `opacity 0` pre-layout) → `RabbitHoleExitSummary` → `RabbitHoleScreen` (integration: sheet open/close; back climbs — cursor at parent, child still in `nodeMap`).

**Phase 6 — Screen rewrite.**
- Rewrite `app/rabbit-hole.tsx` with the flag fork. Stamp `sparks.threadId` on tree creation.
- E2E smoke: open from explore → advance 3 deeper → back (previous node still present) → jump 2 levels up → open the other (ghost) fork (advance fires + `road_not_taken`) → Done (no double-charge; XP banked once).

**Phase 7 — Enable & clean up.**
- Flip `rabbitHoleTreeMap: true`; delete legacy JSX.
- `docs/PARKED_ITEMS.md`: "Your Maps" gallery + silhouette cover art + image share + AI-suggested title + web drag-pan + rabbit-hole sync (thread metadata via mutation log once constellation sync is scoped) + react-native-skia connectors if node count > 50.

## Risks & Mitigations
- **react-native-web `onLayout` async gap** — connectors lag nodes by one frame. Mitigation: ghosts render in the layout tree from first pass at `opacity 0` (holding their lane); connectors `withTiming(1)` once both endpoints measured. Single imperceptible frame.
- **Shared-element API unavailable on web** — replaced entirely by a measured-origin Reanimated overlay reading `tileLayouts[cursorId]`; identical visual on iOS/Android/web.
- **Layout must be a pure function of the tree** — memoize `RabbitHoleMapView` on `revision` so rehydration looks identical and scroll never recomputes.
- **Synchronous web read** — the blob (≤~40 nodes ≪ 5MB) reads in one `localStorage.get`; render/voice synchrony preserved. 90-day soft-delete prune + 80%-quota proactive prune of oldest soft-deleted trees.
- **Cost creep** — free re-takes, `'cheap'` tier, no tap incentive, prefetch off by default; prefetched temp nodes never scored.
- **Synapse drift** — single `isCrossCategory` helper for both rabbit hole and constellation, or the counts diverge. Extract once.
- **`immer` import path / `Map`-vs-`Record`** — store keeps `nodeMap` as a `Record`; selectors build a `Map` for the helpers. Verify Zustand v5 `immer` path against `package.json`.
- **New connector primitive** (direction-shaped Views) is untrodden in this repo — budget a day; `ConnectorElbow` is explicitly two `View`s for the sideways case.
- **Double-toast** — verify `AchievementToast` queues; else 1200ms delay on the second.
- **`road_not_taken` depends on Phase 6** — don't add it to `BADGE_META` until Phase 4 and don't expect it to fire until navigation ships.

## Resolved open questions (Q1–Q6)

Resolved 2026-06-05 in a three-discipline decision round (UI/UX, solution architecture, game design) → lead ruling. None required product-owner sign-off; the four spec edits are already folded into the sections above.

| Q | Decision | Status |
|---|---|---|
| **Q1 · Sideways semantics** | Sideways creates a sibling child of the **current** node (real fork in place); it does **not** re-anchor at the spark | **FIRM** — root-anchor would flatten the tree to a star, break `depthOf(cursor)`, and make depth-tier XP meaningless for sideways branches |
| **Q2 · Breadth bar** | Branch qualifies when parent fork is realized **AND** (sideways subtree ≥2 concrete nodes **OR** 1 concrete node with ≥1 realized fork of its own) | **Default — instrument** cartographer earn-rate; if >20% of sessions earn it, tighten back to flat "≥2 all-concrete" |
| **Q3 · Daily allotment** | Keep **2** full-scoring trees/day; tree 3+ depth-tier only, with a **visible** taper cue | **Default — instrument** trees/day distribution + day-3 session quality; bump to 3 only on healthy, non-farmed data |
| **Q4 · Archivist floor** | 5 trees with (depth≥3 OR ≥1 synapse) **AND** ≥2 of them depth≥5 OR a true cross-category synapse | **Default — instrument**; gate the synapse arm on `isCrossCategory` frequency |
| **Q5 · Depth tiers** | Two tiers: depth 3 → +10, depth 5 → +20 | **FIRM** — early +10 lands inside ~90s and teaches that depth is scored; +30 total sits below `synapseFormed` (+50) |
| **Q6 · Auto-collapse** | Expanded by default + manual long-press collapse; auto-collapse off-path/deeper-than-cursor subtrees only past ~20 rendered nodes; active path + current node's ghosts never collapse | **FIRM (model)**; ~20 threshold pending low-end-device testing |

### Launch instrumentation (the four "instrument" items above)
- **Cartographer earn-rate** — target <20% of sessions (else Q2 gate is being gamed).
- **Trees-per-day distribution + day-3 session quality** — informs whether Q3's free allotment should rise to 3.
- **`isCrossCategory` frequency** — if the AI under-diversifies interest categories, swap Archivist's synapse arm for "≥2 qualifying branches".
- **Cursor-lost-rate vs. node count** — calibrates the Q6 ~20-node auto-collapse threshold.