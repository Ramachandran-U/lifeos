/**
 * Manifesto lock (Manifesto P1–P5 wording + guard wiring) — NOT a ratchet.
 *
 * Six plain assertions that make dilution a red build instead of a style
 * debate: the manifesto's five locked sentences, the CLAUDE.md supersession,
 * the review checklist's 10 binary lines, the PR template that pre-seeds them,
 * and the jest wiring that keeps these guards running.
 *
 * Changing ANY of these requires a founder-approved PR labelled
 * `manifesto-change` — restore from docs/DESIGN_MANIFESTO.md §Locked sentences
 * and §3.3 of the Cluster 5 dossier (docs/design-deep-dive/05).
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const FAILURE = (detail: string) =>
  "The manifesto's locked wording, the CLAUDE.md supersession, the checklist, " +
  'the PR template, or the guard wiring was changed. These changes require a ' +
  'founder-approved PR labelled manifesto-change — restore from ' +
  'docs/DESIGN_MANIFESTO.md §Locked sentences and §3.3 of the Cluster 5 dossier. ' +
  `Detail: ${detail}`;

const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8');

const LOCKED_SENTENCES = [
  'We never open a screen on a visualization.',
  'We never ship three equal cards where one hero belongs.',
  'We never tint for atmosphere.',
  'We never let glow idle.',
  'We never reach for a border, a label-cap, or a card where a headline would do.',
] as const;

describe('manifesto lock — wording, supersession, checklist, template, wiring', () => {
  it('1. DESIGN_MANIFESTO.md exists with five Principle headings and the five locked sentences', () => {
    const manifesto = read('docs/DESIGN_MANIFESTO.md');
    const headings = manifesto.match(/^### Principle /gm) ?? [];
    if (headings.length !== 5) {
      throw new Error(FAILURE(`expected exactly 5 "### Principle" headings, found ${headings.length}`));
    }
    for (const sentence of LOCKED_SENTENCES) {
      if (!manifesto.includes(sentence)) {
        throw new Error(FAILURE(`locked sentence missing or edited: "${sentence}"`));
      }
    }
  });

  it('2. CLAUDE.md carries the new philosophy and none of the superseded one', () => {
    const claude = read('CLAUDE.md');
    if (!claude.includes('Answer First, Celebrate Loud, Rest Quiet')) {
      throw new Error(FAILURE('CLAUDE.md no longer names "Answer First, Celebrate Loud, Rest Quiet"'));
    }
    if (claude.includes('Bold & Expressive')) {
      throw new Error(FAILURE('the superseded "Bold & Expressive" philosophy survives in CLAUDE.md'));
    }
    if (claude.includes('Duolingo meets Headspace')) {
      throw new Error(FAILURE('the superseded "Duolingo meets Headspace" framing survives in CLAUDE.md'));
    }
  });

  it('3. every CLAUDE.md line naming aurora-refined-v2 also says superseded', () => {
    const offending = read('CLAUDE.md')
      .split('\n')
      .filter((line) => line.includes('aurora-refined-v2') && !line.includes('superseded'));
    if (offending.length > 0) {
      throw new Error(FAILURE(`aurora-refined-v2 referenced without "superseded": ${offending.join(' | ')}`));
    }
  });

  it('4. the review checklist has exactly 10 binary lines, each tagged [P1]-[P5] or [G]', () => {
    const checklistLines = read('docs/DESIGN_REVIEW_CHECKLIST.md')
      .split('\n')
      .filter((line) => line.startsWith('- [ ]'));
    if (checklistLines.length !== 10) {
      throw new Error(FAILURE(`expected exactly 10 "- [ ]" lines in DESIGN_REVIEW_CHECKLIST.md, found ${checklistLines.length}`));
    }
    for (const line of checklistLines) {
      if (!/\[(P[1-5]|G)\]/.test(line)) {
        throw new Error(FAILURE(`checklist line missing its [P#]/[G] tag: "${line}"`));
      }
    }
  });

  it('5. the PR template pre-seeds all 10 checklist lines verbatim', () => {
    const template = read('.github/PULL_REQUEST_TEMPLATE.md');
    const checklistLines = read('docs/DESIGN_REVIEW_CHECKLIST.md')
      .split('\n')
      .filter((line) => line.startsWith('- [ ]'));
    for (const line of checklistLines) {
      if (!template.includes(line)) {
        throw new Error(FAILURE(`PR template is missing a checklist line verbatim: "${line}"`));
      }
    }
  });

  it('6. jest wiring is intact — no theme/__tests__ carve-out in jest.config.js', () => {
    if (read('jest.config.js').includes('theme/__tests__')) {
      throw new Error(FAILURE('jest.config.js contains a "theme/__tests__" path — the guard directory has been carved out of npm test'));
    }
  });
});
