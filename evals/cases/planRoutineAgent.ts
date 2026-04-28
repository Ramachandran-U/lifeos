import { planRoutineAgent, type PlanRoutineAgentInput, type AgentResult } from '@/ai/agent/planner';
import { GeneratedRoutineSchema } from '@/ai/types';
import { check } from '../grader';
import type { EvalSuite } from '../types';

const HHMM = /^\d{2}:\d{2}$/;
const VALID_MODULES = ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal'];

const suite: EvalSuite<PlanRoutineAgentInput, AgentResult> = {
  name: 'planRoutineAgent',
  threshold: 1.0,
  run: planRoutineAgent,
  cases: [
    {
      name: 'with-context',
      input: {
        wakeTime: '06:30',
        sleepTime: '22:30',
        workStartTime: '09:00',
        workEndTime: '18:00',
        goals: ['Become a senior AI engineer', 'Run a half marathon'],
        careerFocus: 'ML systems',
        contextItems: [
          { id: 'e1', text: 'Skipped morning workout 3 days in a row' },
          { id: 'e2', text: 'Deep work session on transformer paper went well' },
          { id: 'e3', text: 'Felt drained after evening calls' },
        ],
      },
      graders: [
        check<AgentResult>('plan schema valid', (r) => GeneratedRoutineSchema.safeParse(r.plan).success),
        check<AgentResult>('trace has retrieve step', (r) => r.trace.some((s) => s.kind === 'retrieve')),
        check<AgentResult>('trace has propose step', (r) => r.trace.some((s) => s.kind === 'propose')),
        check<AgentResult>('trace has critique step', (r) => r.trace.some((s) => s.kind === 'critique')),
        check<AgentResult>('trace has commit step', (r) => r.trace.some((s) => s.kind === 'commit')),
        check<AgentResult>('retrieve returned at least 1 hit when context provided', (r) => {
          const ret = r.trace.find((s) => s.kind === 'retrieve') as Extract<AgentResult['trace'][number], { kind: 'retrieve' }>;
          return ret.hits.length >= 1;
        }),
        check<AgentResult>(
          'all blocks valid time format and module',
          (r) =>
            r.plan.blocks.every(
              (b) => HHMM.test(b.startTime) && HHMM.test(b.endTime) && b.startTime < b.endTime && VALID_MODULES.includes(b.module),
            ),
        ),
      ],
    },
    {
      name: 'no-context',
      input: {
        wakeTime: '07:00',
        sleepTime: '23:00',
        workStartTime: '09:30',
        workEndTime: '18:30',
        goals: ['Read 24 books this year'],
      },
      graders: [
        check<AgentResult>('briefing non-empty', (r) => r.plan.briefing.trim().length >= 10),
        check<AgentResult>('plan schema valid', (r) => GeneratedRoutineSchema.safeParse(r.plan).success),
        check<AgentResult>('trace has 4 step kinds', (r) => {
          const kinds = new Set(r.trace.map((s) => s.kind));
          return kinds.has('retrieve') && kinds.has('propose') && kinds.has('critique') && kinds.has('commit');
        }),
      ],
    },
  ],
};

export default suite;
