/**
 * ReconnectHero — Ink + Signal §3.4 / AC9 (unit half) / C4-15 (border half).
 *
 * Covers the three committed hero states, the compassion contract (the h1
 * matches /^\S+ would love to hear from you\.$/ and never contains a digit;
 * overdue/late/neglected/behind/forgot appear nowhere), the 60-day month
 * switch on the cadence caption, the snooze interaction writing to
 * useHeroSnoozeStore, the 4px raw-social-token left border in both themes, and
 * the no-idle-motion rule.
 */

import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ReconnectHero } from '@/components/modules/social/ReconnectHero';
import { useHeroSnoozeStore } from '@/store/useHeroSnoozeStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { darkColors, lightColors } from '@/theme/colors';
import type { Contact } from '@/db/queries/social';

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c1',
    userId: 'u1',
    name: 'Priya Raman',
    nickname: null,
    relationshipType: 'inner_circle',
    preferredCadenceDays: 7,
    lastContactDate: null,
    notes: null,
    birthday: null,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

const baseProps = {
  contact: contact({}),
  daysSince: 12,
  inCadenceCount: 3,
  onOpen: jest.fn(),
  onSnooze: jest.fn(),
  onAdd: jest.fn(),
};

// The §3.4 compassion words, machine-checked (Dilution trap 6 / AC9).
const COMPASSION_BANNED = /overdue|late|neglected|behind|forgot/i;

afterEach(() => {
  useHeroSnoozeStore.setState({ snoozed: {} });
  usePreferencesStore.setState({ theme: 'dark' });
  jest.clearAllMocks();
});

function allRenderedText(): string {
  return JSON.stringify(screen.toJSON());
}

describe('ReconnectHero — overdue state (§3.4 / AC9 unit half)', () => {
  it('renders the first name in an h1 matching the committed shape, with no digit', () => {
    render(<ReconnectHero {...baseProps} />);
    const h1 = screen.getByText(/would love to hear from you/);
    const text = h1.props.children as string;
    expect(text).toBe('Priya would love to hear from you.');
    expect(text).toMatch(/^\S+ would love to hear from you\.$/);
    expect(/\d/.test(text)).toBe(false);
  });

  it('renders the tier + recency caption in days below the 60-day switch', () => {
    render(<ReconnectHero {...baseProps} daysSince={12} />);
    expect(screen.getByText('Inner circle · last contact 12 days ago')).toBeTruthy();
  });

  it('switches the caption to months at 60 days and beyond', () => {
    render(
      <ReconnectHero
        {...baseProps}
        contact={contact({ relationshipType: 'acquaintance', preferredCadenceDays: 60 })}
        daysSince={92}
      />,
    );
    // Math.round(92 / 30) = 3
    expect(screen.getByText('Acquaintance · last contact 3 months ago')).toBeTruthy();
  });

  it('fires onOpen with the contact id from Say hello', () => {
    render(<ReconnectHero {...baseProps} />);
    fireEvent.press(screen.getByText('Say hello'));
    expect(baseProps.onOpen).toHaveBeenCalledWith('c1');
  });

  it("'Not today' writes today's snooze for 'social' into useHeroSnoozeStore and notifies", () => {
    render(<ReconnectHero {...baseProps} />);
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(false);
    fireEvent.press(screen.getByText('Not today'));
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(true);
    expect(useHeroSnoozeStore.getState().snoozed.social).toBe(format(new Date(), 'yyyy-MM-dd'));
    expect(baseProps.onSnooze).toHaveBeenCalledTimes(1);
  });

  it('carries none of the banned compassion words anywhere in the rendered tree', () => {
    render(<ReconnectHero {...baseProps} />);
    expect(allRenderedText()).not.toMatch(COMPASSION_BANNED);
  });
});

describe('ReconnectHero — in-cadence quiet state (§3.4)', () => {
  const quietProps = { ...baseProps, contact: null, daysSince: null, inCadenceCount: 5 };

  it('renders the single quiet line with exact strings — no CTA, no pill', () => {
    render(<ReconnectHero {...quietProps} />);
    expect(screen.getByText("You're in cadence with everyone.")).toBeTruthy();
    expect(screen.getByText('5 people in your orbit')).toBeTruthy();
    expect(screen.queryByText('Say hello')).toBeNull();
    expect(screen.queryByText('Not today')).toBeNull();
  });

  it('carries no banned compassion words', () => {
    render(<ReconnectHero {...quietProps} />);
    expect(allRenderedText()).not.toMatch(COMPASSION_BANNED);
  });
});

describe('ReconnectHero — empty state, zero contacts (§3.4)', () => {
  const emptyProps = { ...baseProps, contact: null, daysSince: null, inCadenceCount: 0 };

  it('renders the EmptyState invitation with the committed copy and trust note', () => {
    render(<ReconnectHero {...emptyProps} />);
    expect(screen.getByText('Build your inner orbit')).toBeTruthy();
    expect(
      screen.getByText(
        "Add the people you actually want to stay close to.\nWe'll quietly tell you when it's been too long.",
      ),
    ).toBeTruthy();
    expect(screen.getByText('Names stay on this device — nothing is uploaded.')).toBeTruthy();
    expect(screen.getByText('Add someone')).toBeTruthy();
  });

  it('fires onAdd from the CTA', () => {
    render(<ReconnectHero {...emptyProps} />);
    fireEvent.press(screen.getByText('Add someone'));
    expect(baseProps.onAdd).toHaveBeenCalledTimes(1);
  });

  it('carries no banned compassion words', () => {
    render(<ReconnectHero {...emptyProps} />);
    expect(allRenderedText()).not.toMatch(COMPASSION_BANNED);
  });
});

describe('ReconnectHero — theme contract (R4 border half / C4-15)', () => {
  it('keeps the 4px raw social-token left border in both themes (overdue state)', () => {
    for (const theme of ['dark', 'light'] as const) {
      usePreferencesStore.setState({ theme });
      const tree = render(<ReconnectHero {...baseProps} />);
      const json = tree.toJSON() as { props: { style: StyleProp<ViewStyle> } };
      const style = StyleSheet.flatten(json.props.style);
      expect(style.borderLeftWidth).toBe(4);
      // The domain hue is fixed across themes — the raw token, no alpha suffix.
      expect(style.borderLeftColor).toBe(darkColors.social);
      expect(style.borderLeftColor).toBe(lightColors.social);
      tree.unmount();
    }
  });
});

describe('ReconnectHero — rest quiet (§3.0.6)', () => {
  it('the source carries zero withRepeat (no idle loops in the hero)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'ReconnectHero.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/withRepeat/);
  });
});
