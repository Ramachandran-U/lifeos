/**
 * ConstellationView — Ink + Signal §3.2 item 6: the constellation has no
 * placement protection and earns its slot by content. Below 3 input nodes
 * (interests + saved sparks + expeditions) the component returns null — the
 * old empty-placeholder Card is deleted (W4 sweep, 2026-06-12). The caps
 * eyebrow moved out: the screen renders the `Constellation` SectionTitle.
 */

import { render, screen } from '@testing-library/react-native';
import { ConstellationView } from '@/components/modules/polymath/ConstellationView';
import type { ConstellationInput } from '@/explore/constellation';

const interest = (id: string, name: string): ConstellationInput['interests'][number] => ({
  id,
  name,
  category: 'science',
  explorationDepth: 'taste',
});

const emptyInput: ConstellationInput = { interests: [], sparks: [], expeditions: [] };

describe('ConstellationView — ≥3-node threshold (§3.2 item 6)', () => {
  it('renders null with zero nodes (the empty-placeholder Card is gone)', () => {
    const tree = render(<ConstellationView input={emptyInput} />);
    expect(tree.toJSON()).toBeNull();
    expect(screen.queryByText('Save sparks and complete expeditions to grow your constellation.')).toBeNull();
  });

  it('renders null below the threshold (2 nodes)', () => {
    const tree = render(
      <ConstellationView
        input={{ ...emptyInput, interests: [interest('i1', 'Physics'), interest('i2', 'Jazz')] }}
      />,
    );
    expect(tree.toJSON()).toBeNull();
  });

  it('renders the node grid at exactly 3 input nodes', () => {
    render(
      <ConstellationView
        input={{
          ...emptyInput,
          interests: [interest('i1', 'Physics'), interest('i2', 'Jazz'), interest('i3', 'Pottery')],
        }}
      />,
    );
    expect(screen.getByText('Physics')).toBeTruthy();
    expect(screen.getByText('Jazz')).toBeTruthy();
    expect(screen.getByText('Pottery')).toBeTruthy();
    // The caps eyebrow is dead — the SectionTitle lives on the screen, not here.
    expect(screen.queryByText('YOUR CONSTELLATION')).toBeNull();
  });

  it('counts sparks and expeditions toward the threshold', () => {
    render(
      <ConstellationView
        input={{
          interests: [interest('i1', 'Physics')],
          sparks: [
            { id: 's1', title: 'Spiral law', seedInterest: 'Physics', adjacentField: 'Biology', status: 'saved' },
          ],
          expeditions: [
            { id: 'e1', title: 'Origins of jazz', theme: 'curiosity', seedSparkId: null, status: 'active' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Physics')).toBeTruthy();
  });
});
