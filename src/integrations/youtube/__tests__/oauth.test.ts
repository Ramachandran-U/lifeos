jest.mock('@/integrations/google/oauth', () => ({
  createGoogleOAuthClient: jest.fn(() => ({
    start: jest.fn(),
    complete: jest.fn(),
    clear: jest.fn(),
    isConnected: jest.fn(),
    getAccessToken: jest.fn(),
    consumeReturnPath: jest.fn(),
  })),
}));

import { createGoogleOAuthClient } from '@/integrations/google/oauth';
import * as oauth from '../oauth';

const createMock = createGoogleOAuthClient as jest.MockedFunction<typeof createGoogleOAuthClient>;

describe('youtube/oauth binding', () => {
  it('requests only the read-only YouTube scope', () => {
    expect(oauth.YOUTUBE_SCOPES).toBe('https://www.googleapis.com/auth/youtube.readonly');
  });

  it('binds the shared PKCE driver with its own token bucket + callback path', () => {
    expect(createMock).toHaveBeenCalledWith({
      scopes: oauth.YOUTUBE_SCOPES,
      tokenKey: 'lifeos_youtube_tokens',
      verifierKey: 'lifeos_youtube_pkce_verifier',
      redirectPath: '/youtube-callback',
    });
  });

  it('re-exports the bound OAuth surface as functions', () => {
    expect(typeof oauth.startYouTubeOAuth).toBe('function');
    expect(typeof oauth.handleYouTubeCallback).toBe('function');
    expect(typeof oauth.clearYouTubeTokens).toBe('function');
    expect(typeof oauth.isYouTubeConnected).toBe('function');
    expect(typeof oauth.getYouTubeAccessToken).toBe('function');
    expect(typeof oauth.consumeYouTubeReturnPath).toBe('function');
  });
});
