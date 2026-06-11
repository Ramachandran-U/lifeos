import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { isContactsConnected, startContactsOAuth } from '@/integrations/googleContacts/oauth';
import { fetchGoogleContacts, type GoogleContact } from '@/integrations/googleContacts/client';
import { createContact, RELATIONSHIP_TIERS, RELATIONSHIP_META, type RelationshipType } from '@/db/queries/social';

type Phase = 'idle' | 'loading' | 'review' | 'error';

/** Cap rows mounted at once — a large address book would jank a plain ScrollView. */
const MAX_VISIBLE_CONTACTS = 150;

const webTextInputOutline = Platform.select({ web: { outlineStyle: 'none' as const } as object, default: {} });

/**
 * Import contacts (+ birthdays) from Google into the Social engine. Web-only
 * (Google OAuth is web-only). Connect → fetch → review/multi-select with a
 * default relationship tier → create the chosen contacts. Contacts already on
 * file (by name) are filtered out so re-importing doesn't duplicate.
 */
export function ContactsImportCard({
  userId,
  existingNames,
  onImported,
}: {
  userId: string;
  existingNames: string[];
  onImported: () => void;
}) {
  const c = useColors();
  const styles = makeStyles(c);

  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fetched, setFetched] = useState<GoogleContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tier, setTier] = useState<RelationshipType>('acquaintance');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') setConnected(isContactsConnected());
  }, []);

  if (Platform.OS !== 'web') return null;

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  const handleConnect = () => {
    if (!clientId) {
      setError('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      setPhase('error');
      return;
    }
    void startContactsOAuth(clientId); // redirects; returns to Social via the callback
  };

  const handleImport = async () => {
    if (!clientId) return;
    setPhase('loading');
    setError(null);
    try {
      const have = new Set(existingNames.map((n) => n.toLowerCase()));
      const fresh = (await fetchGoogleContacts(clientId)).filter((g) => !have.has(g.name.toLowerCase()));
      if (fresh.length === 0) {
        setError('No new contacts to import — they may already be on file.');
        setPhase('error');
        return;
      }
      setFetched(fresh);
      // Default-select the high-signal ones (those with a birthday → power nudges).
      setSelected(new Set(fresh.map((g, i) => (g.birthday ? i : -1)).filter((i) => i >= 0)));
      setQuery('');
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('error');
    }
  };

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const confirm = () => {
    for (const i of selected) {
      const g = fetched[i];
      if (!g) continue;
      createContact({
        userId,
        name: g.name,
        relationshipType: tier,
        birthday: g.birthday ?? undefined,
        source: 'phone_import',
      });
    }
    onImported();
    setPhase('idle');
    setFetched([]);
    setSelected(new Set());
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="people-circle-outline" size={18} color={c.social} />
        <Label color={c.social}>IMPORT FROM GOOGLE CONTACTS</Label>
      </View>
      <Caption style={{ color: c.textMuted }}>
        Bring in people (and birthdays) to stay in touch with. Read-only — you choose who's added,
        and names stay on this device.
      </Caption>

      {!connected ? (
        <Pressable onPress={handleConnect} style={[styles.btn, { backgroundColor: c.socialDim ?? c.surface }]}>
          <Ionicons name="link" size={15} color={c.social} />
          <Label color={c.social}>Connect Google Contacts</Label>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleImport}
          disabled={phase === 'loading'}
          style={[styles.btn, { backgroundColor: c.socialDim ?? c.surface }]}
        >
          {phase === 'loading' ? (
            <LoadingDots />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={15} color={c.social} />
              <Label color={c.social}>Import contacts</Label>
            </>
          )}
        </Pressable>
      )}

      {phase === 'error' && error && <Caption style={{ color: c.error }}>{error}</Caption>}

      <ReviewModal
        visible={phase === 'review'}
        fetched={fetched}
        selected={selected}
        tier={tier}
        query={query}
        c={c}
        onTier={setTier}
        onQuery={setQuery}
        onToggle={toggle}
        onCancel={() => setPhase('idle')}
        onConfirm={confirm}
      />
    </Card>
  );
}

function ReviewModal({
  visible,
  fetched,
  selected,
  tier,
  query,
  c,
  onTier,
  onQuery,
  onToggle,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  fetched: GoogleContact[];
  selected: Set<number>;
  tier: RelationshipType;
  query: string;
  c: AppColors;
  onTier: (t: RelationshipType) => void;
  onQuery: (q: string) => void;
  onToggle: (i: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = makeStyles(c);
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      fetched
        .map((g, i) => ({ g, i }))
        .filter(({ g }) => q === '' || g.name.toLowerCase().includes(q)),
    [fetched, q],
  );
  // Cap rendered rows — a large address book would jank a plain ScrollView.
  // Selection is by original index, so pre-selected rows beyond the cap still
  // import; search narrows to find anyone not shown.
  const shown = matches.slice(0, MAX_VISIBLE_CONTACTS);
  const hidden = matches.length - shown.length;
  const count = selected.size;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label color={c.social}>CHOOSE WHO TO ADD</Label>

          <View style={styles.tierRow}>
            {RELATIONSHIP_TIERS.map((t) => {
              const on = t === tier;
              return (
                <Pressable
                  key={t}
                  onPress={() => onTier(t)}
                  style={[styles.tierChip, { borderColor: on ? c.social : c.border, backgroundColor: on ? c.social + '22' : 'transparent' }]}
                >
                  <Caption style={{ color: on ? c.social : c.textSecondary }}>{RELATIONSHIP_META[t].label}</Caption>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.search, { borderColor: c.border, backgroundColor: c.card }]}>
            <Ionicons name="search" size={15} color={c.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: c.textPrimary }]}
              value={query}
              onChangeText={onQuery}
              placeholder="Search contacts"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
            />
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ gap: 2 }} keyboardShouldPersistTaps="handled">
            {shown.map(({ g, i }) => {
              const on = selected.has(i);
              return (
                <Pressable key={`${g.name}-${i}`} onPress={() => onToggle(i)} style={styles.row}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? c.social : c.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ color: c.textPrimary, fontFamily: fonts.bodyMedium }}>{g.name}</Body>
                    {g.birthday && (
                      <Caption style={{ color: c.textMuted }}>🎂 {g.birthday}</Caption>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {hidden > 0 && (
            <Caption style={{ color: c.textMuted }}>+{hidden} more — search to narrow the list.</Caption>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Body style={{ color: c.textSecondary }}>Cancel</Body>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={count === 0}
              style={[styles.confirmBtn, { backgroundColor: c.social, opacity: count === 0 ? 0.5 : 1 }]}
            >
              <Body style={{ color: '#FFFFFF', fontFamily: fonts.bodyMedium }}>
                Add {count} as {RELATIONSHIP_META[tier].label.toLowerCase()}
              </Body>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: { gap: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      minHeight: 44,
    },
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      padding: spacing.lg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      maxHeight: '85%',
    },
    tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    tierChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1.5,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
    },
    searchInput: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.md, padding: 0, ...webTextInputOutline },
    list: { maxHeight: 320 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
    cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, justifyContent: 'center' },
    confirmBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
