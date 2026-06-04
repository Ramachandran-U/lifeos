/**
 * YouTube Data API v3 — read the signed-in user's subscriptions, the strongest
 * free interest signal (watch history is not available via the API). Each
 * subscriptions.list page costs 1 quota unit; we cap pages to stay well within
 * the 10k/day project quota.
 */

import { getYouTubeAccessToken } from './oauth';

const SUBSCRIPTIONS_URL = 'https://www.googleapis.com/youtube/v3/subscriptions';

export interface SubscribedChannel {
  /** Channel name (snippet.title). */
  title: string;
  /** Channel description, truncated — a topic hint for the extractor. */
  description: string;
}

type SubscriptionItem = {
  snippet?: {
    title?: string;
    description?: string;
  };
};

async function authedGet(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * List the user's subscribed channels (most-recent first), capped at `max`.
 * Returns title + a short description for each. Throws if not connected.
 */
export async function fetchSubscribedChannels(
  clientId: string,
  max = 100,
): Promise<SubscribedChannel[]> {
  const token = await getYouTubeAccessToken(clientId);
  if (!token) throw new Error('YouTube is not connected');

  const out: SubscribedChannel[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
      order: 'relevance',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await authedGet(`${SUBSCRIPTIONS_URL}?${params}`, token);
    if (!res.ok) throw new Error(`YouTube subscriptions failed: ${res.status}`);
    const json = await res.json();

    for (const item of (json.items ?? []) as SubscriptionItem[]) {
      const title = (item.snippet?.title ?? '').trim();
      if (!title) continue;
      out.push({ title, description: (item.snippet?.description ?? '').slice(0, 200).trim() });
      if (out.length >= max) return out;
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return out;
}
