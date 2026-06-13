import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Image, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { generateGamifiedAvatar } from '@/ai/functions';
import { useAI } from '@/hooks/useAI';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { StorageQuotaError } from '@/db/webStorage/_io';
import { persistAvatarImage } from '@/utils/avatarStorage';

interface AvatarEditSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type Mode = 'choose' | 'preview' | 'result';

interface PickedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
}

export function AvatarEditSheet({ visible, onClose, onSaved }: AvatarEditSheetProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const { call, loading, error } = useAI();
  const userId = useUserStore((s) => s.userId);
  const currentAvatarUri = useUserStore((s) => s.avatarUri);
  const setAvatarUri = useUserStore((s) => s.setAvatarUri);

  const [mode, setMode] = useState<Mode>('choose');
  const [source, setSource] = useState<PickedPhoto | null>(null);
  const [result, setResult] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);

  const reset = () => {
    setMode('choose');
    setSource(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pick = async (from: 'camera' | 'library') => {
    const perm =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsEditing: true, aspect: [1, 1] });

    const asset = !result.canceled ? result.assets[0] : null;
    if (asset?.base64) {
      setSource({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
      setMode('preview');
      Haptics.selectionAsync();
    }
  };

  const handleGenerate = async () => {
    if (!source) return;
    const gen = await call(() =>
      generateGamifiedAvatar({ imageBase64: source.base64, mimeType: source.mimeType }),
    );
    if (gen) {
      const uri = `data:${gen.mimeType};base64,${gen.imageBase64}`;
      setResult({ uri, base64: gen.imageBase64, mimeType: gen.mimeType });
      setMode('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSave = async () => {
    if (!result || !userId) return;
    const savedUri = await persistAvatarImage(result.base64, result.mimeType, currentAvatarUri);
    // Reflect the new avatar in-memory first so a storage hiccup never blocks the
    // visible result for this session.
    setAvatarUri(savedUri);
    try {
      // On web the avatar itself is a base64 data URI; storing the (also large)
      // SOURCE data URI too would double the localStorage footprint for only a
      // regeneration hint — skip it on web to stay well under the ~5MB quota.
      const avatarSourceUri = Platform.OS === 'web' ? '' : (source?.uri ?? '');
      updateUser(userId, { avatarUri: savedUri, avatarSourceUri });
    } catch (e) {
      if (e instanceof StorageQuotaError) {
        Alert.alert(
          'Couldn’t save the image',
          'Your device storage is full, so the new avatar will show this session but won’t be saved. Free up some space and try again.',
        );
      } else {
        throw e;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved?.();
    handleClose();
  };

  const previewUri = result?.uri ?? source?.uri ?? null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Heading style={styles.title}>
              {mode === 'result' ? 'Your avatar' : 'Profile avatar'}
            </Heading>
            <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>

          {/* Image preview */}
          <View style={styles.previewWrap}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.previewEmpty]}>
                <Ionicons name="person-outline" size={56} color={c.textMuted} />
              </View>
            )}
            {loading && (
              <View style={styles.loadingOverlay}>
                <LoadingDots />
                <Caption style={{ color: '#FFF', marginTop: spacing.sm }}>Creating your avatar…</Caption>
              </View>
            )}
          </View>

          {error && mode !== 'result' && (
            <Caption style={{ color: c.error, textAlign: 'center' }}>{error}</Caption>
          )}

          {/* Actions */}
          {mode === 'choose' && (
            <View style={styles.actions}>
              <Button title="Take photo" variant="secondary" onPress={() => pick('camera')} />
              <Button title="Choose from library" variant="secondary" onPress={() => pick('library')} />
            </View>
          )}

          {mode === 'preview' && (
            <View style={styles.actions}>
              <Caption style={styles.hint}>
                We'll turn this into a bold, gamified avatar. Faces work best.
              </Caption>
              <Button title="Generate avatar" variant="secondary" onPress={handleGenerate} disabled={loading} />
              <Button title="Pick another" variant="ghost" onPress={() => setMode('choose')} disabled={loading} />
            </View>
          )}

          {mode === 'result' && (
            <View style={styles.actions}>
              <Button title="Use this avatar" variant="secondary" onPress={handleSave} />
              <Button title="Regenerate" variant="secondary" onPress={handleGenerate} disabled={loading} />
              <Button title="Cancel" variant="ghost" onPress={handleClose} disabled={loading} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: c.textPrimary,
      fontFamily: fonts.heading,
    },
    previewWrap: {
      alignSelf: 'center',
      marginVertical: spacing.sm,
    },
    preview: {
      width: 200,
      height: 200,
      borderRadius: radii.tile,
      backgroundColor: c.surfaceAlt,
    },
    previewEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: radii.tile,
    },
    actions: {
      gap: spacing.sm,
    },
    hint: {
      color: c.textMuted,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
  });
}
