/**
 * HealthPulseHero — Ink + Signal §3.1 / AC15 (unit half) / AC8-adjacent.
 *
 * Covers the three committed hero states with their exact strings, the
 * over-target compassion rule (no "over", no deficit math), the R4 amendment
 * (display numerals in c.healthText in BOTH themes — supersedes §3.0.6's
 * per-mode rule and AC15's #140828 literal), the 4px raw-domain-token left
 * border in both themes, and the no-idle-motion rule (zero withRepeat in the
 * source — the screen owns the single hero-budget entry).
 */

import * as fs from 'fs';
import * as path from 'path';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { HealthPulseHero } from '@/components/modules/health/HealthPulseHero';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { darkColors, lightColors } from '@/theme/colors';

const baseProps = {
  kcalLeft: 1420,
  kcalEaten: 580,
  kcalTarget: 2000,
  proteinLeftG: 48,
  readiness: { score: 72, hasData: true, band: 'high' as const },
  hasBaseline: true,
  onLogMeal: jest.fn(),
  onAddVitals: jest.fn(),
};

afterEach(() => {
  usePreferencesStore.setState({ theme: 'dark' });
  jest.clearAllMocks();
});

describe('HealthPulseHero — populated state (§3.1)', () => {
  it('renders the kcal budget, headline, metadata line and CTA with exact strings', () => {
    render(<HealthPulseHero {...baseProps} />);
    expect(screen.getByText('1,420')).toBeTruthy();
    expect(screen.getByText('kcal left today')).toBeTruthy();
    expect(screen.getByText('Protein 48 g to go · 580 kcal eaten · Readiness 72')).toBeTruthy();
    expect(screen.getByText('Log a meal')).toBeTruthy();
  });

  it('omits the readiness fragment when no readiness signal exists', () => {
    render(
      <HealthPulseHero
        {...baseProps}
        readiness={{ score: 0, hasData: false, band: 'low' }}
      />,
    );
    expect(screen.getByText('Protein 48 g to go · 580 kcal eaten')).toBeTruthy();
    expect(screen.queryByText(/Readiness/)).toBeNull();
  });

  it('fires onLogMeal from the CTA', () => {
    render(<HealthPulseHero {...baseProps} />);
    fireEvent.press(screen.getByText('Log a meal'));
    expect(baseProps.onLogMeal).toHaveBeenCalledTimes(1);
  });
});

describe('HealthPulseHero — over-target compassion state (§3.1)', () => {
  const overProps = {
    ...baseProps,
    kcalLeft: -150,
    kcalEaten: 2150,
    proteinLeftG: 12,
  };

  it('renders kcal logged + target reached with exact strings', () => {
    render(<HealthPulseHero {...overProps} />);
    expect(screen.getByText('2,150')).toBeTruthy();
    expect(screen.getByText('kcal logged today')).toBeTruthy();
    expect(screen.getByText('Target 2,000 reached · Protein 12 g to go')).toBeTruthy();
  });

  it('carries no "over" copy and no deficit math (compassion rule)', () => {
    render(<HealthPulseHero {...overProps} />);
    expect(screen.queryByText(/over/i)).toBeNull();
    // No negative numeral anywhere — the deficit is never rendered.
    expect(screen.queryByText(/-\d/)).toBeNull();
    expect(screen.queryByText(/deficit/i)).toBeNull();
  });

  it('treats exactly-on-target (kcalLeft = 0) as the over-target state', () => {
    render(<HealthPulseHero {...overProps} kcalLeft={0} kcalEaten={2000} />);
    expect(screen.getByText('kcal logged today')).toBeTruthy();
    expect(screen.queryByText('kcal left today')).toBeNull();
  });
});

describe('HealthPulseHero — empty baseline state (§3.1)', () => {
  const emptyProps = { ...baseProps, hasBaseline: false, kcalLeft: null, proteinLeftG: null };

  it('renders the baseline invitation with exact strings', () => {
    render(<HealthPulseHero {...emptyProps} />);
    expect(screen.getByText('Start with a baseline.')).toBeTruthy();
    expect(
      screen.getByText(
        'Height and weight unlock BMI, calorie targets, and recovery-aware planning. They stay on this device.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Add height & weight')).toBeTruthy();
    // No kcal surface leaks into the empty state.
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  it('fires onAddVitals from the baseline CTA', () => {
    render(<HealthPulseHero {...emptyProps} />);
    fireEvent.press(screen.getByText('Add height & weight'));
    expect(baseProps.onAddVitals).toHaveBeenCalledTimes(1);
  });
});

describe('HealthPulseHero — theme contract (R4, supersedes AC15 literal)', () => {
  const numeralColor = () => {
    const el = screen.getByText('1,420');
    return StyleSheet.flatten(el.props.style).color;
  };

  it('display numeral resolves to c.healthText on the dark theme', () => {
    usePreferencesStore.setState({ theme: 'dark' });
    render(<HealthPulseHero {...baseProps} />);
    expect(numeralColor()).toBe(darkColors.healthText);
  });

  it('display numeral resolves to c.healthText on the light theme (NOT textPrimary)', () => {
    usePreferencesStore.setState({ theme: 'light' });
    render(<HealthPulseHero {...baseProps} />);
    expect(numeralColor()).toBe(lightColors.healthText);
    expect(numeralColor()).not.toBe(lightColors.textPrimary);
  });

  it('keeps the 4px raw health-token left border in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      usePreferencesStore.setState({ theme });
      const tree = render(<HealthPulseHero {...baseProps} />);
      const json = tree.toJSON() as { props: { style: StyleProp<ViewStyle> } };
      const style = StyleSheet.flatten(json.props.style);
      expect(style.borderLeftWidth).toBe(4);
      // The domain hue is fixed across themes — the raw token, no alpha suffix.
      expect(style.borderLeftColor).toBe(darkColors.health);
      tree.unmount();
    }
  });
});

describe('HealthPulseHero — rest quiet (§3.0.6)', () => {
  it('the source carries zero withRepeat (no idle loops in the hero)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'HealthPulseHero.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/withRepeat/);
  });
});
