/**
 * WeekStatLine — Ink + Signal §3.2 item 4 / §3.0.5 zero-suppression, AC8 unit
 * half (Explore week stat). Ratified amendment R5: in the flag-on tree a zero
 * week renders NOTHING — no THIS WEEK label, no `0 min`, no StarterLine (the
 * W3 cold-start treatment survives only in the untouched legacy tree).
 */

import { render, screen } from '@testing-library/react-native';
import { WeekStatLine } from '@/components/modules/polymath/WeekStatLine';

describe('WeekStatLine — zero-suppression (AC8 / R5)', () => {
  it('renders null at 0 minutes', () => {
    const tree = render(<WeekStatLine totalMinutesWeek={0} interestCount={0} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders null at 0 minutes even when interests exist', () => {
    const tree = render(<WeekStatLine totalMinutesWeek={0} interestCount={4} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders the committed single line when minutes exist', () => {
    render(<WeekStatLine totalMinutesWeek={95} interestCount={3} />);
    expect(screen.getByText('This week: 95 min across 3 interests')).toBeTruthy();
  });
});
