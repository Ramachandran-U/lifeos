import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColors } from '@/theme/colors';
import { LifeHubSheet, type HubRoute } from '@/components/shared/LifeHubSheet';

/**
 * "Life" hub tab. The screen itself is intentionally empty — its purpose is to
 * present the LifeHubSheet on focus. Dismissing without a pick bounces the user
 * back to Today; picking a module navigates there and must NOT bounce.
 */
export default function LifeHubScreen() {
  const c = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // True once a module was chosen during this focus, so the close handler knows
  // navigation already happened and skips the bounce-to-Today.
  const pickedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      pickedRef.current = false;
      setOpen(true);
      return () => setOpen(false);
    }, []),
  );

  // Chose a module: navigate there and flag it so handleClose won't bounce.
  const handlePick = (route: HubRoute) => {
    pickedRef.current = true;
    setOpen(false);
    router.push(route);
  };

  // Dismissed without a pick (overlay / back / ✕): bounce back to Today. If a
  // pick already navigated us away, do nothing — bouncing would yank the user
  // off the domain they just opened (the redirect-to-Today bug).
  const handleClose = () => {
    setOpen(false);
    if (pickedRef.current) return;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LifeHubSheet visible={open} onClose={handleClose} onPick={handlePick} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
