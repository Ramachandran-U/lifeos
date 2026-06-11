import { render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { SectionTitle } from '@/components/ui/SectionTitle';

describe('SectionTitle', () => {
  it('renders the sentence-case title', () => {
    render(<SectionTitle>Skill gaps</SectionTitle>);
    expect(screen.getByText('Skill gaps')).toBeTruthy();
  });

  it('appends the count as " · {count}" when provided', () => {
    render(<SectionTitle count={3}>Saved paths</SectionTitle>);
    // The title Text now contains mixed children — match on the fragments.
    expect(screen.getByText(/Saved paths/)).toBeTruthy();
    expect(screen.getByText(' · 3')).toBeTruthy();
  });

  it('renders a zero count (0 is a real count, not an omission)', () => {
    render(<SectionTitle count={0}>Expeditions</SectionTitle>);
    expect(screen.getByText(' · 0')).toBeTruthy();
  });

  it('renders no count fragment when count is omitted', () => {
    render(<SectionTitle>Connections</SectionTitle>);
    expect(screen.queryByText(/ · /)).toBeNull();
  });

  it('renders the trailing action slot', () => {
    render(
      <SectionTitle trailing={<RNText>Add</RNText>}>Coming up</SectionTitle>,
    );
    expect(screen.getByText('Coming up')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('is type-closed to non-string children (children: string)', () => {
    // @ts-expect-error — children must be a string headline, never an element tree.
    const el = <SectionTitle><RNText>nope</RNText></SectionTitle>;
    expect(el).toBeTruthy();
  });
});
