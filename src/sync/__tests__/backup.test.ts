/**
 * Encrypted backup tests (P1-T8) — the web export/import round-trip with REAL
 * crypto (backupCrypto is unmocked). This is the data-loss guard the devil's
 * advocate flagged: a broken round-trip = unrecoverable data. Native gather/
 * apply use expo-sqlite and are smoke-tested on device (same constraint as the
 * native sink); here we exercise the web paths + all the validation branches.
 */
import { Platform } from 'react-native';
import { exportBackup, importBackup } from '../backup';
import { encryptBackup } from '../backupCrypto';

// ── DOM / file-IO shims (jest's node env has none) ──────────────────────────
let capturedExport = ''; // the JSON written by exportBackup's Blob
let pickResult: string | null = ''; // what the import file-picker yields (null ⇒ cancelled)

function installDom() {
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Blob = class { constructor(parts: string[]) { capturedExport = parts[0]; } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).FileReader = class {
    result = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsText() { this.result = pickResult ?? ''; this.onload?.(); }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'a') return { href: '', download: '', click: () => {} };
      // <input type=file>: click() fires onchange; files reflects pickResult
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = { type: '', accept: '', files: pickResult === null ? [] : [{}], onchange: null };
      input.click = () => input.onchange?.();
      return input;
    },
  };
  return store;
}

beforeEach(() => {
  Platform.OS = 'web' as typeof Platform.OS;
  capturedExport = '';
  pickResult = '';
  installDom();
});
afterEach(() => { Platform.OS = 'node' as typeof Platform.OS; });

describe('web backup round-trip', () => {
  test('export → import restores every lifeos key (real AES-GCM round-trip)', async () => {
    localStorage.setItem('lifeos_goals', JSON.stringify([{ id: 'g1', title: 'Run' }]));
    localStorage.setItem('lifeos_prefs', 'dark');
    localStorage.setItem('lifeos_mutation_log', 'CHAIN'); // sync-internal — must be excluded
    localStorage.setItem('other_app', 'nope'); // non-lifeos — must be excluded

    await exportBackup('hunter2');
    expect(capturedExport).not.toContain('Run'); // ciphertext, not plaintext

    // Wipe the user keys, then restore from the captured backup.
    localStorage.removeItem('lifeos_goals');
    localStorage.removeItem('lifeos_prefs');
    pickResult = capturedExport;
    const res = await importBackup('hunter2');

    expect(res).toEqual({ applied: true });
    expect(localStorage.getItem('lifeos_goals')).toBe(JSON.stringify([{ id: 'g1', title: 'Run' }]));
    expect(localStorage.getItem('lifeos_prefs')).toBe('dark');
    expect(localStorage.getItem('lifeos_mutation_log')).toBe('CHAIN'); // untouched, not in backup
  });

  test('applyWeb rolls back when a mid-restore write fails (no half-applied state)', async () => {
    localStorage.setItem('lifeos_a', 'old-a');
    localStorage.setItem('lifeos_b', 'old-b');
    await exportBackup('pw'); // backup holds {a:'old-a', b:'old-b'}

    // diverge locally, then make the restore of 'old-b' fail (e.g. quota)
    localStorage.setItem('lifeos_a', 'cur-a');
    localStorage.setItem('lifeos_b', 'cur-b');
    const real = localStorage.setItem.bind(localStorage);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (localStorage as any).setItem = (k: string, v: string) => {
      if (v === 'old-b') throw new Error('QuotaExceeded');
      real(k, v);
    };

    pickResult = capturedExport;
    await expect(importBackup('pw')).rejects.toThrow('QuotaExceeded');
    // both keys rolled back to their pre-import (diverged) values
    expect(localStorage.getItem('lifeos_a')).toBe('cur-a');
    expect(localStorage.getItem('lifeos_b')).toBe('cur-b');
  });

  test('wrong passphrase throws (GCM) and writes nothing', async () => {
    localStorage.setItem('lifeos_goals', 'original');
    await exportBackup('right-pass');
    localStorage.setItem('lifeos_goals', 'changed-since-backup');

    pickResult = capturedExport;
    await expect(importBackup('WRONG-pass')).rejects.toThrow();
    // no partial restore — the local value is left exactly as it was
    expect(localStorage.getItem('lifeos_goals')).toBe('changed-since-backup');
  });
});

describe('importBackup validation', () => {
  test('cancelled picker → { applied:false, cancelled }', async () => {
    pickResult = null;
    expect(await importBackup('x')).toEqual({ applied: false, reason: 'cancelled' });
  });

  test('non-JSON / non-envelope file → invalid_file', async () => {
    pickResult = 'not json at all';
    expect(await importBackup('x')).toEqual({ applied: false, reason: 'invalid_file' });

    pickResult = JSON.stringify({ alg: 'nope' }); // missing ct / wrong alg
    expect(await importBackup('x')).toEqual({ applied: false, reason: 'invalid_file' });
  });

  test('valid envelope but wrong platform → wrong_platform (no write)', async () => {
    const envelope = encryptBackup(
      JSON.stringify({ app: 'lifeos', schema: 1, platform: 'ios', createdAt: 't', data: { lifeos_x: 'y' } }),
      'pw',
    );
    pickResult = JSON.stringify(envelope);
    expect(await importBackup('pw')).toEqual({ applied: false, reason: 'wrong_platform' });
    expect(localStorage.getItem('lifeos_x')).toBeNull();
  });

  test('decrypts but the payload is not a lifeos backup → invalid_file', async () => {
    const envelope = encryptBackup(JSON.stringify({ app: 'other', data: {} }), 'pw');
    pickResult = JSON.stringify(envelope);
    expect(await importBackup('pw')).toEqual({ applied: false, reason: 'invalid_file' });
  });
});
