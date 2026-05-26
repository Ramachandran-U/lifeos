import { AIRequest } from './types';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';
import { recordUsage, computeCost } from './costLedger';
import { startSpan, endSpan } from './tracing';
import { track, EVENTS } from '@/utils/telemetry';

const PROXY_URL =
  process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';

async function callViaProxy(request: AIRequest): Promise<string> {
  const span = startSpan('callAI', { task: request.task, model: request.model, cacheSystem: !!request.cacheSystem });

  try {
    const token = await getSupabaseAccessToken();
    if (!token) {
      throw new Error('Sign in required to use AI features.');
    }

    const response = await fetch(`${PROXY_URL}/claude`, {
      method: 'POST',
      signal: request.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        system: request.system,
        messages: request.messages,
        maxTokens: request.maxTokens,
        model: request.model,
        cacheSystem: request.cacheSystem,
        task: request.task,
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

    const model = data.model ?? request.model ?? 'unknown';
    if (data.usage) {
      recordUsage({ model, task: request.task ?? 'unknown', usage: data.usage });
      track(EVENTS.aiCall, {
        task: request.task ?? 'unknown',
        model,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cache_read_tokens: data.usage.cache_read_input_tokens,
      });
      endSpan(span, {
        model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        cacheReadTokens: data.usage.cache_read_input_tokens,
        cacheCreationTokens: data.usage.cache_creation_input_tokens,
        costUsd: computeCost(model, data.usage),
      });
    } else {
      endSpan(span, { model });
    }

    return data.text;
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function callAI(request: AIRequest): Promise<string> {
  return callViaProxy(request);
}
