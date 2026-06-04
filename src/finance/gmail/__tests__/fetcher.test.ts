// oauth.ts pulls RN/expo modules that can't load under the node test env;
// fetcher only needs getAccessToken from it (and not for the functions we test
// here, which take the token directly), so stub the module away.
jest.mock('@/finance/gmail/oauth', () => ({ getAccessToken: jest.fn() }));

import {
  searchEmails,
  fetchEmailBody,
  fetchManyEmailBodies,
  syncRecentBillEmails,
  BILLS_SUBSCRIPTIONS_QUERY,
} from '@/finance/gmail/fetcher';
import { getAccessToken } from '@/finance/gmail/oauth';

const tokenMock = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

const b64url = (s: string) =>
  Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('searchEmails', () => {
  it('paginates through nextPageToken and concatenates message ids', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ messages: [{ id: 'a' }, { id: 'b' }], nextPageToken: 'PAGE2' }))
      .mockResolvedValueOnce(mockResponse({ messages: [{ id: 'c' }] }));

    const ids = await searchEmails('tok', 'q', 100);

    expect(ids).toEqual(['a', 'b', 'c']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Second request must carry the page token.
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=PAGE2');
    // Bearer token is attached.
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('caps the result at maxResults', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ messages: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }));
    const ids = await searchEmails('tok', 'q', 2);
    expect(ids).toEqual(['a', 'b']);
  });

  it('returns an empty list when there are no messages', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}));
    expect(await searchEmails('tok')).toEqual([]);
  });

  it('throws a status-tagged error on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}, false, 401));
    await expect(searchEmails('tok')).rejects.toThrow('Gmail search failed: 401');
  });
});

describe('fetchEmailBody', () => {
  it('parses headers and decodes a plain-text body', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        payload: {
          headers: [
            { name: 'Subject', value: 'Txn alert' },
            { name: 'From', value: 'alerts@hdfcbank.net' },
            { name: 'Date', value: 'Tue, 26 May 2026 12:00:00 +0000' },
          ],
          parts: [{ mimeType: 'text/plain', body: { data: b64url('You spent INR 500') } }],
        },
      }),
    );

    const msg = await fetchEmailBody('tok', 'm1');
    expect(msg).toEqual({
      id: 'm1',
      subject: 'Txn alert',
      from: 'alerts@hdfcbank.net',
      body: 'You spent INR 500',
      date: '2026-05-26',
    });
  });

  it('strips HTML when only an HTML part is present', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        payload: {
          headers: [],
          parts: [{ mimeType: 'text/html', body: { data: b64url('<p>Debited <b>INR 200</b></p>') } }],
        },
      }),
    );
    const msg = await fetchEmailBody('tok', 'm2');
    expect(msg?.body).toBe('Debited INR 200');
  });

  it('returns null on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}, false, 404));
    expect(await fetchEmailBody('tok', 'gone')).toBeNull();
  });
});

describe('fetchManyEmailBodies', () => {
  it('fetches each id and skips the ones that fail', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ payload: { headers: [{ name: 'Subject', value: 'one' }] } }))
      .mockResolvedValueOnce(mockResponse({}, false, 500))
      .mockResolvedValueOnce(mockResponse({ payload: { headers: [{ name: 'Subject', value: 'three' }] } }));

    const msgs = await fetchManyEmailBodies('tok', ['1', '2', '3']);
    expect(msgs.map((m) => m.subject)).toEqual(['one', 'three']);
  });
});

describe('syncRecentBillEmails', () => {
  beforeEach(() => tokenMock.mockReset());

  it('searches with the bills/subscriptions query and returns parsed bodies', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock
      .mockResolvedValueOnce(mockResponse({ messages: [{ id: 'b1' }] })) // search
      .mockResolvedValueOnce(
        mockResponse({ payload: { headers: [{ name: 'Subject', value: 'Your bill is ready' }] } }),
      ); // body

    const msgs = await syncRecentBillEmails('client-123');

    expect(tokenMock).toHaveBeenCalledWith('client-123');
    const searchUrl = String(fetchMock.mock.calls[0][0]);
    expect(searchUrl).toContain('subscription');
    expect(searchUrl).toContain('membership');
    expect(msgs.map((m) => m.subject)).toEqual(['Your bill is ready']);
  });

  it('throws when Gmail is not connected', async () => {
    tokenMock.mockResolvedValue(null);
    await expect(syncRecentBillEmails('client-123')).rejects.toThrow('Gmail is not connected');
  });

  it('exports a query scoped to a 60-day window', () => {
    expect(BILLS_SUBSCRIPTIONS_QUERY).toContain('newer_than:60d');
  });
});
