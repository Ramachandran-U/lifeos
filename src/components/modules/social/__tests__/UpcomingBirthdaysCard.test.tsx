import { render, screen, fireEvent } from '@testing-library/react-native';
import { UpcomingBirthdaysCard } from '@/components/modules/social/UpcomingBirthdaysCard';
import type { Contact } from '@/db/queries/social';

// The card computes "upcoming" relative to the real `new Date()`, so derive the
// birthday key from today to keep the test date-independent.
const mmdd = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c1',
    userId: 'u1',
    name: 'Test',
    nickname: null,
    relationshipType: 'close_friend',
    preferredCadenceDays: 14,
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

describe('UpcomingBirthdaysCard', () => {
  it('renders nothing when no birthdays are upcoming', () => {
    const { toJSON } = render(
      <UpcomingBirthdaysCard contacts={[contact({ birthday: null })]} onPress={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("shows a contact whose birthday is today with the 'Today' label", () => {
    const today = mmdd(new Date());
    render(
      <UpcomingBirthdaysCard
        contacts={[contact({ id: 'a', name: 'Alex Rivera', birthday: today })]}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('Alex Rivera')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('renders no emoji and no caps eyebrow after the W4 re-skin (§3.0.5 / §3.0.7)', () => {
    const today = mmdd(new Date());
    const tree = render(
      <UpcomingBirthdaysCard
        contacts={[contact({ id: 'a', name: 'Alex Rivera', birthday: today })]}
        onPress={jest.fn()}
      />,
    );
    const dump = JSON.stringify(tree.toJSON());
    expect(dump).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dump).not.toContain('UPCOMING BIRTHDAYS');
  });

  it('fires onPress with the tapped contact', () => {
    const onPress = jest.fn();
    const c = contact({ id: 'a', name: 'Alex Rivera', birthday: mmdd(new Date()) });
    render(<UpcomingBirthdaysCard contacts={[c]} onPress={onPress} />);
    fireEvent.press(screen.getByText('Alex Rivera'));
    expect(onPress).toHaveBeenCalledWith(c);
  });
});
