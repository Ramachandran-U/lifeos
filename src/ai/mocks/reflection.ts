import type { TomorrowTweak, TomorrowTweakInput } from '../types';

type TweakModule = NonNullable<TomorrowTweak['patch']['module']>;
const VALID_MODULES: TweakModule[] = ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal'];
function asModule(m: string): TweakModule {
  return (VALID_MODULES as string[]).includes(m) ? (m as TweakModule) : 'work';
}

export function buildMockTomorrowTweak(input: TomorrowTweakInput): TomorrowTweak {
  const skipped = Object.entries(input.today.blockReviews).filter(([, v]) => v === 'skipped');
  const firstTomorrow = input.tomorrow.blocks[0];

  if (skipped.length > 0 && firstTomorrow) {
    return {
      kind: 'move',
      blockId: firstTomorrow.id,
      patch: { startTime: shiftTime(firstTomorrow.startTime, 30), endTime: shiftTime(firstTomorrow.endTime, 30) },
      rationale: 'You skipped a morning block today — try starting 30 min later tomorrow.',
    };
  }

  if ((input.today.mood ?? 3) <= 2 && firstTomorrow) {
    return {
      kind: 'resize',
      blockId: firstTomorrow.id,
      patch: { endTime: shiftTime(firstTomorrow.endTime, -15) },
      rationale: 'Low energy today — lighten tomorrow\'s first block by 15 minutes.',
    };
  }

  if (firstTomorrow) {
    return {
      kind: 'swap',
      blockId: firstTomorrow.id,
      patch: { title: firstTomorrow.title + ' (focus)', module: asModule(firstTomorrow.module) },
      rationale: 'Solid day — keep the rhythm, add a focus cue to the first block.',
    };
  }

  return {
    kind: 'add',
    blockId: null,
    patch: { startTime: '08:00', endTime: '08:30', title: 'Morning stretch', module: 'health' },
    rationale: 'No plan yet for tomorrow — start with a gentle morning block.',
  };
}

function shiftTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
