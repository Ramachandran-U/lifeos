import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
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
 * Web Rive renderer (M3) — @rive-app/react-canvas draws on a 2D canvas, so it
 * never touches the WebGL context budget the Skia celebration layer manages.
 *
 * Metro resolves this .web.tsx over RiveCompanion.tsx on web; it is only ever
 * loaded through Companion.tsx's lazy import, keeping the Rive web runtime
 * (~100 KB) out of the boot bundle.
 */
export function RiveCompanion({ mood, size = 44, equipped = [] }: Props) {
  const source = getCompanionRiveSource();
  const { rive, RiveComponent } = useRive({
    src: source?.web ?? undefined,
    artboard: COMPANION_ARTBOARD,
    stateMachines: COMPANION_STATE_MACHINE,
    autoplay: true,
  });
  const moodInput = useStateMachineInput(rive, COMPANION_STATE_MACHINE, COMPANION_MOOD_INPUT);

  useEffect(() => {
    if (moodInput) moodInput.value = RIVE_MOOD_VALUE[riveMoodFor(mood)];
  }, [moodInput, mood]);

  if (!source?.web) {
    return <CompanionFallback mood={mood} size={size} equipped={equipped} />;
  }

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <RiveComponent style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
