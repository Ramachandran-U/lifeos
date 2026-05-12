/**
 * Mid-day re-plan eval. Each case constructs a remaining-day snapshot and runs
 * `replanRemainingDay`. Graders assert the plan is well-formed and that edits
 * target only blocks in the input set.
 */
import { replanRemainingDay } from '@/ai/functions';
import {
  ReplanRemainingDaySchema,
  type ReplanRemainingDay,
  type ReplanRemainingDayInput,
} from '@/ai/types';
import { schemaValid, check, checkWithInput } from '../grader';
import type { EvalSuite } from '../types';

const VALID_MODULES = [
  'goal',
  'health',
  'finance',
  'career',
  'social',
  'polymath',
  'rest',
  'work',
  'meal',
];

function isHHMM(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s);
}

const suite: EvalSuite<ReplanRemainingDayInput, ReplanRemainingDay> = {
  name: 'replanRemainingDay',
  threshold: 0.8,
  run: replanRemainingDay,
  cases: [
    {
      name: 'skipped-workout-retry',
      input: {
        nowHHMM: '13:00',
        remainingBlocks: [
          { id: 'b1', startTime: '13:00', endTime: '14:00', title: 'Lunch + walk', module: 'meal', status: 'upcoming' },
          { id: 'b2', startTime: '14:00', endTime: '17:00', title: 'Deep work — model eval', module: 'career', status: 'upcoming' },
          { id: 'b3', startTime: '17:30', endTime: '18:30', title: 'Strength session', module: 'health', status: 'upcoming' },
        ],
        skippedToday: [{ id: 's1', title: 'Morning run', module: 'health' }],
        primaryDomains: ['health', 'career'],
        chronotype: 'balanced',
        softenForRecovery: false,
      },
      graders: [
        schemaValid(ReplanRemainingDaySchema),
        checkWithInput<ReplanRemainingDay, ReplanRemainingDayInput>(
          'drop ids refer to known blocks',
          (o, input) => {
            const known = new Set(input.remainingBlocks.map((b) => b.id));
            return o.drop.every((id) => known.has(id));
          },
          'drop references unknown id',
        ),
        checkWithInput<ReplanRemainingDay, ReplanRemainingDayInput>(
          'edit ids refer to known blocks',
          (o, input) => {
            const known = new Set(input.remainingBlocks.map((b) => b.id));
            return o.edits.every((e) => known.has(e.id));
          },
        ),
        check('add blocks have valid HH:MM times', (o) => o.add.every((b) => isHHMM(b.startTime) && isHHMM(b.endTime))),
        checkWithInput<ReplanRemainingDay, ReplanRemainingDayInput>(
          'add blocks start no earlier than nowHHMM',
          (o, input) => o.add.every((b) => b.startTime >= input.nowHHMM),
        ),
        check('add modules valid', (o) => o.add.every((b) => VALID_MODULES.includes(b.module))),
        check('rationale non-empty + short', (o) => o.rationale.length > 0 && o.rationale.length <= 160),
      ],
    },
    {
      name: 'soften-for-recovery-drops-heavy',
      input: {
        nowHHMM: '15:00',
        remainingBlocks: [
          { id: 'r1', startTime: '15:30', endTime: '17:00', title: 'HIIT workout', module: 'health', status: 'upcoming' },
          { id: 'r2', startTime: '17:00', endTime: '18:00', title: 'Cold shower + sauna', module: 'health', status: 'upcoming' },
          { id: 'r3', startTime: '19:00', endTime: '20:00', title: 'Dinner with friend', module: 'social', status: 'upcoming' },
        ],
        skippedToday: [],
        primaryDomains: ['health', 'social'],
        chronotype: 'lark',
        softenForRecovery: true,
      },
      graders: [
        schemaValid(ReplanRemainingDaySchema),
        check(
          'soften produces some change',
          (o) => o.drop.length + o.edits.length + o.add.length >= 1,
          'expected at least one mutation when softenForRecovery=true',
        ),
        check(
          'no new high-energy block added',
          (o) => o.add.every((b) => b.energyRequired !== 'high'),
        ),
        check('rationale mentions reason', (o) => o.rationale.length >= 10),
      ],
    },
    {
      name: 'balanced-day-no-changes',
      input: {
        nowHHMM: '11:00',
        remainingBlocks: [
          { id: 'k1', startTime: '11:00', endTime: '12:00', title: 'Reading time', module: 'polymath', status: 'upcoming' },
          { id: 'k2', startTime: '12:00', endTime: '13:00', title: 'Lunch', module: 'meal', status: 'upcoming' },
          { id: 'k3', startTime: '13:00', endTime: '17:00', title: 'Focus block', module: 'work', status: 'upcoming' },
        ],
        skippedToday: [],
        primaryDomains: ['polymath', 'career'],
        chronotype: 'balanced',
        softenForRecovery: false,
      },
      graders: [
        schemaValid(ReplanRemainingDaySchema),
        checkWithInput<ReplanRemainingDay, ReplanRemainingDayInput>(
          'no edits modify completed blocks',
          (o, input) => {
            const completed = new Set(
              input.remainingBlocks.filter((b) => b.status === 'completed').map((b) => b.id),
            );
            return o.edits.every((e) => !completed.has(e.id)) && o.drop.every((id) => !completed.has(id));
          },
        ),
        check('total changes are bounded', (o) => o.drop.length + o.edits.length + o.add.length <= 5),
        check('rationale non-empty', (o) => o.rationale.length > 0),
      ],
    },
  ],
};

export default suite;
