/**
 * Web localStorage usage probe. On web the persistence layer is bounded by the
 * browser's ~5MB-per-origin quota — we want visibility into approach-to-limit
 * so the beta cohort doesn't silently start failing writes once they cross it.
 *
 * Native is a no-op: SQLite has its own pressure model and bytes-on-disk isn't
 * meaningfully limited on a phone.
 */
import { Platform } from 'react-native';

const WARN_BYTES = 4 * 1024 * 1024; // 4MB — leaves ~1MB headroom under the 5MB Chrome/Safari quota.

export interface StorageUsage {
  bytes: number;
  warn: boolean;
}

export function getLocalStorageUsage(): StorageUsage | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) ?? '';
      // UTF-16: each char is 2 bytes. Approximate, close enough for monitoring.
      bytes += (key.length + value.length) * 2;
    }
  } catch {
    return null;
  }
  return { bytes, warn: bytes >= WARN_BYTES };
}
