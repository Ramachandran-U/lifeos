/**
 * Guard B — atmosphere tints via `+ 'XX'` alpha suffixes (Manifesto P3).
 *
 * "We never tint for atmosphere." The endemic pattern this kills is any color
 * expression concatenated with a two-hex-digit alpha string — `c.goal + '12'`,
 * `hue + '33'`, `accent + '55'`. The regex anchors on the concatenation itself
 * (receiver-agnostic by design): a member-anchored form would miss the live
 * bare-variable tints, and `const wash = c.goal; wash + '12'` would slip a
 * receiver-anchored net. Measured 2026-06-10: every match of this regex in
 * src/ + app/ is a color tint — zero non-color matches.
 *
 * Scope deliberately includes src/theme/ — this construction is illegal even
 * inside theme (measured: zero matches there today, so the rule costs nothing).
 *
 * ONE-WAY RATCHET: entries are removed as files migrate to background/surface/
 * surfaceAlt/card or the semantic *Dim tokens — never added without a
 * founder-approved PR labelled `manifesto-change`. False positive → allowlist
 * that one file with a comment, never weaken the regex.
 *
 * Seed: 138 occurrences across 65 files. Measured: 2026-06-10 (landing day).
 * Reproduce: empty the ALLOWLIST below and run
 *   npx jest src/theme/__tests__/atmosphereTintCompliance.test.ts
 * — the failure list is the seed. Convenience approximation (also exclude
 * __tests__ dirs and *.test.* files, as this guard's walk does):
 *   rg "\+\s*['\"][0-9a-fA-F]{2}['\"]" src app -t ts -l
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

const ALPHA_SUFFIX_TINT = /\+\s*['"][0-9a-fA-F]{2}['"]/;

// ratchet −62 (Ink + Signal W2 PR-3 "Structural color"): every .tsx tint was
// migrated to *Dim tokens / surfaceAlt / solid hues per §C — entries removed,
// never to return.
// ratchet −2 (W2 PR-4 "Front door"): the auth glass cards (background + 'B3')
// died with §E — sign-in/sign-up are clean.
// chartTheme.ts's area fill is hue-parametric data viz (not migratable
// without an API change) and stays allowlisted — the sanctioned .ts exception.
const ALLOWLIST = new Set<string>([
  'src/components/charts/chartTheme.ts',
]);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

function findViolations(): string[] {
  const violations: string[] = [];
  for (const dirName of SCAN_DIRS) {
    const dir = path.join(REPO_ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      if (ALLOWLIST.has(rel)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (ALPHA_SUFFIX_TINT.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

describe("atmosphere tint compliance — no `+ 'XX'` alpha-suffix washes", () => {
  it('no expression is concatenated with a two-hex-digit alpha string', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        "Atmosphere tint (expression + 'XX' alpha suffix) found. We never tint for " +
        'atmosphere (Manifesto P3): use background/surface/surfaceAlt/card or the ' +
        'semantic *Dim tokens; if the element needs the domain hue, use it at full ' +
        'saturation structurally. Violations:\n  ' +
        violations.join('\n  '),
      );
    }
  });

  it('the allowlist only shrinks (entries must exist on disk)', () => {
    for (const rel of ALLOWLIST) {
      const full = path.join(REPO_ROOT, ...rel.split('/'));
      expect({ rel, exists: fs.existsSync(full) }).toEqual({ rel, exists: true });
    }
  });
});
