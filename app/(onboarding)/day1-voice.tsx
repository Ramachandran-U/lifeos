import { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { MOTION_BUDGET } from '@/theme/motion';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';

// ─── Voice catalogue ─────────────────────────────────────────────────────────

type VoiceId = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';

interface VoiceOption {
  id: VoiceId;
  label: string;
  tagline: string;
  traits: string[];
  icon: string;
  accent: string;
}

const VOICES: VoiceOption[] = [
  {
    id: 'Puck',
    label: 'Puck',
    tagline: 'Bright & conversational',
    traits: ['Energetic', 'Clear', 'Uplifting'],
    icon: 'sunny-outline',
    accent: '#F59E0B',
  },
  {
    id: 'Charon',
    label: 'Charon',
    tagline: 'Deep & calm',
    traits: ['Grounded', 'Measured', 'Focused'],
    icon: 'water-outline',
    accent: '#3B82F6',
  },
  {
    id: 'Kore',
    label: 'Kore',
    tagline: 'Warm & focused',
    traits: ['Steady', 'Warm', 'Present'],
    icon: 'leaf-outline',
    accent: '#10B981',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    tagline: 'Clear & assertive',
    traits: ['Direct', 'Bold', 'Motivating'],
    icon: 'flash-outline',
    accent: '#EF4444',
  },
  {
    id: 'Aoede',
    label: 'Aoede',
    tagline: 'Smooth & expressive',
    traits: ['Lyrical', 'Rich', 'Nuanced'],
    icon: 'musical-notes-outline',
    accent: '#8B5CF6',
  },
];

// ─── VoiceCard ────────────────────────────────────────────────────────────────

function VoiceCard({
  voice,
  selected,
  onSelect,
  delay,
}: {
  voice: VoiceOption;
  selected: boolean;
  onSelect: (id: VoiceId) => void;
  delay: number;
}) {
  const c = useColors();
  const s = makeCardStyles(c);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(MOTION_BUDGET.reveal)}>
      <Pressable
        style={[s.card, selected && { borderColor: voice.accent, borderWidth: 2 }]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onSelect(voice.id);
        }}
        testID={`voice-card-${voice.id}`}
      >
        {/* Accent bar */}
        <View style={[s.accentBar, { backgroundColor: voice.accent }]} />

        <View style={s.body}>
          <View style={[s.iconWrap, { backgroundColor: voice.accent + '20' }]}>
            <Ionicons name={voice.icon as 'sunny-outline'} size={24} color={voice.accent} />
          </View>

          <View style={s.textBlock}>
            <Label style={[s.name, selected && { color: voice.accent }]}>{voice.label}</Label>
            <Body style={s.tagline}>{voice.tagline}</Body>
            <View style={s.traits}>
              {voice.traits.map((t) => (
                <View key={t} style={[s.trait, { backgroundColor: voice.accent + '18' }]}>
                  <Caption style={[s.traitText, { color: voice.accent }]}>{t}</Caption>
                </View>
              ))}
            </View>
          </View>

          {selected && (
            <Animated.View entering={ZoomIn.duration(MOTION_BUDGET.microFeedback)} style={[s.checkWrap, { backgroundColor: voice.accent }]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeCardStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    accentBar: {
      height: 3,
      width: '100%',
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      flex: 1,
      gap: spacing.xs,
    },
    name: {
      fontFamily: fonts.heading,
      fontSize: fontSizes.md,
      color: '#fff',
    },
    tagline: {
      fontSize: fontSizes.sm,
      color: c.textSecondary,
    },
    traits: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: 2,
    },
    trait: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 6,
    },
    traitText: {
      fontSize: 11,
      fontFamily: fonts.bodyMedium,
    },
    checkWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Day1VoiceScreen() {
  const c = useColors();
  const s = makeStyles(c);
  const router = useRouter();
  const { userId } = useUserStore();

  const [selected, setSelected] = useState<VoiceId>('Puck');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      updateUser(userId, { preferredVoiceId: selected });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.container}>
      <AuroraBackground />
      <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
        <Animated.View entering={FadeInDown.duration(MOTION_BUDGET.hero)}>
          <Heading style={s.title}>Choose your voice</Heading>
          <Body style={s.subtitle}>
            This is the voice you'll hear whenever you talk to your AI life coach. Pick the one that feels right — you can change it anytime in Settings.
          </Body>
        </Animated.View>

        <View style={s.cards}>
          {VOICES.map((v, i) => (
            <VoiceCard
              key={v.id}
              voice={v}
              selected={selected === v.id}
              onSelect={setSelected}
              delay={100 + i * 80}
            />
          ))}
        </View>

        <Animated.View entering={FadeInUp.delay(600).duration(MOTION_BUDGET.reveal)} style={s.actions}>
          <Button
            title={saving ? 'Saving…' : 'Start with ' + selected}
            onPress={handleContinue}
            disabled={saving}
          />
          <Pressable onPress={handleSkip} hitSlop={8} style={s.skipBtn}>
            <Caption style={s.skipText}>Skip for now</Caption>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    title: {
      marginTop: spacing.xl,
    },
    subtitle: {
      color: c.textSecondary,
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
      lineHeight: 22,
    },
    cards: {
      gap: 0,
    },
    actions: {
      marginTop: spacing.md,
      gap: spacing.md,
    },
    skipBtn: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
    },
    skipText: {
      color: c.textMuted,
    },
  });
