/**
 * Today screen morning briefing eval. The briefing is 1-3 short lines the user
 * reads first thing — small surface, easy to regress on tone/grammar/length.
 *
 * Cases cover the realistic Today-screen states: brand-new user, user with a
 * life goal, user with overdue contacts, user with no plan, user with all
 * inputs present. Graders enforce the contract the screen depends on
 * (line count, grammar, presence of headline content).
 */
import { generateDailyBriefing } from '@/ai/functions';
import {
  DailyBriefingSchema,
  type DailyBriefingInput,
  type DailyBriefingResult,
} from '@/ai/types';
import { schemaValid, check, checkWithInput } from '../grader';
import type { EvalSuite } from '../types';

const base: DailyBriefingInput = {
  name: null,
  topGoal: null,
  blocksToday: 0,
  overdueContacts: 0,
  lifeScore: 0,
  lifeScoreBand: 'Starting',
  weeklyInsight: null,
  topDomainYesterday: null,
};

const suite: EvalSuite<DailyBriefingInput, DailyBriefingResult> = {
  name: 'dailyBriefing',
  threshold: 0.8,
  run: generateDailyBriefing,
  cases: [
    {
      name: 'brand-new-user-empty-state',
      input: base,
      graders: [
        schemaValid(DailyBriefingSchema),
        check('at least one line', (o) => o.lines.length >= 1),
        check('every line non-empty', (o) => o.lines.every((l) => l.trim().length > 0)),
        check('no placeholder text leaks', (o) => o.lines.every((l) => !/\{|TODO|null|undefined/i.test(l))),
      ],
    },
    {
      name: 'goal-anchored-headline',
      input: { ...base, name: 'Alex', topGoal: 'Run a sub-4h marathon', blocksToday: 3 },
      graders: [
        schemaValid(DailyBriefingSchema),
        checkWithInput<DailyBriefingResult, DailyBriefingInput>(
          'headline mentions the goal',
          (o, input) => o.lines.some((l) => l.includes(input.topGoal!)),
        ),
        check('respects 3-line cap', (o) => o.lines.length <= 3),
      ],
    },
    {
      name: 'overdue-contacts-surfaced',
      input: { ...base, blocksToday: 2, overdueContacts: 3 },
      graders: [
        schemaValid(DailyBriefingSchema),
        check(
          'some line mentions overdue count',
          (o) => o.lines.some((l) => /3\s/.test(l) || /three/i.test(l) || /overdue|hello|reach out/i.test(l)),
          'expected a line about reaching out to overdue contacts',
        ),
      ],
    },
    {
      name: 'weekly-insight-passes-through-when-no-overdue',
      input: { ...base, blocksToday: 2, overdueContacts: 0, weeklyInsight: 'You finished most blocks on Tuesdays last week.' },
      graders: [
        schemaValid(DailyBriefingSchema),
        check(
          'weekly insight surfaces verbatim or referenced',
          (o) => o.lines.some((l) => l.includes('Tuesday') || /finish|most blocks/i.test(l)),
        ),
      ],
    },
    {
      name: 'singular-block-grammar',
      input: { ...base, blocksToday: 1 },
      graders: [
        schemaValid(DailyBriefingSchema),
        check(
          'singular grammar — never "1 blocks"',
          (o) => !o.lines.some((l) => /\b1\s+blocks\b/i.test(l)),
          '"1 blocks" is wrong — should be "1 block"',
        ),
      ],
    },
    {
      name: 'plural-block-grammar',
      input: { ...base, blocksToday: 5 },
      graders: [
        schemaValid(DailyBriefingSchema),
        check(
          'plural grammar — never "5 block "',
          (o) => !o.lines.some((l) => /\b5\s+block\s/i.test(l)),
        ),
      ],
    },
    {
      name: 'lifescore-mentioned-when-room',
      input: { ...base, blocksToday: 1, lifeScore: 72, lifeScoreBand: 'Building' },
      graders: [
        schemaValid(DailyBriefingSchema),
        check(
          'third line references the score or band when 2 prior lines are present',
          (o) => o.lines.length < 3 || o.lines.some((l) => /72|building|life score/i.test(l)),
        ),
      ],
    },
    {
      name: 'name-injection-safe',
      input: { ...base, name: '<script>alert(1)</script>', blocksToday: 1 },
      graders: [
        schemaValid(DailyBriefingSchema),
        check(
          'no executable HTML escapes through',
          (o) => o.lines.every((l) => !/<script>/i.test(l)),
          'should sanitize or leave as plain text — never produce executable HTML',
        ),
      ],
    },
    {
      name: 'all-inputs-present-respects-cap',
      input: {
        name: 'Sam',
        topGoal: 'Ship LifeOS to beta',
        blocksToday: 4,
        overdueContacts: 2,
        lifeScore: 65,
        lifeScoreBand: 'Building',
        weeklyInsight: 'Mornings are your strongest focus window.',
        topDomainYesterday: 'career',
      },
      graders: [
        schemaValid(DailyBriefingSchema),
        check('respects 3-line max', (o) => o.lines.length <= 3),
        check('at least one line', (o) => o.lines.length >= 1),
      ],
    },
  ],
};

export default suite;
