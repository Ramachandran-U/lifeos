import { GoalHierarchy } from '../types';

export const MOCK_GOAL_HIERARCHY: GoalHierarchy = {
  primaryGoal: {
    title: 'Become a Senior Product Manager at a top tech company',
    type: 'career',
  },
  yearly: {
    title: 'Land a Senior PM role',
    milestone: 'Receive and accept an offer for a Senior PM position',
  },
  monthly: [
    { month: 1, title: 'Foundation Building', milestone: 'Complete product strategy course and build first case study' },
    { month: 2, title: 'Portfolio Development', milestone: 'Ship a side project demonstrating PM skills with metrics' },
    { month: 3, title: 'Network & Apply', milestone: 'Complete 10 informational interviews and submit 5 applications' },
  ],
  weekly: [
    {
      week: 1,
      focus: 'Start product strategy fundamentals',
      tasks: [
        'Read chapters 1-3 of "Inspired" by Marty Cagan',
        'Complete Module 1 of Reforge Growth Series',
        'Write a product teardown of a favourite app',
      ],
    },
    {
      week: 2,
      focus: 'Practise structured thinking',
      tasks: [
        'Solve 3 product design interview questions',
        'Read chapters 4-6 of "Inspired"',
        'Analyse competitor landscape for side project idea',
      ],
    },
    {
      week: 3,
      focus: 'Begin side project',
      tasks: [
        'Define PRD for side project',
        'Set up project tracking in Linear',
        'Conduct 3 user interviews',
      ],
    },
    {
      week: 4,
      focus: 'Build and ship MVP',
      tasks: [
        'Build MVP with no-code tool',
        'Run usability tests with 5 users',
        'Write launch retrospective',
      ],
    },
  ],
  dailyTaskExamples: [
    'Read 20 pages of "Inspired" (45 min)',
    'Solve 1 product design question (30 min)',
    'Write user story for side project feature (30 min)',
    'Review 2 product launches on Product Hunt (20 min)',
    'Send 1 LinkedIn message to a PM at target company (15 min)',
  ],
};
