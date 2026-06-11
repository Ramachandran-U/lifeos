import { HealthScreenLegacy } from '@/screens/legacy/HealthScreen.legacy';

// W4 foundation (Ink + Signal §3.0.1): the pre-recomposition tree moved
// verbatim to src/screens/legacy/HealthScreen.legacy.tsx (legacy trees live
// outside app/ so they don't become expo-router routes). The
// `module_hierarchy_v1` flag branch + the recomposed tree land in this
// screen's own PR; until then the wrapper renders the legacy tree
// unconditionally.
export default function HealthScreen() {
  return <HealthScreenLegacy />;
}
