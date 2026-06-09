import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION_BUDGET, useMotionScale } from '@/theme/motion';
import { isEnabled } from '@/config/flags';

/**
 * Sheet exit-animation lifecycle (Aurora Alive M0.4).
 *
 * Root cause this fixes: every sheet is hand-rolled over RN `<Modal>`, and a
 * Modal unmounts its children INSTANTLY when `visible` flips false — so any
 * `exiting={SlideOutDown...}` declared inside never plays. The fix is a tiny
 * state machine that keeps the Modal mounted through a `closing` phase:
 *
 *   open ──requestClose()──▶ closing ──(exit tail elapses)──▶ closed → onClose()
 *
 * Consumer recipe:
 *   const sheet = useSheetLifecycle(visible, onClose);
 *   <Modal visible={sheet.mounted} onRequestClose={sheet.requestClose}>
 *     {!sheet.closing && <Animated.View exiting={...}>scrim</Animated.View>}
 *     {!sheet.closing && <Animated.View exiting={...}>sheet body</Animated.View>}
 *   </Modal>
 * Flipping `closing` unmounts the Animated.Views while the Modal host stays
 * up, which is exactly when Reanimated plays `exiting` — then after the tail
 * the Modal itself unmounts and the parent's onClose runs.
 *
 * Behaviour preservation: with the `motionPolish` flag off (or reduce-motion
 * active) the hook degrades to today's instant close — mounted mirrors
 * `visible` and requestClose is the parent's onClose.
 */

export interface SheetLifecycle {
  /** Drive `<Modal visible={...}>` with this, NOT the raw `visible` prop. */
  mounted: boolean;
  /** True while exit animations play — conditionally unmount animated children. */
  closing: boolean;
  /** Close the sheet (plays exits first). Wire to scrim press / ✕ / onRequestClose. */
  requestClose: () => void;
}

export function useSheetLifecycle(
  visible: boolean,
  onClose: () => void,
  // Covers the slowest exit: sheet slide (520) or scrim fade (460) + its 80ms
  // delay, plus a small buffer so the last frame isn't clipped.
  exitMs: number = MOTION_BUDGET.sheetExit + 60,
): SheetLifecycle {
  const motionScale = useMotionScale();
  const animatedExits = isEnabled('motionPolish') && motionScale > 0;

  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>(visible ? 'open' : 'closed');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Parent-initiated closes (visible flipped false externally) must NOT call
  // onClose again when the tail elapses; user-initiated ones must.
  const notifyOnClosed = useRef(false);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const beginClosing = useCallback((notify: boolean) => {
    notifyOnClosed.current = notify;
    setPhase('closing');
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      setPhase('closed');
      if (notifyOnClosed.current) onClose();
    }, exitMs);
  }, [exitMs, onClose]);

  useEffect(() => {
    if (visible) {
      // (Re)open — including a reopen that interrupts a closing tail.
      clearTimer();
      setPhase('open');
    } else if (phase === 'open') {
      // Parent closed us directly; play exits but don't re-notify.
      if (animatedExits) beginClosing(false);
      else setPhase('closed');
    }
    // `phase` is deliberately not a dependency-driven trigger here beyond the
    // open check — the machine advances via beginClosing/timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, animatedExits, beginClosing]);

  useEffect(() => clearTimer, []);

  const requestClose = useCallback(() => {
    if (!animatedExits) {
      onClose();
      return;
    }
    if (phase === 'open') beginClosing(true);
  }, [animatedExits, phase, beginClosing, onClose]);

  return {
    mounted: animatedExits ? phase !== 'closed' : visible,
    closing: animatedExits ? phase === 'closing' : false,
    requestClose,
  };
}
