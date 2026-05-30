import { pickModel } from '../modelRouter';
import { logAiSuggestion } from '@/db/queries/aiSuggestions';
import { runToolAgent, type ToolAgentStep } from './runtime';
import { buildLifeOsTools } from './tools';
import { buildLifeOsWriteTools } from './writeTools';
import { createActionQueue, type ProposedAction } from './actionQueue';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

const WHAT_NEXT_SYSTEM = `
You are LifeOS's planner. The user asks: "What should I do next to improve my life right now?"

You have read-only tools that see the user's real data: goals, today's routine, recent sleep,
gamification momentum (domain scores + streaks), and overdue social contacts.

How to answer:
- Call the tools you need to ground your answer in their ACTUAL state. Don't guess.
- Start from today's routine: what's the next uncompleted block, and is now a good time for it?
- Adapt to signals: if recent sleep is low, don't push a hard block — suggest something
  restorative and protect tonight's sleep. If a domain score is lagging or a streak is at risk,
  weigh that. If a contact is overdue, a quick reconnect may be the highest-leverage 10 minutes.
- Recommend ONE concrete next action, with a one-sentence reason grounded in what you found.
- Be specific and brief (2-4 sentences). No hype, no lists of options — one clear next step.
`.trim();

export interface WhatNextResult {
  answer: string;
  trace: ToolAgentStep[];
  iterations: number;
}

export interface WhatNextInput {
  userId: string;
  /** yyyy-MM-dd, injected for testability; defaults to today inside the tools. */
  today?: string;
  signal?: AbortSignal;
}

const MOCK_ANSWER =
  'Your next routine block is a 30-minute focus session at 14:00 — start it now. ' +
  "It's your highest-leverage block today and you're on track to keep your learning streak alive.";

/**
 * The "what should I do next?" agent — the product's core question, answered by
 * a tool-using loop that reads the user's real state on-device.
 *
 * Gated by the `agent_what_next` flag (default off). Logs every run to
 * ai_suggestions (task 'what_next') so it's measurable alongside the other AI
 * variants — see migration 0004 for the outcome-tracking model.
 */
export async function whatShouldIDoNext(input: WhatNextInput): Promise<WhatNextResult> {
  if (isMock()) {
    return {
      answer: MOCK_ANSWER,
      trace: [
        { kind: 'call', name: 'getTodayRoutine', args: {} },
        { kind: 'result', name: 'getTodayRoutine', ok: true, preview: 'mock' },
        { kind: 'answer', text: MOCK_ANSWER.slice(0, 200) },
      ],
      iterations: 2,
    };
  }

  const tools = buildLifeOsTools({ userId: input.userId, today: input.today });
  const result = await runToolAgent({
    system: WHAT_NEXT_SYSTEM,
    userMessage: 'What should I do next to improve my life right now?',
    tools,
    model: pickModel('agent.whatNext'),
    task: 'agent.whatNext',
    maxIterations: 6,
    signal: input.signal,
  });

  // Fire-and-forget suggestion log; never block or break the user-facing call.
  void logAiSuggestion({
    userId: input.userId,
    task: 'what_next',
    variant: 'agent',
    input: { question: 'what_next', today: input.today },
    outputSummary: `iterations=${result.iterations} answer_len=${result.answer.length}`,
  }).catch(() => {
    /* outcome logging must never break the agent */
  });

  return result;
}

const WHAT_NEXT_ACTIONS_SYSTEM = `
${WHAT_NEXT_SYSTEM}

You can also PROPOSE actions the user can take, using the propose* tools (add a
routine block, mark a block complete/skipped, adjust a goal). Proposing does NOT
change anything — the user reviews and confirms each proposal afterwards. So:
- Only propose actions that directly follow from what you found. Don't propose
  speculative changes.
- Prefer ONE high-leverage proposal over many. Use refs from getGoals /
  getTodayRoutine to target the right row.
- Your text answer should still recommend the single next action in plain words;
  the proposals are the user's shortcut to act on it.
`.trim();

export interface WhatNextWithActionsResult extends WhatNextResult {
  proposedActions: ProposedAction[];
}

const MOCK_PROPOSAL: ProposedAction = {
  kind: 'createRoutineBlock',
  summary: 'Add "Focus session" (14:00–14:30, goal)',
  payload: { date: '2026-01-01', startTime: '14:00', endTime: '14:30', title: 'Focus session', module: 'goal' },
};

/**
 * "What should I do next?" — variant that can also propose confirmable actions.
 * Returns the same answer/trace plus a list of `proposedActions`. NOTHING is
 * mutated here; the UI renders each proposal as a confirm card and only then
 * calls `commitActions` (see actionQueue.ts).
 */
export async function whatShouldIDoNextWithActions(
  input: WhatNextInput,
): Promise<WhatNextWithActionsResult> {
  if (isMock()) {
    return {
      answer: MOCK_ANSWER,
      trace: [
        { kind: 'call', name: 'getTodayRoutine', args: {} },
        { kind: 'result', name: 'getTodayRoutine', ok: true, preview: 'mock' },
        { kind: 'call', name: 'proposeCreateRoutineBlock', args: {} },
        { kind: 'result', name: 'proposeCreateRoutineBlock', ok: true, preview: 'proposed' },
        { kind: 'answer', text: MOCK_ANSWER.slice(0, 200) },
      ],
      iterations: 2,
      proposedActions: [MOCK_PROPOSAL],
    };
  }

  const queue = createActionQueue();
  const tools = [
    ...buildLifeOsTools({ userId: input.userId, today: input.today }),
    ...buildLifeOsWriteTools({ today: input.today }, queue),
  ];
  const result = await runToolAgent({
    system: WHAT_NEXT_ACTIONS_SYSTEM,
    userMessage: 'What should I do next to improve my life right now?',
    tools,
    model: pickModel('agent.whatNext'),
    task: 'agent.whatNext',
    maxIterations: 6,
    signal: input.signal,
  });

  void logAiSuggestion({
    userId: input.userId,
    task: 'what_next',
    variant: 'agent',
    input: { question: 'what_next_actions', today: input.today },
    outputSummary: `iterations=${result.iterations} proposals=${queue.list().length}`,
  }).catch(() => {
    /* outcome logging must never break the agent */
  });

  return { ...result, proposedActions: queue.list() };
}
