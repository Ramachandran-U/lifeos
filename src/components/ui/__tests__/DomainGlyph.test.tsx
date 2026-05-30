import { render } from '@testing-library/react-native';
import { DomainGlyph } from '@/components/ui/DomainGlyph';

// The Lucide icon renders an SVG tree that surfaces the accessibilityLabel on
// more than one node, so we assert "at least one" rather than "exactly one".
describe('DomainGlyph', () => {
  it('renders the canonical icon for a domain with an a11y label', () => {
    const { getAllByLabelText } = render(<DomainGlyph domain="goal" />);
    expect(getAllByLabelText('goal domain').length).toBeGreaterThan(0);
  });

  it('labels each domain distinctly', () => {
    const { getAllByLabelText } = render(<DomainGlyph domain="health" />);
    expect(getAllByLabelText('health domain').length).toBeGreaterThan(0);
  });
});
