import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Rive, { useRive } from 'rive-react-native';
import {
  COMPANION_ARTBOARD,
  COMPANION_MOOD_INPUT,
  COMPANION_STATE_MACHINE,
  RIVE_MOOD_VALUE,
  getCompanionRiveSource,
  riveMoodFor,
} from './companionContract';
import { CompanionFallback } from './CompanionFallback';
import type { CompanionMood } from '@/companion/types';

interface Props {
  mood: CompanionMood;
  size?: number;
  equipped?: readonly string[];
}

/**
 * Native Rive renderer (M3, dev-client only — the Rive native module is not
 * in Expo Go; Companion.tsx only mounts this lazily behind the flag + a
 * non-null asset source, and its error boundary catches a missing module).
 *
 * NEVER import this file statically from app code — go through Companion.tsx,
 * which lazy-loads it so the Rive runtime stays out of the boot path.
 */
export function RiveCompanion({ mood, size = 44, equipped = [] }: Props) {
  const source = getCompanionRiveSource();
  const [setRiveRef, riveRef] = useRive();

  // Drive the state machine's mood input whenever the product mood changes.
  useEffect(() => {
    if (!riveRef) return;
    try {
      riveRef.setInputState(
        COMPANION_STATE_MACHINE,
        COMPANION_MOOD_INPUT,
        RIVE_MOOD_VALUE[riveMoodFor(mood)],
      );
    } catch {
      // A binding miss must never crash the header — the artboard simply
      // stays on its current loop.
    }
  }, [riveRef, mood]);

  if (!source?.native) {
    // Asset not authored yet (see companionContract.getCompanionRiveSource).
    return <CompanionFallback mood={mood} size={size} equipped={equipped} />;
  }

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Rive
        ref={setRiveRef}
        url={source.native}
        artboardName={COMPANION_ARTBOARD}
        stateMachineName={COMPANION_STATE_MACHINE}
        autoplay
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
