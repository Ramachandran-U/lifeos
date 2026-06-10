import { Component, Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { isEnabled } from '@/config/flags';
import { useMotionScale } from '@/theme/motion';
import { CompanionFallback } from './CompanionFallback';
import { getCompanionRiveSource } from './companionContract';
import type { CompanionMood } from '@/companion/types';

export interface CompanionProps {
  mood: CompanionMood;
  size?: number;
  equipped?: readonly string[];
}

/**
 * The public companion surface (M3). Everything renders THROUGH this
 * component — never mount RiveCompanion directly.
 *
 * Decision ladder:
 *   riveCompanion flag off  → CompanionFallback (breathing glyph)
 *   no .riv asset authored  → CompanionFallback
 *   reduce-motion           → CompanionFallback (it renders static at scale 0)
 *   otherwise               → lazy-loaded RiveCompanion (native or .web by
 *                             platform), error-bounded back to the fallback —
 *                             Expo Go's missing native module, a bad asset
 *                             fetch, or a runtime crash all land softly.
 */

// Lazy so the Rive runtime (native module / web canvas lib) stays out of the
// boot path entirely while the flag is off or the asset hasn't landed.
const LazyRive = lazy(() =>
  import('./RiveCompanion').then((m) => ({ default: m.RiveCompanion as ComponentType<CompanionProps> })),
);

export function Companion({ mood, size = 44, equipped = [] }: CompanionProps) {
  const motionScale = useMotionScale();
  const riveEligible =
    isEnabled('riveCompanion') && motionScale > 0 && getCompanionRiveSource() !== null;

  const fallback = <CompanionFallback mood={mood} size={size} equipped={equipped} />;
  if (!riveEligible) return fallback;

  return (
    <CompanionErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyRive mood={mood} size={size} equipped={equipped} />
      </Suspense>
    </CompanionErrorBoundary>
  );
}

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

// Class component by necessity — React still requires a class for
// getDerivedStateFromError (same precedent as components/shared/ErrorBoundary).
// Local + silent: a companion render crash degrades to the glyph, never to the
// full-screen error UI — the header must stay calm whatever Rive does.
class CompanionErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
