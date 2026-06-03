import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Sparkline } from '@/components/ui/Sparkline';
import { DomainChip } from '@/components/ui/DomainChip';
import { Badge } from '@/components/ui/Badge';
import { StreakCounter } from '@/components/ui/StreakCounter';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';

// ── ProgressBar ──────────────────────────────────────────────────────────────
describe('ProgressBar', () => {
  it('mounts for an in-range value', () => {
    const { toJSON } = render(<ProgressBar value={42} />);
    expect(toJSON()).not.toBeNull();
  });

  it('mounts for out-of-range values (clamp is internal, must not throw)', () => {
    expect(() => render(<ProgressBar value={250} />)).not.toThrow();
    expect(() => render(<ProgressBar value={-50} />)).not.toThrow();
  });

  it('accepts a custom color and height', () => {
    const { toJSON } = render(<ProgressBar value={30} color="#FF0000" height={12} />);
    expect(toJSON()).not.toBeNull();
  });
});

// ── Card ─────────────────────────────────────────────────────────────────────
describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <Text>Inside card</Text>
      </Card>,
    );
    expect(screen.getByText('Inside card')).toBeTruthy();
  });

  it('renders children with a moduleColor border applied', () => {
    render(
      <Card moduleColor="#5B4FE8">
        <Text>Tinted card</Text>
      </Card>,
    );
    expect(screen.getByText('Tinted card')).toBeTruthy();
  });

  it('forwards a testID via ViewProps', () => {
    render(
      <Card testID="my-card">
        <Text>x</Text>
      </Card>,
    );
    expect(screen.getByTestId('my-card')).toBeTruthy();
  });
});

// ── Input ────────────────────────────────────────────────────────────────────
describe('Input', () => {
  it('renders its label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders an error message', () => {
    render(<Input label="Email" error="Required field" />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('fires onChangeText on text entry', () => {
    const onChangeText = jest.fn();
    render(<Input label="Name" placeholder="Your name" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ada Fakerton');
    expect(onChangeText).toHaveBeenCalledWith('Ada Fakerton');
  });

  it('renders a secureTextEntry field', () => {
    render(<Input label="Password" placeholder="••••" secureTextEntry />);
    const field = screen.getByPlaceholderText('••••');
    expect(field.props.secureTextEntry).toBe(true);
  });

  it('shows a character count when requested', () => {
    render(<Input label="Bio" value="hi" showCharCount maxLength={10} />);
    expect(screen.getByText('2/10')).toBeTruthy();
  });
});

// ── Sparkline ────────────────────────────────────────────────────────────────
describe('Sparkline', () => {
  it('renders a bar per value', () => {
    const { toJSON } = render(<Sparkline values={[1, 4, 2, 8]} color="#00D9C0" />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders without crashing for an empty array', () => {
    expect(() => render(<Sparkline values={[]} color="#00D9C0" />)).not.toThrow();
  });

  it('accepts a target reference line', () => {
    expect(() => render(<Sparkline values={[2, 3]} color="#00D9C0" target={5} />)).not.toThrow();
  });
});

// ── DomainChip ───────────────────────────────────────────────────────────────
describe('DomainChip', () => {
  it('renders the value text', () => {
    render(<DomainChip domain="health" value="2/3" />);
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('exposes an a11y label combining domain + value', () => {
    render(<DomainChip domain="finance" value="40m" />);
    expect(screen.getByLabelText('finance, 40m')).toBeTruthy();
  });

  it('renders without a value', () => {
    render(<DomainChip domain="goal" />);
    expect(screen.getByLabelText('goal')).toBeTruthy();
  });
});

// ── Badge ────────────────────────────────────────────────────────────────────
describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge label="Pioneer" />);
    expect(screen.getByText('Pioneer')).toBeTruthy();
  });

  it('renders an optional icon glyph', () => {
    render(<Badge label="Streak" icon="🔥" variant="health" />);
    expect(screen.getByText('🔥')).toBeTruthy();
    expect(screen.getByText('Streak')).toBeTruthy();
  });
});

// ── StreakCounter ────────────────────────────────────────────────────────────
describe('StreakCounter', () => {
  it('renders the count and flame', () => {
    render(<StreakCounter count={7} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('🔥')).toBeTruthy();
  });
});

// ── ModuleHeader ─────────────────────────────────────────────────────────────
describe('ModuleHeader', () => {
  it('renders its title with a domain glyph', () => {
    render(<ModuleHeader title="Health" color="#34D399" domain="health" />);
    expect(screen.getByText('Health')).toBeTruthy();
  });

  it('renders its title with an Ionicons fallback', () => {
    render(<ModuleHeader title="Settings" color="#5B4FE8" icon="settings-outline" />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });
});

// ── RotatingPlaceholder ──────────────────────────────────────────────────────
describe('RotatingPlaceholder', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the first phrase while active', () => {
    render(<RotatingPlaceholder phrases={['First hint', 'Second hint']} active color="#888" />);
    expect(screen.getByText('First hint')).toBeTruthy();
  });

  it('renders nothing while inactive', () => {
    const { toJSON } = render(
      <RotatingPlaceholder phrases={['First hint']} active={false} color="#888" />,
    );
    expect(toJSON()).toBeNull();
  });

  it('cycles to the next phrase on its timer', () => {
    jest.useFakeTimers();
    render(
      <RotatingPlaceholder
        phrases={['First hint', 'Second hint']}
        active
        color="#888"
        intervalMs={2000}
      />,
    );
    expect(screen.getByText('First hint')).toBeTruthy();

    // First advance: the dwell interval fires → the hook flips its index and the
    // component schedules its fade-out swap timer (in a re-render/effect).
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // Second advance: lets the just-scheduled fade-out swap timer (180ms) run,
    // which is what actually swaps the visible `shown` text.
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByText('Second hint')).toBeTruthy();
  });
});

// ── LoadingDots ──────────────────────────────────────────────────────────────
describe('LoadingDots', () => {
  it('mounts (three animated dots)', () => {
    const { toJSON } = render(<LoadingDots />);
    expect(toJSON()).not.toBeNull();
  });

  it('accepts color and size overrides', () => {
    expect(() => render(<LoadingDots color="#FFF" size={6} />)).not.toThrow();
  });
});

// ── Skeleton ─────────────────────────────────────────────────────────────────
describe('Skeleton', () => {
  it('renders a solid placeholder immediately when delayMs is 0', () => {
    const { toJSON } = render(<Skeleton delayMs={0} />);
    expect(toJSON()).not.toBeNull();
  });

  it('mounts with default delay without throwing', () => {
    expect(() => render(<Skeleton />)).not.toThrow();
  });
});
