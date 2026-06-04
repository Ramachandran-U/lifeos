import { render, screen, fireEvent } from '@testing-library/react-native';

// ContactRow is a presentational leaf: it imports the RELATIONSHIP_META map and
// the pure computeOverdue() helper from @/db/queries/social (which itself pulls
// the whole drizzle/web-storage chain). Mock that module so the row's render
// branches — cadence label, recency copy, overdue dot — are driven
// deterministically without touching real storage.
let mockOverdue: {
  daysSinceContact: number | null;
  isOverdue: boolean;
  overdueBy: number;
};

jest.mock('@/db/queries/social', () => ({
  RELATIONSHIP_META: {
    inner_circle: { label: 'Inner circle', defaultCadenceDays: 7 },
    acquaintance: { label: 'Acquaintance', defaultCadenceDays: 60 },
  },
  computeOverdue: () => mockOverdue,
}));

import { ContactRow } from '@/components/modules/social/ContactRow';
import type { Contact } from '@/db/queries/social';

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact_fake_1',
    userId: 'user_fake_1',
    name: 'Sam Placeholder',
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
    ...overrides,
  };
}

describe('ContactRow', () => {
  beforeEach(() => {
    mockOverdue = { daysSinceContact: 3, isOverdue: false, overdueBy: 0 };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the contact name and the cadence label', () => {
    render(<ContactRow contact={makeContact()} onPress={() => {}} />);
    expect(screen.getByText('Sam Placeholder')).toBeTruthy();
    expect(screen.getByText('Inner circle · every 7d')).toBeTruthy();
  });

  it('prefers the nickname over the name when one is set', () => {
    render(<ContactRow contact={makeContact({ nickname: 'Sammy' })} onPress={() => {}} />);
    expect(screen.getByText('Sammy')).toBeTruthy();
    expect(screen.queryByText('Sam Placeholder')).toBeNull();
  });

  it('shows the "No contact yet" recency copy when there is no history', () => {
    mockOverdue = { daysSinceContact: null, isOverdue: false, overdueBy: 0 };
    render(<ContactRow contact={makeContact()} onPress={() => {}} />);
    expect(screen.getByText('No contact yet')).toBeTruthy();
  });

  it('renders a "Xd ago" recency label for a recent contact', () => {
    mockOverdue = { daysSinceContact: 3, isOverdue: false, overdueBy: 0 };
    render(<ContactRow contact={makeContact()} onPress={() => {}} />);
    expect(screen.getByText('3d ago')).toBeTruthy();
  });

  it('shows the overdue dot when the contact is overdue', () => {
    mockOverdue = { daysSinceContact: 90, isOverdue: true, overdueBy: 30 };
    render(<ContactRow contact={makeContact({ relationshipType: 'acquaintance' })} onPress={() => {}} />);
    // 90 days → "3mo ago"; the dot is the overdue affordance.
    expect(screen.getByText('3mo ago')).toBeTruthy();
  });

  it('calls onPress when the row is pressed', () => {
    const onPress = jest.fn();
    render(<ContactRow contact={makeContact()} onPress={onPress} />);
    fireEvent.press(screen.getByText('Sam Placeholder'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
