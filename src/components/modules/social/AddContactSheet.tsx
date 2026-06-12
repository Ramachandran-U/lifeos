import { useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Heading, Body, Caption } from '@/components/ui/Typography';
import { Button3D } from '@/components/ui/Button3D';
import { Input } from '@/components/ui/Input';
import {
  createContact,
  RELATIONSHIP_META,
  RELATIONSHIP_TIERS,
  type RelationshipType,
} from '@/db/queries/social';

interface AddContactSheetProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Mode = 'menu' | 'manual' | 'import';

interface PickedPhoneContact {
  name: string;
  selected: boolean;
}

export function AddContactSheet({ visible, userId, onClose, onCreated }: AddContactSheetProps) {
  const c = useColors();
  const [mode, setMode] = useState<Mode>('menu');

  // Manual form
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [relType, setRelType] = useState<RelationshipType>('close_friend');
  const [notes, setNotes] = useState('');

  // Import flow
  const [phoneContacts, setPhoneContacts] = useState<PickedPhoneContact[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importRelType, setImportRelType] = useState<RelationshipType>('acquaintance');

  const reset = useCallback(() => {
    setMode('menu');
    setName('');
    setNickname('');
    setRelType('close_friend');
    setNotes('');
    setPhoneContacts([]);
    setImportLoading(false);
    setImportRelType('acquaintance');
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const saveManual = () => {
    if (!name.trim()) return;
    createContact({
      userId,
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      relationshipType: relType,
      notes: notes.trim() || undefined,
    });
    onCreated();
    close();
  };

  const loadPhoneContacts = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Phone contacts can only be imported on iOS or Android.');
      return;
    }
    setImportLoading(true);
    try {
      // Dynamic import so web bundles don't try to resolve the native module.
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'LifeOS needs contacts access to import people. Your contacts stay on this device.',
        );
        setImportLoading(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name],
      });
      const picks: PickedPhoneContact[] = data
        .map((d) => (d.name ?? '').trim())
        .filter((n) => n.length > 0)
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name, selected: false }));
      setPhoneContacts(picks);
    } catch (err) {
      Alert.alert('Could not load contacts', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setImportLoading(false);
    }
  };

  const togglePick = (idx: number) => {
    setPhoneContacts((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));
  };

  const importPicked = () => {
    const picked = phoneContacts.filter((p) => p.selected);
    if (picked.length === 0) return;
    picked.forEach((p) => {
      createContact({
        userId,
        name: p.name,
        relationshipType: importRelType,
        source: 'phone_import',
      });
    });
    onCreated();
    close();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderMenu = () => (
    <View style={styles.menu}>
      <Pressable
        onPress={() => setMode('manual')}
        style={({ pressed }) => [styles.menuItem, { backgroundColor: c.card, borderColor: pressed ? c.social : c.border }]}
      >
        <View style={[styles.menuIcon, { backgroundColor: c.socialDim }]}>
          <Ionicons name="person-add" size={22} color={c.social} />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={[styles.menuLabel, { color: c.textPrimary }]}>Add manually</Body>
          <Caption style={{ color: c.textMuted }}>Name, relationship, cadence</Caption>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>

      {Platform.OS !== 'web' ? (
        <Pressable
          onPress={() => {
            setMode('import');
            loadPhoneContacts();
          }}
          style={({ pressed }) => [styles.menuItem, { backgroundColor: c.card, borderColor: pressed ? c.social : c.border }]}
        >
          <View style={[styles.menuIcon, { backgroundColor: c.socialDim }]}>
            <Ionicons name="phone-portrait" size={22} color={c.social} />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={[styles.menuLabel, { color: c.textPrimary }]}>Import from phone</Body>
            <Caption style={{ color: c.textMuted }} numberOfLines={2}>
              Pick contacts to add. Names stay on this device.
            </Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderTierPicker = (current: RelationshipType, onChange: (t: RelationshipType) => void) => (
    <View style={styles.tierGrid}>
      {RELATIONSHIP_TIERS.map((t) => {
        const active = t === current;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={[
              styles.tierChip,
              {
                backgroundColor: active ? c.socialDim : c.card,
                borderColor: active ? c.social : c.border,
              },
            ]}
          >
            <Caption style={{ color: active ? c.socialText : c.textSecondary }}>
              {RELATIONSHIP_META[t].label}
            </Caption>
          </Pressable>
        );
      })}
    </View>
  );

  const renderManual = () => (
    <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
      <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Priya" />
      <Input label="Nickname (optional)" value={nickname} onChangeText={setNickname} placeholder="Optional" />

      <Caption style={[styles.fieldLabel, { color: c.textSecondary }]}>Relationship</Caption>
      {renderTierPicker(relType, setRelType)}

      <Caption style={[styles.cadenceHint, { color: c.textMuted }]}>
        Suggested cadence: every {RELATIONSHIP_META[relType].defaultCadenceDays} days. You can tune this on the contact later.
      </Caption>

      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" multiline />

      <Button3D title="Add contact" tone="social" onPress={saveManual} disabled={!name.trim()} />
    </ScrollView>
  );

  const renderImport = () => {
    const pickedCount = phoneContacts.filter((p) => p.selected).length;
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Caption style={[styles.fieldLabel, { color: c.textSecondary }]}>Default tier for selected</Caption>
          {renderTierPicker(importRelType, setImportRelType)}
          <Caption style={{ color: c.textMuted, marginTop: spacing.xs }}>
            You can re-tier any contact from their detail screen.
          </Caption>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
          {importLoading ? (
            <Caption style={{ color: c.textMuted }}>Loading contacts…</Caption>
          ) : phoneContacts.length === 0 ? (
            <Caption style={{ color: c.textMuted }}>No contacts found.</Caption>
          ) : (
            phoneContacts.map((p, i) => (
              <Pressable
                key={`${p.name}-${i}`}
                onPress={() => togglePick(i)}
                style={[styles.pickRow, { borderBottomColor: c.border }]}
              >
                <Ionicons
                  name={p.selected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={p.selected ? c.social : c.textMuted}
                />
                <Body style={{ color: c.textPrimary, flex: 1 }} numberOfLines={1}>
                  {p.name}
                </Body>
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={{ padding: spacing.lg }}>
          <Button3D
            title={`Import ${pickedCount} contact${pickedCount === 1 ? '' : 's'}`}
            tone="social"
            onPress={importPicked}
            disabled={pickedCount === 0}
          />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={close} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <View style={styles.header}>
          {mode !== 'menu' ? (
            <Pressable onPress={() => setMode('menu')} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <Heading style={{ color: c.textPrimary }}>
            {mode === 'menu' ? 'Add contact' : mode === 'manual' ? 'New contact' : 'Pick from phone'}
          </Heading>
          <Pressable onPress={close} hitSlop={12}>
            <Ionicons name="close" size={22} color={c.textPrimary} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {mode === 'menu' ? renderMenu() : mode === 'manual' ? renderManual() : renderImport()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  menu: { padding: spacing.lg, gap: spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontFamily: fonts.heading, fontSize: fontSizes.md },
  formBody: { padding: spacing.lg, gap: spacing.md },
  fieldLabel: { marginTop: spacing.sm, marginBottom: spacing.xs },
  cadenceHint: { marginTop: spacing.xs },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tierChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
});
