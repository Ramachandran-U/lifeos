import { AIRequest } from './types';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const PROXY_URL =
  process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';

async function callViaProxy(request: AIRequest): Promise<string> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new Error('Sign in required to use AI features.');
  }

  const response = await fetch(`${PROXY_URL}/claude`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      system: request.system,
      messages: request.messages,
      maxTokens: request.maxTokens,
    }),
  });

  if (response.status === 429) {
    throw new Error("You've hit today's AI limit. Try again tomorrow.");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI proxy ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

export async function callAI(request: AIRequest): Promise<string> {
  return callViaProxy(request);
}
