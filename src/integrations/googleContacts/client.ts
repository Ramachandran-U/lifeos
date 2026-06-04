/**
 * Google People API — read the user's contacts (names + birthdays + a primary
 * email) to seed the Social engine. `connections.list` is a cheap, paginated
 * read; we cap the import to stay reasonable. Birthdays come back as a
 * {year?, month, day} object — we normalise to "YYYY-MM-DD" (or "MM-DD" when
 * the year is withheld, which is common).
 */

import { getContactsAccessToken } from './oauth';

const CONNECTIONS_URL = 'https://people.googleapis.com/v1/people/me/connections';

export interface GoogleContact {
  name: string;
  /** "YYYY-MM-DD", or "MM-DD" when the year is unknown, or null. */
  birthday: string | null;
  email: string | null;
}

type PeopleBirthday = { date?: { year?: number; month?: number; day?: number } };
type PersonConnection = {
  names?: Array<{ displayName?: string }>;
  birthdays?: PeopleBirthday[];
  emailAddresses?: Array<{ value?: string }>;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseBirthday(birthdays: PeopleBirthday[] | undefined): string | null {
  const d = (birthdays?.find((b) => b.date?.month && b.date?.day) ?? birthdays?.[0])?.date;
  if (!d?.month || !d?.day) return null;
  const md = `${pad2(d.month)}-${pad2(d.day)}`;
  return d.year ? `${d.year}-${md}` : md;
}

/**
 * The user's contacts (most relevant first), capped at `max`. Throws if not
 * connected. Contacts without a name are skipped.
 */
export async function fetchGoogleContacts(clientId: string, max = 1000): Promise<GoogleContact[]> {
  const token = await getContactsAccessToken(clientId);
  if (!token) throw new Error('Google Contacts is not connected');

  const out: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: 'names,birthdays,emailAddresses',
      pageSize: '1000',
      sortOrder: 'LAST_NAME_ASCENDING',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${CONNECTIONS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Google Contacts failed: ${res.status}`);
    const json = await res.json();

    for (const c of (json.connections ?? []) as PersonConnection[]) {
      const name = c.names?.[0]?.displayName?.trim();
      if (!name) continue;
      out.push({
        name,
        birthday: parseBirthday(c.birthdays),
        email: c.emailAddresses?.[0]?.value ?? null,
      });
      if (out.length >= max) return out;
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return out;
}
