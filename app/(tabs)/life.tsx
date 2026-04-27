import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useColors } from '@/theme/colors';
import { LifeHubSheet } from '@/components/shared/LifeHubSheet';

/**
 * "Life" hub tab. The screen itself is intentionally empty — its purpose is to
 * present the LifeHubSheet on focus, then bounce the user back when they
 * dismiss without picking a module.
 */
export default function LifeHubScreen() {
  const c = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setOpen(true);
      return () => setOpen(false);
    }, []),
  );

  // If user taps the overlay (no route taken), bounce back to Today.
  useEffect(() => {
    if (!open) return;
    return () => {
      // cleanup on blur — handled by useFocusEffect above
    };
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LifeHubSheet visible={open} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
