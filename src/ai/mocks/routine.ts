import type {
  GeneratedRoutine,
  ReplanRemainingDay,
  ReplanRemainingDayInput,
  GenerateTomorrowRoutineInput,
} from '../types';

export const MOCK_ROUTINE: GeneratedRoutine = {
  blocks: [
    { startTime: '07:00', endTime: '07:30', title: 'Morning Routine & Stretch', module: 'health', energyRequired: 'low' },
    { startTime: '07:30', endTime: '08:00', title: 'Breakfast', module: 'meal', energyRequired: 'low' },
    { startTime: '08:00', endTime: '09:00', title: 'Deep Work — Career Learning', module: 'career', energyRequired: 'high' },
    { startTime: '09:00', endTime: '12:00', title: 'Work Block', module: 'work', energyRequired: 'high' },
    { startTime: '12:00', endTime: '12:30', title: 'Lunch', module: 'meal', energyRequired: 'low' },
    { startTime: '12:30', endTime: '13:00', title: 'Walk & Recharge', module: 'health', energyRequired: 'low' },
    { startTime: '13:00', endTime: '17:00', title: 'Work Block', module: 'work', energyRequired: 'medium' },
    { startTime: '17:00', endTime: '17:30', title: 'Goal Task — Daily Action', module: 'goal', energyRequired: 'medium' },
    { startTime: '17:30', endTime: '18:30', title: 'Workout', module: 'health', energyRequired: 'high' },
    { startTime: '18:30', endTime: '19:00', title: 'Dinner', module: 'meal', energyRequired: 'low' },
    { startTime: '19:00', endTime: '19:30', title: 'Exploration Time', module: 'polymath', energyRequired: 'medium' },
    { startTime: '19:30', endTime: '20:00', title: 'Social Check-in', module: 'social', energyRequired: 'low' },
    { startTime: '20:00', endTime: '22:00', title: 'Free Time & Wind Down', module: 'rest', energyRequired: 'low' },
  ],
  briefing: 'Your day starts with a focused career learning session while energy is high, followed by a productive work block. The afternoon balances your goal tasks with exercise, and the evening has time for exploration and social connection.',
};

export function buildMockReplanRemainingDay(input: ReplanRemainingDayInput): ReplanRemainingDay {
  const skipped = input.skippedToday[0];
  if (input.softenForRecovery) {
    const heavy = input.remainingBlocks.filter(
      (b) => b.title.toLowerCase().includes('workout') || b.module === 'career',
    );
    return {
      drop: heavy.map((b) => b.id),
      edits: [],
      add: heavy.length
        ? [{
            startTime: heavy[0].startTime,
            endTime: heavy[0].endTime,
            title: 'Easy walk + reset',
            module: 'rest',
            energyRequired: 'low',
          }]
        : [],
      rationale: 'Lower-energy day — swapped the hard blocks for a recovery walk.',
    };
  }
  if (skipped && input.remainingBlocks[0]) {
    return {
      drop: [],
      edits: [{ id: input.remainingBlocks[0].id, title: `${skipped.title} (retry)` }],
      add: [],
      rationale: `Re-tried the ${skipped.title.toLowerCase()} you missed in the next slot.`,
    };
  }
  return { drop: [], edits: [], add: [], rationale: 'Day is on track — no changes.' };
}

export function buildMockTomorrowRoutine(input: GenerateTomorrowRoutineInput): GeneratedRoutine {
  const soft = input.softenForRecovery;
  const blocks = soft ? MOCK_ROUTINE.blocks.filter((b) => b.energyRequired !== 'high') : MOCK_ROUTINE.blocks;
  const miss = input.todayReview.skippedTitles[0];
  const win = input.todayReview.completedTitles[0];
  const briefing = miss
    ? `Today you missed "${miss}" — tomorrow it's shorter and earlier so it actually happens.`
    : win
    ? `Strong day today — "${win}" stays in tomorrow's plan.`
    : 'A balanced day. Start with the deep-work block before the rest of the world wakes up.';
  return { blocks, briefing };
}

import { addDays, format } from 'date-fns';
import type { GeneratedWeekRoutine, GenerateWeekRoutineInput } from '../types';

const WEEKDAY_TEMPLATE: GeneratedRoutine['blocks'] = [
  { startTime: '07:00', endTime: '07:30', title: 'Morning routine + stretch', module: 'health', energyRequired: 'low' },
  { startTime: '07:30', endTime: '08:00', title: 'Breakfast', module: 'meal', energyRequired: 'low' },
  { startTime: '08:00', endTime: '09:00', title: 'Deep work', module: 'career', energyRequired: 'high' },
  { startTime: '09:00', endTime: '12:00', title: 'Work block', module: 'work', energyRequired: 'high' },
  { startTime: '12:00', endTime: '12:30', title: 'Lunch', module: 'meal', energyRequired: 'low' },
  { startTime: '13:00', endTime: '17:00', title: 'Work block', module: 'work', energyRequired: 'medium' },
  { startTime: '17:30', endTime: '18:30', title: 'Workout', module: 'health', energyRequired: 'high' },
  { startTime: '19:00', endTime: '19:30', title: 'Goal task', module: 'goal', energyRequired: 'medium' },
  { startTime: '20:00', endTime: '22:00', title: 'Wind down', module: 'rest', energyRequired: 'low' },
];

const WEEKEND_TEMPLATE: GeneratedRoutine['blocks'] = [
  { startTime: '08:00', endTime: '08:30', title: 'Slow morning', module: 'rest', energyRequired: 'low' },
  { startTime: '09:00', endTime: '10:00', title: 'Workout', module: 'health', energyRequired: 'medium' },
  { startTime: '10:30', endTime: '12:00', title: 'Polymath time', module: 'polymath', energyRequired: 'medium' },
  { startTime: '12:30', endTime: '13:30', title: 'Lunch with family', module: 'social', energyRequired: 'low' },
  { startTime: '14:00', endTime: '16:00', title: 'Personal project', module: 'goal', energyRequired: 'medium' },
  { startTime: '19:00', endTime: '20:30', title: 'Social block', module: 'social', energyRequired: 'low' },
];

export function buildMockWeekRoutine(input: GenerateWeekRoutineInput): GeneratedWeekRoutine {
  const start = new Date(input.startDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const date = format(d, 'yyyy-MM-dd');
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const template = isWeekend ? WEEKEND_TEMPLATE : WEEKDAY_TEMPLATE;
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek];
    return {
      date,
      dayOfWeek,
      blocks: template.map((b) => ({ ...b })),
      briefing: isWeekend
        ? `${dayName} stays light — protect your recovery and one creative block.`
        : `${dayName} runs hot in the morning with deep work, then tapers — one solid goal block locks in the win.`,
    };
  });
  return {
    weeklyOutline:
      'Front-loaded week with Mon/Tue deep-work peaks; midweek balances goal + health; weekend keeps it light with social and polymath time.',
    days,
  };
}
