import type { DiscoveryChatInput, DiscoveryChatTurn } from '../types';

type Domain = 'goals' | 'health' | 'finance' | 'career' | 'social' | 'polymath';

// Cheap keyword → domain mapping so the mock's primaryDomains reflect what the
// user actually said they care about (deterministic; mock-mode/e2e only).
function domainsFrom(text: string): Domain[] {
  const t = text.toLowerCase();
  const hits: Domain[] = [];
  const add = (d: Domain) => { if (!hits.includes(d)) hits.push(d); };
  if (/health|fit|gym|sleep|weight|run|strong/.test(t)) add('health');
  if (/money|financ|save|saving|debt|invest|wealth/.test(t)) add('finance');
  if (/career|job|work|promot|role|business/.test(t)) add('career');
  if (/relationship|social|friend|family|partner|people/.test(t)) add('social');
  if (/learn|skill|study|read|curious|language|music/.test(t)) add('polymath');
  if (/goal|ambition|ship|launch|build|achieve/.test(t)) add('goals');
  return hits.length ? hits.slice(0, 3) : ['goals', 'health'];
}

function toneFrom(text: string): 'direct' | 'warm' | 'playful' | 'clinical' {
  if (/warm/i.test(text)) return 'warm';
  if (/playful/i.test(text)) return 'playful';
  if (/clinical/i.test(text)) return 'clinical';
  return 'direct';
}

// Mock conversation mirrors the goal-first onboarding flow in the system prompt:
// identity → priorities & concrete goals (vision) → schedule → habits → asks.
const SCRIPT: Array<(turnIndex: number, lastUser: string) => DiscoveryChatTurn> = [
  () => ({
    nextQuestion:
      "Welcome to LifeOS — I'll get you set up in a few quick questions. What should I call you, and what's the season of life you're in right now?",
    patch: {},
    stage: 'identity',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion:
      'Which areas matter most to you right now — your goals & ambitions, health, money, career, relationships, or learning? Pick the one or two you most want to move.',
    patch: {
      identity: {
        firstName: lastUser.split(/[,.\s]/)[0] || null,
        seasonOfLife: lastUser.length > 4 ? lastUser.slice(0, 60) : null,
      },
      confidenceDeltas: { identity: 0.7 },
    },
    stage: 'vision',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion:
      "Great. For those, what's one concrete thing you want to achieve in the next 90 days? The more specific the better — a number or a finish line beats a vibe.",
    patch: {
      primaryDomains: domainsFrom(lastUser),
      confidenceDeltas: { primaryDomains: 0.8 },
    },
    stage: 'vision',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion:
      'Love it. What time do you usually wake and sleep, and what are your work hours on a normal weekday? Flag anything immovable too — pickup, class, prayer, a standing meeting.',
    patch: {
      vision: {
        statement: lastUser.slice(0, 200),
        horizon: '90d',
        topGoals: [lastUser.slice(0, 80)],
      },
      confidenceDeltas: { vision: 0.8 },
    },
    stage: 'schedule',
    done: false,
  }),
  () => ({
    nextQuestion:
      "One habit you've been holding well lately, and one you keep dropping? And are you sharper in the morning or later in the day?",
    patch: {
      schedule: { wakeTime: '07:00', sleepTime: '23:00', workStartTime: '09:30', workEndTime: '18:30', fixedBlocks: [] },
      confidenceDeltas: { schedule: 0.8 },
    },
    stage: 'habits',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion:
      'Last thing — what do you want LifeOS to help you with first, and how should I talk to you: direct, warm, playful, or clinical?',
    patch: {
      chronotype: 'balanced',
      habits: { current: [lastUser.slice(0, 60)], aspirational: [] },
      confidenceDeltas: { chronotype: 0.6, habits: 0.8 },
    },
    stage: 'asks',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion: '',
    patch: {
      communication: { tone: toneFrom(lastUser), avoid: [] },
      confidenceDeltas: { identity: 0.3, vision: 0.3, schedule: 0.3, overall: 0.2 },
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
