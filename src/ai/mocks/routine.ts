import { GeneratedRoutine } from '../types';

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
