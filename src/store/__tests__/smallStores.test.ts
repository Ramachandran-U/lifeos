/**
 * Action round-trip specs for the small, dependency-free Zustand stores:
 *   - useUserStore        : setUser, stage, primary domains, module activation
 *                           (idempotent), avatar, reset.
 *   - usePreferencesStore : setters + the two toggles (theme, narration).
 *   - useSyncStore        : markApplied gating + tick, phase, noteSynced.
 *   - useFitSyncStore     : setSync round-trip + clear.
 *
 * These stores have no DB/network deps, so there is nothing to mock — each test
 * drives the store directly and resets state via setState in beforeEach.
 */
import { useUserStore } from '../useUserStore';
import { usePreferencesStore } from '../usePreferencesStore';
import { useSyncStore } from '../useSyncStore';
import { useFitSyncStore } from '../useFitSyncStore';
import type { DailyFitPoint, WorkoutSession } from '@/integrations/googleFit/client';

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.getState().reset();
  });

  it('setUser populates identity fields', () => {
    useUserStore.getState().setUser('user-123', 'Fake Tester', 'fake.user@example.test', 50);
    const s = useUserStore.getState();
    expect(s.userId).toBe('user-123');
    expect(s.name).toBe('Fake Tester');
    expect(s.email).toBe('fake.user@example.test');
    expect(s.onboardingStage).toBe(50);
  });

  it('setOnboardingStage and setPrimaryDomains update in isolation', () => {
    useUserStore.getState().setOnboardingStage(100);
    useUserStore.getState().setPrimaryDomains(['health', 'finance']);
    expect(useUserStore.getState().onboardingStage).toBe(100);
    expect(useUserStore.getState().primaryDomains).toEqual(['health', 'finance']);
  });

  it('markModuleActivated appends once and is idempotent', () => {
    const { markModuleActivated } = useUserStore.getState();
    markModuleActivated('career');
    markModuleActivated('career');
    markModuleActivated('social');
    expect(useUserStore.getState().activatedModules).toEqual(['career', 'social']);
  });

  it('setAvatarUri stores and clears', () => {
    useUserStore.getState().setAvatarUri('file:///fake/avatar.png');
    expect(useUserStore.getState().avatarUri).toBe('file:///fake/avatar.png');
    useUserStore.getState().setAvatarUri(null);
    expect(useUserStore.getState().avatarUri).toBeNull();
  });

  it('reset clears everything back to defaults', () => {
    useUserStore.getState().setUser('u', 'n', 'e@x.test', 10);
    useUserStore.getState().markModuleActivated('goals');
    useUserStore.getState().setAvatarUri('file:///x.png');
    useUserStore.getState().reset();
    const s = useUserStore.getState();
    expect(s.userId).toBeNull();
    expect(s.name).toBe('');
    expect(s.email).toBe('');
    expect(s.onboardingStage).toBe(0);
    expect(s.primaryDomains).toEqual([]);
    expect(s.activatedModules).toEqual([]);
    expect(s.avatarUri).toBeNull();
  });
});

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      theme: 'dark',
      density: 'cozy',
      motionIntensity: 'normal',
      gamification: 'full',
      narrationEnabled: true,
    });
  });

  it('setters update each preference', () => {
    const s = usePreferencesStore.getState();
    s.setTheme('light');
    s.setDensity('compact');
    s.setMotionIntensity('bold');
    s.setGamification('off');
    s.setNarrationEnabled(false);
    const next = usePreferencesStore.getState();
    expect(next.theme).toBe('light');
    expect(next.density).toBe('compact');
    expect(next.motionIntensity).toBe('bold');
    expect(next.gamification).toBe('off');
    expect(next.narrationEnabled).toBe(false);
  });

  it('toggleTheme flips dark↔light', () => {
    usePreferencesStore.getState().toggleTheme();
    expect(usePreferencesStore.getState().theme).toBe('light');
    usePreferencesStore.getState().toggleTheme();
    expect(usePreferencesStore.getState().theme).toBe('dark');
  });

  it('toggleNarration flips the boolean', () => {
    usePreferencesStore.getState().toggleNarration();
    expect(usePreferencesStore.getState().narrationEnabled).toBe(false);
    usePreferencesStore.getState().toggleNarration();
    expect(usePreferencesStore.getState().narrationEnabled).toBe(true);
  });
});

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.setState({ appliedTick: 0, lastAppliedAt: null, phase: 'idle', lastSyncedAt: null });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('markApplied bumps the tick and timestamp only for a positive count', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    useSyncStore.getState().markApplied(3);
    expect(useSyncStore.getState().appliedTick).toBe(1);
    expect(useSyncStore.getState().lastAppliedAt).toBe(1_700_000_000_000);
  });

  it('markApplied is a no-op for zero or negative counts', () => {
    useSyncStore.getState().markApplied(0);
    useSyncStore.getState().markApplied(-2);
    expect(useSyncStore.getState().appliedTick).toBe(0);
    expect(useSyncStore.getState().lastAppliedAt).toBeNull();
  });

  it('setPhase updates the engine phase', () => {
    useSyncStore.getState().setPhase('pushing');
    expect(useSyncStore.getState().phase).toBe('pushing');
  });

  it('noteSynced records the round-trip timestamp', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_111_000);
    useSyncStore.getState().noteSynced();
    expect(useSyncStore.getState().lastSyncedAt).toBe(1_700_000_111_000);
  });
});

describe('useFitSyncStore', () => {
  beforeEach(() => {
    useFitSyncStore.setState({ days: [], workouts: [], lastSyncedAt: null });
  });

  const fakeDay: DailyFitPoint = {
    date: '2026-06-01',
    steps: 8000,
    activeMinutes: 45,
    heartPoints: 30,
    caloriesBurned: 2200,
    distanceMeters: 6000,
    avgHeartRate: 72,
    maxHeartRate: 140,
    minHeartRate: 55,
    sleep: { awake: 10, light: 240, deep: 90, rem: 80, total: 420 },
    spo2: 98,
    bodyFatPct: 18,
    systolic: 118,
    diastolic: 76,
    weightKg: 70,
  };

  const fakeWorkout: WorkoutSession = {
    id: 'w1',
    date: '2026-06-01',
    name: 'Strength',
    iconName: 'barbell',
    activityType: 80,
    durationMinutes: 50,
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_003_000_000,
  };

  it('setSync replaces the cache and stamps lastSyncedAt', () => {
    useFitSyncStore.getState().setSync([fakeDay], [fakeWorkout], 1_700_000_500_000);
    const s = useFitSyncStore.getState();
    expect(s.days).toEqual([fakeDay]);
    expect(s.workouts).toEqual([fakeWorkout]);
    expect(s.lastSyncedAt).toBe(1_700_000_500_000);
  });

  it('clear empties the cache', () => {
    useFitSyncStore.getState().setSync([fakeDay], [fakeWorkout], 1_700_000_500_000);
    useFitSyncStore.getState().clear();
    const s = useFitSyncStore.getState();
    expect(s.days).toEqual([]);
    expect(s.workouts).toEqual([]);
    expect(s.lastSyncedAt).toBeNull();
  });
});
