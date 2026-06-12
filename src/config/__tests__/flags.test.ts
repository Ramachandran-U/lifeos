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

  it('has correct defaults — priorityAdjust + the Aurora motion track are on', () => {
    // priorityAdjust ships enabled so the routing sheet works out of the box.
    // The Aurora Alive motion flags flipped default-on 2026-06-14 (founder
    // next-wave rollout); soundEffects stays off by design (opt-in pref on
    // top). Everything else is off until explicitly enabled.
    const ON_BY_DEFAULT: FeatureFlag[] = [
      'priorityAdjust',
      'motionPolish',
      'motionTransitions',
      'celebrationEngine',
      'riveCompanion',
      'animatedCharts',
    ];
    ON_BY_DEFAULT.forEach((k) => {
      expect(isEnabled(k)).toBe(true);
    });
    const otherFlags = (Object.keys(DEFAULT_FLAGS) as FeatureFlag[]).filter(
      (k) => !ON_BY_DEFAULT.includes(k),
    );
    otherFlags.forEach((k) => {
      expect(isEnabled(k)).toBe(false);
    });
    expect(isEnabled('soundEffects')).toBe(false);
  });

  it('reads truthy env vars (EXPO_PUBLIC_FLAG_<UPPER_SNAKE>)', () => {
    process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES = 'true';
    process.env.EXPO_PUBLIC_FLAG_OVERCOMMITMENT_DETECTOR = '1';
    process.env.EXPO_PUBLIC_FLAG_PRIORITY_ADJUST = 'on';
    expect(isEnabled('domainNudges')).toBe(true);
    expect(isEnabled('overcommitmentDetector')).toBe(true);
    expect(isEnabled('priorityAdjust')).toBe(true);
  });

  it('treats non-truthy env values as false', () => {
    process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES = 'false';
    process.env.EXPO_PUBLIC_FLAG_PRIORITY_ADJUST = 'maybe';
    expect(isEnabled('domainNudges')).toBe(false);
    expect(isEnabled('priorityAdjust')).toBe(false);
  });

  it('override takes priority over env and default', () => {
    process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES = 'true';
    setFlagOverride({ domainNudges: false });
    expect(isEnabled('domainNudges')).toBe(false); // override wins over env

    setFlagOverride({ priorityAdjust: true });
    expect(isEnabled('priorityAdjust')).toBe(true); // override wins over default
  });

  it('acts as a kill switch — override false beats env true', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERCOMMITMENT_DETECTOR = 'true';
    expect(isEnabled('overcommitmentDetector')).toBe(true);
    setFlagOverride({ overcommitmentDetector: false }); // remote kill
    expect(isEnabled('overcommitmentDetector')).toBe(false);
  });

  it('resolveFlags returns a complete snapshot', () => {
    setFlagOverride({ domainNudges: true });
    const snap = resolveFlags();
    expect(snap.domainNudges).toBe(true);
    expect(snap.overcommitmentDetector).toBe(false);
    expect(Object.keys(snap).sort()).toEqual(Object.keys(DEFAULT_FLAGS).sort());
  });

  it('resetFlagOverrides clears overrides', () => {
    setFlagOverride({ domainNudges: true });
    expect(isEnabled('domainNudges')).toBe(true);
    resetFlagOverrides();
    expect(isEnabled('domainNudges')).toBe(false);
  });
});
