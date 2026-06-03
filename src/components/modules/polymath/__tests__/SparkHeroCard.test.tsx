import { render, screen, fireEvent } from '@testing-library/react-native';
import { SparkHeroCard } from '@/components/modules/polymath/SparkHeroCard';
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

describe('SparkHeroCard', () => {
  it('renders the spark title, body and thread starter', () => {
    render(<SparkHeroCard spark={makeSpark()} onAction={() => {}} />);
    expect(screen.getByText("TODAY'S SPARK")).toBeTruthy();
    expect(screen.getByText('The math hidden in seashells')).toBeTruthy();
    expect(screen.getByText('What other natural forms follow the same spiral law?')).toBeTruthy();
  });

  it('shows the four action buttons while the spark is new', () => {
    render(<SparkHeroCard spark={makeSpark({ status: 'new' })} onAction={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Pull thread')).toBeTruthy();
    expect(screen.getByText('Expedition')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('fires onAction with the chosen action key', () => {
    const onAction = jest.fn();
    render(<SparkHeroCard spark={makeSpark()} onAction={onAction} />);
    fireEvent.press(screen.getByText('Save'));
    expect(onAction).toHaveBeenCalledWith('save');
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
