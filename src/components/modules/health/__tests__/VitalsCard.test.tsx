import { render, screen, fireEvent } from '@testing-library/react-native';
import { VitalsCard } from '@/components/modules/health/VitalsCard';

describe('VitalsCard', () => {
  it('renders BMI, weight, height and the category label', () => {
    render(
      <VitalsCard
        weightKg={70}
        heightCm={175}
        bmi={22.9}
        category="healthy"
        trendDirection="flat"
        trendDelta={0}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('VITALS')).toBeTruthy();
    expect(screen.getByText('22.9')).toBeTruthy();
    expect(screen.getByText('70 kg')).toBeTruthy();
    expect(screen.getByText('175 cm')).toBeTruthy();
    expect(screen.getByText('Healthy')).toBeTruthy();
  });

  it('renders an em dash for missing values and no category', () => {
    render(
      <VitalsCard
        weightKg={null}
        heightCm={null}
        bmi={null}
        category={null}
        trendDirection={null}
        trendDelta={null}
        onEdit={() => {}}
      />,
    );
    // BMI + weight + height all fall back to '—'
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('Healthy')).toBeNull();
  });

  it('renders a positive trend delta with a leading +', () => {
    render(
      <VitalsCard
        weightKg={72}
        heightCm={175}
        bmi={23.5}
        category="healthy"
        trendDirection="up"
        trendDelta={1.5}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('+1.5 kg')).toBeTruthy();
  });

  it('renders a negative trend delta as-is', () => {
    render(
      <VitalsCard
        weightKg={68}
        heightCm={175}
        bmi={22.2}
        category="healthy"
        trendDirection="down"
        trendDelta={-2}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('-2 kg')).toBeTruthy();
  });

  it('fires onEdit when the Edit button is pressed', () => {
    const onEdit = jest.fn();
    render(
      <VitalsCard
        weightKg={70}
        heightCm={175}
        bmi={22.9}
        category="healthy"
        trendDirection="flat"
        trendDelta={0}
        onEdit={onEdit}
      />,
    );
    fireEvent.press(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
