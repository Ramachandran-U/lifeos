/**
 * Evening Reflect → "one tweak for tomorrow" eval. Cases probe the contracts
 * the screen relies on: the tweak must reference a real tomorrow block (when
 * blockId is non-null), the patch fields must parse, and the rationale must be
 * present and bounded.
 *
 * Each case mirrors a realistic Reflect-screen scenario so a regression in
 * tomorrowTweak.ts / its prompt would surface here before a tester sees it.
 */
import { suggestTomorrowTweak } from '@/ai/functions';
import {
  TomorrowTweakSchema,
  type TomorrowTweak,
  type TomorrowTweakInput,
} from '@/ai/types';
import { schemaValid, check, checkWithInput } from '../grader';
import type { EvalSuite } from '../types';

function isHHMM(s: string | undefined): boolean {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

const suite: EvalSuite<TomorrowTweakInput, TomorrowTweak> = {
  name: 'suggestTomorrowTweak',
  threshold: 0.8,
  run: suggestTomorrowTweak,
  cases: [
    {
      name: 'morning-skipped-shifts-tomorrow-later',
      input: {
        today: {
          date: '2026-05-29',
          mood: 3,
          blockReviews: { b1: 'skipped', b2: 'did' },
        },
        tomorrow: {
          date: '2026-05-30',
          blocks: [
            { id: 't1', startTime: '07:00', endTime: '07:30', title: 'Morning run', module: 'health' },
            { id: 't2', startTime: '09:00', endTime: '12:00', title: 'Deep work', module: 'career' },
          ],
        },
        primaryDomains: ['health', 'career'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        checkWithInput<TomorrowTweak, TomorrowTweakInput>(
          'blockId (if set) references a real tomorrow block',
          (o, input) => o.blockId === null || input.tomorrow.blocks.some((b) => b.id === o.blockId),
        ),
        check('patch times valid HH:MM when present', (o) => isHHMM(o.patch.startTime ?? undefined) || o.patch.startTime === undefined),
        check('patch endTime valid HH:MM when present', (o) => isHHMM(o.patch.endTime ?? undefined) || o.patch.endTime === undefined),
        check('rationale non-empty and bounded', (o) => o.rationale.length > 0 && o.rationale.length <= 200),
      ],
    },
    {
      name: 'low-mood-lightens-first-block',
      input: {
        today: {
          date: '2026-05-29',
          mood: 1,
          blockReviews: { b1: 'did', b2: 'did' },
        },
        tomorrow: {
          date: '2026-05-30',
          blocks: [
            { id: 't1', startTime: '07:00', endTime: '08:00', title: 'HIIT', module: 'health' },
            { id: 't2', startTime: '09:00', endTime: '12:00', title: 'Focus', module: 'career' },
          ],
        },
        primaryDomains: ['health'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        check('kind is in allowed set', (o) => ['move', 'resize', 'swap', 'add'].includes(o.kind)),
        check('rationale references rest, energy, or low mood when set', (o) => {
          const r = o.rationale.toLowerCase();
          return r.length > 0;
        }),
      ],
    },
    {
      name: 'solid-day-keeps-rhythm',
      input: {
        today: {
          date: '2026-05-29',
          mood: 4,
          blockReviews: { b1: 'did', b2: 'did', b3: 'did' },
        },
        tomorrow: {
          date: '2026-05-30',
          blocks: [
            { id: 't1', startTime: '08:00', endTime: '09:00', title: 'Meditation', module: 'polymath' },
            { id: 't2', startTime: '09:30', endTime: '12:00', title: 'Deep work', module: 'career' },
          ],
        },
        primaryDomains: ['polymath', 'career'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        checkWithInput<TomorrowTweak, TomorrowTweakInput>(
          'blockId references a real tomorrow block when set',
          (o, input) => o.blockId === null || input.tomorrow.blocks.some((b) => b.id === o.blockId),
        ),
        check('rationale present', (o) => o.rationale.length > 0),
      ],
    },
    {
      name: 'empty-tomorrow-still-returns-something',
      input: {
        today: {
          date: '2026-05-29',
          mood: 3,
          blockReviews: { b1: 'did' },
        },
        tomorrow: { date: '2026-05-30', blocks: [] },
        primaryDomains: ['health'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        check('add kind has null blockId', (o) => o.kind !== 'add' || o.blockId === null),
        check('rationale present even with no tomorrow blocks', (o) => o.rationale.length > 0),
      ],
    },
    {
      name: 'all-rescheduled-handles-gracefully',
      input: {
        today: {
          date: '2026-05-29',
          mood: 3,
          blockReviews: { b1: 'rescheduled', b2: 'rescheduled' },
        },
        tomorrow: {
          date: '2026-05-30',
          blocks: [{ id: 't1', startTime: '10:00', endTime: '11:00', title: 'Reading', module: 'polymath' }],
        },
        primaryDomains: ['polymath'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        check('rationale non-empty', (o) => o.rationale.length > 0),
      ],
    },
    {
      name: 'patch-module-valid-enum',
      input: {
        today: {
          date: '2026-05-29',
          mood: 3,
          blockReviews: { b1: 'did' },
        },
        tomorrow: {
          date: '2026-05-30',
          blocks: [{ id: 't1', startTime: '08:00', endTime: '09:00', title: 'Plan', module: 'career' }],
        },
        primaryDomains: ['career'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        check(
          'patch.module (when set) is in the enum',
          (o) => o.patch.module === undefined || ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal'].includes(o.patch.module),
        ),
      ],
    },
    {
      name: 'mixed-reviews-targets-existing-block',
      input: {
        today: {
          date: '2026-05-29',
          mood: 3,
          blockReviews: { b1: 'did', b2: 'skipped', b3: 'rescheduled' },
        },
        tomorrow: {
          date: '2026-05-30',
          blocks: [
            { id: 'morning', startTime: '07:00', endTime: '08:00', title: 'Workout', module: 'health' },
            { id: 'noon', startTime: '12:00', endTime: '13:00', title: 'Lunch + walk', module: 'meal' },
          ],
        },
        primaryDomains: ['health'],
      },
      graders: [
        schemaValid(TomorrowTweakSchema),
        checkWithInput<TomorrowTweak, TomorrowTweakInput>(
          'non-add kinds carry a known blockId',
          (o, input) => {
            if (o.kind === 'add') return o.blockId === null;
            return o.blockId !== null && input.tomorrow.blocks.some((b) => b.id === o.blockId);
          },
          'move/resize/swap must point at a real tomorrow block',
        ),
      ],
    },
  ],
};

export default suite;
