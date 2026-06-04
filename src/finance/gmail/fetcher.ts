/**
 * Gmail API — search for bank transaction emails and fetch bodies.
 * Uses the REST API directly; no gapi client needed.
 */

import { getAccessToken } from './oauth';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

const BANK_QUERY =
  'from:(alerts.hdfcbank.com OR hdfcbank.net OR notifications@icicibank.com OR icicibank.com OR axisbank.com OR axisbankmail.in OR axis.bank.in OR alerts@axis.bank.in) ' +
  'newer_than:30d ' +
  '(debited OR credited OR "transaction alert")';

/**
 * Recurring-commitment emails: subscription renewals + bills/invoices. Sender-
 * agnostic (unlike BANK_QUERY) — matched on subject/body keywords and pre-
 * filtered further by the parser (billParsers.ts), which requires a recurring
 * keyword plus an amount or due date. 60 days catches at least one monthly
 * cycle and recent renewals.
 */
export const BILLS_SUBSCRIPTIONS_QUERY =
  'newer_than:60d ' +
  '(subject:(invoice OR receipt OR "your bill" OR "bill is" OR "payment due" OR ' +
  'renew OR renewal OR subscription OR membership OR statement) OR ' +
  '"auto-renew" OR "will renew" OR "renews on" OR "amount due" OR ' +
  '"amount payable" OR "payment due" OR "due date")';

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  body: string;
  date: string;
}

async function authedFetch(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

export async function searchEmails(
  accessToken: string,
  query: string = BANK_QUERY,
  maxResults = 100,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(maxResults, 100)) });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await authedFetch(`${BASE}/messages?${params}`, accessToken);
    if (!res.ok) throw new Error(`Gmail search failed: ${res.status}`);
    const json = await res.json();
    const page = (json.messages ?? []) as Array<{ id: string }>;
    for (const m of page) ids.push(m.id);
    pageToken = json.nextPageToken;
    if (ids.length >= maxResults) break;
  } while (pageToken);

  return ids.slice(0, maxResults);
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function extractBody(payload: GmailPart): string {
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  const parts = payload.parts ?? [];
  const plain = parts.find((p) => p.mimeType === 'text/plain');
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = parts.find((p) => p.mimeType === 'text/html');
  if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));
  for (const p of parts) {
    const nested = extractBody(p);
    if (nested) return nested;
  }
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchEmailBody(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage | null> {
  const res = await authedFetch(
    `${BASE}/messages/${messageId}?format=full`,
    accessToken,
  );
  if (!res.ok) return null;
  const json = await res.json();
  const headers = (json.payload?.headers ?? []) as Array<{ name: string; value: string }>;
  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
  const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
  const dateHeader = headers.find((h) => h.name.toLowerCase() === 'date')?.value;
  const date = dateHeader ? new Date(dateHeader).toISOString().slice(0, 10) : '';
  const body = extractBody(json.payload ?? {});
  return { id: messageId, subject, from, body, date };
}

export async function fetchManyEmailBodies(
  accessToken: string,
  ids: string[],
): Promise<GmailMessage[]> {
  const out: GmailMessage[] = [];
  for (const id of ids) {
    const msg = await fetchEmailBody(accessToken, id);
    if (msg) out.push(msg);
  }
  return out;
}

/**
 * Convenience wrapper — refreshes token via getAccessToken, searches, fetches bodies.
 * Throws if not connected.
 */
export async function syncRecentEmails(clientId: string): Promise<GmailMessage[]> {
  const token = await getAccessToken(clientId);
  if (!token) throw new Error('Gmail is not connected');
  const ids = await searchEmails(token);
  return fetchManyEmailBodies(token, ids);
}

/**
 * Same shape as syncRecentEmails but for subscription/bill emails — refreshes
 * the token, searches with BILLS_SUBSCRIPTIONS_QUERY, fetches bodies.
 * Throws if not connected.
 */
export async function syncRecentBillEmails(clientId: string): Promise<GmailMessage[]> {
  const token = await getAccessToken(clientId);
  if (!token) throw new Error('Gmail is not connected');
  const ids = await searchEmails(token, BILLS_SUBSCRIPTIONS_QUERY);
  return fetchManyEmailBodies(token, ids);
}
