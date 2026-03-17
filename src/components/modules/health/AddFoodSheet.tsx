import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { createFoodEntry } from '@/db/queries/health';
import { recogniseFood } from '@/ai/functions';
import { useAI } from '@/hooks/useAI';
import { format } from 'date-fns';
import type { FoodRecognition } from '@/ai/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface AddFoodSheetProps {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  onSaved: () => void;
  onPhotoUsed?: () => void;
}

type Mode = 'choose' | 'manual' | 'scanning' | 'review';

export function AddFoodSheet({ visible, mealType, onClose, onSaved, onPhotoUsed }: AddFoodSheetProps) {
  const { call, loading } = useAI();
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
      const recognition = await call(() => recogniseFood(asset.base64!, mediaType));
      if (recognition) {
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
      const recognition = await call(() => recogniseFood(asset.base64!, mediaType));
      if (recognition) {
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

  const handleManualSave = () => {
    if (!foodName.trim() || !calories.trim()) return;

    createFoodEntry({
      date: format(new Date(), 'yyyy-MM-dd'),
      mealType,
      foodName: foodName.trim(),
      quantityG: parseFloat(quantity) || 100,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    });

    onSaved();
    handleClose();
  };

  const renderChoose = () => (
    <>
      <View style={styles.handle} />
      <Heading style={styles.title}>Add {mealType}</Heading>
      <View style={styles.optionRow}>
        <Pressable style={styles.optionCard} onPress={handleTakePhoto}>
          <Ionicons name="camera" size={32} color={colors.health} />
          <Body style={styles.optionLabel}>Take Photo</Body>
          <Caption>AI identifies your food</Caption>
        </Pressable>
        <Pressable style={styles.optionCard} onPress={handlePickFromGallery}>
          <Ionicons name="images" size={32} color={colors.health} />
          <Body style={styles.optionLabel}>Gallery</Body>
          <Caption>Pick a food photo</Caption>
        </Pressable>
      </View>
      <Button title="Enter manually" variant="secondary" onPress={() => setMode('manual')} style={styles.manualBtn} />
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
                color={selectedItems[i] ? colors.health : colors.textMuted}
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
          <Label color={colors.health}>TOTAL</Label>
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
      <Heading style={styles.title}>Add {mealType}</Heading>
      <View style={styles.form}>
        <Input label="Food name" placeholder="e.g. Grilled chicken" value={foodName} onChangeText={setFoodName} />
        <Input label="Quantity (g)" placeholder="100" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
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
        <Button title="Add food" onPress={handleManualSave} disabled={!foodName.trim() || !calories.trim()} />
        <Button title="Back" variant="ghost" onPress={() => setMode('choose')} />
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            {mode === 'choose' && renderChoose()}
            {mode === 'scanning' && renderScanning()}
            {mode === 'review' && renderReview()}
            {mode === 'manual' && renderManual()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
