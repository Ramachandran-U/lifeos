# Design Waves 1–3 — Manual Test Plan

> **Status (2026-06-14): HISTORICAL.** This plan covered the Aurora-era design waves; the visual layer it tests was superseded by the Ink + Signal recommit (June 2026), and its surfaces are now covered by the permanent Playwright suites (`ambient`, `ink-structural`, `cold-start`, `today-answer-first`, `module-hierarchy`) plus the Guard A–E CI ratchets. Kept as a record; do not execute against the current build.

Covers everything shipped on branch `feat/design-wave1-2` (commits `0e61c26` →
`dc1461a`). Each case is independent. Mark **Pass / Fail / N-A** and note the
device. Re-run on **both iOS and Android** for anything marked **[native]** —
several changes (blur, haptics) behave differently per platform and are
*untested visually* so far (only typecheck-verified).

How to run: `npx expo start`, then open on an iOS simulator, an Android
emulator, and (for contrast) web. A fresh install / cleared onboarding is
needed for the entry-screen cases — see TC-0.

Legend: **[native]** = verify on iOS + Android device, not just web.

---

## TC-0 — Setup / preconditions
| Step | Expected |
|---|---|
| Launch the app on a fresh profile (or clear app data so `onboardingStage === 0`). | App routes to the **welcome-intent** screen (chip picker), NOT the day-1 vision textarea. |
| Have a second profile that has completed onboarding (has a routine). | Used for the tab/empty-state cases. |

---

## A. Native glassmorphism (item A) **[native]**
Files: `Card.tsx`, `GlassCard.tsx`. Web keeps CSS blur; native now uses `expo-blur`.

| TC | Steps | Expected |
|---|---|---|
| A-1 | On **iOS**, open Today / any tab with cards over the aurora background. | Cards show a real frosted-glass blur of the gradient behind them — not a flat semi-transparent panel. |
| A-2 | Repeat on **Android**. | Same frosted effect. Watch for jank/scroll lag on a low-end device — note FPS if it stutters. |
| A-3 | Toggle **light mode** (Profile/settings) and re-check a card. | Blur tint switches to light; text stays legible (contrast OK). |
| A-4 | Look at a **z2/z3 surface** (a bottom sheet / modal, e.g. Life hub, Add Contact). | Blur is intentionally subtle/near-opaque here (by design). No visual breakage, corners still rounded. |
| A-5 | On **web**, open the same cards. | Still uses CSS `backdrop-filter` blur — unchanged from before. |
| A-6 | Rotate device / resize. | Blur layer stays clipped to the card's rounded corners (no square overflow). |

---

## B. Button states (item B) **[native]**
File: `Button.tsx`. New: `loading`, `loadingTitle`, `icon`/`iconPosition`, visual disabled.

| TC | Steps | Expected |
|---|---|---|
| B-1 | welcome-intent: before selecting any chip, look at **"Build my day"**. | Button is visibly **dimmed** (disabled look), not just inert. Tapping does nothing, no haptic. |
| B-2 | Select a chip, then tap **"Build my day"**. | Button shows a **spinner + "Building your day…"**, is non-interactive while working, then navigates. |
| B-3 | Career → generate strategy. | Button shows spinner + **"Designing strategy…"**, auto-disabled during the call. |
| B-4 | Finance goal tab → "Get weekly insight". | Spinner + **"Loading…"**, secondary-variant styling preserved. |
| B-5 | Discovery confirm → confirm CTA. | Spinner + **"Building your day…"**; disabled when there's no source. |
| B-6 | Any disabled button. | Reduced opacity (~0.45) and no press haptic. |

---

## C. Two-path onboarding fork (item C)
File: `welcome-intent.tsx`. Discovery promoted from caption link to a real path.

| TC | Steps | Expected |
|---|---|---|
| C-1 | On welcome-intent, scroll below "Build my day". | An **"or" divider** then a **secondary "Talk it through first"** button (bordered), with a one-line subtitle. NOT a faint caption link. |
| C-2 | Tap **"Talk it through first"**. | Navigates to the Discovery chat (`discovery-chat`). Telemetry `onboarding_v2_started` fires (check admin telemetry if available). |
| C-3 | Below that, the **"Import a ChatGPT/Claude chat"** caption link. | Still present as a smaller tertiary option; opens `discovery-intro`. |
| C-4 | Pick 1–3 chips and use "Build my day" instead. | Quick path still works end-to-end (seeds a starter routine, lands on Today). |

---

## D. Entry chips — Lucide icons + copy (item D)
File: `welcome-intent.tsx`.

| TC | Steps | Expected |
|---|---|---|
| D-1 | Look at the 6 chips. | Each shows a **clean Lucide line icon** in its domain colour (target / heart-pulse / trending-up / briefcase / users / sparkles) — NOT a Unicode glyph (◆ ♥ ◈ …). |
| D-2 | Each chip. | Has a **two-line label**: action phrase (e.g. "Build wealth") + a supporting line (e.g. "Save toward what matters"). |
| D-3 | Select / deselect chips; try selecting a 4th. | Selection caps at **3** (4th tap ignored); selected chip gets accent border + tint; selection haptic fires **[native]**. |
| D-4 | Visual polish. | Chip corners use the standard radius; icon sized consistently; no clipped text. |

---

## E. One domain = one icon (items E1 + E2)
Files: `domainIcons.ts`, `DomainGlyph.tsx`, `RoutineBlock.tsx`, `HexRadar.tsx`, `LifeHubSheet.tsx`, `ModuleHeader.tsx`.

