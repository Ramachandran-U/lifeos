import { Platform } from 'react-native';

jest.mock('@/integrations/youtube/oauth', () => ({
  isYouTubeConnected: jest.fn(() => true),
  startYouTubeOAuth: jest.fn(),
}));
jest.mock('@/integrations/youtube/client', () => ({ fetchSubscribedChannels: jest.fn() }));
jest.mock('@/ai/functions', () => ({ extractInterestsFromYouTube: jest.fn() }));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { YouTubeImportCard } from '@/components/modules/polymath/YouTubeImportCard';
import { fetchSubscribedChannels } from '@/integrations/youtube/client';
import { extractInterestsFromYouTube } from '@/ai/functions';
import { isYouTubeConnected } from '@/integrations/youtube/oauth';

const channelsMock = fetchSubscribedChannels as jest.Mock;
const extractMock = extractInterestsFromYouTube as jest.Mock;
const connectedMock = isYouTubeConnected as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'web';
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'cid';
});

describe('YouTubeImportCard', () => {
  it('shows the Connect CTA when YouTube is not connected', () => {
    connectedMock.mockReturnValue(false);
    render(<YouTubeImportCard existingInterestNames={[]} onImport={jest.fn()} />);
    expect(screen.getByText('Connect YouTube')).toBeTruthy();
  });

  it('reviews AI-clustered interests and imports only the selected ones', async () => {
    connectedMock.mockReturnValue(true);
    channelsMock.mockResolvedValue([{ name: 'Veritasium', description: 'science' }]);
    extractMock.mockResolvedValue({
      interests: [
        { name: 'Physics', category: 'science', weeklyMinutesTarget: 60, why: 'You follow Veritasium' },
        { name: 'Cooking', category: 'food', weeklyMinutesTarget: 30, why: 'You follow food channels' },
      ],
    });
    const onImport = jest.fn();
    render(<YouTubeImportCard existingInterestNames={[]} onImport={onImport} />);

    fireEvent.press(screen.getByText('Import interests'));

    await waitFor(() => expect(screen.getByText('REVIEW INTERESTS')).toBeTruthy());
    expect(screen.getByText('Physics')).toBeTruthy();
    expect(screen.getByText('Cooking')).toBeTruthy();

    // Both default-selected → deselect Cooking, then add → onImport gets only Physics.
    fireEvent.press(screen.getByText('Cooking'));
    fireEvent.press(screen.getByText(/^Add 1 interest/));
    expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ name: 'Physics' })]);
  });
});

describe("YouTubeImportCard presentation='row' (Ink + Signal §3.0.3, W4)", () => {
  it('renders the disconnected ConnectRow with the committed copy', () => {
    connectedMock.mockReturnValue(false);
    render(
      <YouTubeImportCard presentation="row" existingInterestNames={[]} onImport={jest.fn()} />,
    );
    expect(screen.getByTestId('connect-row-youtube')).toBeTruthy();
    expect(screen.getByText('Connect YouTube')).toBeTruthy();
    expect(screen.getByText('Turns subscriptions into interests · read-only')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
    // The promo-card pitch never renders in row mode.
    expect(screen.queryByText('IMPORT FROM YOUTUBE')).toBeNull();
  });

  it('renders the connected ConnectRow and keeps the review modal as the press flow', async () => {
    connectedMock.mockReturnValue(true);
    channelsMock.mockResolvedValue([{ name: 'Veritasium', description: 'science' }]);
    extractMock.mockResolvedValue({
      interests: [
        { name: 'Physics', category: 'science', weeklyMinutesTarget: 60, why: 'You follow Veritasium' },
      ],
    });
    render(
      <YouTubeImportCard presentation="row" existingInterestNames={[]} onImport={jest.fn()} />,
    );
    expect(screen.getByText('Import from YouTube')).toBeTruthy();
    expect(screen.getByText('You choose what gets added')).toBeTruthy();

    fireEvent.press(screen.getByTestId('connect-row-youtube'));
    await waitFor(() => expect(screen.getByText('REVIEW INTERESTS')).toBeTruthy());
    expect(screen.getByText('Physics')).toBeTruthy();
  });
});
