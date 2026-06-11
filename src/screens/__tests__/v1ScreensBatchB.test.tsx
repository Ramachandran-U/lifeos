/**
 * W4 batch B V1 trees (Career + Social, module_hierarchy_v1 ON) — the unit
 * halves of AC3 (career mounts with no visible text input), AC5 (the word
 * `Overdue` and the dead caps eyebrows render nowhere on Social), AC9 (the
 * snoozed hero slot is empty and the next overdue contact is NOT promoted),
 * and AC11 (no `streak`/`XP` strings in either tree, gamification on or off).
 *
 * Mock seams mirror src/screens/legacy/__tests__/legacySnapshots.test.tsx,
 * with two differences: useFocusEffect RUNS its callback (as useEffect) so the
 * screens load data, and getContactsByUser is stubbed over the otherwise-real
 * @/db/queries/social module so the Social tree renders a seeded fixture.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    // Unlike the legacy snapshot suite, focus DOES fire here — the V1 trees
    // load their data in useFocusEffect.
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(() => cb(), [cb]);
    },
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@/hooks/useScreenTracking', () => ({ useScreenTracking: jest.fn() }));
jest.mock('@/hooks/useNotifications', () => ({
  refreshSocialOverdueBody: jest.fn(async () => {}),
}));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Seeded contacts over the otherwise-real social query module (computeOverdue,
// computeSocialScore, RELATIONSHIP_META etc. stay real).
jest.mock('@/db/queries/social', () => ({
  ...jest.requireActual('@/db/queries/social'),
  getContactsByUser: jest.fn(() => []),
}));

import { format, subDays } from 'date-fns';
import { Modal, TextInput } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import CareerScreen from '../../../app/(tabs)/career';
import SocialScreen from '../../../app/(tabs)/social';
import { useFlagStore } from '@/store/useFlagStore';
import { useUserStore } from '@/store/useUserStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useHeroSnoozeStore } from '@/store/useHeroSnoozeStore';
import { getContactsByUser, type Contact } from '@/db/queries/social';

const contactsMock = getContactsByUser as jest.Mock;

const daysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c1',
    userId: 'u1',
    name: 'Asha Verma',
    nickname: null,
    relationshipType: 'inner_circle',
    preferredCadenceDays: 7,
    lastContactDate: daysAgo(40),
    notes: null,
    birthday: null,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

// Obviously fake names. Asha: most overdue (hero). Rohan: also overdue
// (Reach out). Meera: in cadence with an upcoming birthday (Coming up + tier).
const SEEDED: Contact[] = [
  contact({ id: 'c1', name: 'Asha Verma', lastContactDate: daysAgo(40) }),
  contact({
    id: 'c2',
    name: 'Rohan Iyer',
    relationshipType: 'close_friend',
    preferredCadenceDays: 14,
    lastContactDate: daysAgo(30),
  }),
  contact({
    id: 'c3',
    name: 'Meera Pillai',
    relationshipType: 'family',
    preferredCadenceDays: 14,
    lastContactDate: daysAgo(0),
    birthday: format(new Date(), 'MM-dd'),
  }),
];

/** Collect every rendered text string from the test-renderer JSON tree. */
function renderedText(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(screen.toJSON());
  return out.join('\n');
}

beforeEach(() => {
  jest.clearAllMocks();
  contactsMock.mockReturnValue([]);
  useFlagStore.setState((s) => ({ flags: { ...s.flags, module_hierarchy_v1: true } }));
  useUserStore.setState({ userId: 'u1' });
  useHeroSnoozeStore.setState({ snoozed: {} });
  usePreferencesStore.setState({ gamification: 'full', theme: 'dark' });
});

afterEach(() => {
  useFlagStore.setState((s) => ({ flags: { ...s.flags, module_hierarchy_v1: false } }));
  useUserStore.setState({ userId: null });
});

