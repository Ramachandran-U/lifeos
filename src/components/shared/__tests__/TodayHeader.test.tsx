/**
 * TodayHeader — greeting rules (Acceptance #2) and compassion/prefs renders
 * (Acceptance #9): no XpBar, no banned strings at any gamification setting.
 */
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

import { TodayHeader, formatGreeting } from '@/components/shared/TodayHeader';
import { usePreferencesStore, type GamificationVisibility } from '@/store/usePreferencesStore';

type Instance = ReturnType<typeof render>['root'];

/** Every string the user can actually read in the rendered tree. */
function renderedStrings(tree: Instance): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object' && 'props' in node) {
      const children = (node as { props: { children?: unknown } }).props.children;
      walk(children);
    }
  };
  tree.findAll(() => true).forEach((n: Instance) => {
    const children = (n.props as { children?: unknown }).children;
    walk(children);
  });
  return out;
}

const baseProps = {
  totalXP: 120,
  initials: 'MC',
  name: 'Maya Chen',
  onVoicePress: jest.fn(),
  onCompanionPress: jest.fn(),
};

afterEach(() => jest.clearAllMocks());

describe('formatGreeting (pure, Acceptance #2)', () => {
  it("formatGreeting('Xxxxxxxxxxxxx Yyyy', 9) returns 'Morning.' (13-char first name)", () => {
    expect(formatGreeting('Xxxxxxxxxxxxx Yyyy', 9)).toBe('Morning.');
  });

  it("formatGreeting('', 9) returns 'Morning.'", () => {
    expect(formatGreeting('', 9)).toBe('Morning.');
  });

  it("formatGreeting('Maya Chen', 14) returns 'Afternoon, Maya.'", () => {
    expect(formatGreeting('Maya Chen', 14)).toBe('Afternoon, Maya.');
  });

  it('keeps a 12-char first name (boundary) and drops a 13-char one', () => {
    expect(formatGreeting('Xxxxxxxxxxxx', 9)).toBe('Morning, Xxxxxxxxxxxx.');
    expect(formatGreeting('Xxxxxxxxxxxxx', 9)).toBe('Morning.');
  });

  it('uses Evening from 17:00', () => {
    expect(formatGreeting('Al', 17)).toBe('Evening, Al.');
    expect(formatGreeting('Al', 23)).toBe('Evening, Al.');
  });

  it('trims and uses only the first whitespace-separated token', () => {
    expect(formatGreeting('  Al   Marlowe ', 9)).toBe('Morning, Al.');
  });
});

describe('TodayHeader render', () => {
  it('renders the greeting with numberOfLines=1 and the voice button', () => {
    render(<TodayHeader {...baseProps} />);
    const greeting = screen.getByTestId('today-greeting');
    expect(greeting.props.numberOfLines).toBe(1);
    expect(screen.getByTestId('voice-open')).toBeTruthy();
    expect(screen.getByTestId('today-header')).toBeTruthy();
  });

  it('contains no feedback button (relocated to the utility stack)', () => {
    render(<TodayHeader {...baseProps} />);
    expect(screen.queryByTestId('feedback-open')).toBeNull();
  });

  it.each(['full', 'minimal', 'off'] as GamificationVisibility[])(
    "gamification '%s': rendered output has no overdue/late/missed/streak/XP strings",
    (setting) => {
      usePreferencesStore.setState({ gamification: setting });
      const { root } = render(<TodayHeader {...baseProps} />);
      const text = renderedStrings(root).join(' ');
      for (const banned of ['overdue', 'late', 'missed', 'streak', 'XP']) {
        expect(text).not.toContain(banned);
      }
    },
  );
});
