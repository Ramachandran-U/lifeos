import { classifyMerchant, __TRAINING_SIZE } from '../merchantClassifier';

describe('classifyMerchant', () => {
  it('has a non-trivial training set', () => {
    expect(__TRAINING_SIZE).toBeGreaterThan(50);
  });

  it('classifies an exact anchor with high confidence', () => {
    const r = classifyMerchant('swiggy');
    expect(r).not.toBeNull();
    expect(r!.category).toBe('food_delivery');
    expect(r!.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it('classifies a fuzzy variant of a known merchant', () => {
    // Real-world surface form with a suffix the regex map might miss.
    const r = classifyMerchant('swiggy instamart pvt ltd');
    expect(r).not.toBeNull();
    // Either food_delivery or groceries is defensible for "swiggy instamart";
    // the point is it resolves to a real category, not null.
    expect(r!.category).toBeTruthy();
  });

  it('returns null for gibberish below the confidence floor', () => {
    expect(classifyMerchant('zzxqwknml vbph')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(classifyMerchant('')).toBeNull();
  });

  it('respects a raised confidence floor', () => {
    // A near-but-not-exact match that clears the default floor should fail a
    // very high floor.
    const loose = classifyMerchant('zomatoo', 0.55);
    const strict = classifyMerchant('zomatoo', 0.99);
    if (loose) {
      // If the loose call matched, the strict call must be null (it can't beat 0.99).
      expect(strict).toBeNull();
    } else {
      // Either way, the strict call must not be more permissive.
      expect(strict).toBeNull();
    }
  });

  it('reports the matched anchor for debuggability', () => {
    const r = classifyMerchant('netflix');
    expect(r).not.toBeNull();
    expect(typeof r!.matchedAnchor).toBe('string');
    expect(r!.matchedAnchor.length).toBeGreaterThan(0);
  });
});
