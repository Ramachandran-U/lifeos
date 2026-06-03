import { render, screen, fireEvent } from '@testing-library/react-native';
import { DomainMiniCard } from '@/components/gamification/DomainMiniCard';
import { DOMAIN_META } from '@/constants/gamification';

describe('DomainMiniCard', () => {
  it('renders the domain label, score and emoji', () => {
    const dm = DOMAIN_META[0]; // goals
    render(<DomainMiniCard domainKey={dm.key} score={72} delta={5} history={[60, 65, 72]} />);
    expect(screen.getByText(dm.label)).toBeTruthy();
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText(dm.emoji)).toBeTruthy();
  });

  it('shows an up arrow with the absolute delta for a positive change', () => {
    render(<DomainMiniCard domainKey="health" score={80} delta={6} history={[74, 78, 80]} />);
    expect(screen.getByText('↑6')).toBeTruthy();
  });

  it('shows a down arrow with the absolute delta for a negative change', () => {
    render(<DomainMiniCard domainKey="finance" score={40} delta={-9} history={[49, 45, 40]} />);
    expect(screen.getByText('↓9')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<DomainMiniCard domainKey="social" score={50} delta={0} history={[50, 50]} onPress={onPress} />);
    fireEvent.press(screen.getByText('50'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
