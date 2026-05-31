# Rotating Placeholders — Manual Test Plan

Covers the animated rotating-placeholder feature shipped on `lifeosv1`
(PRs #61, #63, #64, #65). An opt-in placeholder that **cross-fades** through a
list of domain-relevant hints on empty, open-ended inputs, with a **2s** dwell
per phrase. Structured/form fields are intentionally left on static text.

**Target:** the deployed web build at `https://lifeos-6r5-eqa.pages.dev`
(canonical Cloudflare Pages URL). Re-run on mobile web if convenient.

Mark each case **Pass / Fail / N-A**. Capture the observed phrase sequence and
any console errors on failure.

---

## Implementation reference (expected phrases per input)

| # | Input | Where to reach it | Expected rotating phrases (cross-fade, in order, loops) |
|---|---|---|---|
| Chat | "Ask LifeOS" composer | Today → chat entry / `/chat` | "What should I do next?" → "Why did you skip my workout today?" → "How am I tracking on my goals?" → "Plan the rest of my afternoon…" → "What did I learn this week?" |
| Discovery | Onboarding discovery chat answer box | Welcome → "Talk it through first" → `/discovery-chat` | "Type your answer…" → "A sentence or two is plenty…" → "Tell me what's on your mind…" → "No wrong answers here…" |
| Goals | AddGoalSheet "What do you want to achieve?" | Goals tab → **+** (Add goal) | "I want to run a marathon" → "I want to switch into product management" → "I want to save 6 months of runway" → "I want to read 24 books this year" → "I want to get fit and sleep better" |
| Food | AddFoodSheet "Food name" | Health tab → add food → manual entry | "Type to search (dal, biryani, idli…)" → "Search a dish — paneer tikka, oats…" → "Grilled chicken, banana, coffee…" → "What did you eat?" |
| Finance | Transaction search box | Finance tab → Transactions | "Search merchant or category" → "Try \"Swiggy\" or \"groceries\"…" → "Find a transaction…" → "Coffee, rent, Amazon…" |

---

## TC-0 — Preconditions

| Step | Expected |
|---|---|
| Open `https://lifeos-6r5-eqa.pages.dev`. App loads, no red error screen. | Lands on welcome / sign-in. |
| Sign in (or create a throwaway account) and reach the main tabs. Onboarding may need completing once to reach Goals/Health/Finance. | Authenticated; bottom tab bar visible. |
| Open DevTools → Console and keep it visible during the run. | Used for the "no console errors" assertions. |

> The Discovery case (RP-2) is reachable **during onboarding only** — test it on a fresh/unboarded account, or skip if already onboarded.

---

## RP-1 — Chat composer rotates

| TC | Steps | Expected |
|---|---|---|
| RP-1.1 | Open the chat ("Ask LifeOS"). Do **not** type. Watch the empty composer for ~8s. | The placeholder text **changes over time**, cycling through the Chat phrases above. At least 3 distinct phrases observed. |
| RP-1.2 | Time one full phrase. | Each phrase stays ~**2 seconds** before changing (not ~3s, not <1s). |
| RP-1.3 | Watch a single transition closely. | Text **cross-fades** (fade out → fade in), it does not hard-cut/jump. |
| RP-1.4 | Type a character into the composer. | Rotation **stops immediately**; the placeholder is gone (your text shows). |
| RP-1.5 | Clear the input back to empty. | Rotation **resumes**. |
| RP-1.6 | Throughout, check the Console. | **No errors** logged by the rotation (CORS/config-fetch warnings unrelated to placeholders are OK). |

---

## RP-2 — Discovery chat answer box rotates *(onboarding only)*

| TC | Steps | Expected |
|---|---|---|
| RP-2.1 | Reach `/discovery-chat` (Welcome → "Talk it through first"). Observe the empty answer box ~8s. | Cycles through the Discovery phrases; ≥3 distinct seen, 2s dwell, cross-fade. |
| RP-2.2 | Type, then clear. | Stops while typing, resumes when empty. |

---

## RP-3 — Goal input rotates

| TC | Steps | Expected |
|---|---|---|
| RP-3.1 | Goals tab → **+** → AddGoalSheet. Observe the "What do you want to achieve?" field (empty) ~8s. | Cycles through the Goal phrases ("I want to run a marathon", …); ≥3 distinct, 2s dwell, cross-fade. |
| RP-3.2 | The field is multiline. | Placeholder sits at the **top-left** of the box (not vertically centered), aligned like a normal placeholder. |
| RP-3.3 | Type, then clear. | Stops / resumes. |

---

## RP-4 — Food search rotates

| TC | Steps | Expected |
|---|---|---|
| RP-4.1 | Health tab → Add food → manual entry. Observe the "Food name" field (empty) ~8s. | Cycles through the Food phrases; ≥3 distinct, 2s dwell, cross-fade. |
| RP-4.2 | Type, then clear. | Stops / resumes. |

---

## RP-5 — Finance transaction search rotates (icon row)

| TC | Steps | Expected |
|---|---|---|
| RP-5.1 | Finance tab → Transactions. Observe the search box (empty) ~8s. | Cycles through the Finance phrases; ≥3 distinct, 2s dwell, cross-fade. |
| RP-5.2 | Alignment check (this input has a 🔍 icon to its left). | Placeholder text sits **immediately right of the search icon**, vertically centered — not overlapping the icon, not clipped, not at the top. |
| RP-5.3 | Type, then clear. | Stops / resumes. |

---

## RP-6 — Reduced motion (accessibility)

| TC | Steps | Expected |
|---|---|---|
| RP-6.1 | DevTools → **⋮ → More tools → Rendering** → set **Emulate CSS media feature prefers-reduced-motion** to **reduce**. Reload. Open any rotating input (chat is easiest). | The placeholder shows the **first phrase only, static** — **no rotation, no cross-fade**. |
| RP-6.2 | Set prefers-reduced-motion back to **no-preference**, reload, reopen. | Rotation **resumes** normally. |

---

## RP-7 — Regression: form fields stay static (must NOT rotate)

| TC | Steps | Expected |
|---|---|---|
| RP-7.1 | Sign-in / sign-up: observe **Email** and **Password** placeholders ~5s. | **Static** ("you@example.com", "Your password" / "At least 8 characters"). No rotation. |
| RP-7.2 | Add Food numeric fields (Calories, Protein/Carbs/Fat, Quantity). | Static numeric placeholders ("250", "0", "100"). No rotation. |
| RP-7.3 | Finance amount fields ("Enter amount") / onboarding day-7 amount. | Static. No rotation. |

---

## RP-8 — Cross-cutting

| TC | Steps | Expected |
|---|---|---|
| RP-8.1 | Across all rotating inputs, confirm phrases are **domain-relevant** (goal phrases on the goal field, food on food, etc.) — not generic or mismatched. | Each input's hints match its domain. |
| RP-8.2 | Leave a rotating input open for ~30s. | Rotation **keeps looping** (does not freeze, blank out, or get stuck on a faded-out empty state). Watch FPS — no visible jank. |
| RP-8.3 | Resize / zoom the window with a rotating input visible. | Placeholder stays aligned; no overflow or clipping. |

---

## Known scope / notes

- Only **open-ended/intent/search** inputs rotate. Email/password/amount/date/short-name fields are intentionally static (see RP-7).
- Default dwell is **2000ms** (`useRotatingPlaceholder`); per-input `intervalMs` override exists but no current call site sets it.
- Cross-fade ≈ 180ms out / 240ms in, so a phrase is fully readable for ~1.6s of the 2s window.
- The swap is timer-driven (not animation-callback-driven) specifically so it can't get stuck at opacity 0 on react-native-web — RP-8.2 guards this regression.

---

## Reporting

For each failure: TC id, the input, observed vs expected phrase sequence, dwell timing, a screen recording/GIF if the issue is animation-related, and any console error text.

---

## Claude-in-Chrome execution prompt

Paste the block below into Claude in Chrome (Claude operating the browser). Fill in
the two credential placeholders first. It drives this plan end-to-end and reports
a pass/fail table.

> **Important for the tester:** the rotating hint is rendered as a **separate text
> element overlaid on top of the input**, NOT the input's HTML `placeholder`
> attribute (which is empty). Always read the *visible* hint text on screen — do
> not inspect the `placeholder` attribute, it will look empty.

```
You are QA-testing the "rotating placeholders" feature on the deployed LifeOS web app.

TARGET: https://lifeos-6r5-eqa.pages.dev
CREDENTIALS: use the deployed e2e test user — email is `lifeos-e2e-test@example.com`;
the password is in the repo's `.env.test` as `PLAYWRIGHT_TEST_PASSWORD` (not hardcoded here).
(If sign-in fails, create a throwaway account via Sign up and complete the minimal onboarding to reach the tabs.)

CRITICAL READING RULE:
The animated hint is a SEPARATE text element drawn over each input — it is NOT the
input's `placeholder` HTML attribute (that attribute is empty). To observe a phrase,
read the visible text shown inside/over the empty field on screen. Do not type unless
a step says to.

HOW TO OBSERVE ROTATION (do this for each input):
1. Make sure the field is empty and not focused-with-text.
2. Read the visible hint text now. Then re-read it roughly once per second for ~8-10 seconds,
   recording each distinct phrase in the order it appears.
3. You should collect at least 3 DISTINCT phrases that fade in/out (cross-fade, not a hard cut),
   each holding for about 2 seconds.

SETUP:
- Open the target URL. Confirm it loads with no full-page error.
- Open DevTools Console; note any errors during the run (ignore unrelated CORS/config-fetch warnings).
- Sign in with the credentials. Reach the bottom tab bar.

RUN THESE CASES — report Pass/Fail + the phrase sequence you observed for each:

[RP-1] CHAT: Open "Ask LifeOS" chat (or navigate to /chat).
  a) Observe rotation (≥3 distinct phrases, ~2s each, cross-fading). Expected set:
     "What should I do next?", "Why did you skip my workout today?",
     "How am I tracking on my goals?", "Plan the rest of my afternoon…",
     "What did I learn this week?"
  b) Type a character → the hint must disappear and stop rotating.
  c) Clear the field → rotation must resume.

[RP-3] GOALS: Goals tab → tap "+" (Add a goal). Observe the "What do you want to achieve?" field.
  Expected set: "I want to run a marathon", "I want to switch into product management",
  "I want to save 6 months of runway", "I want to read 24 books this year",
  "I want to get fit and sleep better".
  Also confirm the hint sits at the TOP-LEFT of the multiline box. Then type/clear to confirm stop/resume.

[RP-4] FOOD: Health tab → add food → manual entry. Observe the "Food name" field.
  Expected set: "Type to search (dal, biryani, idli…)", "Search a dish — paneer tikka, oats…",
  "Grilled chicken, banana, coffee…", "What did you eat?". Type/clear to confirm stop/resume.

[RP-5] FINANCE: Finance tab → Transactions. Observe the search box (it has a magnifier icon on its left).
  Expected set: "Search merchant or category", 'Try "Swiggy" or "groceries"…',
  "Find a transaction…", "Coffee, rent, Amazon…".
  Confirm the hint sits immediately RIGHT of the search icon, vertically centered, not overlapping/clipped.
  Type/clear to confirm stop/resume.

[RP-6] REDUCED MOTION: Open DevTools → ⋮ → More tools → Rendering → set
  "Emulate CSS media feature prefers-reduced-motion" = reduce. Reload. Open the chat input.
  Expected: the hint shows ONE phrase, static — NO rotation, NO cross-fade.
  Then set it back to "no-preference", reload, reopen → rotation resumes.

[RP-7] REGRESSION (must NOT rotate): On the Sign-in screen, watch Email and Password placeholders for ~5s.
  Expected: STATIC ("you@example.com", "Your password"/"At least 8 characters") — no rotation.
  Also spot-check Add Food numeric fields (Calories "250", macros "0") — static.

[RP-8] STABILITY: Leave the chat input open and empty for ~30 seconds.
  Expected: it keeps looping through phrases — it must NOT freeze, go blank, or get stuck on an empty/faded-out state.

OUTPUT:
Produce a results table: | Case | Result (Pass/Fail) | Observed phrases / notes |.
For any Fail, include what you saw vs expected, dwell timing, and any console error text.
If an input is unreachable (e.g. onboarding-only Discovery box, or a gated tab), mark it N/A with the reason.
```

