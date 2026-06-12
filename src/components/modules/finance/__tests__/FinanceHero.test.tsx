/**
 * FinanceHero — Ink + Signal §3.5 / AC8 (unit half) / AC13 (native half) /
 * R4 theme contract.
 *
 * Covers: the spend hero renders ONLY when connected (the disconnected state
 * is the EmptyState keeper — no zero-rupee display, AC8); the exact §3.5
 * copy incl. the trustNote string sourced via the trustNote prop (AC13); the
 * native "web for now" title with no localhost leak (dilution audit 19); the
 * connected-but-empty first-value line with zero ₹ numerals (§3.0.5); R4 —
 * display numerals in c.financeText in BOTH themes over a raw c.finance 4px
 * rail; and rest-quiet (no idle loops in the source).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FinanceHero } from '@/components/modules/finance/FinanceHero';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { darkColors, lightColors } from '@/theme/colors';

const TRUST_NOTE = 'Only transaction emails are scanned — nothing is uploaded.';

const connectedProps = {
  gmailConnected: true,
  txCount: 12,
  thisMonthSpendPaise: 123_400, // ₹1,234
  lastMonthSpendPaise: 100_000, // ₹1,000
  thisMonthIncomePaise: 500_000, // ₹5,000
  onConnect: jest.fn(),
};

beforeEach(() => {
  (Platform as { OS: string }).OS = 'web';
});

afterEach(() => {
  usePreferencesStore.setState({ theme: 'dark' });
  jest.clearAllMocks();
});

describe('FinanceHero — native state (§3.5 / AC13 native half)', () => {
  it('renders the exact web-for-now title and never the localhost developer string', () => {
    (Platform as { OS: string }).OS = 'ios';
    render(<FinanceHero {...connectedProps} />);
    expect(screen.getByText('Finance lives on the web for now')).toBeTruthy();
    expect(
      screen.getByText(
        'Gmail-powered transaction sync runs in the web app. Open LifeOS in your browser to connect.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/localhost/)).toBeNull();
    expect(screen.queryByText('Connect Gmail')).toBeNull();
  });
});

describe('FinanceHero — disconnected keeper (§3.5 / AC13)', () => {
  const props = { ...connectedProps, gmailConnected: false };

  it('renders the EmptyState keeper with the exact §3.5 copy', () => {
    render(<FinanceHero {...props} />);
    expect(screen.getByText('Connect your inbox')).toBeTruthy();
    expect(
      screen.getByText(
        'LifeOS reads HDFC, ICICI, and Axis bank alert emails to categorise spending and surface behavioural insights.',
      ),
    ).toBeTruthy();
    // AC13 — the trust clause arrives via EmptyState's trustNote prop, which
    // renders it adjacent to the lock-closed-outline glyph (§3.0.4).
    expect(screen.getByText(TRUST_NOTE)).toBeTruthy();
  });

  it('fires onConnect from the Connect Gmail CTA', () => {
    render(<FinanceHero {...props} />);
    fireEvent.press(screen.getByText('Connect Gmail'));
    expect(props.onConnect).toHaveBeenCalledTimes(1);
  });

  it('renders NO spend numerals while disconnected (AC8 — hero only when connected)', () => {
    render(<FinanceHero {...props} />);
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText('spent so far this month')).toBeNull();
  });
});

describe('FinanceHero — connected, zero transactions (§3.0.5 / AC8)', () => {
  const props = { ...connectedProps, txCount: 0, thisMonthSpendPaise: 0, lastMonthSpendPaise: 0, thisMonthIncomePaise: 0 };

  it('renders the first-value action line instead of a ₹0 display', () => {
    render(<FinanceHero {...props} />);
    expect(
      screen.getByText(
        'No transactions yet. Tap Sync now after connecting an inbox with bank alert emails.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText('spent so far this month')).toBeNull();
  });
});

describe('FinanceHero — connected spend headline (§3.5)', () => {
  it('renders the display numeral, h3, delta caption and In/Out/Net strip', () => {
    render(<FinanceHero {...connectedProps} />);
    // '₹1,234' appears twice by design: the display numeral + the Out cell.
    expect(screen.getAllByText('₹1,234')).toHaveLength(2);
    expect(screen.getByText('spent so far this month')).toBeTruthy();
    // (1234 - 1000) / 1000 = +23.4%, spending more reads in c.error.
    expect(screen.getByText('+23.4% vs same period last month (₹1,000)')).toBeTruthy();
    expect(screen.getByText('In')).toBeTruthy();
    expect(screen.getByText('Out')).toBeTruthy();
    expect(screen.getByText('Net')).toBeTruthy();
    expect(screen.getByText('₹5,000')).toBeTruthy(); // In
    // Net = 5000 - 1234 = +₹3,766
    expect(screen.getByText('+₹3,766')).toBeTruthy();
  });

  it('omits the delta caption when there is no last-month baseline', () => {
    render(<FinanceHero {...connectedProps} lastMonthSpendPaise={0} />);
    expect(screen.queryByText(/vs same period last month/)).toBeNull();
  });

  it('omits the cashflow strip when no income landed this month', () => {
    render(<FinanceHero {...connectedProps} thisMonthIncomePaise={0} />);
    expect(screen.queryByText('Net')).toBeNull();
  });
});

describe('FinanceHero — theme contract (R4, supersedes §3.0.6 per-mode rule)', () => {
  const numeralColor = () => {
    // First match is the display numeral (the Out cell repeats the string).
    const el = screen.getAllByText('₹1,234')[0]!;
    return StyleSheet.flatten(el.props.style).color;
  };

  it('display numeral resolves to c.financeText on the dark theme', () => {
    usePreferencesStore.setState({ theme: 'dark' });
    render(<FinanceHero {...connectedProps} />);
    expect(numeralColor()).toBe(darkColors.financeText);
  });

  it('display numeral resolves to c.financeText on the light theme (NOT textPrimary)', () => {
    usePreferencesStore.setState({ theme: 'light' });
    render(<FinanceHero {...connectedProps} />);
    expect(numeralColor()).toBe(lightColors.financeText);
    expect(numeralColor()).not.toBe(lightColors.textPrimary);
  });

  it('keeps the 4px raw finance-token left border in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      usePreferencesStore.setState({ theme });
      const tree = render(<FinanceHero {...connectedProps} />);
      const json = tree.toJSON() as { props: { style: StyleProp<ViewStyle> } };
      const style = StyleSheet.flatten(json.props.style);
      expect(style.borderLeftWidth).toBe(4);
      // The domain hue is fixed across themes — the raw token, no alpha suffix.
      expect(style.borderLeftColor).toBe(darkColors.finance);
      tree.unmount();
    }
  });
});

describe('FinanceHero — rest quiet (§3.0.6)', () => {
  it('the source carries zero withRepeat (no idle loops in the hero)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'FinanceHero.tsx'), 'utf8');
    expect(source).not.toMatch(/withRepeat/);
  });
});
