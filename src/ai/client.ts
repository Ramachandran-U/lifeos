import { AIRequest } from './types';

const API_KEY =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: request.maxTokens ?? 1500,
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
  if (API_KEY) {
    return callViaAPI(request);
  }
  throw new Error(
    'No AI backend available. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env, or set EXPO_PUBLIC_USE_AI_MOCK=true for mock responses.',
  );
}
