/**
 * Pure seed builders for Dive/Bridge. Guards the invariants the rabbit-hole
 * screen + resume logic rely on: required params present, body >= 20 chars (the
 * RabbitHoleNode contract), single-idea vs cross shape, and STABLE synthetic
 * sparkIds (so re-opening resumes the same map instead of duplicating).
 */
import { buildDiveParams, buildBridgeParams, buildFreeDiveParams, slugForPhrase } from '@/explore/exploreLaunch';

const astro = { id: 'int-astro', name: 'Astronomy' };
const jazz = { id: 'int-jazz', name: 'Jazz piano' };

describe('buildDiveParams (single-idea)', () => {
  it('roots the seed on the chosen interest with no adjacent field, mode dive', () => {
    const p = buildDiveParams(astro);
    expect(p.seedTitle).toBe('Astronomy');
    expect(p.seedInterest).toBe('Astronomy');
    expect(p.seedAdjacent).toBe('');
    expect(p.mode).toBe('dive');
    expect(p.seedBody.length).toBeGreaterThanOrEqual(20);
  });

  it('uses a stable, interest-derived sparkId (resumes, never duplicates)', () => {
    expect(buildDiveParams(astro).sparkId).toBe('interest-int-astro');
    expect(buildDiveParams(astro).sparkId).toBe(buildDiveParams(astro).sparkId);
    expect(buildDiveParams(astro).sparkId).not.toBe(buildDiveParams(jazz).sparkId);
  });
});

describe('buildBridgeParams (cross-discipline)', () => {
  it('carries both interests as seed + adjacent', () => {
    const p = buildBridgeParams(astro, jazz);
    expect(p.seedInterest).toBe('Astronomy');
    expect(p.seedAdjacent).toBe('Jazz piano');
    expect(p.seedTitle).toContain('Astronomy');
    expect(p.seedTitle).toContain('Jazz piano');
    expect(p.mode).toBe('bridge');
    expect(p.seedBody.length).toBeGreaterThanOrEqual(20);
  });

  it('uses a stable pair-derived sparkId, order-sensitive to the primary', () => {
    expect(buildBridgeParams(astro, jazz).sparkId).toBe('bridge-int-astro-int-jazz');
    expect(buildBridgeParams(jazz, astro).sparkId).toBe('bridge-int-jazz-int-astro');
  });
});

describe('buildFreeDiveParams (free-text dive)', () => {
  it('builds a single-idea dive seed from an arbitrary phrase', () => {
    const p = buildFreeDiveParams('Why do cities grow?');
    expect(p.seedTitle).toBe('Why do cities grow?');
    expect(p.seedInterest).toBe('Why do cities grow?');
    expect(p.seedAdjacent).toBe('');
    expect(p.mode).toBe('dive');
    expect(p.seedBody.length).toBeGreaterThanOrEqual(20);
    expect(p.sparkId).toBe('freetext-why-do-cities-grow');
  });
});

describe('slugForPhrase', () => {
  it('is lowercase, hyphenated, trimmed of stray separators', () => {
    expect(slugForPhrase('  Hello, World!! ')).toBe('hello-world');
    expect(slugForPhrase('AI')).toBe('ai');
  });
  it('falls back to "idea" when nothing slug-able remains', () => {
    expect(slugForPhrase('!!!')).toBe('idea');
    expect(slugForPhrase('   ')).toBe('idea');
  });
});
