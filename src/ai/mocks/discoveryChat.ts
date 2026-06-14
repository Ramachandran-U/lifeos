import type { DiscoveryChatInput, DiscoveryChatTurn } from '../types';

type Domain = 'goals' | 'health' | 'finance' | 'career' | 'social' | 'polymath';

// Cheap keyword → domain mapping so the mock's primaryDomains reflect which areas
// the user said they want to improve (deterministic; mock-mode/e2e only).
function domainsFrom(text: string): Domain[] {
  const t = text.toLowerCase();
  const hits: Domain[] = [];
  const add = (d: Domain) => { if (!hits.includes(d)) hits.push(d); };
  if (/health|fit|gym|sleep|weight|run|strong|energy/.test(t)) add('health');
  if (/money|financ|save|saving|debt|invest|wealth|spend/.test(t)) add('finance');
  if (/career|job|work|promot|role|business/.test(t)) add('career');
  if (/relationship|social|friend|family|partner|people/.test(t)) add('social');
  if (/learn|skill|study|read|curious|language|music|hobby/.test(t)) add('polymath');
  if (/goal|ambition|ship|launch|build|achieve|project/.test(t)) add('goals');
  return hits.length ? hits.slice(0, 3) : ['goals', 'health'];
}

// A ~90-second, AREAS-FIRST onboarding (mirrors the system prompt): one opener
// that grabs name + the life areas they want to improve, a light "what would
// better look like", a quick schedule grab, then done. Four turns.
const SCRIPT: Array<(turnIndex: number, lastUser: string) => DiscoveryChatTurn> = [
  () => ({
    nextQuestion:
      "Hi, I'm LifeOS — I'll keep this quick. What should I call you, and which parts of your life do you most want to improve right now: health, money, career, relationships, learning, or a big personal goal?",
    patch: {},
    stage: 'identity',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion:
      "Got it. For those, what would 'better' look like a few months from now? A rough sense is plenty — no need for exact numbers.",
    patch: {
      identity: { firstName: lastUser.split(/[,.\s]/)[0] || null },
      primaryDomains: domainsFrom(lastUser),
      confidenceDeltas: { identity: 0.6, primaryDomains: 0.85 },
    },
    stage: 'vision',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion:
      'Last quick thing so your plan fits your day — when do you usually wake up and go to bed, and what are your work hours?',
    patch: {
      vision: { statement: lastUser.slice(0, 160), horizon: '90d', topGoals: [] },
      confidenceDeltas: { vision: 0.6 },
    },
    stage: 'schedule',
    done: false,
  }),
  () => ({
    nextQuestion: '',
    patch: {
      schedule: { wakeTime: '07:00', sleepTime: '23:00', workStartTime: '09:30', workEndTime: '18:30', fixedBlocks: [] },
      communication: { tone: 'warm', avoid: [] },
      confidenceDeltas: { schedule: 0.7, overall: 0.3 },
    },
    stage: 'done',
    done: true,
  }),
];

export function buildMockDiscoveryChatTurn(input: DiscoveryChatInput): DiscoveryChatTurn {
  const turnIndex = input.transcript.filter((m) => m.role === 'assistant').length;
  const lastUser = [...input.transcript].reverse().find((m) => m.role === 'user')?.content ?? '';
  const step = SCRIPT[Math.min(turnIndex, SCRIPT.length - 1)];
  return step(turnIndex, lastUser);
}
