/**
 * Google Auth (SSO) REST client — fetchGoogleProfile guards: throws when there
 * is no access token, throws when userinfo returns no email, and returns the
 * parsed profile on success.
 */

jest.mock('../oauth', () => ({
  getGoogleAuthAccessToken: jest.fn().mockResolvedValue('auth-tok'),
}));

import { fetchGoogleProfile } from '../client';
import { getGoogleAuthAccessToken } from '../oauth';

const CLIENT_ID = 'fake-client.apps.googleusercontent.com';

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  (getGoogleAuthAccessToken as jest.Mock).mockResolvedValue('auth-tok');
});

describe('fetchGoogleProfile', () => {
  it('throws when the access token is missing (does not hit the network)', async () => {
    (getGoogleAuthAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(fetchGoogleProfile(CLIENT_ID)).rejects.toThrow('Google auth token missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a status-tagged error when userinfo responds non-ok', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 403));

    await expect(fetchGoogleProfile(CLIENT_ID)).rejects.toThrow('userinfo failed: 403');
  });

  it('throws when the profile has no email address', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ sub: 'user-123', name: 'Test Person' }));

    await expect(fetchGoogleProfile(CLIENT_ID)).rejects.toThrow('Google did not return an email address');
  });

  it('returns the parsed profile on success with the bearer attached', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sub: 'user-123',
        email: 'test.person@example.test',
        name: 'Test Person',
        picture: 'https://example.test/avatar.png',
        email_verified: true,
      }),
    );

    const profile = await fetchGoogleProfile(CLIENT_ID);

    expect(profile).toEqual({
      sub: 'user-123',
      email: 'test.person@example.test',
      name: 'Test Person',
      picture: 'https://example.test/avatar.png',
      email_verified: true,
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer auth-tok');
  });
});
