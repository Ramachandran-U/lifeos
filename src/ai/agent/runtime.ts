import { callAIRaw } from '../client';
import { withSpan } from '../tracing';
import type { AIMessage, AIToolDeclaration, AIToolPart } from '../types';

/**
 * A tool the agent can call. `declaration` is the schema sent to the model;
 * `execute` runs on-device against local SQLite (or any data source) and
 * returns a JSON-serialisable result.
 *
 * Keep tools in this `{ declaration, execute }` shape and provider-agnostic —
 * don't let provider wire formats (e.g. Gemini functionCall/functionResponse)
 * leak past this file into tool definitions. This decoupling is what keeps a
 * future MCP server/client a thin adapter rather than a rewrite. See
 * docs/architecture/mcp-interop-decision.md.
 */
export interface AgentTool {
  declaration: AIToolDeclaration;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export type ToolAgentStep =
  | { kind: 'call'; name: string; args: Record<string, unknown> }
  | { kind: 'result'; name: string; ok: boolean; preview: string }
  | { kind: 'answer'; text: string };

export interface ToolAgentResult {
  answer: string;
  trace: ToolAgentStep[];
  /** Number of model round-trips made (1 = answered without calling a tool). */
  iterations: number;
}

export interface RunToolAgentInput {
  system: string;
  userMessage: string;
  tools: AgentTool[];
  model?: string;
  task?: string;
  /** Hard cap on model round-trips. Clamped to [1, 10]. Default 6. */
  maxIterations?: number;
  signal?: AbortSignal;
}

const DEFAULT_MAX_ITERATIONS = 6;
const ITERATION_HARD_CEILING = 10;

function preview(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 120);
  } catch {
    return String(value).slice(0, 120);
  }
}

/**
 * Runs a tool-use agent loop: ask the model → if it requests tool calls,
 * execute them on-device and feed the results back → repeat until the model
 * answers in text or the iteration cap is hit.
 *
 * Safety rails:
 *   - iteration cap (clamped to [1,10]) prevents runaway loops
 *   - an unknown tool name returns an error to the model rather than throwing,
 *     so the model can recover or apologise
 *   - a tool that throws is caught and its error is returned to the model,
 *     never crashing the loop
 *   - if the cap is hit while the model still wants tools, one final
 *     tool-free call forces a text answer
 *
 * The proxy executes nothing — every tool runs here, beside the user's local
 * data. See workers/ai-proxy/src/claude.ts for the passthrough side.
 */
export async function runToolAgent(input: RunToolAgentInput): Promise<ToolAgentResult> {
  return withSpan(
    'agent.toolLoop',
    () => runToolAgentInner(input),
    { task: input.task ?? 'agent.toolLoop', toolCount: input.tools.length },
  );
}

async function runToolAgentInner(input: RunToolAgentInput): Promise<ToolAgentResult> {
  const maxIterations = Math.min(
    Math.max(1, input.maxIterations ?? DEFAULT_MAX_ITERATIONS),
    ITERATION_HARD_CEILING,
  );
  const declarations = input.tools.map((t) => t.declaration);
  const toolMap = new Map(input.tools.map((t) => [t.declaration.name, t]));
  const trace: ToolAgentStep[] = [];
  const messages: AIMessage[] = [{ role: 'user', content: input.userMessage }];

  let lastText = '';

  for (let i = 0; i < maxIterations; i++) {
    const res = await callAIRaw({
      system: input.system,
      messages,
      model: input.model,
      task: input.task,
      tools: declarations,
      signal: input.signal,
    });
    lastText = res.text;

    if (res.functionCalls.length === 0) {
      trace.push({ kind: 'answer', text: res.text.slice(0, 200) });
      return { answer: res.text, trace, iterations: i + 1 };
    }

    // Record the assistant's tool-call turn so the conversation stays coherent.
    const callParts: AIToolPart[] = res.functionCalls.map((fc) => ({
      functionCall: { name: fc.name, args: fc.args },
    }));
    messages.push({ role: 'assistant', content: callParts });

    // Execute each requested tool on-device, collecting functionResponse parts.
    const responseParts: AIToolPart[] = [];
    for (const fc of res.functionCalls) {
      trace.push({ kind: 'call', name: fc.name, args: fc.args });
      const tool = toolMap.get(fc.name);
      let response: Record<string, unknown>;
      if (!tool) {
        response = { error: `unknown tool: ${fc.name}` };
        trace.push({ kind: 'result', name: fc.name, ok: false, preview: 'unknown tool' });
      } else {
        try {
          const out = await tool.execute(fc.args ?? {});
          response = { result: out };
          trace.push({ kind: 'result', name: fc.name, ok: true, preview: preview(out) });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          response = { error: message };
          trace.push({ kind: 'result', name: fc.name, ok: false, preview: message.slice(0, 120) });
        }
      }
      responseParts.push({ functionResponse: { name: fc.name, response } });
    }
    messages.push({ role: 'user', content: responseParts });
  }

  // Iteration cap hit while the model still wanted tools. Force a final,
  // tool-free answer so the caller always gets text rather than a dangling
  // tool request.
  try {
    const forced = await callAIRaw({
      system: input.system,
      messages: [
        ...messages,
        {
          role: 'user',
          content:
            'You have gathered enough information. Answer now in plain text without calling any more tools.',
        },
      ],
      model: input.model,
      task: input.task,
      signal: input.signal,
    });
    if (forced.text) {
      trace.push({ kind: 'answer', text: forced.text.slice(0, 200) });
      return { answer: forced.text, trace, iterations: maxIterations };
    }
  } catch {
    // Fall through to whatever text we last had.
  }

  trace.push({ kind: 'answer', text: lastText.slice(0, 200) });
  return { answer: lastText, trace, iterations: maxIterations };
}
