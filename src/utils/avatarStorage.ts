import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Persist a generated avatar image (base64) and return a renderable URI.
 *
 * Native: writes the bytes to the app's document directory and returns a
 * `file://` URI — keeping the heavy base64 out of SQLite and Zustand (only the
 * short path is stored, per the data-residency model: the image never leaves
 * the device). Web has no real filesystem, so we fall back to an inline
 * `data:` URI, which RN-Web's <Image> renders directly.
 *
 * `previousUri` (if a file we wrote) is deleted to avoid orphaned avatars
 * accumulating across regenerations.
 */
export async function persistAvatarImage(
  base64: string,
  mimeType: string,
  previousUri?: string | null,
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';

  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return `data:${mimeType};base64,${base64}`;
  }

  // Timestamped filename busts the <Image> cache so a regenerated avatar shows
  // immediately instead of re-displaying the stale cached file.
  const uri = `${FileSystem.documentDirectory}avatar-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });

  if (
    previousUri &&
    previousUri.startsWith('file://') &&
    previousUri.includes('/avatar-')
  ) {
    await FileSystem.deleteAsync(previousUri, { idempotent: true }).catch(() => {});
  }

  return uri;
}
