import { GeneratedRoutineSchema, type GeneratedRoutine, type RoutineInput } from '@/ai/types';
import { generateRoutine } from '@/ai/functions';
import { schemaValid, check } from '../grader';
import type { EvalSuite } from '../types';

const VALID_MODULES = ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal'];
const HHMM = /^\d{2}:\d{2}$/;

const suite: EvalSuite<RoutineInput, GeneratedRoutine> = {
  name: 'generateRoutine',
  threshold: 1.0,
  run: generateRoutine,
  cases: [
    {
      name: 'standard-9to6',
      input: {
        wakeTime: '06:30',
        sleepTime: '22:30',
        workStartTime: '09:00',
        workEndTime: '18:00',
        goals: ['Become a senior AI engineer', 'Run a half marathon'],
        careerFocus: 'Machine learning systems',
      },
      graders: [
        schemaValid(GeneratedRoutineSchema),
        check('blocks non-empty', (o) => o.blocks.length >= 4),
        check('all times HH:MM', (o) => o.blocks.every((b) => HHMM.test(b.startTime) && HHMM.test(b.endTime))),
        check('start < end per block', (o) => o.blocks.every((b) => b.startTime < b.endTime)),
        check('all modules valid', (o) => o.blocks.every((b) => VALID_MODULES.includes(b.module))),
        check('briefing non-trivial', (o) => o.briefing.trim().length >= 20),
      ],
    },
    {
      name: 'early-riser',
      input: {
        wakeTime: '05:00',
        sleepTime: '21:30',
        workStartTime: '08:00',
        workEndTime: '16:00',
      },
      graders: [
        schemaValid(GeneratedRoutineSchema),
        check('blocks non-empty', (o) => o.blocks.length > 0),
      ],
    },
  ],
};

export default suite;
