/**
 * Minimal observability counters/gauges (P1-T4).
 *
 * The tracing module (`src/ai/tracing.ts`) covers *spans* (timed operations);
 * this covers *counters* (how many times X happened) and *gauges* (the current
 * value of Y) — the health signals the roadmap's observability backbone wants
 * to watch (sync lag, outbox depth, conflict rate, restore success).
 *
 * Deliberately tiny and platform-free (no react-native/expo imports) so it is
 * unit-testable under the pure-Node jest harness and importable from anywhere,
 * including `src/sync/*`. The sink is in-memory; an exporter (Langfuse/Sentry)
 * can read snapshots via `getMetrics()` later.
 *
 * Every entry point is fire-and-forget — it must NEVER throw to the caller, the
 * same observer-only contract the mutation log holds.
 */

export type MetricTags = Record<string, string | number | boolean>;

interface CounterEntry {
  name: string;
  tags: MetricTags;
  value: number;
}

interface GaugeEntry {
  name: string;
  tags: MetricTags;
  value: number;
}

const counters = new Map<string, CounterEntry>();
const gauges = new Map<string, GaugeEntry>();

/**
 * Build a stable key from a metric name + tags. Tag keys are sorted so
 * `{a,b}` and `{b,a}` collapse to one series.
 */
function keyOf(name: string, tags: MetricTags): string {
  const parts = Object.keys(tags)
    .sort()
    .map((k) => `${k}=${String(tags[k])}`);
  return parts.length ? `${name}|${parts.join(',')}` : name;
}

/** Add `by` (default 1) to a counter series. */
export function increment(name: string, tags: MetricTags = {}, by = 1): void {
  try {
    const key = keyOf(name, tags);
    const existing = counters.get(key);
    if (existing) existing.value += by;
    else counters.set(key, { name, tags, value: by });
  } catch {
    // Observer-only: metrics must never break the caller.
  }
}

/** Set a gauge series to the latest value. */
export function gauge(name: string, value: number, tags: MetricTags = {}): void {
  try {
    gauges.set(keyOf(name, tags), { name, tags, value });
  } catch {
    // Observer-only.
  }
}

export interface MetricsSnapshot {
  counters: CounterEntry[];
  gauges: GaugeEntry[];
}

/** Snapshot of all series (for an exporter, a debug screen, or tests). */
export function getMetrics(): MetricsSnapshot {
  return {
    counters: Array.from(counters.values()).map((c) => ({ ...c })),
    gauges: Array.from(gauges.values()).map((g) => ({ ...g })),
  };
}

/** Read one counter's current total (0 if never incremented). Tests/debug. */
export function getCounter(name: string, tags: MetricTags = {}): number {
  return counters.get(keyOf(name, tags))?.value ?? 0;
}

/** Clear all series. Tests should call this in `afterEach`. */
export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
}
