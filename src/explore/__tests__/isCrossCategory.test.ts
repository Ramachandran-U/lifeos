import {
  categoryOf,
  isCrossCategory,
  crossCategoryPair,
  interestNodeId,
  conceptNodeId,
  normInterest,
  type CategorizedInterest,
} from '../isCrossCategory';

const interests: CategorizedInterest[] = [
  { name: 'Chess', category: 'games' },
  { name: 'Linguistics', category: 'humanities' },
  { name: 'Go', category: 'games' },
];

describe('categoryOf', () => {
  it('resolves by normalized name (case / whitespace insensitive)', () => {
    expect(categoryOf('chess', interests)).toBe('games');
    expect(categoryOf('  CHESS ', interests)).toBe('games');
    expect(categoryOf('linguistics', interests)).toBe('humanities');
  });
  it('returns undefined for an untracked interest', () => {
    expect(categoryOf('cooking', interests)).toBeUndefined();
    expect(categoryOf('', interests)).toBeUndefined();
  });
});

describe('isCrossCategory / crossCategoryPair', () => {
  it('true + sorted pair when both resolve to different categories', () => {
    expect(isCrossCategory('Chess', 'Linguistics', interests)).toBe(true);
    expect(crossCategoryPair('Chess', 'Linguistics', interests)).toBe('games|humanities');
    expect(crossCategoryPair('Linguistics', 'Chess', interests)).toBe('games|humanities'); // order-independent
  });
  it('false when same category', () => {
    expect(isCrossCategory('Chess', 'Go', interests)).toBe(false);
    expect(crossCategoryPair('Chess', 'Go', interests)).toBeNull();
  });
  it('false when either endpoint is untracked', () => {
    expect(isCrossCategory('Chess', 'cooking', interests)).toBe(false);
    expect(crossCategoryPair('cooking', 'baking', interests)).toBeNull();
  });
});

describe('node id helpers', () => {
  it('mint normalized constellation ids', () => {
    expect(interestNodeId('Chess')).toBe('interest:chess');
    expect(conceptNodeId('The Lateral Line')).toBe('concept:the lateral line');
    expect(normInterest('  Foo   Bar ')).toBe('foo bar');
  });
});
