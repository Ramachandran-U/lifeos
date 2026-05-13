// ─── Sparkline ───────────────────────────────────────────────────────────────
// Tiny line chart — used by the Rewards hero and DomainMiniCard.

import Svg, { Polyline, Circle } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color, width = 80, height = 28 }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return { x, y };
  });

  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={3} fill={color} />
    </Svg>
  );
}
