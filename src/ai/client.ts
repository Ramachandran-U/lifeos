import { AIRequest } from './types';

async function callViaAPI(request: AIRequest): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: request.maxTokens ?? 1500,
      system: request.system,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function callAI(request: AIRequest): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    return callViaAPI(request);
  }
  throw new Error('No AI backend available. Set ANTHROPIC_API_KEY or enable USE_AI_MOCK.');
}
