import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SparkHeroCard } from '@/components/modules/polymath/SparkHeroCard';
import { darkColors } from '@/theme/colors';
import type { Spark } from '@/explore/spark';

const makeSpark = (overrides: Partial<Spark> = {}): Spark => ({
  id: 'spark_1',
  userId: 'user_1',
  date: '2026-06-03',
  status: 'new',
  threadId: null,
  createdAt: '2026-06-03T08:00:00.000Z',
  title: 'The math hidden in seashells',
  body: 'Logarithmic spirals show up in nautilus shells and galaxies alike — a tiny bridge between biology and geometry.',
  threadStarter: 'What other natural forms follow the same spiral law?',
  seedInterest: 'Biology',
  adjacentField: 'Geometry',
  ...overrides,
});

describe('SparkHeroCard (W4 restyle — Ink + Signal §3.2)', () => {
  it('renders the spark title, body and thread starter', () => {
    render(<SparkHeroCard spark={makeSpark()} onAction={() => {}} />);
    expect(screen.getByText('The math hidden in seashells')).toBeTruthy();
    expect(screen.getByText('What other natural forms follow the same spiral law?')).toBeTruthy();
  });

  it('carries no caps eyebrows — TODAY\'S SPARK and PULL THE THREAD are dead (§3.0.7)', () => {
    render(<SparkHeroCard spark={makeSpark()} onAction={() => {}} />);
    expect(screen.queryByText("TODAY'S SPARK")).toBeNull();
    expect(screen.queryByText('PULL THE THREAD')).toBeNull();
  });

  it('wears the 4px polymath left border on the background — no Card chrome', () => {
    const tree = render(<SparkHeroCard spark={makeSpark()} onAction={() => {}} />);
    const json = tree.toJSON() as { props: { style: StyleProp<ViewStyle> } };
    const style = StyleSheet.flatten(json.props.style);
    expect(style.borderLeftWidth).toBe(4);
    expect(style.borderLeftColor).toBe(darkColors.polymath);
    expect(style.backgroundColor).toBeUndefined();
  });

  it('shows the four action buttons while the spark is new, with Pull thread as the filled primary', () => {
    render(<SparkHeroCard spark={makeSpark({ status: 'new' })} onAction={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Expedition')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
    const pull = screen.getByText('Pull thread');
    // Filled polymath pill with inkOnColor label (§3.2 restyle).
    expect(StyleSheet.flatten(pull.props.style).color).toBe(darkColors.inkOnColor);
  });

  it('fires onAction with the chosen action key', () => {
    const onAction = jest.fn();
    render(<SparkHeroCard spark={makeSpark()} onAction={onAction} />);
    fireEvent.press(screen.getByText('Save'));
    expect(onAction).toHaveBeenCalledWith('save');
  });

  it('fires pull_thread from the primary pill', () => {
    const onAction = jest.fn();
    render(<SparkHeroCard spark={makeSpark()} onAction={onAction} />);
    fireEvent.press(screen.getByText('Pull thread'));
    expect(onAction).toHaveBeenCalledWith('pull_thread');
  });

  it('hides actions and shows the saved confirmation once acted on', () => {
    render(<SparkHeroCard spark={makeSpark({ status: 'saved' })} onAction={() => {}} />);
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.getByText('Saved to your constellation.')).toBeTruthy();
  });

  it('shows the dismissed confirmation when skipped', () => {
    render(<SparkHeroCard spark={makeSpark({ status: 'dismissed' })} onAction={() => {}} />);
    expect(screen.getByText('Skipped.')).toBeTruthy();
  });
});
