# Cluster 5: Manifesto codification + anti-dilution machinery

> **Ratified amendments (founder, 2026-06-10 — cross-spec resolutions, see 00-INDEX.md):**
> R1: the manifesto P3 "Compliant looks like" body and Guard B's failure message say `*Dim` (not `*Light`) — APPLIED in the Wave 0 landing (PR #170); the five locked sentences are unaffected.
> R8: Guard D allowlist growth for `TodayHeader.tsx`, `NextMoveHero.tsx`, `FirstWinCard.tsx` is founder-approved (2026-06-10) as a single `manifesto-change` batch, to be executed in Wave 3 — the ratchet is never bypassed silently.
> R9: manifesto P3's "4px domain bar" is scoped to a screen's single hero (where the hue also carries ink or the CTA) — APPLIED in the Wave 0 landing (PR #170).

# Cluster 5 — Make the Philosophy Enforceable
**Design dossier · LifeOS · Ink + Signal program · 2026-06-10 (hardened by dilution audit, same date)**
Repo: `c:\personal\Project X\lifeos-w3` (all paths below relative to it unless prefixed `c:\`)

---

## 1. Current state — what the code and screenshots actually show

**The stated philosophy and the shipped product have already diverged once.** `CLAUDE.md` ("Design System > Philosophy") still says *"Bold & Expressive — think Duolingo meets Headspace… The app should feel alive"* and points to `docs/aurora-refined-v2/` as the current token reference. That folder's own `README.md` opens with *"This is not a redesign… less performative, more inhabited"* — a restraint mandate. The restraint did not hold:

- **Atmosphere tinting is endemic.** `app/(tabs)/goals.tsx:497` builds a card wash by string-concatenating an alpha suffix onto a domain token: `backgroundColor: c.goal + '12'` (7% opacity). The full pattern — *any* color expression `+ '<two hex digits>'` — appears **138 times across 65 files** in `src/` + `app/` (measured 2026-06-10, tests excluded): 93 via token member access (`c.goal + '12'`, `colors.border + '33'`) and 45 more via bare color variables (`hue + '33'` in `src/components/charts/chartTheme.ts:22`, `accent + '55'` in `src/components/gamification/BadgeTile.tsx:29`, `color + '22'` in `src/components/gamification/DomainMiniCard.tsx:33`). Color demoted from meaning to mist, one card at a time.
- **The ambient wash is everywhere and nowhere.** `src/components/shared/AuroraBackground.tsx` mounts a permanent `GradientMesh` (stops at 0.22 / 0.16 / 0.12 opacity, lines 26–30) plus idle `DriftingBloom` orbs on an 8s loop (`AMBIENT.auroraDrift = 8000` in `src/theme/motion.ts:59`) — imported at **41 sites** (38 files import `@/components/shared/AuroraBackground`, e.g. `app/(tabs)/index.tsx:32`; the 3 auth screens import `src/components/shared/AuroraAnimatedBackground.tsx`). The audit's "5% perceptibility in-app, 100% on sign-in" is visible in `tmp/audit-today.png` vs `tmp/audit-signin.png`: same component family, two identities.
- **LABEL-CAPS is both systematized and freelanced.** The sanctioned path is the `micro` text variant (`src/theme/typography.ts:118–124`: mono, 10.5px, `letterSpacing: 1.6`, `textTransform: 'uppercase'`) wrapped by `src/components/ui/SectionLabel.tsx` — 16 `variant="micro"` usages across 8 files. But screens also hand-roll caps: `app/(tabs)/goals.tsx:500` renders the literal string `YOUR NEXT MOVE` with manual `letterSpacing: 0.5`, and `app/(tabs)/rewards.tsx:190` passes `label="BEST STREAK"`. ALL-CAPS multi-word literals appear **109 times across 55 `.tsx` files**; the union of all caps-pattern offenders (literals + `micro` + `SectionLabel` + `textTransform`) is **64 files** (measured 2026-06-10).
- **Emoji-in-data ships today.** `app/(tabs)/rewards.tsx:190`: `value={`${bestStreak}🔥`}` — an emoji concatenated into a numeric stat (`tmp/audit-rewards.png` shows the result: `0 🔥` inside one of three equal stat boxes whose values are `+0`, `1/19`, `0🔥`). Reward-emoji literals appear in **10** component files (measured 2026-06-10).
- **Raw color literals outside the token layer:** **185 quoted-hex occurrences across 57 files** plus **47 `rgba()`/`hsl()` literals**, union **65 files**, in `src/` (excluding `src/theme/`) + `app/`, tests excluded (measured 2026-06-10). Largest hex offenders: `src/finance/display.ts` (24), `src/components/shared/ambient/presets.ts` (22), `src/components/modules/polymath/DiscoverGrid.tsx` (12), `src/components/modules/polymath/discoverArea.ts` (9), `app/(tabs)/goals.tsx` (9), `app/(tabs)/index.tsx` (6).
- **The enforcement precedent already exists and works.** `src/theme/__tests__/motionTokenCompliance.test.ts` is a jest grep-ratchet: `walk()` over `SCAN_DIRS = ['src', 'app']`, regex for raw duration literals, file-path allowlist documented as a *"ONE-WAY RATCHET"* (line 11), plus a second `it()` asserting every allowlist entry still exists on disk (lines 111–118). It migrated 68 literals and has held. This cluster clones that machine four times.
- **Flag infrastructure:** compile-time typed flags in `src/config/flags.ts` (camelCase, default-false — `motionPolish: false` at line 56, `celebrationEngine: false` at line 58) and runtime flags in `src/store/useFlagStore.ts` `FALLBACK_FLAGS` (line 10, snake_case). The Aurora Alive celebration layer is flag-gated and is the **keep** half of the aurora verdict — `EnergySweep`/`ParticleField` inside `src/components/shared/ambient/` and the `CelebrationHost` in `src/celebration/CelebrationHost.tsx` are event-driven and stay as celebration language.

**Diagnosis:** the repo has good token files and one good guard, but the philosophy lives only in prose, so every screen-level decision re-litigates it — and prose loses. The fix is not better prose. It is prose **with teeth**: locked wording, mechanical guards, a binary review ritual, and a handoff contract that survives summarization.

---

## 2. Options weighed (alternatives appear here only)

**A — Manifesto + human review only.** Write `DESIGN_MANIFESTO.md`, patch `CLAUDE.md`, rely on reviewers. This is the cheapest path and the one most teams take. It is also exactly how the current state happened: `aurora-refined-v2/README.md` already mandated restraint in writing, and 138 atmosphere tints shipped anyway. Documents without mechanisms decay at the speed of the next deadline. Rejected.

**B — Custom ESLint plugin.** AST-level rules (`no-raw-color`, `no-caps-label`, `no-ambient-import`) with editor squiggles and autofix. Strictly more precise than grep (no false positives in comments), and the long-term right home. But it introduces a new toolchain surface (rule authoring, plugin packaging, eslint config churn), has no in-repo precedent, and the allowlist-ratchet culture the team already understands lives in jest. Shipping this wave matters more than AST purity; a later migration from jest-ratchet to ESLint loses nothing because the allowlists transfer. Rejected for this wave.

**C — Locked manifesto + 4 jest grep-ratchets + 1 lock test (six assertions) + binary checklist + PR template + consumption contract.** Clone the proven `motionTokenCompliance` machine for color, caps, ambient imports, and alpha-tints; add a non-ratchet test that asserts the manifesto's five "We never" sentences exist verbatim and that the guard wiring itself is intact (so softening the doc *or* unplugging the guards is a CI failure); make the PR checklist binary and embed it in the repo's PR template; bind the next planning session with a verbatim-copy contract. **Committed.** This is the only option where dilution is a red build instead of a vibe.

---

## 3. The spec

### 3.0 Flags and parity (applies to everything below)

- **This cluster adds zero runtime flags and zero runtime behavior.** It ships docs + CI tests. Guards MUST NOT import `src/config/flags.ts` or `src/store/useFlagStore.ts` — a flag-gated guard is a self-disarming guard. (Other clusters' specs name their own flags; checklist line 7 verifies they did.)
- **Web/native parity:** every deliverable is filesystem-level (docs, jest node-project tests) and therefore platform-identical by construction. The guards scan the `.ts`/`.tsx` sources shared by iOS, Android, and web; no `Platform.select` branch escapes them because the scan is textual, not runtime.
- **Compassion:** Principle 4 below subordinates all celebration to `useMotionScale()` (exported from `src/theme/motion.ts`; reduce-motion → scale 0) and to the `gamification: 'off'` value of `GamificationVisibility = 'full' | 'minimal' | 'off'` (`src/store/usePreferencesStore.ts:7`). No guard failure message and no copy string in this cluster uses guilt framing — failure messages name the rule and the fix, never the author.
- **Hex-radar freeze (binds this and every other cluster):** the `HexRadar` on Today (`src/components/gamification/HexRadar.tsx`, imported at `app/(tabs)/index.tsx:56`, rendered at `app/(tabs)/index.tsx:528`) keeps its current position, size, and order in the Today layout. No deliverable in this dossier moves, shrinks, collapses, or demotes it, and the landing PR for this cluster contains zero diffs to `app/(tabs)/index.tsx` (criterion 14).

### 3.1 Deliverable 1 — `docs/DESIGN_MANIFESTO.md` (full content, final wording)

> Destination: `docs/DESIGN_MANIFESTO.md` (verified absent today — this file is created, not merged). The implementation wave creates this file with exactly the content below.

```markdown
# Answer First, Celebrate Loud, Rest Quiet
**The LifeOS design manifesto. Canonical. Supersedes "Bold & Expressive" and `docs/aurora-refined-v2/` (now historical reference only).**

LifeOS asks one question for the user: *"What should I do next to improve my life?"*
Every screen either answers that question or gets out of the way of the screen that does.
The visual language is **Ink + Signal**: true-black ink as the resting state, full-saturation
domain signal only where it carries meaning, type as the primary layout instrument,
and loud celebration reserved for the moments that earn it.

Five principles. Each has a locked "We never" sentence — those sentences are
enforced verbatim by `src/theme/__tests__/manifestoLock.test.ts`. Changing one
requires a founder-approved PR labelled `manifesto-change`.

---

### Principle 1 — Answer first
**We do:** put the screen's answer — in words, with its action — inside the first
viewport, before any chart, ring, radar, or score.
**We never open a screen on a visualization.**

*Violation today:* Today (`app/(tabs)/index.tsx`) opens on the hex radar
(`src/components/gamification/HexRadar.tsx`, rendered at `app/(tabs)/index.tsx:528`)
while the actionable next-move card lives on the Goals tab (`app/(tabs)/goals.tsx:495–503`).
The user's first paint is a diagram of their life, not a decision about it.
*Compliant looks like:* the radar's position, size, and order on Today are frozen
(founder decision — design with it, not instead of it), and an interactive element
that starts or completes today's next block is fully visible in the same first
viewport at 390×844 logical px on react-native-web. Compliance is achieved by
placing the answer in the same first viewport — never by moving, shrinking, or
demoting the radar. A visualization is a supporting witness, never the opening
statement.

### Principle 2 — One hero per screen
**We do:** give every screen exactly one dominant element — largest type, first
focus, the thing the screen exists for. Everything else is visibly subordinate.
**We never ship three equal cards where one hero belongs.**

*Violation today:* Rewards (`app/(tabs)/rewards.tsx:188–190`, `tmp/audit-rewards.png`)
opens on three equal stat boxes reading `+0`, `1/19`, `0🔥` — three zeros given
identical weight while the genuinely human line ("You pushed Social +3.")
sits below them in a quiet card.
*Compliant looks like:* "You pushed Social +3." set as the display-type hero;
the three stats demoted to one quiet tabular line beneath it.

### Principle 3 — Color is meaning
**We do:** use domain hues at full saturation, structurally — a filled block, a
4px domain bar, a headline, a progress fill. A hue on screen always means
"this is that domain" or "this changed".
**We never tint for atmosphere.**

*Violation today:* `app/(tabs)/goals.tsx:497` — `backgroundColor: c.goal + '12'`,
a 7%-opacity wash built by concatenating an alpha suffix onto a token. 138
occurrences of the alpha-suffix pattern across 65 files (including bare-variable
forms like `hue + '33'`, `accent + '55'`). Also the permanent gradient mesh in
`src/components/shared/AuroraBackground.tsx:26–30` (0.22/0.16/0.12 opacity on
every screen).
*Compliant looks like:* surfaces come from `background`/`surface`/`surfaceAlt`/`card`
or the semantic `*Light` tokens in `src/theme/colors.ts`; domain hue appears at 100%
or not at all. If a tint "softens" a card, the card did not need the hue.

### Principle 4 — Celebrate moments, rest quiet
**We do:** make completion loud — confetti, sweep, haptic, sound (each behind
its Aurora Alive flag in `src/config/flags.ts` — `celebrationEngine`,
`motionPolish` — each respecting reduce-motion via `useMotionScale()` from
`src/theme/motion.ts` and the `gamification: 'off'` preference in
`src/store/usePreferencesStore.ts`) — and make rest silent: true-black ink,
zero idle animation, zero drifting glow.
**We never let glow idle.**

*Violation today:* `src/components/shared/AuroraBackground.tsx` mounts
`DriftingBloom` orbs on an infinite 8s loop (`AMBIENT.auroraDrift`) plus a
permanent `GradientMesh`, imported at 41 sites — glow that runs whether or not
anything happened. The auth screens run `AuroraAnimatedBackground` at full
opacity.
*Compliant looks like:* the resting base is `colors.background` with nothing
moving. Aurora exists only as event language — `EnergySweep`, `ParticleField`
(in `src/components/shared/ambient/`), and the `CelebrationHost`
(`src/celebration/CelebrationHost.tsx`, behind `celebrationEngine`) — triggered
by a completion, and it *ends*.

### Principle 5 — Type does the talking
**We do:** build hierarchy from the type scale (`hero`→`micro` in
`src/theme/typography.ts`), tabular numerals (`TABULAR_NUMS`,
`src/theme/typography.ts`) for data, `DOMAIN_GLYPHS` (`src/theme/colors.ts:7`)
for domain marks.
**We never reach for a border, a label-cap, or a card where a headline would do.**

*Violation today:* `app/(tabs)/goals.tsx:500` hand-rolls the caps label
`YOUR NEXT MOVE` (manual `letterSpacing: 0.5`) above body-size content — the
most important sentence in the app dressed as an eyebrow. `app/(tabs)/rewards.tsx:190`
concatenates an emoji into a data value (`${bestStreak}🔥`). 109 multi-word
ALL-CAPS literals across 55 component files.
*Compliant looks like:* "Today's focus block" set as an `h2`/`h1` headline;
streak counts rendered as type + `TABULAR_NUMS` +
`src/components/gamification/StreakFlame.tsx` (the component, not the emoji);
caps eyebrows only via `SectionLabel`, at most one per scroll section, and
never above the screen's hero.

---

## Locked sentences (enforced by manifestoLock.test.ts — do not edit)

1. We never open a screen on a visualization.
2. We never ship three equal cards where one hero belongs.
3. We never tint for atmosphere.
4. We never let glow idle.
5. We never reach for a border, a label-cap, or a card where a headline would do.

## How this document is enforced

- `src/theme/__tests__/colorTokenCompliance.test.ts` — raw hex / rgba() / hsl() outside src/theme (P3, P5)
- `src/theme/__tests__/atmosphereTintCompliance.test.ts` — `+ 'XX'` alpha-suffix washes (P3)
- `src/theme/__tests__/ambientWashCompliance.test.ts` — idle-wash imports (P4)
- `src/theme/__tests__/capsLabelCompliance.test.ts` — new LABEL-CAPS surfaces (P5)
- `src/theme/__tests__/manifestoLock.test.ts` — this document's locked wording, the CLAUDE.md
  supersession, the checklist's 10 lines, the PR template, and the jest wiring itself
- `docs/DESIGN_REVIEW_CHECKLIST.md` — pasted, filled, into every PR whose diff touches
  `app/**` or `src/components/**` (pre-seeded by `.github/PULL_REQUEST_TEMPLATE.md`)

All four compliance allowlists are ONE-WAY RATCHETS (same culture as
`motionTokenCompliance.test.ts`): entries are removed as files are migrated,
never added without a founder-approved PR labelled `manifesto-change`.
A false positive is handled by allowlisting that one file with a comment —
never by weakening a regex.
```

### 3.2 Deliverable 2 — CLAUDE.md patch (paste-ready)

Replace the entire `### Philosophy` block under `## Design System` (currently the paragraph beginning *"**Bold & Expressive** — think Duolingo meets Headspace…"* and ending *"…documented in `docs/aurora-refined-v2/`."*) with:

```markdown
### Philosophy
**Answer First, Celebrate Loud, Rest Quiet** — the canonical manifesto is
`docs/DESIGN_MANIFESTO.md`; read it before any UI work. The visual language is
**Ink + Signal**: true-black resting base, zero decorative washes, domain hues
at full saturation used structurally (never as atmosphere tint), type-led
hierarchy, and loud flag-gated celebration that always ends. The five locked
rules — never open a screen on a visualization; never three equal cards where
one hero belongs; never tint for atmosphere; never let glow idle; never a
border/label-cap/card where a headline would do — are enforced in CI by the
compliance ratchets in `src/theme/__tests__/*Compliance.test.ts` plus
`manifestoLock.test.ts`. Weakening a guard regex or growing an allowlist
requires a founder-approved PR labelled `manifesto-change`.
(`docs/aurora-refined-v2/` is superseded — historical reference only.)
```

**Where the copies live (verified 2026-06-10 — there is no `lifeos/` directory inside this repo):**

1. **`<repo>\CLAUDE.md`** (`c:\personal\Project X\lifeos-w3\CLAUDE.md`) — the version-controlled copy. Patched in the landing PR. This is the copy `manifestoLock.test.ts` asserts on. When this branch merges, git carries the change to the primary clone (`c:\personal\Project X\lifeos\CLAUDE.md`) and every other worktree — no manual copy.
2. **`c:\personal\Project X\CLAUDE.md`** — the workspace mirror that Claude Code sessions read. It is outside the repo and CI cannot reach it. It is updated **in the same working session** with the identical block, and the landing PR description contains the literal line `workspace CLAUDE.md mirror updated` so the reviewer can hold the author to it.

The strings `Bold & Expressive` and `Duolingo meets Headspace` MUST NOT survive anywhere in either copy (both are asserted absent in the repo copy by `manifestoLock.test.ts`); `aurora-refined-v2` survives only on lines containing the word `superseded`.

### 3.3 Deliverable 3 — Automated guards (the dilution killers)

All four ratchets clone the structure of `src/theme/__tests__/motionTokenCompliance.test.ts` verbatim: `REPO_ROOT = path.resolve(__dirname, '..', '..', '..')`, `walk()` over `SCAN_DIRS = ['src', 'app']`, `SKIP_DIR_NAMES = ['__tests__', 'node_modules', '.claude']`, skip `.test.`/`.spec.` files, per-line regex, file-path `ALLOWLIST` as a `Set<string>` of repo-relative POSIX paths, plus the second `it()` asserting every allowlist entry exists on disk (the shrink-only check). Each runs in the existing **node** jest project (`jest.config.js` `testMatch: ['**/__tests__/**/*.test.ts', ...]` already collects `src/theme/__tests__/`, and its `testPathIgnorePatterns` — `/app/`, `/src/components/`, `/src/hooks/` — do not touch `src/theme/`). They become required CI automatically: `.github/workflows/unit-tests.yml` runs `npm test`, which runs both jest projects.

**Seeding rule for every guard:** on the landing day, run the test with an empty allowlist, paste the exact violating file list as the allowlist, and record in the file's header comment (a) the seeded violation count, (b) the measure date, and (c) the exact grep command that reproduces it. The counts below were measured 2026-06-10; the landing-day grep output is the authority.

**Guard A — `src/theme/__tests__/colorTokenCompliance.test.ts`**
- Regexes (per line, a hit on either is a violation):
  - `/(['"`])#[0-9a-fA-F]{3,8}\1/` — any quoted hex color literal.
  - `/\brgba?\(|\bhsla?\(/` — any functional color literal.
