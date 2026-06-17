/**
 * The mock routine path must honour the user's schedule, same as the real-AI
 * path. Regression for the "wake 10:00 → routine starts at 12:00" bug: the static
 * MOCK_ROUTINE is anchored at 07:00, and the mock branch used to return it raw —
 * bypassing the window + wake-anchor — so a late wake dropped the morning and the
 * day appeared to start at noon.
 */
import { planRoutineAgent } from '@/ai/agent/planner';

const toMin = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

describe('planRoutineAgent — mock path honours wake time', () => {
  const ORIG = process.env.EXPO_PUBLIC_USE_AI_MOCK;
  beforeAll(() => { process.env.EXPO_PUBLIC_USE_AI_MOCK = 'true'; });
  afterAll(() => { process.env.EXPO_PUBLIC_USE_AI_MOCK = ORIG; });

  it('anchors the mock routine to a late wake (10:00) — never starts at noon', async () => {
    const { plan } = await planRoutineAgent({
      wakeTime: '10:00', sleepTime: '22:00', workStartTime: '11:00', workEndTime: '21:00',
    });
    expect(plan.blocks.length).toBeGreaterThan(0);
    // The day begins at wake (the anchor prepends an opening block when the
    // mock's earliest in-window block is later, e.g. the noon lunch).
    expect(plan.blocks[0].startTime).toBe('10:00');
    // Nothing before wake or after sleep.
    for (const b of plan.blocks) {
      expect(toMin(b.startTime)).toBeGreaterThanOrEqual(toMin('10:00'));
      expect(toMin(b.endTime)).toBeLessThanOrEqual(toMin('22:00'));
    }
  });

  it('leaves an early wake (07:00) starting at 07:00', async () => {
    const { plan } = await planRoutineAgent({
      wakeTime: '07:00', sleepTime: '23:00', workStartTime: '09:00', workEndTime: '17:00',
    });
    expect(plan.blocks[0].startTime).toBe('07:00');
  });
});
