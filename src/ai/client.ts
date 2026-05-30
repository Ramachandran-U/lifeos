import { AIRequest, AIToolResponse, AvatarGenInput, AvatarGenResult } from './types';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';
import { recordUsage, computeCost } from './costLedger';
import { startSpan, endSpan } from './tracing';
import { track, EVENTS } from '@/utils/telemetry';

const PROXY_URL =
  process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';

async function callViaProxy(request: AIRequest): Promise<AIToolResponse> {
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
        ...(request.tools && request.tools.length > 0 ? { tools: request.tools } : {}),
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

    return {
      text: data.text ?? '',
      functionCalls: Array.isArray(data.functionCalls) ? data.functionCalls : [],
      model,
    };
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Text-only AI call — the contract used by all single-shot functions. */
export async function callAI(request: AIRequest): Promise<string> {
  return (await callViaProxy(request)).text;
}

/**
 * Structured AI call that surfaces tool calls. Used by the tool-use agent
 * runtime, which needs to see `functionCalls` to dispatch them on-device.
 */
export async function callAIRaw(request: AIRequest): Promise<AIToolResponse> {
  return callViaProxy(request);
}

/**
 * Avatar image generation (nano banana). A SEPARATE transport from
 * `callViaProxy` because the response is a base64 image, not text — but it
 * keeps the same auth, error-surfacing, cost-ledger, telemetry, and tracing
 * guarantees so this entry point doesn't bypass any of them.
 */
export async function generateAvatarViaProxy(input: AvatarGenInput): Promise<AvatarGenResult> {
  const task = 'generateAvatar';
  const span = startSpan('callAvatar', { task });

  try {
    const token = await getSupabaseAccessToken();
    if (!token) {
      throw new Error('Sign in required to use AI features.');
    }

    const response = await fetch(`${PROXY_URL}/v1/image/avatar`, {
      method: 'POST',
      signal: input.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        stylePrompt: input.stylePrompt,
      }),
    });

    if (response.status === 429) {
      throw new Error("You've hit today's avatar limit. Try again tomorrow.");
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI proxy ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (!data.imageBase64) throw new Error('No avatar image returned.');

    const model = data.model ?? 'gemini-2.5-flash-image';
    if (data.usage) {
      recordUsage({ model, task, usage: data.usage });
      track(EVENTS.aiCall, {
        task,
        model,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cache_read_tokens: data.usage.cache_read_input_tokens,
      });
      endSpan(span, {
        model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        costUsd: computeCost(model, data.usage),
      });
    } else {
      endSpan(span, { model });
    }

    return {
      imageBase64: data.imageBase64,
      mimeType: data.mimeType ?? 'image/png',
      model,
    };
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
