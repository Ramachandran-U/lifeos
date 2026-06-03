import { render } from '@testing-library/react-native';
import { Sparkline } from '@/components/gamification/Sparkline';

describe('Sparkline (gamification)', () => {
  it('renders nothing for fewer than two data points', () => {
    expect(render(<Sparkline data={[]} color="#5B4FE8" />).toJSON()).toBeNull();
    expect(render(<Sparkline data={[5]} color="#5B4FE8" />).toJSON()).toBeNull();
  });

  it('renders an svg for two or more points', () => {
    const tree = render(<Sparkline data={[1, 4, 2, 8, 6]} color="#5B4FE8" width={72} height={24} />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('does not crash when all points are equal (zero range)', () => {
    expect(render(<Sparkline data={[3, 3, 3]} color="#5B4FE8" />).toJSON()).toBeTruthy();
  });
});
