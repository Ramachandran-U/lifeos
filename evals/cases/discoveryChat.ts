/**
 * Discovery chat replay eval. Each case is a scripted user transcript;
 * the runner feeds turns one-by-one into `discoveryChatTurn`, merges patches
 * into the running profile, and stops when the AI says done (or after the
 * scripted turns run out). Graders inspect the final profile shape.
 *
 * In MOCK mode (default) the mock script always advances through identity →
 * vision → schedule → habits → asks regardless of message content — so this
 * exercises wiring and merge logic. Run with `EVAL_REAL=true` for true model
 * regression signal.
 */
import { discoveryChatTurn } from '@/ai/functions';
import { mergeProfilePatch } from '@/ai/profileMerge';
import {
  emptyUserProfile,
  ROUTINE_CONFIDENCE_THRESHOLD,
  UserProfileSchema,
  type UserProfile,
} from '@/ai/types';
import { schemaValid, check } from '../grader';
import type { EvalSuite } from '../types';

interface ChatScenario {
  userTurns: string[];
  /** Max turns before we stop replaying — safety net for live mode. */
  maxTurns?: number;
}

async function runDiscovery(input: ChatScenario): Promise<UserProfile> {
  let profile = emptyUserProfile('chat');
  const transcript: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const cap = input.maxTurns ?? input.userTurns.length;

  for (let i = 0; i < cap; i++) {
    const userMsg = input.userTurns[i];
    if (!userMsg) break;
    transcript.push({ role: 'user', content: userMsg });
    const turn = await discoveryChatTurn({ profile, transcript });
    profile = mergeProfilePatch(profile, turn.patch);
    if (turn.nextQuestion) {
      transcript.push({ role: 'assistant', content: turn.nextQuestion });
    }
    if (turn.done) break;
  }
  return profile;
}

const suite: EvalSuite<ChatScenario, UserProfile> = {
  name: 'discoveryChat',
  threshold: 0.8,
  run: runDiscovery,
  cases: [
    {
      name: 'career-switcher-morning-lark',
      input: {
        userTurns: [
          "I'm Asha, 32, in the middle of switching from marketing to data science.",
          'Land a junior DS role in 6 months and feel less anxious about it.',
          'Wake around 5:30, sleep by 22:00. Day job 09:00–18:00.',
          'Kid pickup at 16:30 Tue/Thu. Sharpest first thing in the morning.',
          "I'm holding a daily 30-min reading habit; I keep dropping the gym after work.",
          'Career and health, mostly.',
          'Direct tone please — no fluff.',
        ],
      },
      graders: [
        schemaValid(UserProfileSchema),
        check('identity.firstName captured', (p) => Boolean(p.identity.firstName)),
        check('vision statement non-trivial', (p) => (p.vision.statement ?? '').length >= 8),
        check('wakeTime set', (p) => p.schedule.wakeTime !== null),
        check('sleepTime set', (p) => p.schedule.sleepTime !== null),
        check(
          'overall confidence >= threshold',
          (p) => p.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD,
          'profile not ready to unlock routine',
        ),
        check('source = chat', (p) => p.source === 'chat'),
      ],
    },
    {
      name: 'new-parent-night-owl',
      input: {
        userTurns: [
          "Hi, Ravi here — first-time dad to a 4-month-old.",
          'I want to feel less wrecked and actually have one focused work block a day.',
          'Wake 07:00 (with the baby), sleep 23:30. Work 10:00–19:00, mostly remote.',
          'Bedtime routine 19:30–20:30 every night, no exceptions. Brain only really turns on after 21:00.',
          'I journal in fits and starts. I keep meaning to walk daily.',
          'Health and goals first.',
          'Warm tone, please — I am barely hanging on.',
        ],
      },
      graders: [
        schemaValid(UserProfileSchema),
        check('identity.firstName captured', (p) => Boolean(p.identity.firstName)),
        check('vision statement non-empty', (p) => (p.vision.statement ?? '').length > 0),
        check('schedule wake+sleep both set', (p) => p.schedule.wakeTime !== null && p.schedule.sleepTime !== null),
        check(
          'communication.tone in v1 enum',
          (p) => p.communication.tone === null || ['direct', 'warm', 'playful', 'clinical'].includes(p.communication.tone),
        ),
        check('primaryDomains <= 3', (p) => p.primaryDomains.length <= 3),
        check(
          'overall confidence >= threshold',
          (p) => p.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD,
        ),
      ],
    },
    {
      name: 'minimal-effort-vague-answers',
      input: {
        userTurns: [
          'Mira',
          'idk, just be healthier I guess',
          '7am to 11pm. 9-5.',
          'nothing fixed',
          'i drink water sometimes',
          'health',
          'whatever, just go',
        ],
      },
      graders: [
        schemaValid(UserProfileSchema),
        // With vague answers the AI is allowed to land below threshold — we just
        // want to confirm the profile is well-formed and didn't crash.
        check('identity.firstName captured', (p) => Boolean(p.identity.firstName)),
        check('topGoals length <= 5', (p) => p.vision.topGoals.length <= 5),
        check('values length <= 5', (p) => p.values.length <= 5),
        check('confidence.overall is bounded', (p) => p.confidence.overall >= 0 && p.confidence.overall <= 1),
      ],
    },
  ],
};

export default suite;