describe('Career V1 — value before form (AC3 unit half)', () => {
  it('mounts with no analysis: the hero leads, no text input is visible, all modals closed', () => {
    render(<CareerScreen />);
    // The hero slot exists and leads with value (state A).
    expect(screen.getByTestId('career-hero')).toBeTruthy();
    expect(screen.getByText('Your next role has a route.')).toBeTruthy();
    expect(screen.getByText('Map my path')).toBeTruthy();
    // AC3: zero text inputs in the tree, the sheet's form strings absent,
    // and every Modal (setup sheet + save modal) mounts closed.
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    expect(screen.queryByText('Analyse my career path')).toBeNull();
    const modals = screen.UNSAFE_queryAllByType(Modal);
    expect(modals.length).toBeGreaterThan(0);
    for (const m of modals) expect(m.props.visible).toBe(false);
  });

  it("renders AC4's sample route before any tap", () => {
    render(<CareerScreen />);
    expect(screen.getByText('Sample route · Senior Engineer → Staff Engineer · 12 wk')).toBeTruthy();
    expect(screen.getByText('Wk 1 — Ship a system-design one-pager')).toBeTruthy();
    expect(screen.getByText('Wk 5 — Lead a cross-team design review')).toBeTruthy();
    expect(screen.getByText('Wk 12 — Case study: a measurable production win')).toBeTruthy();
  });
});

describe('Social V1 — the answer is a person (§3.4)', () => {
  it('promotes the most-overdue contact into the hero and excludes them from Reach out', () => {
    contactsMock.mockReturnValue(SEEDED);
    render(<SocialScreen />);
    expect(screen.getByTestId('social-hero')).toBeTruthy();
    expect(screen.getByText('Asha would love to hear from you.')).toBeTruthy();
    expect(screen.getByText('Say hello')).toBeTruthy();
    // Reach out carries the REMAINING overdue only — the hero's contact never
    // appears as a row (Dilution trap 6: the named person is not a count).
    expect(screen.getByText('Reach out')).toBeTruthy();
    expect(screen.getByText('Rohan Iyer')).toBeTruthy();
    expect(screen.queryByText('Asha Verma')).toBeNull();
    // Coming up + tier section + score row all present.
    expect(screen.getByText('Coming up')).toBeTruthy();
    expect(screen.getByText('Family')).toBeTruthy();
    // 1 of 3 in cadence → 33 /100.
    expect(screen.getByText('33 /100')).toBeTruthy();
  });

  it('AC5: the word `Overdue` and the dead caps eyebrows render nowhere', () => {
    contactsMock.mockReturnValue(SEEDED);
    render(<SocialScreen />);
    const text = renderedText();
    expect(text).not.toContain('Overdue');
    expect(text).not.toContain('UPCOMING BIRTHDAYS');
    expect(text).not.toContain('IMPORT FROM GOOGLE CONTACTS');
  });

  it('AC9 (screen half): a snoozed hero leaves the slot empty and does NOT promote the next overdue contact', () => {
    useHeroSnoozeStore.setState({ snoozed: { social: format(new Date(), 'yyyy-MM-dd') } });
    contactsMock.mockReturnValue(SEEDED);
    render(<SocialScreen />);
    // The slot stays mounted (AC1) but carries no hero for the day.
    const hero = screen.getByTestId('social-hero');
    expect(hero.children).toHaveLength(0);
    expect(screen.queryByText(/would love to hear from you/)).toBeNull();
    // No promotion: Rohan stays a Reach out row, Asha appears nowhere.
    expect(screen.queryByText('Rohan would love to hear from you.')).toBeNull();
    expect(screen.getByText('Rohan Iyer')).toBeTruthy();
    expect(screen.queryByText('Asha Verma')).toBeNull();
  });

  it('renders the EmptyState invitation at zero contacts', () => {
    contactsMock.mockReturnValue([]);
    render(<SocialScreen />);
    expect(screen.getByText('Build your inner orbit')).toBeTruthy();
    expect(screen.getByText('Add someone')).toBeTruthy();
    expect(screen.getByText('Names stay on this device — nothing is uploaded.')).toBeTruthy();
  });
});

describe('AC11 (unit half) — no streak/XP strings in either V1 tree', () => {
  for (const gamification of ['full', 'off'] as const) {
    it(`career tree carries no streak/XP copy (gamification: ${gamification})`, () => {
      usePreferencesStore.setState({ gamification });
      render(<CareerScreen />);
      const text = renderedText();
      expect(text).not.toMatch(/streak/i);
      expect(text).not.toMatch(/xp/i);
    });

    it(`social tree carries no streak/XP copy (gamification: ${gamification})`, () => {
      usePreferencesStore.setState({ gamification });
      contactsMock.mockReturnValue(SEEDED);
      render(<SocialScreen />);
      const text = renderedText();
      expect(text).not.toMatch(/streak/i);
      expect(text).not.toMatch(/xp/i);
    });
  }
});
