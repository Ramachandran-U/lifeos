import { render } from '@testing-library/react-native';
import { XpBar } from '@/components/gamification/XpBar';

describe('XpBar', () => {
  it('renders without crashing at a mid value', () => {
    const tree = render(<XpBar pct={0.5} color="#5B4FE8" />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders without crashing for out-of-range / custom-height values', () => {
    expect(render(<XpBar pct={1.5} color="#5B4FE8" height={4} />).toJSON()).toBeTruthy();
    expect(render(<XpBar pct={-0.2} color="#5B4FE8" />).toJSON()).toBeTruthy();
  });
});
