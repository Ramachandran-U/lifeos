import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { createFoodEntry } from '@/db/queries/health';
import { format } from 'date-fns';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface AddFoodSheetProps {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  onSaved: () => void;
}

export function AddFoodSheet({ visible, mealType, onClose, onSaved }: AddFoodSheetProps) {
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const handleSave = () => {
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

    setFoodName('');
    setQuantity('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
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

              <Button title="Add food" onPress={handleSave} disabled={!foodName.trim() || !calories.trim()} />
            </View>
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
    maxHeight: '85%',
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
