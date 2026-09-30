/**
 * Guard — every feature flag is read from `process.env` by a STATIC reference.
 *
 * Bundlers substitute `process.env.SOME_NAME` at build time. They cannot see a
 * key computed at runtime, so `process.env[envKey(flag)]` compiles to a lookup
 * against an object that, in the web bundle, does not contain the variable at
 * all. The flag then reads `undefined` and the compiled default silently wins.
 *
 * That was live: `.env` set EXPO_PUBLIC_FLAG_DOMAIN_NUDGES (and three more
 * cognitive-layer flags) to `true`, while the deployed bundle ran every one of
 * them as `false`. The shipped bundle still contained the runtime key builder
 * and not one flag's variable name — proof the substitution never happened.
 * Nothing errored; the flags just did nothing, through several deploys.
 *
 * Two properties are pinned here:
 *   1. flags.ts contains NO computed `process.env[...]` access.
 *   2. Every flag has a static `process.env.EXPO_PUBLIC_FLAG_<UPPER_SNAKE>`
 *      read whose name matches `envKey(flag)` exactly.
 *
 * A type-level guard already exists (ENV_SOURCES is `Record<FeatureFlag, …>`,
 * so an omission fails typecheck). This catches the other half: a *present*
 * entry that reads the wrong variable name, or a well-meaning refactor back to
 * a computed key — neither of which TypeScript can see.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_FLAGS, envKey, type FeatureFlag } from '../flags';

const FLAGS_SRC = path.join(__dirname, '..', 'flags.ts');
const source = fs.readFileSync(FLAGS_SRC, 'utf8');

/** Strip comments so prose about the bug can't satisfy or trip the checks. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const code = stripComments(source);

describe('env-flag compliance — static reads only', () => {
  it('flags.ts never accesses process.env with a computed key', () => {
    // `process.env[` in any form — bracket access is what defeats the bundler.
    const computed = /process\.env\s*\[/.exec(code);
    expect(
      computed ? `found computed access: ${code.slice(computed.index, computed.index + 60)}` : null,
    ).toBeNull();
  });

  it('every flag has a static process.env read matching envKey(flag)', () => {
    const missing: string[] = [];
    for (const flag of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
      const needle = `process.env.${envKey(flag)}`;
      if (!code.includes(needle)) missing.push(`${flag} -> ${needle}`);
    }
    expect(missing).toEqual([]);
  });

  it('declares no EXPO_PUBLIC_FLAG_ variable that is not a real flag', () => {
    const declared = new Set(
      Array.from(code.matchAll(/process\.env\.(EXPO_PUBLIC_FLAG_[A-Z0-9_]+)/g)).map((m) => m[1]),
    );
    const expected = new Set(
      (Object.keys(DEFAULT_FLAGS) as FeatureFlag[]).map((f) => envKey(f)),
    );
    const stray = [...declared].filter((d) => !expected.has(d));
    expect(stray).toEqual([]);
  });

  it('the env override actually reaches isEnabled (end-to-end through the map)', () => {
    // Re-import in isolation so the module-level map is rebuilt with our env.
    jest.resetModules();
    const prev = process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES;
    process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES = 'true';
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../flags') as typeof import('../flags');
      expect(mod.DEFAULT_FLAGS.domainNudges).toBe(false); // default really is off
      expect(mod.isEnabled('domainNudges')).toBe(true); // …and env wins
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES;
      else process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES = prev;
    }
  });
});
