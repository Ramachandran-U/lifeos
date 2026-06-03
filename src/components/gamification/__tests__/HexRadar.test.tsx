import { render, fireEvent } from '@testing-library/react-native';
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
