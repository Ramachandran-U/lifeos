import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Caption } from '@/components/ui/Typography';
import { useSyncStore } from '@/store/useSyncStore';

/** Compact "Xs/Xm/Xh ago" — kept rough on purpose. */
function ago(ts: number | null): string {
  if (!ts) return 'not yet';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/**
 * Visible cross-device sync status — a colored dot + label driven by
 * `useSyncStore`. Makes a disabled flag or a stale device self-evident instead
 * of something you discover by querying the DB.
 */
export function SyncStatus() {
  const c = useColors();
  const phase = useSyncStore((s) => s.phase);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  // Tick every 20s so the "Xm ago" label stays roughly current without a write.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  let label: string;
  let dot: string;
  switch (phase) {
    case 'disabled':
      label = 'Sync off';
      dot = c.textMuted;
      break;
    case 'signed_out':
      label = 'Sign in to sync';
      dot = c.textMuted;
      break;
    case 'pushing':
    case 'pulling':
      label = 'Syncing…';
      dot = c.primary;
      break;
    default:
      label = lastSyncedAt ? `Synced · ${ago(lastSyncedAt)}` : 'Synced · not yet';
      dot = c.success;
  }

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Caption style={{ color: c.textSecondary }}>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
