import { GoalHierarchySchema, type GoalHierarchy, type GoalInput } from '@/ai/types';
import { decomposeGoal } from '@/ai/functions';
import { schemaValid, check } from '../grader';
import type { EvalSuite } from '../types';

const VALID_TYPES = ['career', 'health', 'finance', 'learning', 'personal'];

const suite: EvalSuite<GoalInput, GoalHierarchy> = {
  name: 'decomposeGoal',
  threshold: 0.9,
  run: decomposeGoal,
  cases: [
    {
      name: 'career-vision',
      input: { visionStatement: 'Become a senior AI engineer at a top lab in 18 months', name: 'Asha' },
      graders: [
        schemaValid(GoalHierarchySchema),
        check('primaryGoal.type valid', (o) => VALID_TYPES.includes(o.primaryGoal.type)),
        check('monthly non-empty', (o) => o.monthly.length > 0, 'monthly array empty'),
        check('weekly non-empty', (o) => o.weekly.length > 0, 'weekly array empty'),
        check('daily examples >= 3', (o) => o.dailyTaskExamples.length >= 3),
        check('primaryGoal.title non-trivial', (o) => o.primaryGoal.title.trim().length >= 5),
      ],
    },
    {
      name: 'health-vision',
      input: { visionStatement: 'Lose 10kg and run a half marathon by next April', name: 'Ravi' },
      graders: [
        schemaValid(GoalHierarchySchema),
        check('monthly non-empty', (o) => o.monthly.length > 0),
        check('yearly milestone present', (o) => o.yearly.milestone.trim().length > 10),
      ],
    },
    {
      name: 'finance-vision',
      input: { visionStatement: 'Save ₹50 lakhs for a home down-payment in 5 years', name: 'Priya' },
      graders: [
        schemaValid(GoalHierarchySchema),
        check('weekly tasks non-empty', (o) => o.weekly.every((w) => w.tasks.length > 0)),
      ],
    },
    {
      name: 'learning-vision',
      input: { visionStatement: 'Become fluent in Spanish in 12 months', name: 'Kabir' },
      graders: [
        schemaValid(GoalHierarchySchema),
        check('daily examples non-trivial', (o) => o.dailyTaskExamples.every((t) => t.length > 10)),
      ],
    },
    {
      name: 'personal-vision',
      input: { visionStatement: 'Read 24 books and journal daily for a year', name: 'Mira' },
      graders: [schemaValid(GoalHierarchySchema)],
    },
  ],
};

export default suite;
