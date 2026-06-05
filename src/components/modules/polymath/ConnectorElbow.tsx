import { Fragment } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useColors } from '@/theme/colors';
import type { RabbitHoleDirection } from '@/explore/rabbitHoleTree';

interface Point {
  x: number;
  y: number;
}

interface Props {
  from: Point;
  to: Point;
  direction: RabbitHoleDirection;
  /** On the active root→cursor path (gold + thicker). */
  active: boolean;
  /** Un-taken fork (dashed + faint). */
  ghost: boolean;
}

const THICK = 2;

/** A direction-shaped connector drawn with bordered Views (so it works on
 * react-native-web too): a straight vertical line for `deeper`, a horizontal
 * stub + vertical drop (an elbow) for `sideways`. */
export function ConnectorElbow({ from, to, direction, active, ghost }: Props) {
  const c = useColors();
  const color = active ? c.polymath : c.border;
  const seg = (extra: ViewStyle): ViewStyle => ({
    position: 'absolute',
    borderColor: color,
    borderStyle: ghost ? 'dashed' : 'solid',
    opacity: ghost ? 0.4 : 1,
    ...extra,
  });

  if (direction === 'deeper') {
    return (
      <View
        pointerEvents="none"
        style={seg({ left: from.x, top: from.y, height: Math.max(0, to.y - from.y), borderLeftWidth: THICK })}
      />
    );
  }

  const left = Math.min(from.x, to.x);
  const width = Math.abs(to.x - from.x);
  return (
    <Fragment>
      <View
        pointerEvents="none"
        style={seg({ left, top: from.y, width, borderTopWidth: THICK })}
      />
      <View
        pointerEvents="none"
        style={seg({ left: to.x, top: from.y, height: Math.max(0, to.y - from.y), borderLeftWidth: THICK })}
      />
    </Fragment>
  );
}
