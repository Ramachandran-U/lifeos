jest.mock('../oauth', () => ({ getContactsAccessToken: jest.fn() }));

import { fetchGoogleContacts } from '../client';
import { getContactsAccessToken } from '../oauth';

const tokenMock = getContactsAccessToken as jest.MockedFunction<typeof getContactsAccessToken>;
const fetchMock = jest.fn();

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

const person = (
  displayName: string,
  birthdays?: Array<{ date?: { year?: number; month?: number; day?: number } }>,
  email?: string,
) => ({
  names: displayName ? [{ displayName }] : [],
  birthdays,
  emailAddresses: email ? [{ value: email }] : [],
});

beforeEach(() => {
  fetchMock.mockReset();
  tokenMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('fetchGoogleContacts', () => {
  it('throws when not connected', async () => {
    tokenMock.mockResolvedValue(null);
    await expect(fetchGoogleContacts('c1')).rejects.toThrow('Google Contacts is not connected');
  });

  it('parses names, email, and birthdays (with and without year), and paginates', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          connections: [
            person('Alex Rivera', [{ date: { year: 1990, month: 6, day: 4 } }], 'alex@x.com'),
            person('Sam Lee', [{ date: { month: 12, day: 25 } }]), // year withheld
          ],
          nextPageToken: 'P2',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ connections: [person('No Birthday')] }));

    const contacts = await fetchGoogleContacts('c1');

    expect(contacts).toEqual([
      { name: 'Alex Rivera', birthday: '1990-06-04', email: 'alex@x.com' },
      { name: 'Sam Lee', birthday: '12-25', email: null },
      { name: 'No Birthday', birthday: null, email: null },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain('personFields=names');
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=P2');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('skips connections without a name and caps at max', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock.mockResolvedValue(
      jsonResponse({ connections: [person('A'), person(''), person('B'), person('C')], nextPageToken: 'more' }),
    );
    const contacts = await fetchGoogleContacts('c1', 2);
    expect(contacts.map((c) => c.name)).toEqual(['A', 'B']);
    expect(fetchMock).toHaveBeenCalledTimes(1); // hit cap mid-page → no second request
  });

  it('throws a status-tagged error on a non-ok response', async () => {
    tokenMock.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 403));
    await expect(fetchGoogleContacts('c1')).rejects.toThrow('Google Contacts failed: 403');
  });
});