- Scope: `src/**` + `app/**` `.ts`/`.tsx`; `src/theme/**` excluded wholesale (token definitions are the one legal home).
- Seed (measured 2026-06-10): **185 hex occurrences / 57 files + 47 rgba()/hsl() occurrences; allowlist = the 65-file union** — including `src/finance/display.ts` (24 hex), `src/components/shared/ambient/presets.ts` (22), `src/components/modules/polymath/DiscoverGrid.tsx` (12), `src/components/modules/polymath/discoverArea.ts` (9), `app/(tabs)/goals.tsx` (9), `app/(tabs)/index.tsx` (6), `src/components/shared/AuroraBackground.tsx` (6).
- Known, decided limitation (recorded so it cannot be re-litigated as an excuse): a hex value embedded mid-template-literal (not immediately quote-delimited) is not matched by the quote-anchored regex. This is accepted for this wave — the rgba/hsl regex catches the common web-shadow constructions — and is revisited only at the ESLint migration (Option B). It is not grounds to widen the regex ad hoc or to skip a migration.
- Failure message: `Raw color literal found outside src/theme/. Color is meaning (Manifesto P3): read tokens via useColors() / colors.ts, or add a semantic token to src/theme/colors.ts. Never inline a hue. Violations:\n  <file:line  trimmed-line>`

