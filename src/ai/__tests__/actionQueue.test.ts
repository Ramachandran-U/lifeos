import { createActionQueue, commitActions, type ProposedAction, type CommitDeps } from '../agent/actionQueue';

function makeDeps(): CommitDeps & {
  created: unknown[];
  statuses: Array<[string, string]>;
  goals: Array<[string, string]>;
} {
  const created: unknown[] = [];
  const statuses: Array<[string, string]> = [];
  const goals: Array<[string, string]> = [];
  return {
    created,
    statuses,
    goals,
    createRoutineBlock: (d) => created.push(d),
    updateRoutineBlockStatus: (id, status) => statuses.push([id, status]),
    updateGoalStatus: (id, status) => goals.push([id, status]),
  };
}

describe('createActionQueue', () => {
  it('collects proposals in order and returns a copy', () => {
    const q = createActionQueue();
    q.propose({ kind: 'completeBlock', summary: 'x', payload: { ref: 'b1' } });
    q.propose({ kind: 'skipBlock', summary: 'y', payload: { ref: 'b2' } });
    const list = q.list();
    expect(list.map((a) => a.kind)).toEqual(['completeBlock', 'skipBlock']);
    // list() returns a copy — mutating it doesn't affect the queue
    list.pop();
    expect(q.list()).toHaveLength(2);
  });
});

describe('commitActions', () => {
  it('maps each action kind to the correct DB call with correct args', async () => {
    const deps = makeDeps();
    const actions: ProposedAction[] = [
      {
        kind: 'createRoutineBlock',
        summary: '',
        payload: { date: '2026-05-30', startTime: '14:00', endTime: '14:30', title: 'Focus', module: 'goal' },
      },
      { kind: 'completeBlock', summary: '', payload: { ref: 'b1' } },
      { kind: 'skipBlock', summary: '', payload: { ref: 'b2' } },
      { kind: 'adjustGoalStatus', summary: '', payload: { ref: 'g1', status: 'completed' } },
    ];
    const results = await commitActions(actions, deps);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(deps.created).toEqual([
      { date: '2026-05-30', startTime: '14:00', endTime: '14:30', title: 'Focus', module: 'goal' },
    ]);
    expect(deps.statuses).toEqual([
      ['b1', 'completed'],
      ['b2', 'skipped'],
    ]);
    expect(deps.goals).toEqual([['g1', 'completed']]);
  });

  it('isolates failures: one throwing action does not abort the rest', async () => {
    const deps = makeDeps();
    deps.updateRoutineBlockStatus = (id) => {
      if (id === 'bad') throw new Error('stale ref');
      deps.statuses.push([id, 'completed']);
    };
    const actions: ProposedAction[] = [
      { kind: 'completeBlock', summary: '', payload: { ref: 'bad' } },
      { kind: 'completeBlock', summary: '', payload: { ref: 'good' } },
    ];
    const results = await commitActions(actions, deps);

    expect(results[0].ok).toBe(false);
    expect(results[0].error).toMatch(/stale ref/);
    expect(results[1].ok).toBe(true);
    expect(deps.statuses).toEqual([['good', 'completed']]);
  });
});
