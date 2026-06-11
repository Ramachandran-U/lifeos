import { Platform } from 'react-native';

jest.mock('@/integrations/googleContacts/oauth', () => ({
  isContactsConnected: jest.fn(() => true),
  startContactsOAuth: jest.fn(),
}));
jest.mock('@/integrations/googleContacts/client', () => ({ fetchGoogleContacts: jest.fn() }));
jest.mock('@/db/queries/social', () => ({
  createContact: jest.fn(() => 'new-id'),
  RELATIONSHIP_TIERS: ['inner_circle', 'close_friend', 'family', 'mentor', 'colleague', 'acquaintance'],
  RELATIONSHIP_META: {
    inner_circle: { label: 'Inner circle', defaultCadenceDays: 7 },
    close_friend: { label: 'Close friend', defaultCadenceDays: 14 },
    family: { label: 'Family', defaultCadenceDays: 14 },
    mentor: { label: 'Mentor', defaultCadenceDays: 30 },
    colleague: { label: 'Colleague', defaultCadenceDays: 21 },
    acquaintance: { label: 'Acquaintance', defaultCadenceDays: 60 },
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ContactsImportCard } from '@/components/modules/social/ContactsImportCard';
import { fetchGoogleContacts } from '@/integrations/googleContacts/client';
import { isContactsConnected } from '@/integrations/googleContacts/oauth';
import { createContact } from '@/db/queries/social';

const fetchMock = fetchGoogleContacts as jest.Mock;
const connectedMock = isContactsConnected as jest.Mock;
const createContactMock = createContact as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'web';
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'cid';
});

describe('ContactsImportCard', () => {
  it('shows the Connect CTA when Google Contacts is not connected', () => {
    connectedMock.mockReturnValue(false);
    render(<ContactsImportCard userId="u1" existingNames={[]} onImported={jest.fn()} />);
    expect(screen.getByText('Connect Google Contacts')).toBeTruthy();
  });

  it('dedupes existing, pre-selects birthday-havers, and creates only the selected', async () => {
    connectedMock.mockReturnValue(true);
    fetchMock.mockResolvedValue([
      { name: 'Alex Rivera', birthday: '1990-06-04', email: 'a@x.com' }, // birthday → pre-selected
      { name: 'Sam Lee', birthday: null, email: null }, // no birthday → not pre-selected
      { name: 'Existing Person', birthday: null, email: null }, // already on file → filtered
    ]);
    const onImported = jest.fn();
    render(
      <ContactsImportCard userId="u1" existingNames={['existing person']} onImported={onImported} />,
    );

    fireEvent.press(screen.getByText('Import contacts'));

    await waitFor(() => expect(screen.getByText('CHOOSE WHO TO ADD')).toBeTruthy());
    expect(screen.queryByText('Existing Person')).toBeNull(); // dedup (case-insensitive)
    expect(screen.getByText('Alex Rivera')).toBeTruthy();
    expect(screen.getByText('Sam Lee')).toBeTruthy();

    // Only Alex is pre-selected (has a birthday) → "Add 1 as acquaintance".
    fireEvent.press(screen.getByText(/^Add 1 as/));
    expect(createContactMock).toHaveBeenCalledTimes(1);
    expect(createContactMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', name: 'Alex Rivera', source: 'phone_import', birthday: '1990-06-04' }),
    );
    expect(onImported).toHaveBeenCalled();
  });
});

describe("ContactsImportCard presentation='row' (Ink + Signal §3.0.3, W4)", () => {
  it('renders the disconnected ConnectRow with the committed copy', () => {
    connectedMock.mockReturnValue(false);
    render(
      <ContactsImportCard
        presentation="row"
        userId="u1"
        existingNames={[]}
        onImported={jest.fn()}
      />,
    );
    expect(screen.getByTestId('connect-row-contacts')).toBeTruthy();
    expect(screen.getByText('Connect Google Contacts')).toBeTruthy();
    expect(screen.getByText('Names and birthdays stay on this device')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
    // The promo-card pitch never renders in row mode.
    expect(screen.queryByText('IMPORT FROM GOOGLE CONTACTS')).toBeNull();
  });

  it('renders the connected ConnectRow and keeps the review modal as the press flow', async () => {
    connectedMock.mockReturnValue(true);
    fetchMock.mockResolvedValue([{ name: 'Alex Rivera', birthday: '1990-06-04', email: 'a@x.com' }]);
    render(
      <ContactsImportCard
        presentation="row"
        userId="u1"
        existingNames={[]}
        onImported={jest.fn()}
      />,
    );
    expect(screen.getByText('Import contacts')).toBeTruthy();
    expect(screen.getByText('You choose who gets added')).toBeTruthy();

    fireEvent.press(screen.getByTestId('connect-row-contacts'));
    await waitFor(() => expect(screen.getByText('CHOOSE WHO TO ADD')).toBeTruthy());
    expect(screen.getByText('Alex Rivera')).toBeTruthy();
  });
});
