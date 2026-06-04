// oauth.ts re-exports the shared Google driver (pulls in Supabase session); the
// client only needs the bearer accessor, so stub the module.
jest.mock('../oauth', () => ({ getYouTubeAccessToken: jest.fn() }));

import { fetchSubscribedChannels } from '../client';
import { getYouTubeAccessToken } from '../oauth';

const tokenMock = getYouTubeAccessToken as jest.MockedFunction<typeof getYouTubeAccessToken>;
const fetchMock = jest.fn();

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

const sub = (title: string, description = '') => ({ snippet: { title, description } });

beforeEach(() => {
  fetchMock.mockReset();
  tokenMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('fetchSubscribedChannels', () => {
  it('throws when YouTube is not connected', async () => {
    tokenMock.mockResolvedValue(null);
    await expect(fetchSubscribedChannels('client-1')).rejects.toThrow('YouTube is not connected');
  });

  it('parses channel titles + truncated descriptions and paginates', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [sub('Veritasium', 'science'), sub('Babish', 'cooking')], nextPageToken: 'P2' }))
      .mockResolvedValueOnce(jsonResponse({ items: [sub('Fireship')] }));

    const channels = await fetchSubscribedChannels('client-1');

    expect(channels.map((c) => c.title)).toEqual(['Veritasium', 'Babish', 'Fireship']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('mine=true');
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=P2');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('truncates long descriptions to 200 chars and skips title-less items', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [sub('Deep Channel', 'x'.repeat(250)), sub('')] }),
    );
    const channels = await fetchSubscribedChannels('client-1');
    expect(channels).toHaveLength(1);
    expect(channels[0].description.length).toBe(200);
  });

  it('caps the result at max and stops paginating', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [sub('A'), sub('B'), sub('C')], nextPageToken: 'more' }),
    );
    const channels = await fetchSubscribedChannels('client-1', 2);
    expect(channels.map((c) => c.title)).toEqual(['A', 'B']);
    expect(fetchMock).toHaveBeenCalledTimes(1); // hit the cap mid-page → no second request
  });

  it('throws a status-tagged error on a non-ok response', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 403));
    await expect(fetchSubscribedChannels('client-1')).rejects.toThrow('YouTube subscriptions failed: 403');
  });
});