| TC | Steps | Expected |
|---|---|---|
| E-1 | Compare the **goal** icon on: the HexRadar (Today), a routine block tag, the Life hub tile, the Goals screen header, the entry chip. | **Identical Lucide icon** (target) in every location. Repeat spot-check for health (heart-pulse), finance (trending-up), career (briefcase), social (users), polymath/explore (sparkles). |
| E-2 | Today → HexRadar domain dots. | Each domain shows its Lucide icon; tap a dot still works (domain press). Career icon uses the light/contrast colour. |
| E-3 | Open the **Life** tab → hub sheet. | Each module tile shows the canonical Lucide domain icon in its colour bubble; tapping routes to that module. |
| E-4 | Each module screen header (Goals/Health/Finance/Career/Social/Explore). | Header circle shows the canonical Lucide domain icon (not the old Ionicons flag/heart/wallet…). |
| E-5 | A routine block on Today and on the day-1 blueprint. | The module tag shows `icon + LABEL` in a row (icon left of the text), correctly aligned. |
| E-6 | (Known/expected) generic icons — chevrons, +, close, sync, mail. | Still Ionicons. This is **intentional** (affordance icons not migrated). Not a bug. |

---

## F. Life tab clarity (item G)
File: `_layout.tsx`.

| TC | Steps | Expected |
|---|---|---|
| F-1 | Look at the bottom tab bar. | The **Life** tab icon is now a **grid** glyph (not the old app-launcher `apps` icon). Label still "Life". |
| F-2 | Tap **Life**. | Opens "Your life modules" sheet; dismissing it bounces back to Today (unchanged behaviour). |

---

## G. Theme-rule fixes (item H)
Files: `colors.ts` (`inkOnColor`), `social.tsx`, `welcome-intent.tsx`.

| TC | Steps | Expected |
|---|---|---|
| G-1 | Social tab → the **+ FAB** (bottom-right, pink). | The "+" is dark ink, clearly legible on the bright pink. (No regression from the token change.) |
| G-2 | Light vs dark mode on the Social FAB. | Ink stays the same dark tone and remains legible on the accent in both modes. |

---

## H. Empty states (item K, part 1)
File: `EmptyState.tsx` + Today/Goals/Finance/Social/Explore.

| TC | Steps | Expected |
|---|---|---|
| H-1 | **Social** with no contacts. | Centered accent **icon bubble + "Build your inner orbit" + caption** (two lines). Consistent look. |
| H-2 | **Goals** with no goals. | "No goals yet" + "Tap + to add your first goal", same EmptyState styling, goal-orange accent. |
| H-3 | **Explore** with no interests. | "Nothing to explore yet" + caption, polymath accent. |
| H-4 | **Finance → Goals tab** with no financial goal. | EmptyState with finance accent + a working **"Set up my financial goal"** CTA button (starts setup). |
| H-5 | **Today** with no routine (fresh profile, before onboarding completes). | Calendar icon + "No routine yet" + "Complete onboarding to get started". |
| H-6 | Compare H-1…H-5 side by side. | All five share the **same layout/spacing** (icon bubble size, title, caption). No leftover bespoke variants. |

---

## I. In-button loading copy (item K, part 2)
Covered functionally in B-2…B-5. Extra check:

| TC | Steps | Expected |
|---|---|---|
| I-1 | Trigger each converted loader (welcome-intent, career strategy, finance insight, discovery-confirm). | Spinner appears **and** the progress copy is preserved (e.g. "Designing strategy…"). No button that only swaps text without a spinner. |

---

## J. Staged routine reveal (item L) **[native]**
File: `day1-routine.tsx`.

| TC | Steps | Expected |
|---|---|---|
| J-1 | Onboarding day-1 routine → set times → **Generate my routine**. | Blocks **stagger in one-by-one** (cascade), not all at once in a single fade. |
| J-2 | On generation success. | A **success haptic** fires as the blueprint appears **[native]**. (A second success haptic fires later on Save — that's expected, separate beat.) |
| J-3 | Generate a routine with many blocks (busy schedule). | Cascade stays snappy (last block isn't absurdly delayed); no layout jump. |

---

## K. Onboarding finance currency (item I)
File: `day7-finance.tsx` (default currency = INR via `getCurrency()`).

| TC | Steps | Expected |
|---|---|---|
| K-1 | Onboarding day-7 finance screen. | **No free-text "Currency" field** anymore. The amount field is labelled **"Target amount (₹)"** with the active symbol. |
| K-2 | Target-amount placeholder. | Shows a localised preset number (from the active currency), not the old "50000"/"USD". |
| K-3 | Generate the plan. | Plan headline reads e.g. **"₹12,500 / month"** (formatted with grouping + symbol), not "USD 12500". |
| K-4 | Continue → check the created goal (Finance tab → goal). | Goal currency matches the app-wide currency (consistent with the Finance tab; no USD/INR mismatch). |

---

## Cross-cutting regression sweep
| TC | Steps | Expected |
|---|---|---|
| X-1 | Full onboarding via the **chip path** end-to-end. | Reaches Today with a seeded routine; no crashes. |
| X-2 | Full onboarding via the **Discovery chat path**. | Chat → confirm → Today; no crashes. |
| X-3 | Visit every tab (Today, Life, Explore, Rewards, Profile + each module). | No red-screen errors; icons render; cards/blur OK. |
| X-4 | Light/dark mode toggle across tabs. | No unreadable text, no missing icons. |
| X-5 | Web build (`expo start --web`). | Loads; Lucide icons render; CSS blur intact; no console errors from the icon swap. |

---

## Notes / known scope
- **Not in this branch:** item **F** (Today screen section reduction) and item **J** (shared day-screen scaffold) were deliberately deferred for a verified session. Today still has its full section set.
- Generic affordance icons remain **Ionicons** by design (E2 scoped to domain icons only).
- `onboarding_v2` flag was already default-on; not changed.
- Everything here was **typecheck-clean** but **not yet visually verified** — this plan is the verification.