**Guard B — `src/theme/__tests__/atmosphereTintCompliance.test.ts`**
- Regex (per line): `/\+\s*['"][0-9a-fA-F]{2}['"]/` — *any* expression concatenated with a two-hex-digit string. Receiver-agnostic by design: the member-anchored form (`c.x + '12'`) misses the 45 live bare-variable tints (`hue + '33'`, `accent + '55'`, `color + '22'`, `deltaColor + '22'`). Measured 2026-06-10: every match of this regex in `src/` + `app/` is a color tint — zero non-color matches.
- Scope: `src/**` + `app/**` `.ts`/`.tsx` (no theme exclusion — this construction is illegal even inside theme; measured today, `src/theme/` has zero matches, so the rule costs nothing).
- Seed: **138 occurrences / 65 files** (measured 2026-06-10).
- Failure message: `Atmosphere tint (expression + 'XX' alpha suffix) found. We never tint for atmosphere (Manifesto P3): use background/surface/surfaceAlt/card or the semantic *Light tokens; if the element needs the domain hue, use it at full saturation structurally. Violations:\n  ...`

**Guard C — `src/theme/__tests__/ambientWashCompliance.test.ts`**
- Regex (per line): `/from ['"](?:@\/components\/shared\/AuroraBackground|@\/components\/shared\/AuroraAnimatedBackground|@\/components\/ui\/AuroraGlow|\.{1,2}\/ambient\/(?:GradientMesh|presets))['"]/`
  The relative alternatives REQUIRE the `ambient/` segment. The earlier draft's optional `(?:ambient\/)?` is wrong: it matches `import { resolvePreset } from './presets'` in `src/celebration/CelebrationHost.tsx:8` — the celebration layer this guard exists to protect. Criterion 8 asserts the celebration layer produces zero matches.
