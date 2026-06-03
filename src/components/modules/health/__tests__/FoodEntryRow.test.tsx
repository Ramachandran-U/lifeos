import { render, screen, fireEvent } from '@testing-library/react-native';
import { FoodEntryRow } from '@/components/modules/health/FoodEntryRow';

describe('FoodEntryRow', () => {
  it('renders the food name, rounded quantity, calories and macro line', () => {
    render(
      <FoodEntryRow foodName="Oatmeal" calories={320.6} protein={12.2} carbs={54.7} fat={6.1} quantityG={250.4} />,
    );
    expect(screen.getByText('Oatmeal')).toBeTruthy();
    expect(screen.getByText('250g')).toBeTruthy();
    expect(screen.getByText('321 kcal')).toBeTruthy();
    expect(screen.getByText('P:12g C:55g F:6g')).toBeTruthy();
  });

  it('fires onEdit when the row is pressed', () => {
    const onEdit = jest.fn();
    render(
      <FoodEntryRow
        foodName="Apple"
        calories={95}
        protein={0}
        carbs={25}
        fat={0}
        quantityG={180}
        onEdit={onEdit}
      />,
    );
    fireEvent.press(screen.getByLabelText('Edit Apple'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders no delete control when onDelete is absent', () => {
    render(<FoodEntryRow foodName="Apple" calories={95} protein={0} carbs={25} fat={0} quantityG={180} />);
    expect(screen.queryByLabelText('Delete Apple')).toBeNull();
  });

  it('fires onDelete from the trash control without firing onEdit', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    render(
      <FoodEntryRow
        foodName="Banana"
        calories={105}
        protein={1}
        carbs={27}
        fat={0}
        quantityG={120}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    fireEvent.press(screen.getByLabelText('Delete Banana'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
