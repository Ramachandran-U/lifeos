# LifeOS — Gamified-Learning & UI/UX Upgrade Playbook

> **Status:** Research synthesis (2 passes) · **Date:** 2026-06-09 · **Branch:** `feat/design-enhancements`
> **Outcome (2026-06-14):** this research produced the Aurora Alive program (retention mechanics + motion, shipped and default-on) and seeded the Ink + Signal design recommit — see `docs/DESIGN_MANIFESTO.md` and `docs/design-deep-dive/`.
> **Method:** Deep-research harness, adversarial 3-vote verification (kill on 2/3 refute).
> - **Pass 1** (UI/UX, 3D, motion, gamification mechanics): 25 sources → 116 claims → 25 verified → **23 confirmed, 2 killed, 13 findings**.
> - **Pass 2** (Voice UX + dark patterns — §10–§11): 23 sources → 103 claims → 25 verified → **23 confirmed, 2 killed, 14 findings**.
> **Confidence legend:** 🟢 high (primary vendor/peer-reviewed) · 🟡 medium (secondary or statistically fragile) · 🔴 refuted (do not rely on).
>
> **Both original gaps are now closed:** Voice/Gemini-Live UX → **§10**; gamification dark patterns → **§11**. Remaining open items (web parity, latency, an audit of existing streak copy) are in [§9](#9-open-questions--gaps-to-close).

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

**Pass-2 additions (full detail in §10–§11):**

| # | Change | Effort | Confidence | New dep? |
|---|--------|--------|-----------|----------|
| 11 | **Deploy voice as a voice-*augmented* layer** (one input among many), never voice-only; rank rollout: hands-free logging → evening reflection → coaching. **Never** for data-dense review | S–M | 🟢 | capture/UI libs |
| 12 | **Always pair voice with a non-voice path + live captions** (ASR degrades in noise/across accents; accessibility hard requirement) | S–M | 🟢 | None |
| 13 | **Make every voice surface interruptible (barge-in) with a tap-to-talk toggle** — unbounded barge-in backfired for Duolingo | M | 🟢 | None |
| 14 | **Eliminate the 4 gamification red lines** — streak-guilt/loss-aversion, pay-to-restore, social-pyramid pressure, grinding (§11) | M | 🟢 | None |
| 15 | **Reframe XP/badges as *informational*, not controlling** (overjustification effect) — protect the intrinsically-driven Explore/Polymath engine especially | M | 🟢 | None |

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

**D. Text input → voice-input affordance** *(now backed by §10)*
- A mic affordance that visualizes assistant state (idle → listening → thinking → speaking) via an animated waveform driven by `expo-audio` metering (web needs a non-metering pulse fallback). **Always** paired with the typed path and live captions; interruptible with a tap-to-talk toggle. See **§10** for the full interaction spec and feasibility.

---

## 8. What NOT to copy / do

- 🔴 **Don't cite a "Brilliant tangram-style branded loader"** — that specific claim was **REFUTED (0-3)**. The *principle* (delightful branded loading) is sound; justify it via skeletons + Reanimated transitions, not an unverified Brilliant behavior.
- 🔴 **Don't assume Reanimated layout transitions "just work" on web** — the "fully supported on Web" claim was **REFUTED (1-2)**. Test on the Cloudflare Pages build.
- **Don't adopt Skia/Rive app-wide** — bundle + per-platform-parity cost. Scope to one flagship visual each.
- **Don't lean on badge inflation** as the motivational engine — competence effect is marginal; relatedness/autonomy carry the weight.
- **Don't ship Carbon durations verbatim** — they're a conservative *starting scale*; brand-tune for "bold & expressive."
- **Don't over-promise behavior change** from streaks/XP — the behavioral effect size is the weakest and least stable.
- 🔴 **Don't claim "voice only works for simple single-answer queries"** — **REFUTED (0-3)**. The real constraint is data *density*, not task complexity; voice handles complex conversation fine, just not dense comparison/review.
- 🔴 **Don't cite a flat ASR-accuracy figure for impaired users** (e.g. "58.5%") — **REFUTED (1-2)**. Success is gated by the user's *combined* speech + cognitive ability (with compensation between them), not a single number.
- **Don't use voice as the sole input for any consequential action** — confirm consequential actions, and always offer a typed/tap equivalent.
- **Don't ship the 4 gamification red lines** (§11): streak-guilt/loss-aversion, pay-to-restore, social-pyramid pressure, grinding.
- **Don't frame XP/badges/streaks as something the user will "lose"** — sunk-cost framing is a psychological dark pattern; treat accumulated progress as permanently banked.

---

## 9. Open questions / gaps to close

The two original gaps (voice, dark patterns) are **now closed** in §10–§11. These remain open and need follow-up — several are **LifeOS-internal audits** the research can't answer:

1. **Web parity (biggest technical risk).** Do Reanimated 4.x layout transitions + `boxShadow` (inset/spreadDistance) render correctly at 60fps on react-native-web / Cloudflare Pages, or need fallbacks? → *Empirical test required.* (Button3D's rim technique is already web-verified.)
2. **Gemini Live barge-in + tap-to-talk on web.** Does the existing voice path support interruptibility AND a tap-to-talk toggle on react-native-web, or will web need a degraded turn-taking mode (Web SpeechRecognition browser gaps + absent web metering)? → *Empirical test.*
3. **Gemini Live production latency.** Does the current round-trip sit within the ~sub-second human-conversation threshold for natural turn-taking on mobile data? No LifeOS-specific measurement exists. → *Measure.*
4. **Audit existing streak/XP copy against the red lines (§11).** Which of the 5 streaks (workout/learning/foodTracking/journaling/social) use loss-aversion "don't break the chain" framing? Do any unlocks/XP gates constitute grinding or sunk-cost framing? → *Internal copy/UX audit.*
5. **Is any streak-restore/badge/XP mechanic monetized (pay-to-restore)?** Highest-severity red line; needs an explicit product-side yes/no.
6. **Reference-app actual motion values.** No measured durations/easings/spring configs from Duolingo / Headspace / Brilliant — current guidance is principles + Carbon-derived scale only.
7. **Is Skia/Rive actually justified for LifeOS's celebration visuals?** Does the node count for constellation/particle/mascot moments exceed the ~100 Android / ~500 iOS Reanimated budget? → *Prototype on transform/opacity first.*

---

## 10. Voice / conversational UX (Pass 2, Part A)

> Framing: LifeOS already owns the realtime transport (Gemini Live `voiceClient.ts` — the one sanctioned voice path per CLAUDE.md). These are **UX, placement, and feasibility** findings for the layer *above* it. The supplementary capture/UI libraries below must not bypass `voiceClient.ts`.

### 🟢 Voice value map — deploy by task type, not everywhere
Spoken output is **linear, transient, and overloads working memory** — a stable cognitive constraint that persists even with 2025 LLM voice. So voice wins for hands-free/linear/conversational tasks and **loses for data-dense review/comparison/precise editing** (each item must be held in working memory to compare; no random-access re-read).

| Task | Voice fit | Why |
|------|-----------|-----|
| Hands-free logging (health/food/finance) | ✅ Strong | Linear capture, hands/eyes busy |
| Evening reflection / journaling | ✅ Strong | Conversational, open-ended |
| Daily briefing (TTS summary) | ✅ Good | Short, linear, glanceable-as-audio |
| "What should I do next?" coaching | ✅ Good | Dialogue, single next action |
| Explore/Polymath learning practice | ✅ Good (see RCT) | Conversational reps |
| Finance analytics / multi-goal compare / routine diff-preview / precise edits | ❌ Render **visually** | Data-dense; voice only as a nav adjunct |

- Source: [NN/g — Intelligent assistant usability](https://www.nngroup.com/articles/intelligent-assistant-usability/) (n=17), [MDPI 2024 VUI review](https://www.mdpi.com/2078-2489/15/9/579). **Effort: S** (a placement rule, not a build).
- 🔴 The sibling claim "voice only works for simple single-answer queries" was **REFUTED (0-3)** — the constraint is data *density*, not complexity.

### 🟢 Real-time conversational voice produces *measurable* learning gains
The strongest single piece of evidence for the **Explore/Polymath** surface: an RCT (n=567, 30 days, Duolingo Video Call / GPT-4o) found ≥2 daily voice conversations beat a lessons control on speaking proficiency — **+43.7% greater pre→post improvement** (Estimate 2.00, 95% CI 0.65–3.35, **p=.004**, Versant). Gains occurred **even with no real-time corrective feedback** — feedback was deferred to an end-of-call transcript.
- **Maps to LifeOS:** build voice roleplay/practice as conversational reps + a **post-session transcript with tips**; don't block on live in-conversation correction.
- **Caveats:** first-party vendor whitepaper (not peer-reviewed); 13.7% attrition (skewed to voice arm); both groups stayed at A1 CEFR (small absolute gain); ≥2-calls/day self-selects motivated users; doesn't isolate full-duplex as *the* causal mechanism.
- Source: [Duolingo DRR-25-06](https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_video_call_improves_speaking_2025.pdf)

### 🟢 Pattern decision guide — voice-augmented, interruptible, confirm-consequential
- **Voice-augmented, not voice-first** — voice is one input among many; never the sole path.
- **Turn-taking is the #1 frustration.** Assistants that respond during natural pauses or fail to yield when the user speaks feel "rude." **Barge-in/interruptibility + accurate endpointing are mandatory** for the full-duplex path. Tune carefully: too-early interrupts, too-late feels sluggish.
- **Offer a per-surface toggle: full-duplex barge-in ↔ tap-to-talk.** Real-product evidence: Duolingo moved Video Call *toward* tap-to-speak after users complained the AI interrupted constantly. **Effort: M.**
- **Confirm consequential actions** (vs. just-do-it), and always offer a typed/tap equivalent.
- Sources: [NN/g](https://www.nngroup.com/articles/intelligent-assistant-usability/), [LiveKit — turn detection](https://docs.livekit.io/agents/build/turns/)

### 🟢 Accessibility — pair voice with a non-voice path (hard requirement)
Voice is an accessibility **win** for some (motor/vision) and a **barrier** for others (dysarthria, certain accents, deaf/HoH, noisy/public contexts). ASR degrades materially in noise and across accents/dialects (JAMIA Open 2024: median WER **33% White vs 50% Black** patients, p=0.016; **86%** for utterances <5 words). Success for impaired users is gated by **combined** residual speech + cognitive ability (with compensation between them).
- **Requirements:** every voice surface offers an equivalent typed/tap path; render **live captions/transcripts** for all spoken output (accessibility *and* trust); never voice-only for a consequential action. Precedent: Apple "Type to Siri."
- 🔴 Do **not** cite a flat impaired-user accuracy figure ("58.5%") — **REFUTED (1-2)**.
- Sources: [JAMIA Open / PMC11631515](https://pmc.ncbi.nlm.nih.gov/articles/PMC11631515/), [Masina et al. JMIR 2020 / PMC7547392](https://pmc.ncbi.nlm.nih.gov/articles/PMC7547392/). **Effort: S–M.**

### 🟢 Assistant-state visualizer — feasible from Expo primitives
The idle → listening → thinking → speaking visualizer (waveform/orb/pulse) that builds trust can be driven on **iOS/Android** from `expo-audio`'s real-time `metering` (enable `isMeteringEnabled`); map dB→amplitude (`amplitude = 10^(dB/20)`) to animate a 60fps waveform via `react-native-reanimated`.
- **Web caveat:** metering is frequently `undefined` on react-native-web (MediaRecorder lacks per-frame levels) → ship a **non-metering fallback** (generic pulse / typing indicator). **Effort: M.**
- Source: [Expo Audio docs](https://docs.expo.dev/versions/latest/sdk/audio/)

### 🟢 RN/Expo UI-layer feasibility — confirmed for one codebase
- `expo-audio`: explicit mic-permission APIs (`requestRecordingPermissionsAsync` / `getRecordingPermissionsAsync`); supported Android/iOS/tvOS/Web.
- `expo-speech-recognition` (jamsch): wraps iOS `SFSpeechRecognizer`, Android `SpeechRecognizer`, Web `SpeechRecognition` from one codebase; `interimResults` + `continuous` enable **live-caption** rendering.
- **Caveats:** web mic needs HTTPS (✓ Cloudflare Pages); needs a custom dev build (not Expo Go); min iOS 16.4; no continuous mode on Android ≤12; Web SpeechRecognition has browser gaps (Chrome-on-iOS, Firefox/Brave desktop).
- Sources: [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/), [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition)

### Ranked LifeOS surface rollout
1. **Hands-free logging** (health/food/finance) — strongest fit, linear capture.
2. **Evening reflection / journaling** — conversational, already a screen (`evening-reflect`).
3. **"What should I do next?" coaching** — dialogue → single next action.
4. **Daily briefing** — TTS summary, keep it short.
5. **Explore/Polymath practice** — roleplay reps + post-session transcript (the RCT-backed one).

> **Do NOT** voice-enable data-dense review (finance analytics, multi-goal compare, routine diff-preview, precise edits) — render those visually.

---

## 11. Ethical gamification & dark patterns (Pass 2, Part B)

### 🟢 The line is *intentionality*
A **dark game design pattern** is one used *intentionally* to cause experiences against the user's best interest, likely without consent — intentionality separates a dark pattern from mere bad design. **LifeOS principle: for every gamification mechanic, be able to state whose interest it serves.** (Deterding 2020 critiques the intent criterion as hard to operationalize — note, but the framing still guides design.)
- Sources: [Zagal, Björk & Lewis, FDG 2013](http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf), [Nyström 2021](https://www.diva-portal.org/smash/get/diva2:1518853/FULLTEXT01.pdf)

### 🟢 LifeOS's existing mechanics sit inside the danger zones
Taxonomy: **time / money / social-capital** (Zagal 2013) + a 4th **psychological** category (Niknejad et al. 2024). LifeOS's current gamification maps directly onto dark-pattern families — audit each against this map:

| LifeOS mechanic | Dark-pattern family it can become |
|-----------------|-----------------------------------|
| Streaks (workout/learning/foodTracking/journaling/social), daily login | **Temporal** — "Playing by Appointment", "Daily Rewards", "Grinding" |
| XP (total + weekly), badges | **Psychological** — "Variable Rewards", "Badges/Endowed Progress" |
| Long streaks / badge collections / XP totals | **Psychological** — "Invested/Endowed Value", "Complete the Collection" (= sunk-cost) |

- Sources: [Zagal 2013](http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf), [Niknejad et al. 2024 (arXiv)](https://arxiv.org/html/2412.05039v1)

### 🔴 Red-lines checklist — never ship these; ship the substitute
| # | Red line (NEVER) | Why harmful | Humane substitute for LifeOS |
|---|------------------|-------------|------------------------------|
| 1 | **Streak coercion / loss-aversion guilt** ("you broke your streak", daily-login penalty) | "Playing by Appointment" coerces daily return by penalizing absence | Auto, non-monetized **freeze/grace days**; **"comeback"** framing; forgiveness on missed days; celebrate **cumulative effort**, not an unbroken chain |
| 2 | **Pay-to-restore** (monetized streak rescue) | Monetizes manufactured loss-aversion — highest-severity | Restoration is free/automatic, or simply not needed (progress is banked) |
| 3 | **Social-pyramid / coercive social pressure** (progress depends on recruiting/pressuring contacts; shame/comparison) | Entraps recruited users via out-of-game obligation, not intrinsic interest | Social features **opt-in**, serving **relatedness** (shared encouragement, optional accountability) without obligation/guilt |
| 4 | **Grinding** (gate value behind repetitive busywork; padding to inflate completion) | Coerces time-spend for its own sake; worst for new users who can't judge the cost | Surface the genuinely-highest-value next action; reach outcomes in the fewest meaningful steps; transparent time cost |

- Sources: [Zagal 2013](http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf), [Niknejad 2024](https://arxiv.org/html/2412.05039v1)

### 🟢 The load-bearing "why": the overjustification effect
Controlling extrinsic rewards (the family that **includes points and badges**) are perceived as controlling and **decrease intrinsic motivation for already-interesting tasks**; once rewards stop, users tend to reduce/stop the activity. **Competence-based rewards raise intrinsic motivation only when paired with autonomy.**
- **Maps to LifeOS:** wire gamification to **autonomy + relatedness**, not competence/points in isolation; reward **effort/mastery** and self-chosen goals; make XP/badges **informational** ("you practiced 5 days"), not coercive; use unexpected/informational rewards + verbal affirmation over expected controlling ones; **protect the Explore/Polymath engine** (intrinsically curiosity-driven) from controlling reward overlays especially. **Effort: M** (reframe existing XP/badge copy + reward schedule).
- **Contested:** the effect's *magnitude* is debated (Cameron & Pierce 1994 vs. Deci/Koestner/Ryan 1999); its *existence* for already-interesting tasks with controlling rewards is consensus — recommendations rest only on the consensus-scoped version.
- Sources: [Springer 2024 (SDT)](https://link.springer.com/article/10.1007/s11528-024-00968-9), [Ryan & Deci 2000 — SDT](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf), [Nyström 2021](https://www.diva-portal.org/smash/get/diva2:1518853/FULLTEXT01.pdf)

### 🟢 Audit against all 7 darkness domains, not just "is it addictive"
A systematic review (Nyström 2021, n=28) maps gamification darkness into 7 domains — **Motivation, Addiction, Competition/collaboration, Manipulation, Data integrity, Surveillance/privacy, Ethics/exploitation** — with **Ethics & exploitation the largest** (13/28). As a "Digital Life Architect" asking users for continual self-work, LifeOS must guard against turning life-improvement into **self-surveillance and unpaid productivity-grind**.
- Source: [Nyström 2021](https://www.diva-portal.org/smash/get/diva2:1518853/FULLTEXT01.pdf) (2021 — foundational structural taxonomy, slightly predates the 2023–2026 window)

---

## 12. Sources

**Primary (vendor / peer-reviewed — high confidence):**
- [React Native — shadow props](https://reactnative.dev/docs/shadow-props) · [BoxShadowValue](https://reactnative.dev/docs/boxshadowvalue)
- [Reanimated — performance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) · [layout transitions](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-transitions/)
- [React Native Skia — bundle size](https://shopify.github.io/react-native-skia/docs/getting-started/bundle-size/)
- [Rive — choose a renderer](https://rive.app/docs/runtimes/choose-a-renderer)
- [IBM Carbon — Motion](https://carbondesignsystem.com/elements/motion/overview/)
- [Sailer & Homner 2020 — gamification meta-analysis](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- [Li, Hew & Du 2024 — gamification & intrinsic motivation meta-analysis](https://link.springer.com/article/10.1007/s11423-023-10337-7)

*Pass 2 (voice + dark patterns):*
- [NN/g — Intelligent assistant usability](https://www.nngroup.com/articles/intelligent-assistant-usability/) (n=17) · [MDPI 2024 — VUI systematic review](https://www.mdpi.com/2078-2489/15/9/579)
- [Duolingo DRR-25-06 — Video Call speaking-gains RCT](https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_video_call_improves_speaking_2025.pdf) *(first-party whitepaper)*
- [JAMIA Open 2024 — ASR accuracy disparity / PMC11631515](https://pmc.ncbi.nlm.nih.gov/articles/PMC11631515/) · [Masina et al. JMIR 2020 / PMC7547392](https://pmc.ncbi.nlm.nih.gov/articles/PMC7547392/)
- [Expo Audio docs](https://docs.expo.dev/versions/latest/sdk/audio/) · [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition)
- [Zagal, Björk & Lewis — Dark Patterns, FDG 2013](http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf) · [Niknejad et al. 2024 — "Level Up or Game Over" (arXiv)](https://arxiv.org/html/2412.05039v1)
- [Nyström 2021 — "Exploring the Darkness of Gamification"](https://www.diva-portal.org/smash/get/diva2:1518853/FULLTEXT01.pdf) · [Springer 2024 — SDT / overjustification](https://link.springer.com/article/10.1007/s11528-024-00968-9) · [Ryan & Deci 2000 — SDT](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)

**Secondary / blog (directionally sound — weaker):**
- [NN/g — Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)
- [screensdesign — Brilliant teardown](https://screensdesign.com/showcase/brilliant-learn-by-doing) · [Brilliant — Why Brilliant](https://brilliant.org/help/why-brilliant) · [60fps.design — Brilliant](https://60fps.design/apps/brilliant)
- [Rive — how Brilliant motivates learners](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)
- [Duolingo micro-interactions](https://medium.com/@Bundu/little-touches-big-impact-the-micro-interactions-on-duolingo-d8377876f682)
- [Lottie vs Rive](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation) · [RN animation stress-testing 2023→2025](https://medium.com/@islamrustamov/how-react-native-improved-from-2023-to-2025-animation-stress-testing-and-a-little-bit-of-flutter-edd44297b815)
- [Motion design tokens](https://medium.com/@ogonzal87/animation-motion-design-tokens-8cf67ffa36e9) · [Skeleton loading @60fps in Reanimated](https://medium.com/@varunkukade999/skeleton-loading-from-scratch-powering-reanimated-v3-60-fps-43e4c518f87d)
- *Pass 2:* [LiveKit — turn detection for voice agents](https://docs.livekit.io/agents/build/turns/) · [AssemblyAI — low-latency voice AI](https://www.assemblyai.com/blog/low-latency-voice-ai) · [Sayna — handling barge-in](https://sayna.ai/blog/handling-barge-in-what-happens-when-users-interrupt-your-ai-mid-sentence) · [NN/g — visibility of system status](https://www.nngroup.com/articles/visibility-system-status/) · [Finch app review](https://calmevo.com/finch-app-review/) · [Duolingo streaks & anxiety in kids](https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids)