- Scope: `src/**` + `app/**` `.ts`/`.tsx`. Allowlist seed: the **41 importer files** (38 × `@/components/shared/AuroraBackground`, including `app/(tabs)/index.tsx`; 3 × `@/components/shared/AuroraAnimatedBackground` on `app/(auth)/sign-in.tsx`, `sign-up.tsx`, `welcome.tsx`) **plus `src/components/shared/AuroraBackground.tsx` itself** (it imports `./ambient/GradientMesh`). `src/components/ui/AuroraGlow.tsx` has **zero importers today** — it stays in the regex so the first future import is a red build, and contributes no allowlist entry. The event layer is untouched and unmatched: `EnergySweep`, `ParticleField`, `useAmbientEventStore` (in `src/components/shared/ambient/`) and everything in `src/celebration/` stay as celebration language; `GradientMesh` and the bloom presets are the idle wash being retired by the color cluster.
- Failure message: `New idle-wash import. We never let glow idle (Manifesto P4): the resting base is colors.background with nothing moving. For a completion moment, fire the event layer (useAmbientEventStore sweep / CelebrationHost behind celebrationEngine) — it must end. Violations:\n  ...`

**Guard D — `src/theme/__tests__/capsLabelCompliance.test.ts`**
- Regexes and per-regex scope (a hit on any is a violation):
  1. `/variant=["']micro["']/` — scans `.tsx` only.
  2. `/<SectionLabel[\s>/]/` — scans `.tsx` only.
  3. `/textTransform:\s*['"]uppercase['"]/` — scans `.ts` **and** `.tsx` (`src/theme/typography.ts` is a `.ts` file and is the only legal home; measured 2026-06-10 it is the only `.ts` match in the tree, so it is the sole `.ts` allowlist entry).
  4. `/["'>][A-Z][A-Z]+(?: [A-Z0-9/+&.'-]+)+["'<]/` — two-plus-word ALL-CAPS literal in JSX text or a string prop (catches `YOUR NEXT MOVE`, `label="BEST STREAK"`) — scans `.tsx` only (the pattern is noisy in `.ts` data/SQL files; that is a scoping decision, not a hedge).
