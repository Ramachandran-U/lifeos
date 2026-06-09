# LifeOS — Gamified-Learning & UI/UX Upgrade Playbook

> **Status:** Research synthesis · **Date:** 2026-06-09 · **Branch:** `feat/design-enhancements`
> **Method:** Deep-research harness — 5 search angles → 25 sources fetched → 116 claims extracted → 25 adversarially verified (3-vote, kill on 2/3 refute). **23 confirmed, 2 killed, 13 findings after synthesis.**
> **Confidence legend:** 🟢 high (primary vendor/peer-reviewed) · 🟡 medium (secondary or statistically fragile) · 🔴 refuted (do not rely on).
>
> **Two known gaps** (research engine ran out of budget before covering them — see [§8 Open Questions](#8-open-questions--gaps-to-close)): **(1) Voice/Gemini-Live UX** has zero verified findings; **(2) gamification dark-patterns** has evidence on what *works* but not a sourced catalogue of what to *avoid*. Treat the streak/loss-aversion design as unresearched.

---

## 1. Executive summary — highest-leverage changes (ranked)

The headline: **a best-in-class upgrade is mostly achievable on the stack you already have.** RN 0.81.5 (New Architecture on by default) + Reanimated 4.1.1 already cover 3D depth, branded transitions, and 60fps celebration motion. Heavy renderers (Skia/Rive) should be reserved for one or two flagship moments, not adopted wholesale.

| # | Change | Effort | Confidence | New dep? |
|---|--------|--------|-----------|----------|
| 1 | **Build 3D/tactile buttons with the modern `boxShadow` prop + Reanimated press-spring** (inset + spreadDistance, animate transform/opacity only) | S | 🟢 | None |
| 2 | **Adopt a tokenized two-tier motion language** (productive vs. expressive) in `theme/motion.ts` — gate celebration behind earned events | M | 🟢 | None |
| 3 | **Replace blank spinners with skeletons + Reanimated layout/entering transitions** via a duration-based decision guide | M | 🟢 (🟡 web) | None |
| 4 | **Wrap Explore/Polymath in narrative + cooperative-competitive framing** (expeditions/constellations already fit) — the single best-evidenced gamification lever | M | 🟢 | None |
| 5 | **Re-weight gamification toward relatedness (social) + autonomy (choice)**, away from badge-as-competence inflation | M | 🟡 | None |
| 6 | **Copy Brilliant's interactive wrong-answer feedback** — manipulable elements that explain *why*, not text | L | 🟡 | None |
| 7 | **Set & enforce a 60fps performance budget** (transform/opacity only; cap ~100 animated nodes on low-end Android, ~500 iOS) | S | 🟢 | None |
| 8 | **Reserve Skia for one bespoke canvas visual** (e.g. mastery constellation / particle celebration), lazy-loaded on web | M | 🟢 | Skia (scoped) |
| 9 | **Evaluate Rive for a single flagship mascot/celebration** only — not general motion | M | 🟢 | Rive (scoped) |
| 10 | **Validate every motion/shadow recommendation on the react-native-web build** before shipping (biggest open risk) | S | 🟢 | None |

---

## 2. 3D / tactile controls (Research Q1)

### 🟢 You can build extruded/pressed button depth cross-platform with **no new dependency**
- RN's **legacy** iOS-style shadow props (`shadowOffset/Opacity/Radius`) are **iOS-only**; only `shadowColor` works on both platforms (Android API 28+). The legacy set alone **cannot** give uniform layered/inset depth.
- RN now ships a **spec-compliant `boxShadow` View style prop** (modeled on CSS `box-shadow`), working on **iOS + Android**, supporting **inset shadows and `spreadDistance`** (`BoxShadowValue`: offsetX, offsetY, blurRadius, spreadDistance, color, inset). It is **New-Architecture-only** (default since RN 0.76; inset needs Android 10+) — **LifeOS is on RN 0.81.5 with New Arch on, so it's available now.**
- Combine `boxShadow` layering/inset with **Reanimated press scale/translate + spring physics**, animating **only `transform`/`opacity`** (non-layout, hardware-accelerated) for 60fps depression effects.
- **Web caveat:** validate `boxShadow` + `inset` parity on react-native-web before shipping.
- Sources: [RN shadow-props](https://reactnative.dev/docs/shadow-props), [RN BoxShadowValue](https://reactnative.dev/docs/boxshadowvalue), [Reanimated performance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)

> **Verdict:** Skia/Rive are **not required** for tactile/3D buttons. This is the cheapest high-impact win.

---

## 3. Transitions & loading (Research Q2)

### 🟢 Replace blank spinners with Reanimated's built-in transitions + skeletons — no Lottie/Rive/Skia for the common cases
- Reanimated exposes a **`layout` prop** that replaces abrupt layout changes (size **and** position) with smooth animated transitions, and **4.x ships six preset layout transitions**: `LinearTransition`, `SequencedTransition`, `FadingTransition`, `JumpingTransition`, `CurvedTransition`, `EntryExitTransition`.
- **Caveats:** (a) layout transitions animate **already-mounted** components — they are **not** a drop-in for async-fetch placeholder states, where **skeletons / entering animations** are the right tool; (b) requires New Architecture (✓ LifeOS); (c) 🔴 a sibling claim that layout transitions are *"fully supported on Web"* was **REFUTED (1-2)** — **test web before relying on it.**
- Source: [Reanimated layout transitions](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-transitions/)

### 🟡 Duration-based loading decision guide (NN/g)
| Wait | Use |
|------|-----|
| **< 1s** | Nothing — no loader |
| **2–10s** | **Skeleton screen** (mimics final wireframe, builds mental model) |
| **> 10s** | **Progress bar with an explicit duration estimate** |

- Skeleton rationale: *"creates the illusion that the page is gradually transitioning into its final format"* and helps users build mental models before the content lands.
- **Important caveat:** the *"feels faster"* effect of skeletons is **contested** (Viget 2017 found skeletons worst on perceived duration in one condition; Mejtoft et al. 2018 found no significant speed difference, spinner users finished faster). **Present skeletons as a mental-model aid, not a proven speed gain.** The **duration thresholds** rest on Nielsen's stable 0.1/1/10s limits and *are* reliable.
- Source: [NN/g — Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)

### 🟢 60fps performance budget
- Animate **non-layout properties** (`transform`, `opacity`, `backgroundColor`) — layout styles force per-frame recalculation.
- Rule of thumb: **≤100 animated components on low-end Android, ≤500 on iOS** (soft thresholds). Past that on mid-tier Android is where Skia becomes justified despite bundle cost.
- Source: [Reanimated performance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)

---

## 4. Motion system & "clean + gamified" balance (Research Q3, Q6)

### 🟢 Adopt a documented **two-tier motion language** (the key to staying clean, not confetti-spammy)
IBM Carbon defines two motion styles:
- **Productive** — *"efficiency and responsiveness, while remaining subtle and out of the way"* → button states, dropdowns, tables, routine UI.
- **Expressive** — *"enthusiastic, vibrant, and highly visible movement"* → **reserved for occasional, important moments** (badge unlock, streak milestone, mastery).

> The discipline: **gate expressive/celebration motion behind genuinely earned events; keep everything else productive.** This is the sourced answer to "how do you keep a heavily gamified UI minimal."

- Source: [IBM Carbon — Motion](https://carbondesignsystem.com/elements/motion/overview/)

### 🟢 Concrete motion tokens (Carbon v11 — a *starting scale* to brand-tune)
Ship these in `src/theme/motion.ts` alongside color/spacing tokens. **Carbon's productive bias is more conservative than "Duolingo meets Headspace"** — tune up the energy for expressive moments.

**Easing (productive / expressive):**
| Token | Productive | Expressive |
|-------|-----------|-----------|
| Standard | `cubic-bezier(0.2, 0, 0.38, 0.9)` | `cubic-bezier(0.4, 0.14, 0.3, 1)` |
| Entrance | `cubic-bezier(0, 0, 0.38, 0.9)` | `cubic-bezier(0, 0, 0.3, 1)` |
| Exit | `cubic-bezier(0.2, 0, 1, 0.9)` | `cubic-bezier(0.4, 0.14, 1, 1)` |

**Duration tokens (scaled by motion size/distance):**
| Token | ms | Use |
|-------|----|----|
| `fast-01` | 70 | button / toggle |
| `fast-02` | 110 | fade |
| `moderate-01` | 150 | small expansion |
| `moderate-02` | 240 | toast / expansion |
| `slow-01` | 400 | large expansion / important notifications |
| `slow-02` | 700 | background dimming |

These translate cleanly to `Easing.bezier(...)` + `withTiming(duration)`.
- Source: [IBM Carbon — Motion](https://carbondesignsystem.com/elements/motion/overview/)

---

## 5. Gamified-learning mechanics (Research Q4)

### 🟢 Gamification helps **learning** more than it changes **behavior**
Sailer & Homner (2020) meta-analysis (Educational Psychology Review):
- **Cognitive** learning outcomes: **g ≈ 0.49** (CI [0.30, 0.69], k=19) — largest & most stable.
- **Motivational**: g ≈ 0.36 (k=16).
- **Behavioral**: g ≈ 0.25 (k=9) — smallest, weakest, least stable.

> **Implication:** Streaks/XP are well-evidenced for helping users **learn** (Explore/Polymath). **Do not over-promise** that they alone will rewire durable habits across all six engines.
- Source: [Sailer & Homner 2020](https://link.springer.com/article/10.1007/s10648-019-09498-w)

### 🟢 The two highest-yield design choices: **competition + collaboration**, and **narrative/game fiction**
- Sailer & Homner: *"Inclusion of game fiction and combining competition with collaboration were particularly effective… for fostering behavioral learning outcomes."*
- **Maps to LifeOS:** prefer **cooperative-competitive** framings (team expeditions, shared goals, leaderboards-with-allies) over zero-sum leaderboards; wrap Explore/Polymath in light **quest/narrative** framing — *"expeditions"* and *"constellations"* already fit.
- **Caveat:** behavioral evidence base is small (k=9) and the motivational extension is tentative — strong moderator, not a guarantee.

### 🟡 Motivation comes from **relatedness + autonomy**, not from competence-signaling
Li, Hew & Du (2024) meta-analysis (35 interventions, ~2,500 participants):
- **Relatedness**: g = 1.776 — but **k=4, very wide CI** → thinly-powered, not a robust point value.
- **Autonomy**: g = 0.638 (moderate-to-large).
- **Competence**: g = 0.277 (**marginal**, p=.049, lower CI ≈ 0).
- Overall intrinsic motivation: g = 0.257 (small but significant).

> **Design implication:** Invest in **relatedness** (social engine, shared/cooperative play) and **autonomy** (let users choose domains, goals, pacing — fits the *"what should I do next?"* agency). **Avoid leaning on badge inflation as a competence signal.**
- Source: [Li, Hew & Du 2024](https://link.springer.com/article/10.1007/s11423-023-10337-7)

### 🟡 Copy Brilliant's interactive wrong-answer feedback
- On a wrong answer, Brilliant gives **manipulable interactive elements** to explore *why*, rather than text-only explanations: *"turning each mistake into a genuine learning opportunity."*
- **Maps to LifeOS:** build immediate, interactive feedback loops into Explore/Polymath learning content.
- Confidence medium (strongest direct evidence is one UX teardown; corroborated by Brilliant's own help page).
- Sources: [screensdesign teardown](https://screensdesign.com/showcase/brilliant-learn-by-doing), [Brilliant — Why Brilliant](https://brilliant.org/help/why-brilliant)

---

## 6. Library decision matrix

| Need | Use | Why / cost |
|------|-----|-----------|
| Tactile/3D buttons, press depth, list/layout transitions, skeletons, most celebrations | **Reanimated 4.1.1 + `boxShadow`** (already in stack) | 🟢 Zero new dependency. Covers the large majority of cases at 60fps. |
| Designer-authored vector **loaders / illustrated moments** | **Lottie** *(evaluate)* | JSON vector, lighter than Skia; good designer handoff; less interactive than Rive. Adds a dependency. |
| **Interactive** state-machine illustrations — a **flagship mascot/celebration** (Duolingo-style character) | **Rive** *(scoped)* | Strong designer workflow + interactivity, BUT renderer is **configured per-platform** (`RiveRenderer.defaultRenderer(iOS, Android)`) — extra setup for a single-codebase product; iOS Simulator/Intel gaps. Use for **one** flagship moment, not general motion. |
| Bespoke **generative/canvas** visual (mastery constellation, hundreds of particles exceeding the Reanimated node budget) | **Skia** *(scoped, lazy-loaded)* | Bundle cost: **~6 MB iOS** (5.8 MB binary + 220 KB JS), **~4 MB Android arm64** download (librnskia.so ~3.8 MB; 41.3 MB full multi-arch APK), **~2.9 MB gzip web** (CanvasKit WASM — lazy-load it). Justified only where transform/opacity Reanimated genuinely can't do the job. |

- Sources: [Skia bundle size](https://shopify.github.io/react-native-skia/docs/getting-started/bundle-size/), [Rive — choose a renderer](https://rive.app/docs/runtimes/choose-a-renderer), [Lottie vs Rive](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)

---

## 7. Before → After component sketches

> *Design synthesis derived from the verified techniques above — not separately sourced. Build on tokens from `src/theme/`.*

**A. Primary button → 3D tactile button**
- *Before:* flat fill, opacity dim on press.
- *After:* `boxShadow` with a solid offset-Y "base" layer (engine color, darker) → reads as extruded. On press: Reanimated `withSpring` translateY +2–3px + scale 0.98, base shadow shrinks (depression), `expo-haptics` impact. Tokens: `fast-01` (70ms) productive easing.

**B. Card loading → branded skeleton transition**
- *Before:* centered spinner on blank card.
- *After:* skeleton matching the card wireframe (2–10s window) with a shimmer on `transform`/`opacity`; on data arrival, `EntryExitTransition` / `FadingTransition` swaps skeleton → content. No spinner under 1s.

**C. Badge unlock → earned expressive moment**
- *Before:* static toast.
- *After:* **expressive**-tier motion (gated, rare): scale-in with `slow-01` (400ms) expressive easing, engine-color particle burst (transform/opacity, <100 nodes on Android), haptic. Everything else in the app stays **productive**.

**D. Text input → voice-input affordance** *(design only — see voice gap below)*
- A mic affordance that visualizes assistant state (idle → listening → thinking → speaking) via an animated waveform/orb. **Interaction pattern unresearched — do not finalize until §8 voice research is done.**

---

## 8. What NOT to copy / do

- 🔴 **Don't cite a "Brilliant tangram-style branded loader"** — that specific claim was **REFUTED (0-3)**. The *principle* (delightful branded loading) is sound; justify it via skeletons + Reanimated transitions, not an unverified Brilliant behavior.
- 🔴 **Don't assume Reanimated layout transitions "just work" on web** — the "fully supported on Web" claim was **REFUTED (1-2)**. Test on the Cloudflare Pages build.
- **Don't adopt Skia/Rive app-wide** — bundle + per-platform-parity cost. Scope to one flagship visual each.
- **Don't lean on badge inflation** as the motivational engine — competence effect is marginal; relatedness/autonomy carry the weight.
- **Don't ship Carbon durations verbatim** — they're a conservative *starting scale*; brand-tune for "bold & expressive."
- **Don't over-promise behavior change** from streaks/XP — the behavioral effect size is the weakest and least stable.

---

## 9. Open questions / gaps to close

These were **not answered** by the research run and need dedicated follow-up before the related design work:

1. **🔴 VOICE (Gemini Live) — entirely unresearched.** No verified claims addressed where voice adds genuine value vs. novelty, conversational-state/barge-in/error-recovery/accessibility patterns, or the highest-value LifeOS surfaces (daily briefing, reflection, coaching, hands-free logging). **Sketch D above is provisional.** → *Run a dedicated voice-UX research pass.*
2. **Gamification dark patterns — not catalogued.** We have evidence on what *works*, not a sourced list of what to *avoid* (manipulative streak guilt, pay-to-restore, addictive loops). **Fill this before designing streak loss-aversion mechanics.**
3. **Web parity (biggest technical risk).** Do Reanimated 4.x layout transitions + `boxShadow` (inset/spreadDistance) render correctly at 60fps on react-native-web / Cloudflare Pages, or need fallbacks? → *Empirical test required.*
4. **Reference-app actual motion values.** No measured durations/easings/spring configs from Duolingo / Headspace / Brilliant — current guidance is principles + Carbon-derived scale only.
5. **Is Skia/Rive actually justified for LifeOS's celebration visuals?** Does the node count for constellation/particle/mascot moments exceed the ~100 Android / ~500 iOS Reanimated budget? → *Prototype on transform/opacity first.*

---

## 10. Sources

**Primary (vendor / peer-reviewed — high confidence):**
- [React Native — shadow props](https://reactnative.dev/docs/shadow-props) · [BoxShadowValue](https://reactnative.dev/docs/boxshadowvalue)
- [Reanimated — performance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) · [layout transitions](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-transitions/)
- [React Native Skia — bundle size](https://shopify.github.io/react-native-skia/docs/getting-started/bundle-size/)
- [Rive — choose a renderer](https://rive.app/docs/runtimes/choose-a-renderer)
- [IBM Carbon — Motion](https://carbondesignsystem.com/elements/motion/overview/)
- [Sailer & Homner 2020 — gamification meta-analysis](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- [Li, Hew & Du 2024 — gamification & intrinsic motivation meta-analysis](https://link.springer.com/article/10.1007/s11423-023-10337-7)

**Secondary / blog (directionally sound — weaker):**
- [NN/g — Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)
- [screensdesign — Brilliant teardown](https://screensdesign.com/showcase/brilliant-learn-by-doing) · [Brilliant — Why Brilliant](https://brilliant.org/help/why-brilliant) · [60fps.design — Brilliant](https://60fps.design/apps/brilliant)
- [Rive — how Brilliant motivates learners](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)
- [Duolingo micro-interactions](https://medium.com/@Bundu/little-touches-big-impact-the-micro-interactions-on-duolingo-d8377876f682)
- [Lottie vs Rive](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation) · [RN animation stress-testing 2023→2025](https://medium.com/@islamrustamov/how-react-native-improved-from-2023-to-2025-animation-stress-testing-and-a-little-bit-of-flutter-edd44297b815)
- [Motion design tokens](https://medium.com/@ogonzal87/animation-motion-design-tokens-8cf67ffa36e9) · [Skeleton loading @60fps in Reanimated](https://medium.com/@varunkukade999/skeleton-loading-from-scratch-powering-reanimated-v3-60-fps-43e4c518f87d)
- Voice (unverified, for the follow-up pass): [Duolingo video call](https://duoplanet.com/duolingo-video-call/) · [Reflection.app](https://www.reflection.app/) · [full-duplex dialogue systems](https://medium.com/@brijeshrn/from-turn-taking-to-synchronous-dialogue-building-and-measuring-true-full-duplex-systems-794a07f3e59f) · [Voice UI design](https://www.eleken.co/blog-posts/voice-ui-design)
