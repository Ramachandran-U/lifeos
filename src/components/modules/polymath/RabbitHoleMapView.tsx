import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { spacing } from '@/theme/spacing';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';
import { layoutTree } from '@/explore/rabbitHoleLayout';
import { pathToRoot, asLookup } from '@/explore/rabbitHoleTree';
import { advanceRabbitHole } from '@/explore/rabbitHoleActions';
import { ConnectorElbow } from './ConnectorElbow';
import { RabbitHoleMapNode, type MapNodeKind } from './RabbitHoleMapNode';

const TILE_W = 132;
const TILE_H = 64;
const COL_GAP = 28;
const ROW_GAP = 44;
const cellW = TILE_W + COL_GAP;
const cellH = TILE_H + ROW_GAP;

const centerX = (col: number): number => col * cellW + TILE_W / 2;
const topY = (row: number): number => row * cellH;
const centerY = (row: number): number => topY(row) + TILE_H / 2;

interface Props {
  /** Called after a node is focused (e.g. open the phone Focus sheet). */
  onFocusNode?: () => void;
}

/** The decision-tree map: a deterministic, scrollable layout of tiles +
 * connectors. Tapping a node jumps the cursor there; tapping a ghost opens that
 * fork. The layout is a pure function of the tree (memoized on its identity). */
export function RabbitHoleMapView({ onFocusNode }: Props) {
  const nodeMap = useRabbitHoleStore((s) => s.nodeMap);
  const rootId = useRabbitHoleStore((s) => s.rootId);
  const cursorId = useRabbitHoleStore((s) => s.cursorId);
  const jumpTo = useRabbitHoleStore((s) => s.jumpTo);
  const setTileLayout = useRabbitHoleStore((s) => s.setTileLayout);

  const layout = useMemo(
    () => (rootId && cursorId ? layoutTree({ nodeMap, rootId, cursorId }) : null),
    [nodeMap, rootId, cursorId],
  );
  const pathIds = useMemo(
    () => (cursorId ? new Set(pathToRoot(cursorId, asLookup(nodeMap)).map((n) => n.id)) : new Set<string>()),
    [nodeMap, cursorId],
  );

  if (!layout || !rootId || !cursorId) return null;

  const width = layout.cols * cellW;
  const height = layout.rows * cellH + spacing.xl;

  return (
    <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }} showsHorizontalScrollIndicator={false}>
      <ScrollView contentContainerStyle={{ width, height }} showsVerticalScrollIndicator={false}>
        <View style={{ width, height }}>
          {layout.connectors.map((conn, i) => (
            <ConnectorElbow
              key={`conn-${i}`}
              from={{ x: centerX(conn.from.col), y: centerY(conn.from.row) }}
              to={{ x: centerX(conn.to.col), y: centerY(conn.to.row) }}
              direction={conn.direction}
              active={conn.toId != null && pathIds.has(conn.toId) && pathIds.has(conn.fromId)}
              ghost={conn.toId == null}
            />
          ))}

          {Object.entries(layout.nodes).map(([id, cell]) => {
            const node = nodeMap[id];
            if (!node) return null;
            const kind: MapNodeKind = id === cursorId ? 'cursor' : pathIds.has(id) ? 'path' : 'visited';
            const left = centerX(cell.col) - TILE_W / 2;
            const top = topY(cell.row);
            return (
              <RabbitHoleMapNode
                key={id}
                title={node.title}
                kind={kind}
                arrivedVia={node.arrivedVia}
                x={left}
                y={top}
                width={TILE_W}
                height={TILE_H}
                onLayout={(e) =>
                  setTileLayout(id, { x: left, y: top, width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
                }
                onPress={() => {
                  jumpTo(id);
                  onFocusNode?.();
                }}
              />
            );
          })}

          {layout.ghosts.map((g, i) => (
            <RabbitHoleMapNode
              key={`ghost-${i}`}
              title=""
              kind="ghost"
              x={centerX(g.col) - TILE_W / 2}
              y={topY(g.row)}
              width={TILE_W}
              height={TILE_H}
              accessibilityLabel={`Open the ${g.direction} fork`}
              onPress={() => {
                // A fork can only be taken from its parent — move the cursor there
                // first, then this same ghost advances on the next tap.
                if (g.parentId === cursorId) void advanceRabbitHole(g.direction);
                else jumpTo(g.parentId);
              }}
            />
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