- Allowlist: the union of all four patterns' current offenders. Seed: **64 files** (109 ALL-CAPS literals across 55 files + 16 `variant="micro"` across 8 files + `SectionLabel` consumers + `src/theme/typography.ts`, measured 2026-06-10).
- Failure message: `New LABEL-CAPS surface. Type does the talking (Manifesto P5): set the words as an h1/h2/h3 headline from src/theme/typography.ts. A caps eyebrow is wayfinding furniture, never the message — and never above the screen's hero. Violations:\n  ...`

**Lock test (not a ratchet) — `src/theme/__tests__/manifestoLock.test.ts`**
Six plain assertions, no allowlist:
1. `docs/DESIGN_MANIFESTO.md` exists, contains exactly five `### Principle` headings, and contains all five locked sentences from §3.1 as exact substrings.
2. `<repo>/CLAUDE.md` contains `Answer First, Celebrate Loud, Rest Quiet` and contains neither `Bold & Expressive` nor `Duolingo meets Headspace`.
3. Every line of `<repo>/CLAUDE.md` containing `aurora-refined-v2` also contains `superseded`.
4. `docs/DESIGN_REVIEW_CHECKLIST.md` exists and contains exactly 10 lines beginning `- [ ]`, each containing one of `[P1]`…`[P5]` or `[G]`.
5. `.github/PULL_REQUEST_TEMPLATE.md` exists and contains all 10 of those `- [ ]` lines verbatim.
6. `jest.config.js` does not contain the substring `theme/__tests__` — i.e. no ignore pattern, project exclusion, or path carve-out has unplugged the guard directory from `npm test`.

Failure message: `The manifesto's locked wording, the CLAUDE.md supersession, the checklist, the PR template, or the guard wiring was changed. These changes require a founder-approved PR labelled manifesto-change — restore from docs/DESIGN_MANIFESTO.md §Locked sentences and §3.3 of the Cluster 5 dossier.`

**Rollout note:** all five tests land green by construction (seeded allowlists), in the same PR as the docs, unflagged, as required CI via `.github/workflows/unit-tests.yml` (`npm test` — both jest projects). Other clusters shrink the allowlists file-by-file as they ship; allowlist removals are celebrated in PR descriptions ("ratchet −6").

### 3.4 Deliverable 4 — `docs/DESIGN_REVIEW_CHECKLIST.md` (full content) + PR template

```markdown
# Design review checklist — paste into every PR that touches app/ or src/components/
Every line is yes/no. A "no" without a founder-approved `manifesto-change` label blocks merge.
A PR touching app/ or src/components/ without this checklist filled in its description is returned without review.
(P# = docs/DESIGN_MANIFESTO.md principle; G = guard hygiene.)

- [ ] [P1] On every screen this PR touches, the screen's answer (a sentence + its action) is fully inside the first viewport at 390×844 — before any chart, ring, or radar — and the Today HexRadar (app/(tabs)/index.tsx) was not moved, resized, or demoted.
- [ ] [P2] Every touched screen has exactly one hero element; no row of 2+ visually equal cards was added.
- [ ] [P3] Zero new quoted hex / rgba() / hsl() literals outside src/theme/ and zero new `+ 'XX'` alpha tints anywhere (guards A+B pass with no allowlist additions).
- [ ] [P4] Nothing added animates while idle; every new animation is event-triggered, ends, and respects useMotionScale() and gamification:'off'.
- [ ] [P5] No new ALL-CAPS label, micro-variant eyebrow, or emoji-in-data; new emphasis is a typography.ts variant (guard D passes with no allowlist additions).
- [ ] [G] No compliance-test allowlist gained an entry, no guard regex was edited, no `.skip`/`.only` was added to any *Compliance/manifestoLock test, and jest.config.js + .github/workflows/unit-tests.yml still run them.
- [ ] [G] New user-visible behavior is behind a named flag (src/config/flags.ts or FALLBACK_FLAGS in src/store/useFlagStore.ts) and the PR description names it.
- [ ] [G] The change was screenshotted on react-native-web at 390×844 (the test surface), the screenshot is attached to the PR, and it matches the native intent.
- [ ] [G] All copy added is guilt-free: no streak-shaming, no FOMO timers, no paywalled mechanics.
- [ ] [G] If this PR implements a dossier wave, its acceptance criteria are quoted verbatim in the PR description with pass/fail marks.
```

