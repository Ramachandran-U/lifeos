/**
 * Lightweight span-based tracing for AI calls. Each call gets a span with
 * latency, model, token usage, and arbitrary metadata. Spans can nest so
 * agent runs show parent → children.
 *
 * Default sink: in-memory store (read via `getSpans()`, dump via `flushToFile()`).
 * Optional sink: Langfuse — set LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY +
 * (optional) LANGFUSE_BASE_URL. Spans are POSTed to /api/public/ingestion in
 * batch on flush.
 */

export interface Span {
  id: string;
  parentId?: string;
  name: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
  status: 'ok' | 'error';
  error?: string;
  metadata?: Record<string, unknown>;
}

const spans: Span[] = [];
const stack: string[] = [];

let counter = 0;
function newId(): string {
  counter += 1;
  return `s_${Date.now().toString(36)}_${counter}`;
}

export function startSpan(name: string, metadata?: Record<string, unknown>): Span {
  const span: Span = {
    id: newId(),
    parentId: stack[stack.length - 1],
    name,
    startMs: Date.now(),
    status: 'ok',
    metadata,
  };
  spans.push(span);
  stack.push(span.id);
  return span;
}

export function endSpan(
  span: Span,
  patch?: Partial<Pick<Span, 'model' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheCreationTokens' | 'costUsd' | 'status' | 'error' | 'metadata'>>,
): void {
  span.endMs = Date.now();
  span.durationMs = span.endMs - span.startMs;
  if (patch) {
    if (patch.metadata) span.metadata = { ...(span.metadata ?? {}), ...patch.metadata };
    Object.assign(span, { ...patch, metadata: span.metadata });
  }
  // Pop only if this span is still on top — protects against out-of-order ends.
  const top = stack[stack.length - 1];
  if (top === span.id) stack.pop();
  else {
    const idx = stack.lastIndexOf(span.id);
    if (idx >= 0) stack.splice(idx, 1);
  }
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const span = startSpan(name, metadata);
  try {
    const result = await fn(span);
    endSpan(span);
    return result;
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export function getSpans(): readonly Span[] {
  return spans;
}

export function clearSpans(): void {
  spans.length = 0;
  stack.length = 0;
}

export interface TraceSummary {
  total: number;
  errors: number;
  totalDurationMs: number;
  avgDurationMs: number;
  byName: Record<string, { count: number; totalMs: number; errors: number }>;
}

export function summarizeTrace(): TraceSummary {
  const completed = spans.filter((s) => s.endMs !== undefined);
  const totalDurationMs = completed.reduce((acc, s) => acc + (s.durationMs ?? 0), 0);
  const sum: TraceSummary = {
    total: completed.length,
    errors: completed.filter((s) => s.status === 'error').length,
    totalDurationMs,
    avgDurationMs: completed.length ? totalDurationMs / completed.length : 0,
    byName: {},
  };
  for (const s of completed) {
    sum.byName[s.name] ??= { count: 0, totalMs: 0, errors: 0 };
    sum.byName[s.name]!.count += 1;
    sum.byName[s.name]!.totalMs += s.durationMs ?? 0;
    if (s.status === 'error') sum.byName[s.name]!.errors += 1;
  }
  return sum;
}

/** Optional Langfuse exporter. No-ops when env vars are missing. */
export async function exportToLangfuse(): Promise<{ posted: number; skipped: boolean }> {
  const pub = process.env.LANGFUSE_PUBLIC_KEY;
  const sec = process.env.LANGFUSE_SECRET_KEY;
  if (!pub || !sec) return { posted: 0, skipped: true };
  const base = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';
  const auth = 'Basic ' + Buffer.from(`${pub}:${sec}`).toString('base64');

  const events = spans
    .filter((s) => s.endMs !== undefined)
    .map((s) => ({
      id: s.id,
      type: 'span-create',
      timestamp: new Date(s.startMs).toISOString(),
      body: {
        id: s.id,
        parentObservationId: s.parentId,
        name: s.name,
        startTime: new Date(s.startMs).toISOString(),
        endTime: s.endMs ? new Date(s.endMs).toISOString() : undefined,
        level: s.status === 'error' ? 'ERROR' : 'DEFAULT',
        statusMessage: s.error,
        metadata: {
          model: s.model,
          inputTokens: s.inputTokens,
          outputTokens: s.outputTokens,
          cacheReadTokens: s.cacheReadTokens,
          costUsd: s.costUsd,
          ...s.metadata,
        },
      },
    }));

  if (events.length === 0) return { posted: 0, skipped: false };

  const res = await fetch(`${base}/api/public/ingestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ batch: events }),
  });
  if (!res.ok) throw new Error(`Langfuse ingestion failed: ${res.status}`);
  return { posted: events.length, skipped: false };
}
