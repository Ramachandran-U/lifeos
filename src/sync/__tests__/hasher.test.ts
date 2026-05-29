/**
 * Hasher tests. Web path uses globalThis.crypto.subtle which Node 20+ exposes
 * by default. Native path is mocked through jest.mocks/expo-crypto.ts so we
 * don't have to load expo here.
 */
import { Platform } from 'react-native';

describe('production hasher', () => {
  afterEach(() => {
    Platform.OS = 'node' as typeof Platform.OS;
    jest.resetModules();
  });

  test('web path produces a stable 64-char hex SHA-256', async () => {
    Platform.OS = 'web' as typeof Platform.OS;
    const { getProductionHasher } = await import('../hasher');
    const hash = getProductionHasher();
    const out1 = await hash('lifeos');
    const out2 = await hash('lifeos');
    expect(out1).toBe(out2);
    expect(out1).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(out1)).toBe(true);
  });

  test('hashes for different inputs differ', async () => {
    Platform.OS = 'web' as typeof Platform.OS;
    const { getProductionHasher } = await import('../hasher');
    const hash = getProductionHasher();
    const a = await hash('a');
    const b = await hash('b');
    expect(a).not.toBe(b);
  });
});