**PR-template wiring (this is a deliverable, not a footnote):** create `.github/PULL_REQUEST_TEMPLATE.md` (verified absent today; `.github/` exists and holds `workflows/`) containing a `## Design review` section with the 10 `- [ ]` lines above verbatim, so every PR opens pre-seeded with the unchecked list. `manifestoLock.test.ts` assertion 5 pins it.

### 3.5 Deliverable 5 — The consumption contract (binding on the next session)

> Place this block verbatim at the top of the design dossier the implementation planner consumes.

```markdown
## Consumption contract — binding on the implementation-planning session
1. Acceptance criteria from this dossier are copied VERBATIM into implementation
   tasks — never paraphrased, never summarized, never merged. One criterion
   dropped = the task is incomplete by definition.
2. A wave is "done" only when every copied criterion is individually marked
   pass with evidence (screenshot, test name, or grep output) in the PR.
3. Token names, copy strings, regexes, and file paths in this dossier are exact.
   If a value must change during implementation, the change is recorded inline
   in the dossier with a dated note — silent drift is a defect.
4. The five compliance/lock tests in src/theme/__tests__/ land in the FIRST
   wave, before any visual work, so every later wave is born ratcheted.
5. Allowlist entries only shrink. Any plan step that adds one is invalid
   unless the PR carries the manifesto-change label with founder approval.
6. No plan step is allowed to soften manifesto wording ("never" → "avoid",
   "is" → "should be"). manifestoLock.test.ts makes this a red build.
7. Every plan task that touches a screen cites the manifesto principle(s) it
   serves, and ships the DESIGN_REVIEW_CHECKLIST filled in its PR.
8. If a task cannot meet a criterion, the task is escalated to the founder —
   it is never quietly rescoped to a weaker criterion.
```

---

## 4. Dilution traps (and the counter-rule for each)

1. **The docs land, the guards "follow next sprint."** The manifesto without the ratchets is option A — the one that already failed once in this repo. *Counter-rule:* docs and all five tests ship in one PR; contract line 4 makes guard-first ordering a plan requirement; criterion 3 makes it checkable.
2. **Allowlists quietly grow** ("just this one screen, it's a hotfix"). One addition re-legalizes the pattern forever. *Counter-rule:* the shrink-only `it()` plus checklist line 6; any addition requires the `manifesto-change` label with founder approval — reviewers reject unlabeled diffs touching an `ALLOWLIST` block.
3. **A guard regex gets narrowed during review** ("too many false positives"). *Counter-rule:* a false positive is handled by allowlisting that one file with a comment — never by weakening the regex. The regexes in §3.3 are part of the locked spec; editing one without the label fails checklist line 6.
4. **The manifesto wording gets sanded down in doc review** ("never" becomes "prefer not to"). This is the original sin of every diluted audit. *Counter-rule:* the five sentences are mechanically locked by `manifestoLock.test.ts`; softening is a red build, not a style debate.
5. **CLAUDE.md keeps the old philosophy alongside the new one** ("for context"), giving every future session two truths to pick from. *Counter-rule:* the patch *replaces* the section; the lock test asserts `Bold & Expressive` and `Duolingo meets Headspace` are gone and `aurora-refined-v2` appears only with `superseded`.
6. **The checklist becomes decorative** — pasted pre-checked, or skipped on "small" PRs. *Counter-rule:* `.github/PULL_REQUEST_TEMPLATE.md` pre-seeds it unchecked on every PR; checklist line 10 + contract line 7 tie it to wave completion; a PR touching `app/` or `src/components/` without the filled checklist is returned without review (stated in the checklist header itself).
7. **The planner summarizes this dossier** into "tighten design consistency, add some lint tests" — the founder's exact fear. *Counter-rule:* the consumption contract (§3.5) sits at the top of the dossier and forbids paraphrase; criterion-by-criterion pass marks are the only accepted definition of done.
8. **Guard evasion by rename** — `AuroraBackground.tsx` is renamed (or re-exported through a new wrapper) so the import regex never fires. *Counter-rule:* the rename deletes an allowlisted path, so the exists-on-disk `it()` reds CI and forces the rename PR to touch the `ALLOWLIST` block — which is rule 2 territory, label required. A new wrapper file re-exporting the wash imports it and is caught directly.
9. **Guard unplugging via config** — a `testPathIgnorePatterns` entry, project exclusion, or CI-workflow edit silently stops running `src/theme/__tests__`. *Counter-rule:* `manifestoLock.test.ts` assertion 6 asserts `jest.config.js` contains no `theme/__tests__` carve-out; checklist line 6 names `unit-tests.yml`; criterion 12 makes it reviewable.
10. **Workspace-mirror drift** — the repo copy of `CLAUDE.md` is patched (CI-locked), but the workspace mirror at `c:\personal\Project X\CLAUDE.md` — the file Claude Code sessions actually read — keeps "Bold & Expressive", and every future session is briefed on the dead philosophy. *Counter-rule:* §3.2 step 2 updates it in the same session and the PR description carries the literal attestation line `workspace CLAUDE.md mirror updated`; criterion 2b makes the reviewer check for it.
11. **Tint evasion via intermediate variable** — `const wash = c.goal; … wash + '12'` slips past any receiver-anchored regex. *Counter-rule:* Guard B anchors on the alpha-suffix concatenation itself, receiver-agnostic; this audit already widened the seed from the member-only 93/47 to the true 138/65, and the measured false-positive count of the wide regex is zero.

