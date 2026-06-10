import {
  rollLoot,
  LOOT_WEIGHTS,
  XP_ROLL_MIN,
  XP_ROLL_MAX,
  type LootContext,
} from '../lootTable';
import { MAX_FREEZES_BANKED } from '../streakEngine';
import { COSMETIC_IDS } from '@/constants/cosmetics';

const OPEN_CTX: LootContext = { freezesBanked: 0, ownedCosmetics: [] };

describe('rollLoot — pure, seeded, additive-only', () => {
  test('deterministic: same seed + ctx ⇒ identical contents', () => {
    for (let i = 0; i < 50; i++) {
      const seed = `chest:u1:2026-06-10:id${i}`;
      expect(rollLoot(seed, OPEN_CTX)).toEqual(rollLoot(seed, OPEN_CTX));
    }
  });

  test('10k rolls match the 60/25/15 weights within ±2%', () => {
    const counts = { xp: 0, freeze: 0, cosmetic: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      counts[rollLoot(`dist-seed-${i}`, OPEN_CTX).type] += 1;
    }
    expect(counts.xp / N).toBeGreaterThan(LOOT_WEIGHTS.xp / 100 - 0.02);
    expect(counts.xp / N).toBeLessThan(LOOT_WEIGHTS.xp / 100 + 0.02);
    expect(counts.freeze / N).toBeGreaterThan(LOOT_WEIGHTS.freeze / 100 - 0.02);
    expect(counts.freeze / N).toBeLessThan(LOOT_WEIGHTS.freeze / 100 + 0.02);
    expect(counts.cosmetic / N).toBeGreaterThan(LOOT_WEIGHTS.cosmetic / 100 - 0.02);
    expect(counts.cosmetic / N).toBeLessThan(LOOT_WEIGHTS.cosmetic / 100 + 0.02);
  });

  test('xp amounts stay within [25, 75] and hit both edges over many rolls', () => {
    const amounts: number[] = [];
    for (let i = 0; i < 5_000; i++) {
      const roll = rollLoot(`xp-range-${i}`, OPEN_CTX);
      if (roll.type === 'xp') amounts.push(roll.amount);
    }
    expect(Math.min(...amounts)).toBe(XP_ROLL_MIN);
    expect(Math.max(...amounts)).toBe(XP_ROLL_MAX);
    expect(amounts.every((a) => Number.isInteger(a))).toBe(true);
  });

  test('a freeze rolled on a full bank converts to XP — never wasted, never dropped', () => {
    const fullBank: LootContext = { freezesBanked: MAX_FREEZES_BANKED, ownedCosmetics: [] };
    for (let i = 0; i < 2_000; i++) {
      const roll = rollLoot(`full-bank-${i}`, fullBank);
      expect(roll.type).not.toBe('freeze');
    }
  });

  test('a cosmetic rolled with the collection complete converts to XP', () => {
    const allOwned: LootContext = { freezesBanked: 0, ownedCosmetics: [...COSMETIC_IDS] };
    for (let i = 0; i < 2_000; i++) {
      const roll = rollLoot(`all-owned-${i}`, allOwned);
      expect(roll.type).not.toBe('cosmetic');
    }
  });

  test('cosmetic rolls only ever drop unowned ids', () => {
    const owned = COSMETIC_IDS.slice(0, COSMETIC_IDS.length - 1);
    const ctx: LootContext = { freezesBanked: 0, ownedCosmetics: owned };
    let sawCosmetic = false;
    for (let i = 0; i < 2_000; i++) {
      const roll = rollLoot(`one-left-${i}`, ctx);
      if (roll.type === 'cosmetic') {
        sawCosmetic = true;
        expect(roll.cosmeticId).toBe(COSMETIC_IDS[COSMETIC_IDS.length - 1]);
      }
    }
    expect(sawCosmetic).toBe(true);
  });

  test('every branch returns a reward — there is no empty/dud outcome', () => {
    for (let i = 0; i < 1_000; i++) {
      const roll = rollLoot(`no-dud-${i}`, OPEN_CTX);
      expect(['xp', 'freeze', 'cosmetic']).toContain(roll.type);
    }
  });
});
