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
viewport at 390×844 logical px on react-native-web.
Compliance is achieved by placing the answer in the same first viewport — never by moving, shrinking, or demoting the radar.
A visualization is a supporting witness, never the opening statement.

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
4px domain bar (legal only on a screen's single hero, where the hue also carries
ink or the CTA), a headline, a progress fill. A hue on screen always means
"this is that domain" or "this changed".
**We never tint for atmosphere.**

*Violation today:* `app/(tabs)/goals.tsx:497` — `backgroundColor: c.goal + '12'`,
a 7%-opacity wash built by concatenating an alpha suffix onto a token. 138
occurrences of the alpha-suffix pattern across 65 files (including bare-variable
forms like `hue + '33'`, `accent + '55'`). Also the permanent gradient mesh in
`src/components/shared/AuroraBackground.tsx:26–30` (0.22/0.16/0.12 opacity on
every screen).
*Compliant looks like:* surfaces come from `background`/`surface`/`surfaceAlt`/`card`
or the semantic `*Dim` tokens in `src/theme/colors.ts`; domain hue appears at 100%
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
