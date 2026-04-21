import { AIRequest } from './types';

const API_KEY =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

const PROXY_URL =
  process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787/ai';

async function callViaProxy(request: AIRequest): Promise<string> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: request.system,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI proxy ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

async function callViaAPI(request: AIRequest): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: request.maxTokens ?? 1200,
      system: request.system,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Claude API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function callAI(request: AIRequest): Promise<string> {
  if (API_KEY) return callViaAPI(request);

  // Fallback to local CLI proxy — uses your Claude Code subscription, no API cost.
  try {
    return await callViaProxy(request);
  } catch (err) {
    const hint =
      err instanceof Error && /Failed to fetch|NetworkError/i.test(err.message)
        ? ' — is the proxy running? Start it with `node scripts/ai-proxy.js`.'
        : '';
    throw new Error(
      (err instanceof Error ? err.message : 'AI proxy error') + hint,
    );
  }
}
