import {
  startExpedition,
  completeStep,
  abandonExpedition,
  canStartExpedition,
  progressFraction,
  mergeExpeditionProgress,
  MAX_ACTIVE_EXPEDITIONS,
  type ExpeditionProgress,
  type Clock,
} from '../expeditions';

let t = 0;
const clock: Clock = {
  now: () => `2026-05-27T00:00:${String(t++).padStart(2, '0')}.000Z`,
  newId: () => `p_${t}`,
};
beforeEach(() => { t = 0; });

function start(expId = 'e1', userId = 'u1') {
  return startExpedition(expId, userId, clock);
}

describe('startExpedition', () => {
  it('creates an active, zero-progress record', () => {
    const p = start();
    expect(p).toMatchObject({ expeditionId: 'e1', userId: 'u1', status: 'active', currentStep: 0, completedSteps: [], completedAt: null });
  });
});

describe('canStartExpedition', () => {
  it('caps active expeditions', () => {
    expect(canStartExpedition(0)).toBe(true);
    expect(canStartExpedition(MAX_ACTIVE_EXPEDITIONS - 1)).toBe(true);
    expect(canStartExpedition(MAX_ACTIVE_EXPEDITIONS)).toBe(false);
  });
});

describe('completeStep', () => {
  it('adds the step, unlocks the next, stays active mid-way', () => {
    let p = start();
    p = completeStep(p, 0, 5, clock);
    expect(p.completedSteps).toEqual([0]);
    expect(p.currentStep).toBe(1);
    expect(p.status).toBe('active');
  });

  it('is idempotent on a repeated step (no duplicate)', () => {
    let p = start();
    p = completeStep(p, 0, 5, clock);
    p = completeStep(p, 0, 5, clock);
    expect(p.completedSteps).toEqual([0]);
  });

  it('allows out-of-order completion via the set', () => {
    let p = start();
    p = completeStep(p, 2, 5, clock);
    p = completeStep(p, 0, 5, clock);
    expect(p.completedSteps).toEqual([0, 2]);
    expect(p.currentStep).toBe(3); // max unlocked
  });

  it('promotes to completed once every step is done and sets completedAt', () => {
    let p = start();
    for (let i = 0; i < 3; i++) p = completeStep(p, i, 3, clock);
    expect(p.status).toBe('completed');
    expect(p.completedAt).not.toBeNull();
    expect(p.completedSteps).toEqual([0, 1, 2]);
  });

  it('ignores invalid indexes and no-ops once completed', () => {
    let p = start();
    p = completeStep(p, -1, 3, clock);
    p = completeStep(p, 9, 3, clock);
    expect(p.completedSteps).toEqual([]);
    for (let i = 0; i < 3; i++) p = completeStep(p, i, 3, clock);
    const done = p;
    p = completeStep(p, 0, 3, clock);
    expect(p).toBe(done); // unchanged reference — no-op after completion
  });
});

describe('abandon / fraction', () => {
  it('abandons an active expedition but not a completed one', () => {
    let p = start();
    p = abandonExpedition(p, clock);
    expect(p.status).toBe('abandoned');
  });
  it('progressFraction reflects completed/total', () => {
    let p = start();
    p = completeStep(p, 0, 4, clock);
    expect(progressFraction(p, 4)).toBe(0.25);
  });
});

describe('mergeExpeditionProgress — conflict-free sync', () => {
  function withSteps(steps: number[], over: Partial<ExpeditionProgress> = {}): ExpeditionProgress {
    return {
      id: 'p1', userId: 'u1', expeditionId: 'e1', status: 'active',
      currentStep: steps.length ? Math.max(...steps) + 1 : 0,
      completedSteps: [...steps].sort((a, b) => a - b),
      startedAt: '2026-05-01T00:00:00.000Z',
      lastActivityAt: '2026-05-01T00:00:00.000Z',
      completedAt: null, updatedAt: '2026-05-01T00:00:00.000Z', ...over,
    };
  }

  it('unions completed steps — no step lost when two devices advance offline', () => {
    const phone = withSteps([0, 1], { lastActivityAt: '2026-05-02T00:00:00.000Z' });
    const laptop = withSteps([0, 2], { lastActivityAt: '2026-05-03T00:00:00.000Z' });
    const merged = mergeExpeditionProgress(phone, laptop);
    expect(merged.completedSteps).toEqual([0, 1, 2]);
    expect(merged.currentStep).toBe(3);
    expect(merged.lastActivityAt).toBe('2026-05-03T00:00:00.000Z');
  });

  it('is commutative', () => {
    const a = withSteps([0, 3], { id: 'a', currentStep: 4 });
    const b = withSteps([1, 2], { id: 'b', currentStep: 3 });
    expect(mergeExpeditionProgress(a, b)).toEqual(mergeExpeditionProgress(b, a));
  });

  it('is idempotent (merge with self is identity)', () => {
    const a = withSteps([0, 1, 2]);
    expect(mergeExpeditionProgress(a, a)).toEqual(a);
  });

  it('completed beats active; active beats abandoned (a resume is not lost)', () => {
    const completed = withSteps([0, 1, 2], { status: 'completed', completedAt: '2026-05-04T00:00:00.000Z' });
    const active = withSteps([0], { status: 'active' });
    expect(mergeExpeditionProgress(completed, active).status).toBe('completed');
    expect(mergeExpeditionProgress(completed, active).completedAt).toBe('2026-05-04T00:00:00.000Z');

    const abandoned = withSteps([0], { status: 'abandoned' });
    expect(mergeExpeditionProgress(active, abandoned).status).toBe('active');
  });

  it('takes earliest start and clears completedAt when not completed', () => {
    const a = withSteps([0], { startedAt: '2026-05-01T00:00:00.000Z' });
    const b = withSteps([1], { startedAt: '2026-04-20T00:00:00.000Z' });
    const merged = mergeExpeditionProgress(a, b);
    expect(merged.startedAt).toBe('2026-04-20T00:00:00.000Z');
    expect(merged.completedAt).toBeNull();
  });
});
