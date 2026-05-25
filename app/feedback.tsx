import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { submitFeedback } from '@/utils/feedback';
import { useUserStore } from '@/store/useUserStore';

export default function FeedbackScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = makeStyles(c);
  const { email: userEmail } = useUserStore();

  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [fromEmail, setFromEmail] = useState(userEmail || '');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const handleSubmit = async () => {
    if (!body.trim()) {
      setErrMsg('Please write a message.');
      return;
    }
    setStatus('submitting');
    setErrMsg('');
    try {
      await submitFeedback({ body, subject, from_email: fromEmail });
      setStatus('sent');
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Could not send.');
    }
  };

  if (status === 'sent') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <Card style={styles.thanksCard}>
              <Heading>Thanks 🙏</Heading>
              <Body style={styles.thanksBody}>
                We read every message. If you left an email we'll reply when something ships.
              </Body>
              <Button title="Done" onPress={() => router.back()} style={styles.doneBtn} />
            </Card>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
            <Body style={{ color: c.textSecondary }}>Back</Body>
          </Pressable>

          <Heading style={styles.title}>Send feedback</Heading>

          <Card style={styles.section}>
            <Body style={styles.intro}>
              Tell us what's broken, missing, or confusing. We'd much rather hear it now than have you delete the app.
            </Body>
            <Caption style={styles.captionText}>
              Your message and app context (version, platform) are sent. Email is optional — only fill it in if you want a reply.
            </Caption>
          </Card>

          <Card style={styles.section}>
            <Input
              label="What happened?"
              placeholder="The Routine Builder kept generating breakfast at 11pm…"
              value={body}
              onChangeText={(t) => { setBody(t); setErrMsg(''); }}
              multiline
              numberOfLines={6}
              style={styles.bodyInput}
            />
            <Input
              label="Subject (optional)"
              placeholder="e.g. Routine timing bug"
              value={subject}
              onChangeText={setSubject}
            />
            <Input
              label="Reply-to email (optional)"
              placeholder="you@example.com"
              value={fromEmail}
              onChangeText={setFromEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {errMsg ? <Body style={styles.error}>{errMsg}</Body> : null}

            <Button
              title={status === 'submitting' ? 'Sending…' : 'Send feedback'}
              onPress={handleSubmit}
              disabled={status === 'submitting'}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    title: { marginTop: spacing.sm, marginBottom: spacing.sm },
    section: { gap: spacing.sm },
    intro: { fontSize: 16 },
    captionText: { color: colors.textMuted },
    bodyInput: { minHeight: 120, textAlignVertical: 'top' },
    error: { color: colors.error, textAlign: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
    thanksCard: { gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xl },
    thanksBody: { textAlign: 'center' },
    doneBtn: { marginTop: spacing.md, alignSelf: 'stretch' },
  });
