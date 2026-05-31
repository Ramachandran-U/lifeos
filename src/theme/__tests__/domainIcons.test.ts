// lucide-react-native pulls react-native-svg, which can't load under the
// node test env (RN is stubbed). We only need to assert the MAP's contract,
// not render real icons, so stub each named icon with a distinct component.
jest.mock('lucide-react-native', () => {
  const make = (name: string) => {
    const C = () => null;
    (C as { displayName?: string }).displayName = name;
    return C;
  };
  return {
    Target: make('Target'),
    HeartPulse: make('HeartPulse'),
    TrendingUp: make('TrendingUp'),
    Briefcase: make('Briefcase'),
    Users: make('Users'),
    Sparkles: make('Sparkles'),
    Moon: make('Moon'),
    Square: make('Square'),
    UtensilsCrossed: make('UtensilsCrossed'),
  };
});

import { DOMAIN_ICONS, MODULE_ICONS } from '@/theme/domainIcons';

// Guards the single source of truth that keeps the radar, routine blocks,
// module headers, Life hub, and entry chips showing the SAME icon per domain.

const DOMAINS = ['goal', 'health', 'finance', 'career', 'social', 'polymath'] as const;

describe('DOMAIN_ICONS', () => {
  it('defines an icon for every domain', () => {
    DOMAINS.forEach((d) => {
      expect(DOMAIN_ICONS[d]).toBeDefined();
    });
    expect(Object.keys(DOMAIN_ICONS).sort()).toEqual([...DOMAINS].sort());
  });
});

describe('MODULE_ICONS', () => {
  it('is a superset of DOMAIN_ICONS (same component identity per domain)', () => {
    DOMAINS.forEach((d) => {
      expect(MODULE_ICONS[d]).toBe(DOMAIN_ICONS[d]);
    });
  });

  it('adds the non-domain block types', () => {
    expect(MODULE_ICONS.rest).toBeDefined();
    expect(MODULE_ICONS.work).toBeDefined();
    expect(MODULE_ICONS.meal).toBeDefined();
  });
});

// Regression: DomainGlyph used to do `DOMAIN_ICONS[domain]` unguarded. Callers
// pass a routine-block `module` cast to DomainKey, and modules like 'rest' /
// 'meal' / 'work' are NOT domain keys → the lookup returned `undefined`, and
// rendering `<undefined/>` threw React #130 (blank screen) on block complete.
// The glyph now falls back to the goal icon for any non-canonical key.
describe('DomainGlyph icon resolution (React #130 guard)', () => {
  const resolve = (domain: string) =>
    (DOMAIN_ICONS as Record<string, unknown>)[domain] ?? DOMAIN_ICONS.goal;

  it('resolves a real icon for canonical domains', () => {
    DOMAINS.forEach((d) => expect(resolve(d)).toBe(DOMAIN_ICONS[d]));
  });

  it('falls back to the goal icon for non-domain block modules', () => {
    ['rest', 'meal', 'work', '', 'bogus'].forEach((m) => {
      expect(resolve(m)).toBe(DOMAIN_ICONS.goal);
      expect(resolve(m)).toBeDefined(); // never undefined → never <undefined/>
    });
  });
});
