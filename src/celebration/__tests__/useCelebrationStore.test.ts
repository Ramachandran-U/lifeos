import { setFlagOverride, resetFlagOverrides } from '@/config/flags';
import { useCelebrationStore, celebrate } from '../useCelebrationStore';

function drainAll() {
  const store = useCelebrationStore.getState();
  while (useCelebrationStore.getState().active) store.complete();
}

describe('useCelebrationStore — flag-gated FIFO of celebration beats', () => {
  afterEach(() => {
    resetFlagOverrides();
    drainAll();
  });

  test('celebrate is a no-op while celebrationEngine is off (the default)', () => {
    celebrate({ kind: 'levelUp' });
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queue).toHaveLength(0);
  });

  test('micro beats never enter the queue', () => {
    setFlagOverride({ celebrationEngine: true });
    celebrate({ kind: 'xp', amount: 10 });
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  test('classifies and activates the first standard/epic beat immediately', () => {
    setFlagOverride({ celebrationEngine: true });
    celebrate({ kind: 'xp', amount: 30, domain: 'health' });
    const active = useCelebrationStore.getState().active;
    expect(active).not.toBeNull();
    expect(active?.tier).toBe('standard');
    expect(active?.domain).toBe('health');
  });

  test('beats play one at a time; complete() advances FIFO', () => {
    setFlagOverride({ celebrationEngine: true });
    celebrate({ kind: 'dayComplete' });
    celebrate({ kind: 'levelUp' });
    const s1 = useCelebrationStore.getState();
    expect(s1.active?.kind).toBe('dayComplete');
    expect(s1.queue.map((e) => e.kind)).toEqual(['levelUp']);

    s1.complete();
    const s2 = useCelebrationStore.getState();
    expect(s2.active?.kind).toBe('levelUp');
    expect(s2.queue).toHaveLength(0);

    s2.complete();
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  test('queue caps at 3 waiting beats — overflow drops, never rains for 10s', () => {
    setFlagOverride({ celebrationEngine: true });
    for (let i = 0; i < 6; i++) celebrate({ kind: 'levelUp' });
    expect(useCelebrationStore.getState().queue).toHaveLength(3);
  });
});
