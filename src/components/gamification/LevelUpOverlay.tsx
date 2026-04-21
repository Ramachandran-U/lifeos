import { Modal, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeInUp } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { LEVEL_PERKS } from '@/constants/gamification';

interface Props {
  level: number | null;
  userName?: string;
  onClose: () => void;
}

export function LevelUpOverlay({ level, userName, onClose }: Props) {
  const c = useColors();
  if (level === null) return null;
  const perks = LEVEL_PERKS[level] ?? ['New features unlocked', 'Keep going!'];
  const firstName = (userName ?? 'Friend').split(' ')[0];

  const auroraBg = Platform.OS === 'web'
    ? ({
        backgroundImage: `
          radial-gradient(50% 40% at 50% 20%, ${c.primary}44, transparent 70%),
          radial-gradient(40% 30% at 80% 80%, #FF99C533, transparent 70%),
          radial-gradient(40% 30% at 20% 90%, #7FB8FF33, transparent 70%)
        `,
      } as unknown as object)
    : undefined;
  const levelGlow = Platform.OS === 'web'
    ? ({ textShadow: `0 0 32px ${c.primary}, 0 0 8px ${c.primaryLight}` } as unknown as object)
    : undefined;

  return (
    <Modal transparent animationType="none" visible={level !== null} onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.72)' }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={ZoomIn.duration(600).springify().damping(14)}
          style={[styles.modal, { backgroundColor: c.surface, borderColor: c.primary + '55' }, auroraBg as object]}
        >
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Text style={{ color: c.textMuted, fontSize: 18 }}>✕</Text>
          </Pressable>

          <Text style={[styles.levelNum, { color: c.primaryLight }, levelGlow as object]}>{level}</Text>
          <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: c.textMuted, letterSpacing: 2, marginBottom: 6 }}>
            LEVEL UP
          </Text>
          <Text style={{ fontFamily: fonts.heading, fontSize: 24, color: c.textPrimary, textAlign: 'center' }}>
            Congratulations, {firstName}!
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: fontSizes.sm,
              color: c.textSecondary,
              textAlign: 'center',
              marginTop: 6,
              marginBottom: 24,
            }}
          >
            You've reached Level {level}. Here's what you've unlocked:
          </Text>

          <View style={[styles.perksBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            {perks.map((p, i) => (
              <Animated.View
                key={i}
                entering={FadeInUp.delay(300 + i * 100).duration(400)}
                style={[styles.perkRow, i < perks.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}
              >
                <View style={[styles.sparkle, { backgroundColor: c.primary + '22' }]}>
                  <Text style={{ fontSize: 14 }}>✨</Text>
                </View>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.textPrimary, flex: 1 }}>
                  {p}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: '#FFF', letterSpacing: 0.5 }}>
              Continue
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 28,
    borderWidth: 1,
    padding: 40,
    alignItems: 'center',
  },
  close: { position: 'absolute', top: 16, right: 16, padding: 4 },
  levelNum: { fontFamily: fonts.heading, fontSize: 108, fontWeight: '800', lineHeight: 112 },
  perksBox: { width: '100%', borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 24 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sparkle: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cta: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
});
