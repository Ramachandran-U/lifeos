import {
  createActionQueue,
  commitActions,
  STALE_REF_ERROR,
  type ProposedAction,
  type CommitDeps,
} from '../agent/actionQueue';

function makeDeps(): CommitDeps & {
  created: unknown[];
  statuses: Array<[string, string]>;
  goals: Array<[string, string]>;
  foods: unknown[];
  weights: unknown[];
  interactions: unknown[];
} {
  const created: unknown[] = [];
  const statuses: Array<[string, string]> = [];
  const goals: Array<[string, string]> = [];
  const foods: unknown[] = [];
  const weights: unknown[] = [];
  const interactions: unknown[] = [];
  return {
    created,
    statuses,
    goals,
    foods,
    weights,
    interactions,
    createRoutineBlock: (d) => created.push(d),
    updateRoutineBlockStatus: (id, status) => statuses.push([id, status]),
    updateGoalStatus: (id, status) => goals.push([id, status]),
    createFoodEntry: (d) => foods.push(d),
    createHealthLog: (d) => weights.push(d),
    logContactInteraction: (d) => interactions.push(d),
    // Default: refs are valid. Stale-ref tests override these.
    routineBlockExists: () => true,
    goalExists: () => true,
    contactExists: () => true,
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

  it('re-validates a block ref at commit time: a vanished block fails and does not mutate', async () => {
    const deps = makeDeps();
    deps.routineBlockExists = (id) => id !== 'gone'; // 'gone' was deleted since the proposal
    const actions: ProposedAction[] = [
      { kind: 'completeBlock', summary: '', payload: { ref: 'gone' } },
      { kind: 'skipBlock', summary: '', payload: { ref: 'here' } },
    ];
    const results = await commitActions(actions, deps);

    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBe(STALE_REF_ERROR);
    expect(results[1].ok).toBe(true);
    // The stale one never reached the DB; only the live one was updated.
    expect(deps.statuses).toEqual([['here', 'skipped']]);
  });

  it('re-validates a goal ref at commit time: a vanished goal fails and does not mutate', async () => {
    const deps = makeDeps();
    deps.goalExists = () => false;
    const results = await commitActions(
      [{ kind: 'adjustGoalStatus', summary: '', payload: { ref: 'g1', status: 'paused' } }],
      deps,
    );

    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBe(STALE_REF_ERROR);
    expect(deps.goals).toEqual([]); // no UPDATE issued
  });

  it('createRoutineBlock needs no ref and is unaffected by the existence checks', async () => {
    const deps = makeDeps();
    deps.routineBlockExists = () => false; // would block ref actions, but create has no ref
    const results = await commitActions(
      [
        {
          kind: 'createRoutineBlock',
          summary: '',
          payload: { date: '2026-06-04', startTime: '09:00', endTime: '09:30', title: 'New', module: 'goal' },
        },
      ],
      deps,
    );
    expect(results[0].ok).toBe(true);
    expect(deps.created).toHaveLength(1);
  });

  it('rejects voice navigation intents — they are handled by the companion, not commit', async () => {
    const deps = makeDeps();
    const results = await commitActions(
      [
        { kind: 'createGoalFromVision', summary: '', payload: { visionStatement: 'run a marathon' } },
        {
          kind: 'generateCareerPath',
          summary: '',
          payload: { currentRole: 'SWE', targetRole: 'EM', timelineMonths: 24 },
        },
      ],
      deps,
    );
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0].error).toMatch(/navigation/);
    expect(results[1].error).toMatch(/navigation/);
    // Nothing was written to the DB.
    expect(deps.created).toEqual([]);
    expect(deps.statuses).toEqual([]);
    expect(deps.goals).toEqual([]);
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
