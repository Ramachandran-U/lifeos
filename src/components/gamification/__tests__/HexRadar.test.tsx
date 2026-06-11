import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { HexRadar } from '@/components/gamification/HexRadar';
import { DOMAIN_META, type DomainKey } from '@/constants/gamification';

// The react-test-renderer instance type, derived from render()'s root so we
// don't depend on a named export (@testing-library/react-native doesn't expose
// ReactTestInstance).
type Instance = ReturnType<typeof render>['root'];

/** Collect every rendered element that carries a function `onPress` prop. */
function findPressables(node: Instance): Instance[] {
  return node.findAll((n: Instance) => typeof (n.props as { onPress?: unknown }).onPress === 'function');
}

const scoresOf = (value: number): Record<DomainKey, number> =>
  DOMAIN_META.reduce(
    (acc, d) => {
      acc[d.key] = value;
      return acc;
    },
    {} as Record<DomainKey, number>,
  );

describe('HexRadar', () => {
  it('renders the svg without crashing', () => {
    expect(render(<HexRadar scores={scoresOf(50)} />).toJSON()).toBeTruthy();
  });

  it('renders with a yesterday comparison overlay', () => {
    expect(
      render(<HexRadar scores={scoresOf(60)} yesterdayScores={scoresOf(40)} />).toJSON(),
    ).toBeTruthy();
  });

  it('fires onDomainPress with a valid domain key when a hotspot is tapped', () => {
    const onDomainPress = jest.fn();
    const { root } = render(
      <HexRadar scores={scoresOf(50)} onDomainPress={onDomainPress} activeDomain="goals" />,
    );
    // Each domain icon / vertex is pressable and wires onDomainPress(d.key).
    const pressables = findPressables(root);
    expect(pressables.length).toBeGreaterThan(0);
    fireEvent.press(pressables[0]);
    expect(onDomainPress).toHaveBeenCalledTimes(1);
    expect(DOMAIN_META.map((d) => d.key)).toContain(onDomainPress.mock.calls[0][0]);
  });
});

// ─── W3 Today recomposition (01-today-hero.md §3.4) ─────────────────────────

/** Loose type-name of a rendered node (host string or component name). */
function typeNameOf(node: Instance): string {
  const t = (node as unknown as { type: unknown }).type;
  if (typeof t === 'string') return t;
  if (typeof t === 'function') return (t as { name?: string }).name ?? '';
  return String(t);
}

describe('HexRadar hub (Acceptance #7)', () => {
  const findHub = (root: Instance) =>
    root.findAll((n: Instance) => (n.props as { testID?: string }).testID === 'radar-hub')[0];

  it('day-1 state renders exactly DAY 1 / PICK YOUR FIRST WIN', () => {
    const { getByText } = render(
      <HexRadar
        scores={scoresOf(15)}
        hub={{ topline: 'DAY 1', subline: 'PICK YOUR FIRST WIN', onPress: jest.fn() }}
      />,
    );
    expect(getByText('DAY 1')).toBeTruthy();
    expect(getByText('PICK YOUR FIRST WIN')).toBeTruthy();
  });

  it('mid-day state renders exactly 2/5 / BLOCKS DONE', () => {
    const { getByText } = render(
      <HexRadar
        scores={scoresOf(40)}
        hub={{ topline: '2/5', subline: 'BLOCKS DONE', onPress: jest.fn() }}
      />,
    );
    expect(getByText('2/5')).toBeTruthy();
    expect(getByText('BLOCKS DONE')).toBeTruthy();
  });

  it('all-clear state renders exactly ALL CLEAR / SEE YOUR DAY and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText, root } = render(
      <HexRadar
        scores={scoresOf(80)}
        hub={{ topline: 'ALL CLEAR', subline: 'SEE YOUR DAY', onPress }}
      />,
    );
    expect(getByText('ALL CLEAR')).toBeTruthy();
    expect(getByText('SEE YOUR DAY')).toBeTruthy();
    fireEvent.press(findHub(root));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('the hub subtree contains no Circle/Rect/Path/blur node — type only', () => {
    const { root } = render(
      <HexRadar
        scores={scoresOf(15)}
        hub={{ topline: 'DAY 1', subline: 'PICK YOUR FIRST WIN' }}
      />,
    );
    const hub = findHub(root);
    expect(hub).toBeTruthy();
    const shapes = hub.findAll((n: Instance) =>
      /(^|RNSVG)(Circle|Rect|Path)$|Blur/i.test(typeNameOf(n)),
    );
    expect(shapes).toHaveLength(0);
  });

  it('no hub prop → no hub overlay (flag-off render unchanged)', () => {
    const { root } = render(<HexRadar scores={scoresOf(50)} />);
    expect(
      root.findAll((n: Instance) => (n.props as { testID?: string }).testID === 'radar-hub'),
    ).toHaveLength(0);
  });
});

describe('HexRadar spokes + vertices (Acceptance #8)', () => {
  const SIZE = 340;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const maxR = SIZE * 0.42;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (angle: number, r: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  it("every spoke's inner endpoint equals pt(d.angleDeg, maxR * 0.18) — inset radius 25.704", () => {
    expect(maxR * 0.18).toBeCloseTo(25.704, 3);
    const { root } = render(<HexRadar scores={scoresOf(50)} size={SIZE} />);
    // The svg Line renders nested host nodes carrying the same props — keep
    // only the outermost component node per spoke.
    const lines = root.findAll(
      (n: Instance) =>
        typeNameOf(n) === 'Line' &&
        (n.props as { x1?: unknown }).x1 !== undefined &&
        (n.props as { y2?: unknown }).y2 !== undefined,
    );
    // One spoke per domain, and nothing else renders a Line.
    expect(lines.length).toBe(DOMAIN_META.length);
    DOMAIN_META.forEach((d, i) => {
      const inner = pt(d.angleDeg, maxR * 0.18);
      const outer = pt(d.angleDeg, maxR);
      const props = lines[i].props as { x1: number; y1: number; x2: number; y2: number };
      expect(props.x1).toBeCloseTo(inner.x, 6);
      expect(props.y1).toBeCloseTo(inner.y, 6);
      expect(props.x2).toBeCloseTo(outer.x, 6);
      expect(props.y2).toBeCloseTo(outer.y, 6);
    });
  });

  it('vertex icons render at full opacity — no idle dimming, active or not', () => {
    const { root } = render(<HexRadar scores={scoresOf(50)} activeDomain="goals" />);
    const iconPressables = findPressables(root).filter((n) => {
      const flat = StyleSheet.flatten((n.props as { style?: unknown }).style ?? {}) as {
        opacity?: number;
      };
      return flat.opacity !== undefined;
    });
    expect(iconPressables.length).toBeGreaterThanOrEqual(DOMAIN_META.length);
    for (const n of iconPressables) {
      const flat = StyleSheet.flatten((n.props as { style?: unknown }).style ?? {}) as {
        opacity?: number;
      };
      expect(flat.opacity).toBe(1);
    }
  });
});
