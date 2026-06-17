/**
 * Build the (PII-free) telemetry props for a voice tool invocation.
 *
 * Voice tools run on-device against sensitive local data, so we record ONLY the
 * tool name and coarse success/shape booleans — never tool arguments, payee
 * names, amounts, transcripts, or any tool-result content. That's enough to
 * validate usage (which tools get called, how often, how often they actually
 * found data) without leaking anything personal.
 *
 * The shape mirrors the `{ result } | { error }` wrapper the voice session puts
 * around each tool response (see the `toolCall` path in voiceClient.ts):
 *  - `ok`        — the tool ran without throwing / was a known tool.
 *  - `found`     — for read tools that report it (e.g. getMoneyWithPayee), did
 *                  it actually find data? (a tool can run ok yet find nothing).
 *  - `ambiguous` — for tools that report it, was the result ambiguous?
 */
export interface VoiceToolResponse {
  result?: unknown;
  error?: unknown;
}

export function voiceToolTelemetryProps(
  name: string,
  response: VoiceToolResponse,
): Record<string, unknown> {
  const ok = response.error === undefined;
  const props: Record<string, unknown> = { tool: name, ok };
  const result = response.result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.found === 'boolean') props.found = r.found;
    if (typeof r.ambiguous === 'boolean') props.ambiguous = r.ambiguous;
  }
  return props;
}
