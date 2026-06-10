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
