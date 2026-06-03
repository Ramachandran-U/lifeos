import { render, screen } from '@testing-library/react-native';
import { CalorieRing } from '@/components/modules/health/CalorieRing';

describe('CalorieRing', () => {
  it('renders the rounded consumed count and the target', () => {
    render(<CalorieRing consumed={1850.4} target={2000} protein={90} carbs={210} fat={60} />);
    expect(screen.getByText('1850')).toBeTruthy();
    expect(screen.getByText('/ 2000 kcal')).toBeTruthy();
  });

  it('renders macro labels and gram values without targets', () => {
    render(<CalorieRing consumed={1000} target={2000} protein={90} carbs={210} fat={60} />);
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('Fat')).toBeTruthy();
    expect(screen.getByText('90g')).toBeTruthy();
    expect(screen.getByText('210g')).toBeTruthy();
    expect(screen.getByText('60g')).toBeTruthy();
  });

  it('renders "eaten / target g" when macro goals are supplied', () => {
    render(
      <CalorieRing
        consumed={1000}
        target={2000}
        protein={90}
        carbs={210}
        fat={60}
        proteinTarget={120}
        carbsTarget={250}
        fatTarget={70}
      />,
    );
    expect(screen.getByText('90/120g')).toBeTruthy();
    expect(screen.getByText('210/250g')).toBeTruthy();
    expect(screen.getByText('60/70g')).toBeTruthy();
  });

  it('does not divide by zero when the target is 0', () => {
    render(<CalorieRing consumed={500} target={0} protein={10} carbs={20} fat={5} />);
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.getByText('/ 0 kcal')).toBeTruthy();
  });
});
