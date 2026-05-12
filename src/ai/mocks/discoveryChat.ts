import type { DiscoveryChatInput, DiscoveryChatTurn } from '../types';

const SCRIPT: Array<(turnIndex: number, lastUser: string) => DiscoveryChatTurn> = [
  () => ({
    nextQuestion: "Hey, I'm LifeOS. What should I call you, and what's the one phrase that describes the season of life you're in right now?",
    patch: {},
    stage: 'identity',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion: 'What are 1–3 things you want to be different about your life 90 days from now? Be as specific as you can.',
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
    nextQuestion: 'What time do you usually wake up and go to bed? And what are your work hours on a typical weekday?',
    patch: {
      vision: { statement: lastUser.slice(0, 200), horizon: '90d', topGoals: [lastUser.slice(0, 80)] },
      confidenceDeltas: { vision: 0.7 },
    },
    stage: 'schedule',
    done: false,
  }),
  () => ({
    nextQuestion: 'Anything immovable in your week — kid pickup, gym class, prayer, a standing meeting? And are you sharper in the morning or later in the day?',
    patch: {
      schedule: { wakeTime: '07:00', sleepTime: '23:00', workStartTime: '09:30', workEndTime: '18:30', fixedBlocks: [] },
      confidenceDeltas: { schedule: 0.6 },
    },
    stage: 'schedule',
    done: false,
  }),
  () => ({
    nextQuestion: "What's a habit you've been holding well, and one you keep dropping?",
    patch: {
      chronotype: 'balanced',
      confidenceDeltas: { schedule: 0.2, chronotype: 0.6 },
    },
    stage: 'habits',
    done: false,
  }),
  (_i, lastUser) => ({
    nextQuestion: "Last one — what do you most want LifeOS to help you with first, and how should I talk to you: direct, warm, playful, or clinical?",
    patch: {
      habits: { current: [lastUser.slice(0, 60)], aspirational: [] },
      constraints: ['no late-night work'],
      confidenceDeltas: { habits: 0.9, constraints: 0.9 },
    },
    stage: 'asks',
    done: false,
  }),
  () => ({
    nextQuestion: '',
    patch: {
      primaryDomains: ['health', 'career'],
      communication: { tone: 'direct', avoid: [] },
      confidenceDeltas: {
        primaryDomains: 1.0,
        identity: 0.3,
        vision: 0.3,
        schedule: 0.4,
        chronotype: 0.4,
      },
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
