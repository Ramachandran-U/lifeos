/**
 * SocialHealthRow — Ink + Signal §3.0.5 zero-suppression, AC8 unit half
 * (the social score row).
 *
 * The score row renders NOTHING at 0 (the `Reach out` rows are the action that
 * moves it) and nothing at null (zero contacts — a 0 would be a lie). At a
 * positive score it renders the committed `Social health` + `{score} /100`
 * mono pair over a solid social fill.
 */

import { render, screen } from '@testing-library/react-native';
import { SocialHealthRow } from '@/components/modules/social/SocialHealthRow';

describe('SocialHealthRow — zero-suppression (AC8)', () => {
  it('renders null at score 0', () => {
    const tree = render(<SocialHealthRow score={0} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders null at score null (zero contacts)', () => {
    const tree = render(<SocialHealthRow score={null} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders null at negative scores too (defensive)', () => {
    const tree = render(<SocialHealthRow score={-5} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders the committed copy at a positive score', () => {
    render(<SocialHealthRow score={72} />);
    expect(screen.getByText('Social health')).toBeTruthy();
    expect(screen.getByText('72 /100')).toBeTruthy();
  });

  it("never renders the AC8-banned '0 /100' string", () => {
    const tree = render(<SocialHealthRow score={0} />);
    expect(JSON.stringify(tree.toJSON())).not.toContain('0 /100');
  });
});