---

## 5. Acceptance criteria (binary, reviewer-checkable)

1. `docs/DESIGN_MANIFESTO.md` exists, contains exactly five `### Principle` headings, and contains all five locked sentences from §3.1 as exact substrings.
2. **(a)** `<repo>/CLAUDE.md` contains the string `Answer First, Celebrate Loud, Rest Quiet`; `grep -c "Bold & Expressive"` and `grep -c "Duolingo meets Headspace"` both return 0 on it; every line matching `aurora-refined-v2` also matches `superseded`. **(b)** The landing PR description contains the literal line `workspace CLAUDE.md mirror updated`.
3. The five test files named in §3.3 exist at those exact paths, are collected by the node jest project, and `npx jest src/theme/__tests__` exits 0 on the landing commit.
4. Each ratchet's `ALLOWLIST` equals the exact file set produced by running that guard's regexes over the landing-day tree; each file's header comment records the seeded violation count, the measure date, and the reproducing grep command; the exists-on-disk `it()` passes for all four.
5. Adding the line `const x = '#5B4FE8';` to any non-allowlisted file under `src/utils/` makes `npx jest src/theme/__tests__/colorTokenCompliance.test.ts` fail, and the failure output contains the file path, the line number, and the string `Manifesto P3`.
6. Adding the line `const glow = 'rgba(91,79,232,0.12)';` to the same file also fails Guard A with output containing `Manifesto P3`.
7. Adding the line `const wash = hue + '12';` to any non-allowlisted file fails Guard B with output containing `Manifesto P3`.
8. Running Guard C's regex over `src/celebration/**` produces zero matches (in particular, `src/celebration/CelebrationHost.tsx:8` — `import { resolvePreset } from './presets'` — does not match), and adding `import { AuroraBackground } from '@/components/shared/AuroraBackground';` to a new file under `app/` fails Guard C with output containing `Manifesto P4`.
9. Adding `<Text>NEXT BEST STEP</Text>` to a non-allowlisted `.tsx` file fails Guard D with output containing `Manifesto P5`.
10. Changing any locked sentence in `docs/DESIGN_MANIFESTO.md` by one word makes `manifestoLock.test.ts` fail.
11. `grep -E "it\.skip|it\.only|it\.todo|describe\.skip|describe\.only|test\.skip|test\.only|xit\(|xdescribe\(|xtest\("` across the five test files returns 0 matches, and none of the five files contains an import from `src/config/flags` or `src/store/useFlagStore`.
12. `manifestoLock.test.ts` fails when the substring `theme/__tests__` is added anywhere in `jest.config.js` (verified by making that edit and running the test), and the landing PR contains no diff to `jest.config.js` or `.github/workflows/unit-tests.yml`.
13. `docs/DESIGN_REVIEW_CHECKLIST.md` exists with exactly 10 `- [ ]` lines, each containing a `[P1]`–`[P5]` or `[G]` tag, and `.github/PULL_REQUEST_TEMPLATE.md` exists containing all 10 lines verbatim.
14. `git diff --name-only` for the landing PR equals exactly this set (no more, no fewer): `docs/DESIGN_MANIFESTO.md`, `docs/DESIGN_REVIEW_CHECKLIST.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `CLAUDE.md`, `src/theme/__tests__/colorTokenCompliance.test.ts`, `src/theme/__tests__/atmosphereTintCompliance.test.ts`, `src/theme/__tests__/ambientWashCompliance.test.ts`, `src/theme/__tests__/capsLabelCompliance.test.ts`, `src/theme/__tests__/manifestoLock.test.ts`, plus the dossier file receiving the §3.5 contract block. In particular `app/(tabs)/index.tsx` (the HexRadar host) has zero diffs.
15. `docs/DESIGN_MANIFESTO.md` contains the exact sentence `Compliance is achieved by placing the answer in the same first viewport — never by moving, shrinking, or demoting the radar.` and contains the string `HexRadar`.
16. The five locked sentences in `docs/DESIGN_MANIFESTO.md` contain zero instances of the words `avoid`, `prefer`, `should`, `try` (case-insensitive) — `never` survives the doc review intact.

---

## 6. Effort estimate

| Piece | Effort |
|---|---|
| `docs/DESIGN_MANIFESTO.md` (content finalized above) | **S** |
| CLAUDE.md patch (repo copy in PR + workspace mirror attestation) | **S** |
| Guard A — colorTokenCompliance (2 regexes, 65-file union seed) | **M** |
| Guard B — atmosphereTintCompliance (1 regex, 65-file seed, zero measured FPs) | **S** |
| Guard C — ambientWashCompliance (42-entry seed incl. AuroraBackground.tsx; celebration layer verified unmatched) | **S** |
| Guard D — capsLabelCompliance (4 regexes with per-regex scope, 64-file union seed) | **M** |
| `manifestoLock.test.ts` (6 assertions) | **S** |
| `docs/DESIGN_REVIEW_CHECKLIST.md` + `.github/PULL_REQUEST_TEMPLATE.md` | **S** |
| Consumption contract insertion into the dossier | **S** |
| **Total cluster** | **M** (one focused day; zero runtime risk by criterion 14) |

---

## Dilution audit log

1. **§1 tint count wrong and pattern too narrow** — claimed 94/47 via `c.<token> + 'XX'`; measured member-form is 93/47 and the real pattern (any expression `+ 'XX'`) is **138/65**, with live bare-variable tints (`hue + '33'` chartTheme.ts:22, `accent + '55'` BadgeTile.tsx:29, `color + '22'` DomainMiniCard.tsx:33) that the spec's regex missed. Rewrote §1 bullet, Guard B, manifesto P3, traps (new trap 11).
2. **§1 raw-hex counts wrong** — claimed 194/58; measured 185/57 quoted hex; `presets.ts` is 22 not 30, `index.tsx` is 6 not 7; added `discoverArea.ts` (9). Corrected with measure date.
3. **Guard A blind spot** — 47 live `rgba()`/`hsl()` literals outside theme escaped the hex-only regex; added second regex, seed = 65-file union; recorded the template-literal-hex limitation as a decided non-goal (no "revisit later" hedge left open-ended — it is pinned to the ESLint migration).
4. **Guard B escape hatch** — receiver list `(c|colors|palette)` was an evasion template (`const wash = c.goal; wash + '12'`); regex now anchors the alpha-suffix concat itself; verified zero false positives across the tree.
5. **Guard C regex false positive (would have broken the keep-layer)** — optional `(?:ambient\/)?` matches `from './presets'` in `src/celebration/CelebrationHost.tsx:8` (verified on disk); regex now requires `ambient/`; added criterion 8 (celebration layer must produce zero matches).
6. **Guard C unverified claims pinned** — verified 41 importer files (38 + 3 auth, exact paths), `AuroraBackground.tsx` self-entry needed (imports `./ambient/GradientMesh`), `AuroraGlow.tsx` has 0 importers (kept in regex, decision recorded, no allowlist entry).
7. **Guard D scope contradiction** — `textTransform` rule said "legal only in `src/theme/typography.ts`" while scanning `.tsx` only (typography.ts is `.ts`, never scanned); regex 3 now scans `.ts`+`.tsx`, and I verified typography.ts is today's only `.ts` match.
8. **§3.2 mirror instruction wrong for this repo** — there is no `lifeos/` directory inside `lifeos-w3` (verified); "both mirrored copies" was unimplementable as written. Rewrote: lock test binds `<repo>/CLAUDE.md`; workspace mirror `c:\personal\Project X\CLAUDE.md` gets a same-session manual update with a PR-description attestation line (criterion 2b, trap 10).
9. **`Duolingo meets Headspace` ban had no enforcement** — added to `manifestoLock.test.ts` assertion 2 and criterion 2a.
10. **No defense against guard unplugging** — jest-config/CI edits silently skipping `src/theme/__tests__` were uncovered; added lock assertion 6, checklist line 6 wording, trap 9, criterion 12.
11. **"PR-template wiring" existed only in the effort table** — specified `.github/PULL_REQUEST_TEMPLATE.md` (verified absent; `.github/` exists) with the 10 lines verbatim; lock assertion 5 + criterion 13.
12. **P5 judgment phrase** — "only where a section genuinely needs a wayfinding mark" replaced with binary rule: via `SectionLabel` only, at most one per scroll section, never above the hero.
13. **Hex-radar freeze under-specified** — pinned `HexRadar` to `src/components/gamification/HexRadar.tsx`, import `index.tsx:56`, render `index.tsx:528`; froze position/size/order in §3.0 and P1; added grep-checkable freeze sentence (criterion 15) and zero-diff requirement on `index.tsx` (criterion 14). Placement unchanged — constraint honored, now mechanically.
14. **Compassion gate under-pinned** — named `GamificationVisibility = 'full' | 'minimal' | 'off'` (`usePreferencesStore.ts:7`, verified) and `useMotionScale()` home (`src/theme/motion.ts`, verified); added "failure messages never use guilt framing" to §3.0.
15. **Unpinned component references** — `CelebrationHost` → `src/celebration/CelebrationHost.tsx`, `StreakFlame` → `src/components/gamification/StreakFlame.tsx`, `DOMAIN_GLYPHS` → `src/theme/colors.ts:7`, `TABULAR_NUMS` → `src/theme/typography.ts`, `AuroraAnimatedBackground` → `src/components/shared/AuroraAnimatedBackground.tsx` (all verified on disk).
16. **Sloppy artifact reference** — "tmp/audit-signin" → `tmp/audit-signin.png`; verified `audit-today.png` and `audit-rewards.png` exist in `tmp/`.
17. **Criterion 11 contradicted the deliverables** — it banned all non-test diffs while the PR must diff `CLAUDE.md`/docs/`.github`; replaced with an exhaustive allowed-file enumeration (criterion 14).
18. **Skip-token grep too narrow** — extended to `.only`, `.todo`, `xdescribe`, `xtest` (criterion 11).
19. **Acceptance criteria expanded 11 → 16**, all yes/no: added rgba negative test (6), Guard B negative test (7), celebration zero-match (8), config-tamper test (12), template existence (13), freeze sentence (15), softener-word sweep of locked sentences (16).
20. **Rollout/CI anchor added** — named `.github/workflows/unit-tests.yml` (runs `npm test`, both jest projects; node project's ignore patterns verified not to touch `src/theme/`) as the mechanism making the guards required CI.
21. **Seeding rule tightened** — header comment must record count + date + the exact reproducing grep command (reproducibility kills "the numbers were always wrong" dilution).
22. **Banned-word sweep of §3–6** — zero instances of consider/could/maybe/potentially/"we might" found or introduced; the curiosity tab's filename never appears in §3–6 (offender lists cite `discoverArea.ts`/`DiscoverGrid.tsx`, which are the actual top files).
23. **Verified-and-kept (anti-dilution ballast)** — 109/55 caps, 16/8 micro, 64-file union, 10 emoji files, `typography.ts:118–124`, `AuroraBackground.tsx:26–30`, `goals.tsx:495/497/500`, `rewards.tsx:190`, `index.tsx:32`, `AMBIENT.auroraDrift = 8000` (`motion.ts:59`), flags `celebrationEngine`/`motionPolish` default-false, `FALLBACK_FLAGS` (`useFlagStore.ts:10`), motion-test "ONE-WAY RATCHET" + exists-on-disk `it()` — all confirmed against `c:\personal\Project X\lifeos-w3` on 2026-06-10.
