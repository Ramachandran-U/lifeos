import { buildLifeOsWriteTools } from '../agent/writeTools';
import { createActionQueue } from '../agent/actionQueue';

function toolMap(today?: string) {
  const queue = createActionQueue();
  const tools = buildLifeOsWriteTools({ today }, queue);
  const map = new Map(tools.map((t) => [t.declaration.name, t]));
  return { queue, map };
}

describe('buildLifeOsWriteTools', () => {
  it('proposeCreateRoutineBlock enqueues a proposal and never mutates', async () => {
    const { queue, map } = toolMap('2026-05-30');
    const out = await map.get('proposeCreateRoutineBlock')!.execute({
      startTime: '14:00',
      endTime: '14:30',
      title: 'Focus',
      module: 'goal',
    });
    expect(out).toEqual({ proposed: true });
    expect(queue.list()).toEqual([
      {
        kind: 'createRoutineBlock',
        summary: 'Add "Focus" (14:00–14:30, goal)',
        payload: { date: '2026-05-30', startTime: '14:00', endTime: '14:30', title: 'Focus', module: 'goal', notes: undefined },
      },
    ]);
  });

  it('proposeCreateRoutineBlock rejects missing required args without enqueuing', async () => {
    const { queue, map } = toolMap();
    const out = await map.get('proposeCreateRoutineBlock')!.execute({ title: 'x' });
    expect(out).toMatchObject({ proposed: false });
    expect(queue.list()).toHaveLength(0);
  });

  it('proposeCompleteBlock and proposeSkipBlock target a ref', async () => {
    const { queue, map } = toolMap();
    await map.get('proposeCompleteBlock')!.execute({ ref: 'b1' });
    await map.get('proposeSkipBlock')!.execute({ ref: 'b2' });
    expect(queue.list()).toEqual([
      { kind: 'completeBlock', summary: 'Mark a block complete', payload: { ref: 'b1' } },
      { kind: 'skipBlock', summary: 'Mark a block skipped', payload: { ref: 'b2' } },
    ]);
  });

  it('proposeAdjustGoalStatus validates the status enum', async () => {
    const { queue, map } = toolMap();
    const bad = await map.get('proposeAdjustGoalStatus')!.execute({ ref: 'g1', status: 'banana' });
    expect(bad).toMatchObject({ proposed: false });
    expect(queue.list()).toHaveLength(0);

    const ok = await map.get('proposeAdjustGoalStatus')!.execute({ ref: 'g1', status: 'paused' });
    expect(ok).toEqual({ proposed: true });
    expect(queue.list()).toEqual([
      { kind: 'adjustGoalStatus', summary: 'Set a goal to "paused"', payload: { ref: 'g1', status: 'paused' } },
    ]);
  });
});
