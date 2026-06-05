import {
  DEFAULT_FLAGS,
  isEnabled,
  resolveFlags,
  setFlagOverride,
  resetFlagOverrides,
  type FeatureFlag,
} from '../flags';

describe('feature flags', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    resetFlagOverrides();
    process.env = { ...envSnapshot };
  });

  // Flags intentionally graduated to on-by-default (the explore "thinking
  // partner" revamp + the rabbit-hole tree-map redesign shipped GA — the latter
  // browser-verified 2026-06-05). Every OTHER flag must still default to false
  // so unfinished subsystems stay dark on merge.
  const GRADUATED_ON: FeatureFlag[] = ['exploreChasing', 'exploreAgenticThread', 'exploreFrontier', 'rabbitHoleTreeMap'];

  it('keeps every non-graduated flag off by default', () => {
    (Object.keys(DEFAULT_FLAGS) as FeatureFlag[]).forEach((k) => {
      expect(isEnabled(k)).toBe(GRADUATED_ON.includes(k));
    });
  });

  it('reads truthy env vars (EXPO_PUBLIC_FLAG_<UPPER_SNAKE>)', () => {
    process.env.EXPO_PUBLIC_FLAG_MUTATION_LOG = 'true';
    process.env.EXPO_PUBLIC_FLAG_SYNC_ENGINE = '1';
    process.env.EXPO_PUBLIC_FLAG_VERSION_HISTORY = 'on';
    expect(isEnabled('mutationLog')).toBe(true);
    expect(isEnabled('syncEngine')).toBe(true);
    expect(isEnabled('versionHistory')).toBe(true);
  });

  it('treats non-truthy env values as false', () => {
    process.env.EXPO_PUBLIC_FLAG_MUTATION_LOG = 'false';
    process.env.EXPO_PUBLIC_FLAG_SYNC_ENGINE = 'maybe';
    expect(isEnabled('mutationLog')).toBe(false);
    expect(isEnabled('syncEngine')).toBe(false);
  });

  it('override takes priority over env and default', () => {
    process.env.EXPO_PUBLIC_FLAG_MUTATION_LOG = 'true';
    setFlagOverride({ mutationLog: false });
    expect(isEnabled('mutationLog')).toBe(false); // override wins over env

    setFlagOverride({ cognitiveEngine: true });
    expect(isEnabled('cognitiveEngine')).toBe(true); // override wins over default
  });

  it('acts as a kill switch — override false beats env true', () => {
    process.env.EXPO_PUBLIC_FLAG_SYNC_ENGINE = 'true';
    expect(isEnabled('syncEngine')).toBe(true);
    setFlagOverride({ syncEngine: false }); // remote kill
    expect(isEnabled('syncEngine')).toBe(false);
  });

  it('resolveFlags returns a complete snapshot', () => {
    setFlagOverride({ memoryGraph: true });
    const snap = resolveFlags();
    expect(snap.memoryGraph).toBe(true);
    expect(snap.orchestration).toBe(false);
    expect(Object.keys(snap).sort()).toEqual(Object.keys(DEFAULT_FLAGS).sort());
  });

  it('resetFlagOverrides clears overrides', () => {
    setFlagOverride({ mutationLog: true });
    expect(isEnabled('mutationLog')).toBe(true);
    resetFlagOverrides();
    expect(isEnabled('mutationLog')).toBe(false);
  });
});
