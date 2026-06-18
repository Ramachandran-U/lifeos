import { useState, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useColors } from '@/theme/colors';
import { LifeHubSheet } from '@/components/shared/LifeHubSheet';

/**
 * "Life" hub tab. The screen itself is intentionally empty — its purpose is to
 * present the LifeHubSheet on focus. Picking a domain navigates to it; dismissing
 * the sheet WITHOUT picking bounces back to Today (the hub has no content of its
 * own).
 */
export default function LifeHubScreen() {
  const c = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Did the user choose a domain this visit? A pick navigates away, so the
  // subsequent sheet-close must NOT also bounce to Today. (The bug: every close
  // — including a pick — ran the bounce, which undid the domain navigation and
  // dropped the user back on Today.)
  const pickedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      pickedRef.current = false; // reset each time the hub is focused
      setOpen(true);
      return () => setOpen(false);
    }, []),
  );

  // A domain was chosen — navigate to it. The pick flag tells handleClose to
  // stand down so it doesn't bounce us straight back to Today.
  const handlePick = useCallback(
    (route: string) => {
      pickedRef.current = true;
      router.push(route as Href);
    },
    [router],
  );

  // Sheet closed. If a domain was picked, handlePick already navigated — do
  // nothing. Otherwise the user dismissed the hub, so return them to Today.
  const handleClose = useCallback(() => {
    setOpen(false);
    if (pickedRef.current) return;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LifeHubSheet visible={open} onPick={handlePick} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
