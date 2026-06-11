/**
 * Legacy screen snapshots — AC12 baseline (Ink + Signal §3.0.1, Dilution trap 1).
 *
 * These snapshots are recorded in the W4 FOUNDATION PR, i.e. from trees that
 * are byte-identical to the pre-recomposition screens (the extraction changed
 * only the export line — verified by diff). Every later screen PR must keep
 * the *.legacy.tsx trees matching these snapshots: "Jest snapshots of all five
 * *.legacy.tsx trees match snapshots recorded from the pre-recomposition
 * screens in the foundation PR". A diff here means the legacy path changed —
 * which is never allowed; it is deleted, not edited (graduation task in
 * docs/PARKED_ITEMS.md §13).
 *
 * SANCTIONED REGENERATIONS (§3.0.7 — "lands with its screen's PR"): the
 * *.legacy.tsx FILES stay untouched, but they mount shared child components
 * whose internal caps labels die unconditionally in each screen PR's §3.0.7
 * sweep. Those card-internal label swaps are the one sanctioned source of
 * legacy-pixel change, and the snapshot is re-recorded in the same PR:
 *  - 2026-06-12 (W4 screens batch A, Health + Explore): ExploreScreenLegacy
 *    re-recorded — ConstellationView's empty-placeholder Card was deleted
 *    (§3.2 item 6 ≥3-node threshold), so the legacy zero-state no longer
 *    renders it. The Health sweep (MealSuggestionsCard / BloodReportCard /
 *    FitDashboard) only touches surfaces that are collapsed or disconnected
 *    in the zero-data baseline — no Health snapshot churn.
 *
 * Mock seams follow the established component-test conventions
 * (TodayHeader.test.tsx, ContactsImportCard.test.tsx): expo-router hooks and
 * the screen-tracking/notification hooks are stubbed; everything below the
 * screens renders for real (deep react-test-renderer trees, not shallow).
 * useFocusEffect is a no-op, so each screen renders its deterministic
 * zero-data tree without touching the DB layer (queries are lazy and never
 * invoked without focus).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(), // no focus in jest — data loaders never fire
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/useScreenTracking', () => ({ useScreenTracking: jest.fn() }));
jest.mock('@/hooks/useNotifications', () => ({
  refreshSocialOverdueBody: jest.fn(async () => {}),
}));

// Deterministic safe-area insets for stable snapshots (the library's own mock;
// it ships as `export default {...}`, hence the .default unwrap).
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

import { render } from '@testing-library/react-native';
import { HealthScreenLegacy } from '@/screens/legacy/HealthScreen.legacy';
import { ExploreScreenLegacy } from '@/screens/legacy/ExploreScreen.legacy';
import { CareerScreenLegacy } from '@/screens/legacy/CareerScreen.legacy';
import { SocialScreenLegacy } from '@/screens/legacy/SocialScreen.legacy';
import { FinanceScreenLegacy } from '@/screens/legacy/FinanceScreen.legacy';

describe('legacy module screens — pre-recomposition render baseline (AC12)', () => {
  it('HealthScreenLegacy matches the pre-recomposition tree', () => {
    expect(render(<HealthScreenLegacy />).toJSON()).toMatchSnapshot();
  });

  it('ExploreScreenLegacy matches the pre-recomposition tree', () => {
    expect(render(<ExploreScreenLegacy />).toJSON()).toMatchSnapshot();
  });

  it('CareerScreenLegacy matches the pre-recomposition tree', () => {
    expect(render(<CareerScreenLegacy />).toJSON()).toMatchSnapshot();
  });

  it('SocialScreenLegacy matches the pre-recomposition tree', () => {
    expect(render(<SocialScreenLegacy />).toJSON()).toMatchSnapshot();
  });

  it('FinanceScreenLegacy matches the pre-recomposition tree', () => {
    expect(render(<FinanceScreenLegacy />).toJSON()).toMatchSnapshot();
  });
});
