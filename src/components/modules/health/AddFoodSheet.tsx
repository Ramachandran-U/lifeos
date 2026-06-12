import { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { createFoodEntry, updateFoodEntry } from '@/db/queries/health';
import { recogniseFood } from '@/ai/functions';
import { parseSpokenMeal } from '@/ai/voiceFood';
import { useAI } from '@/hooks/useAI';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { format } from 'date-fns';
import type { FoodRecognition } from '@/ai/types';
import { searchFoods, scaleMacros } from '@/utils/foodSearch';
import { lookupBarcode } from '@/utils/openFoodFacts';
import { upgradeFoodRecognition } from '@/utils/upgradeFoodRecognition';
import { BarcodeScannerWeb, isBarcodeDetectorSupported } from './BarcodeScannerWeb';
import type { FoodItem } from '@/data/foods';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** An existing entry being edited. When set, the sheet opens straight into the
 *  prefilled manual form and saving updates the row instead of inserting. */
export interface FoodEntryEdit {
  id: string;
  mealType: string;
  foodName: string;
  quantityG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AddFoodSheetProps {
  visible: boolean;
  mealType: MealType;
  editEntry?: FoodEntryEdit | null;
  onClose: () => void;
  onSaved: () => void;
  onPhotoUsed?: () => void;
}

type Mode = 'choose' | 'manual' | 'scanning' | 'review' | 'barcode' | 'listening';

// Rotating prompts for the empty food-search box — concrete dishes read as
// "type anything", and hint that the bundled DB covers everyday meals.
const FOOD_SEARCH_PLACEHOLDERS = [
  'Type to search (dal, biryani, idli…)',
  'Search a dish — paneer tikka, oats…',
  'Grilled chicken, banana, coffee…',
  'What did you eat?',
];

export function AddFoodSheet({ visible, mealType, editEntry, onClose, onSaved, onPhotoUsed }: AddFoodSheetProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const { call, loading, error: aiError } = useAI();
  const [mode, setMode] = useState<Mode>('choose');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [recognised, setRecognised] = useState<FoodRecognition | null>(null);
  const [selectedItems, setSelectedItems] = useState<boolean[]>([]);

  // Manual entry state
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  // Validation message for the manual form (QA HE-02: reject negatives / NaN).
  const [manualError, setManualError] = useState<string | null>(null);

  // Bundled-DB search state. When the user picks a result we autofill the
  // macro fields from its default serving; if they then change the quantity,
  // we re-scale from the picked item rather than the raw text.
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [pickedItem, setPickedItem] = useState<FoodItem | null>(null);

  // Barcode lookup state.
  const [barcode, setBarcode] = useState('');
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [scannerOn, setScannerOn] = useState(false);
  const canScan = isBarcodeDetectorSupported();
  const isEditing = !!editEntry;
  const speech = useSpeechRecognition();

  // When opened to edit an existing entry, jump straight to the manual form
  // with its values prefilled.
  useEffect(() => {
    if (visible && editEntry) {
      setMode('manual');
      setFoodName(editEntry.foodName);
      setQuantity(String(editEntry.quantityG));
      setCalories(String(editEntry.calories));
      setProtein(String(editEntry.protein));
      setCarbs(String(editEntry.carbs));
      setFat(String(editEntry.fat));
      setPickedItem(null);
      setSearchResults([]);
    }
  }, [visible, editEntry]);

  const handleBarcodeLookup = async () => {
    const code = barcode.trim();
    if (!code) return;
    setBarcodeBusy(true);
    setBarcodeError(null);
    try {
      const result = await lookupBarcode(code);
      if (!result) {
        setBarcodeError('Not found in Open Food Facts. Try entering it manually.');
        return;
      }
      // Treat the OFF hit like a search result: pick it, prefill the manual
      // form, and drop the user there so they can confirm + save.
      handlePickResult(result.item);
      setMode('manual');
      setBarcode('');
    } catch (e) {
      setBarcodeError(e instanceof Error ? e.message : 'Lookup failed.');
    } finally {
      setBarcodeBusy(false);
    }
  };

  const handleNameChange = (next: string) => {
    setFoodName(next);
    if (pickedItem && next !== pickedItem.name) setPickedItem(null);
    setSearchResults(next.trim().length >= 2 ? searchFoods(next) : []);
  };

  const handlePickResult = (item: FoodItem) => {
    setPickedItem(item);
    setFoodName(item.name);
    setQuantity(String(item.defaultServing.quantityG));
    setCalories(String(item.defaultServing.calories));
    setProtein(String(item.defaultServing.protein));
    setCarbs(String(item.defaultServing.carbs));
    setFat(String(item.defaultServing.fat));
    setSearchResults([]);
  };

  const handleQuantityChange = (next: string) => {
    setQuantity(next);
    if (!pickedItem) return;
    const g = parseFloat(next);
    if (!Number.isFinite(g) || g <= 0) return;
    const scaled = scaleMacros(pickedItem.defaultServing, g);
    setCalories(String(scaled.calories));
    setProtein(String(scaled.protein));
    setCarbs(String(scaled.carbs));
    setFat(String(scaled.fat));
  };

  const reset = () => {
    setMode('choose');
    setPhotoUri(null);
    setRecognised(null);
    setSelectedItems([]);
    setFoodName('');
    setQuantity('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setSearchResults([]);
    setPickedItem(null);
    setBarcode('');
    setBarcodeError(null);
    setScannerOn(false);
    speech.stop();
    speech.reset();
  };

  // Voice food logging: dictate → transcribe (Web Speech API) → parse to items.
  const handleStartVoice = () => {
    speech.reset();
    setMode('listening');
    speech.start();
  };

  const handleVoiceDone = async () => {
    speech.stop();
    const text = speech.transcript.trim();
    if (!text) {
      setMode('choose');
      return;
    }
    setMode('scanning'); // reuse the spinner state while the model parses
    const raw = await call(() => parseSpokenMeal(text));
    if (raw) {
      const { recognition } = upgradeFoodRecognition(raw);
      setRecognised(recognition);
      setSelectedItems(recognition.items.map(() => true));
      setMode('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setMode('choose');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setMode('scanning');

      const mediaType = asset.mimeType ?? 'image/jpeg';
      const rawRecognition = await call(() => recogniseFood(asset.base64!, mediaType));
      if (rawRecognition) {
        // Upgrade AI macro estimates with DB lookups for confident name
        // matches — empirically the model undershoots kcal by 20–40%.
        const { recognition } = upgradeFoodRecognition(rawRecognition);
        setRecognised(recognition);
        setSelectedItems(recognition.items.map(() => true));
        setMode('review');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setMode('choose');
      }
    }
  };

  const handlePickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setMode('scanning');

      const mediaType = asset.mimeType ?? 'image/jpeg';
      const rawRecognition = await call(() => recogniseFood(asset.base64!, mediaType));
      if (rawRecognition) {
        // Upgrade AI macro estimates with DB lookups for confident name
        // matches — empirically the model undershoots kcal by 20–40%.
        const { recognition } = upgradeFoodRecognition(rawRecognition);
        setRecognised(recognition);
        setSelectedItems(recognition.items.map(() => true));
        setMode('review');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setMode('choose');
      }
    }
  };

  const toggleItem = (index: number) => {
    setSelectedItems(prev => prev.map((v, i) => i === index ? !v : v));
  };

  const handleConfirmRecognised = () => {
    if (!recognised) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    recognised.items.forEach((item, i) => {
      if (selectedItems[i]) {
        createFoodEntry({
          date: today,
          mealType,
          foodName: item.name,
          quantityG: item.quantityG,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        });
      }
    });

    onPhotoUsed?.();
    onSaved();
    handleClose();
  };

  // Parse a nutrition field: must be a finite, non-negative number. Returns
  // null for invalid input (negative or non-numeric like "abc") so we reject
  // the save instead of silently coercing to 0 / corrupting the daily total.
  // `defaultIfEmpty` covers optional fields left blank.
  const parseField = (raw: string, defaultIfEmpty: number): number | null => {
    if (!raw.trim()) return defaultIfEmpty;
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const handleManualSave = () => {
    if (!foodName.trim() || !calories.trim()) return;

    const calVal = parseField(calories, 0);
    const qtyVal = parseField(quantity, 100);
    const proVal = parseField(protein, 0);
    const carbVal = parseField(carbs, 0);
    const fatVal = parseField(fat, 0);
    if (calVal === null || qtyVal === null || proVal === null || carbVal === null || fatVal === null) {
      setManualError('Enter valid, non-negative numbers.');
      return;
    }
    setManualError(null);

    const fields = {
      foodName: foodName.trim(),
      quantityG: qtyVal || 100,
      calories: calVal,
      protein: proVal,
      carbs: carbVal,
      fat: fatVal,
    };

    if (editEntry) {
      updateFoodEntry(editEntry.id, fields);
    } else {
      createFoodEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        mealType,
        ...fields,
      });
    }

    onSaved();
    handleClose();
  };

  const renderChoose = () => (
    <>
      <View style={styles.handle} />
      <Heading style={styles.title}>Add {mealType}</Heading>
      <View style={styles.optionRow}>
        <Pressable style={styles.optionCard} onPress={handleTakePhoto}>
          <Ionicons name="camera" size={32} color={c.health} />
          <Body style={styles.optionLabel}>Take Photo</Body>
          <Caption>AI identifies your food</Caption>
        </Pressable>
        <Pressable style={styles.optionCard} onPress={handlePickFromGallery}>
          <Ionicons name="images" size={32} color={c.health} />
          <Body style={styles.optionLabel}>Gallery</Body>
          <Caption>Pick a food photo</Caption>
        </Pressable>
      </View>
      <View style={styles.optionRow}>
        <Pressable style={styles.optionCard} onPress={() => setMode('barcode')}>
          <Ionicons name="barcode" size={32} color={c.health} />
          <Body style={styles.optionLabel}>Barcode</Body>
          <Caption>Scan a packaged product</Caption>
        </Pressable>
        <Pressable style={styles.optionCard} onPress={() => setMode('manual')}>
          <Ionicons name="search" size={32} color={c.health} />
          <Body style={styles.optionLabel}>Search</Body>
          <Caption>~1,600 foods + macros</Caption>
        </Pressable>
      </View>
      {speech.supported && (
        <View style={styles.optionRow}>
          <Pressable style={styles.optionCard} onPress={handleStartVoice}>
            <Ionicons name="mic" size={32} color={c.health} />
            <Body style={styles.optionLabel}>Speak</Body>
            <Caption>Say what you ate</Caption>
          </Pressable>
          <View style={styles.optionSpacer} />
        </View>
      )}
      {/* Voice/photo recognition failures land back on this screen (their
          handlers fall through to 'choose' on a null result) — say why instead
          of silently resetting. Raw proxy errors stay out of the UI. */}
      {aiError ? (
        <Body style={styles.voiceError}>
          {aiError.startsWith('AI proxy')
            ? 'The AI service had a problem. Try again in a moment.'
            : aiError}
        </Body>
      ) : null}
    </>
  );

  const renderListening = () => (
    <>
      <View style={styles.handle} />
      <Heading style={styles.title}>Say what you ate</Heading>
      <Caption style={styles.voiceHint}>
        e.g. &ldquo;two eggs, a slice of toast with butter, and a black coffee&rdquo;
      </Caption>
      <Card style={styles.voiceCard}>
        <View style={styles.voiceMicRow}>
          <Ionicons name={speech.listening ? 'mic' : 'mic-off'} size={20} color={speech.listening ? c.health : c.textMuted} />
          <Caption style={{ color: c.textSecondary }}>{speech.listening ? 'Listening…' : 'Paused'}</Caption>
        </View>
        <Body style={styles.voiceTranscript}>
          {speech.transcript || 'Your words will appear here.'}
        </Body>
      </Card>
      {speech.error ? <Body style={styles.voiceError}>{speech.error}</Body> : null}
      <Button title="Done" onPress={handleVoiceDone} disabled={!speech.transcript.trim()} />
      {/* Recognition can end with nothing heard (mic muted, pause too long) —
          without this the user faces only a disabled Done and Cancel. */}
      {!speech.listening && !speech.transcript.trim() ? (
        <Button title="Listen again" variant="ghost" onPress={speech.start} />
      ) : null}
      <Button title="Cancel" variant="ghost" onPress={() => { speech.stop(); setMode('choose'); }} />
    </>
  );

  // Once the camera fires a code, auto-lookup so the user doesn't have to
  // press a second button. Done inline (not via state effect) so the call
  // doesn't fire on every re-render.
  const handleScannerDetect = (code: string) => {
    setScannerOn(false);
    setBarcode(code);
    setBarcodeBusy(true);
    setBarcodeError(null);
    lookupBarcode(code)
      .then((result) => {
        if (!result) {
          setBarcodeError(`Barcode ${code} not in Open Food Facts. Try a different one or enter macros manually.`);
          return;
        }
        handlePickResult(result.item);
        setMode('manual');
        setBarcode('');
      })
      .catch((e) => setBarcodeError(e instanceof Error ? e.message : 'Lookup failed.'))
      .finally(() => setBarcodeBusy(false));
  };

  const renderBarcode = () => (
    <>
      <View style={styles.handle} />
      <Heading style={styles.title}>Look up barcode</Heading>
      <Caption style={styles.barcodeHint}>
        {scannerOn
          ? 'Hold the package barcode inside the box. Detection is automatic.'
          : Platform.OS === 'web' && canScan
            ? 'Scan with your camera, or type the digits if you prefer. Powered by Open Food Facts — best for international brands; Indian packaged snacks may have gaps.'
            : 'Type the barcode digits from the package (8–13 digits). Powered by Open Food Facts.'}
      </Caption>

      {scannerOn && Platform.OS === 'web' ? (
        <BarcodeScannerWeb
          onScan={handleScannerDetect}
          onError={(msg) => { setBarcodeError(msg); setScannerOn(false); }}
        />
      ) : null}

      <View style={styles.form}>
        {Platform.OS === 'web' && canScan && !scannerOn ? (
          <Button title="📷 Scan with camera" onPress={() => { setBarcodeError(null); setScannerOn(true); }} />
        ) : null}
        {scannerOn ? (
          <Button title="Stop scanning" variant="ghost" onPress={() => setScannerOn(false)} />
        ) : null}
        <Input
          label="Barcode"
          placeholder="e.g. 8901058851656"
          value={barcode}
          onChangeText={(t) => { setBarcode(t.replace(/[^\d]/g, '')); setBarcodeError(null); }}
          keyboardType="numeric"
        />
        {barcodeError ? <Body style={styles.barcodeError}>{barcodeError}</Body> : null}
        <Button
          title={barcodeBusy ? 'Looking up…' : 'Look up'}
          onPress={handleBarcodeLookup}
          disabled={!barcode.trim() || barcodeBusy}
        />
        <Button title="Back" variant="ghost" onPress={() => { setMode('choose'); setBarcode(''); setBarcodeError(null); setScannerOn(false); }} />
      </View>
    </>
  );

  const renderScanning = () => (
    <>
      <View style={styles.handle} />
      <Heading style={styles.title}>Scanning your meal...</Heading>
      {photoUri && <Image source={{ uri: photoUri }} style={styles.previewImage} />}
      <View style={styles.scanningContainer}>
        <LoadingDots />
        <Body style={styles.scanningText}>Identifying food items...</Body>
      </View>
    </>
  );

  const renderReview = () => {
    const selectedTotal = recognised?.items.reduce((sum, item, i) => {
      if (!selectedItems[i]) return sum;
      return { calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 }) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

    return (
      <>
        <View style={styles.handle} />
        <Heading style={styles.title}>Review your meal</Heading>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.previewImageSmall} />}

        {recognised?.items.map((item, i) => (
          <Pressable
            key={i}
            style={[styles.reviewItem, !selectedItems[i] && styles.reviewItemDeselected]}
            onPress={() => toggleItem(i)}
          >
            <View style={styles.reviewCheck}>
              <Ionicons
                name={selectedItems[i] ? 'checkbox' : 'square-outline'}
                size={22}
                color={selectedItems[i] ? c.health : c.textMuted}
              />
            </View>
            <View style={styles.reviewContent}>
              <Body style={styles.reviewName}>{item.name}</Body>
              <Caption>{item.quantity} - {item.calories} cal</Caption>
              <Caption>P: {item.protein}g  C: {item.carbs}g  F: {item.fat}g</Caption>
            </View>
          </Pressable>
        ))}

        <Card style={styles.totalCard}>
          <Label color={c.health}>TOTAL</Label>
          <Body>{selectedTotal.calories} cal  |  P: {selectedTotal.protein}g  C: {selectedTotal.carbs}g  F: {selectedTotal.fat}g</Body>
        </Card>

        <Button title="Confirm & save" onPress={handleConfirmRecognised} />
        <Button title="Re-scan" variant="ghost" onPress={() => { setMode('choose'); setRecognised(null); }} />
      </>
    );
  };

  const renderManual = () => (
    <>
      <View style={styles.handle} />
      <Heading style={styles.title}>{isEditing ? 'Edit food' : `Add ${mealType}`}</Heading>
      <View style={styles.form}>
        <Input
          label="Food name"
          rotatingPlaceholders={FOOD_SEARCH_PLACEHOLDERS}
          value={foodName}
          onChangeText={handleNameChange}
        />
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((item) => (
              <Pressable key={item.id} style={styles.searchResult} onPress={() => handlePickResult(item)}>
                <View style={styles.searchResultLeft}>
                  <Body style={styles.searchResultName}>{item.name}</Body>
                  <Caption>
                    {item.defaultServing.label} · {item.defaultServing.calories} cal · P {item.defaultServing.protein}g · C {item.defaultServing.carbs}g · F {item.defaultServing.fat}g
                  </Caption>
                </View>
                <Ionicons name="add-circle" size={24} color={c.health} />
              </Pressable>
            ))}
          </View>
        )}
        {pickedItem && (
          <Caption style={styles.pickedHint}>
            From bundled DB · {pickedItem.source === 'curated-seed' ? 'approximate' : pickedItem.source.toUpperCase()} · macros auto-scale with quantity
          </Caption>
        )}
        <Input
          label="Quantity (g)"
          placeholder="100"
          value={quantity}
          onChangeText={handleQuantityChange}
          keyboardType="numeric"
        />
        <Input label="Calories" placeholder="250" value={calories} onChangeText={setCalories} keyboardType="numeric" />
        <View style={styles.macroRow}>
          <View style={styles.macroInput}>
            <Input label="Protein (g)" placeholder="0" value={protein} onChangeText={setProtein} keyboardType="numeric" />
          </View>
          <View style={styles.macroInput}>
            <Input label="Carbs (g)" placeholder="0" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
          </View>
          <View style={styles.macroInput}>
            <Input label="Fat (g)" placeholder="0" value={fat} onChangeText={setFat} keyboardType="numeric" />
          </View>
        </View>
        {manualError ? <Body style={styles.barcodeError}>{manualError}</Body> : null}
        <Button title={isEditing ? 'Save changes' : 'Add food'} onPress={handleManualSave} disabled={!foodName.trim() || !calories.trim()} />
        <Button title={isEditing ? 'Cancel' : 'Back'} variant="ghost" onPress={() => (isEditing ? handleClose() : setMode('choose'))} />
      </View>
    </>
  );

  return (
    // Native slide handles the exit animation; onRequestClose wires Esc (web)
    // and the Android back button, matching every other sheet (cf. KB-04).
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            {mode === 'choose' && renderChoose()}
            {mode === 'scanning' && renderScanning()}
            {mode === 'review' && renderReview()}
            {mode === 'manual' && renderManual()}
            {mode === 'barcode' && renderBarcode()}
            {mode === 'listening' && renderListening()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  // Choose mode
  optionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  optionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  optionLabel: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
  },
  optionSpacer: { flex: 1 },
  voiceHint: { color: colors.textMuted, marginBottom: spacing.sm },
  voiceCard: { gap: spacing.sm, minHeight: 96, marginBottom: spacing.md },
  voiceMicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voiceTranscript: { color: colors.textPrimary },
  voiceError: { color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  manualBtn: {
    marginTop: spacing.xs,
  },
  // Scanning
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  previewImageSmall: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  scanningText: {
    color: colors.textSecondary,
  },
  // Review
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewItemDeselected: {
    opacity: 0.5,
  },
  reviewCheck: {
    marginRight: spacing.sm,
  },
  reviewContent: {
    flex: 1,
    gap: 2,
  },
  reviewName: {
    fontFamily: fonts.bodyMedium,
  },
  totalCard: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  // Manual
  form: {
    gap: spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroInput: {
    flex: 1,
  },
  // Search results dropdown
  searchResults: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -spacing.xs,
    overflow: 'hidden',
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchResultLeft: {
    flex: 1,
    gap: 2,
  },
  searchResultName: {
    fontFamily: fonts.bodyMedium,
  },
  pickedHint: {
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: -spacing.xs,
  },
  barcodeHint: {
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  barcodeError: {
    color: colors.error,
    textAlign: 'center',
  },
});
