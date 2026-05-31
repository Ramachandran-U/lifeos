# Claude Design Prompt — LifeOS Gamification & Game-Feel UI

> ⚠️ **OBSOLETE DESIGN TOKENS — historical reference only.** The colour palette in this prompt (`goal #FF6B35`, `health #00C896`, `finance #F0B429`, `primary #5B4FE8`, …) is the **pre-Aurora** iteration and no longer matches the live design system. Current tokens live in `src/theme/colors.ts` (Aurora Refined: `goal #C9A0FF`, `health #7EE0B8`, `finance #F4C16A`, `primary #A584FF`, canvas `#0A0612`). Do **not** generate new UI from this prompt as-is — see [`docs/aurora-refined-v2/`](aurora-refined-v2/README.md) for the current design language. Kept for the historical Duolingo/Finch aesthetic direction it captures.

Paste the prompt below into Claude (claude.ai) with the **Artifacts** feature on. It will return a React + Tailwind artifact covering every screen listed. After review, paste the artifact back to the Claude Code session so it can be ported to React Native.

---

## The Prompt

You are a **senior product designer** specialising in **mobile game-feel UI** for wellbeing and productivity apps. Design a cohesive, bold, celebration-worthy gamification system for **LifeOS** — an AI-first "Digital Life Architect" for iOS and Android. Output a **single React + Tailwind artifact** that visualises every screen listed below on a mobile viewport (390×844). Use no external images; rely on emoji, SVG, gradients, and motion.

### The App in One Line

LifeOS answers "What should I do next to improve my life?" through 6 engines — **Goals, Health, Finance, Career, Social, Polymath (curiosity/learning)** — feeding a Master Routine Planner. Users progress by completing routine blocks, logging health, hitting goal milestones, finishing learning resources, and maintaining streaks.

### Aesthetic DNA

Blend these, keep it adult and premium:
- **Duolingo** — warmth, streak flames, XP gold, celebration haptics
- **Finch** — gentle progression, personal growth framing
- **Habitica** — RPG HUD but without the 16-bit nostalgia
- **Headspace** — calm negative space, generous type

Avoid: cartoon mascots, childish fonts, loot-box energy, dense dashboards.

### Exact Design Tokens (use verbatim)

**Typography**
- Display / Headings: **Nunito** (700/800)
- Body / Labels: **DM Sans** (400/500/600)
- Scale: 11, 13, 15, 17, 20, 28, 36, 48

**Spacing** — 4pt grid: 4, 8, 16, 24, 32, 48, 64
**Radii** — cards 20, buttons 16, pills 999

**Palette**
```
MODULES
  goal     #FF6B35  (orange)     goalLight     #FFF0EB
  health   #00C896  (green)      healthLight   #E0FBF4
  finance  #F0B429  (gold)       financeLight  #FFFBEB
  career   #5B4FE8  (violet)     careerLight   #EDE9FF
  social   #FF4D8B  (pink)       socialLight   #FFE8F2
  polymath #00B4D8  (cyan)       polymathLight #E0F8FF

GAMIFICATION
  xp       #FFD700  (gold)
  streak   #FF6B35  (flame orange)
  badge    #A855F7  (purple)

BRAND
  primary  #5B4FE8

DARK (default)
  background #0D0D0D  surface #1A1A2E  card #1F1F3A
  border #2E2E4A  textPrimary #FFFFFF  textSecondary #A8A8C0  textMuted #6B6B88

LIGHT
  background #F4F4F8  surface #FFFFFF  card #FFFFFF
  border #DDD9F0  textPrimary #0D0D1A  textSecondary #4A4A6A  textMuted #9090B0
```

Every surface must render correctly in **both dark and light**. Show a theme toggle in the artifact.

### The Gamification System (design to this spec)

- **XP** earned per action — complete routine block (+10), complete goal task (+15), log food (+5), log weight (+10), upload blood report (+50), finish learning resource (+100), earn badge (+200), photo food log (+20)
- **Level** derived from total XP using a smooth curve (e.g. `xpForLevel(n) = 100 * n * (n+1) / 2`). Show level as a ring around the avatar/emoji.
- **6 Domain Scores** (0–100) — Goals, Health, Finance, Career, Social, Mind — already visualised as a hexagonal radar. Design a polished version of this radar that feels like a character sheet.
- **5 Streaks** — workout, learning, food tracking, journaling, social. Grace day allowed once per streak (show as a dimmed flame).
- **8 Badges** currently defined: first_blueprint, first_blood_report, streak_30_any, skill_mastery, life_balance, goal_complete, week_1, food_photo. Design for **both earned and locked** states; locked state should tease the unlock condition.
- **Quests** (new) — 2-3 rotating daily quests and 1 weekly quest. Each quest has: module colour, short title, reward chip (XP), progress bar. Tapping completes if eligible.

### Required Artifact Surfaces (all in one artifact, switchable with tabs)

1. **Today hero** — the top third of the Home screen. Must include:
   - Level badge (circular ring showing XP progress, current level number centred, module gradient)
   - Greeting + current streak count in flame pill
   - Inline row of **top 3 streaks** (flame + count) with grace-day dimming
   - **2 active daily quests** as compact cards (module colour stripe, reward chip, progress)

2. **Rewards tab (full screen)** — dedicated gamification home:
   - Top: Large Level ring + XP-to-next-level bar + total XP
   - **Level ladder** — next 5 levels with the unlock each level grants (new quest slot, new theme, etc.)
   - **Badge gallery** — 4-column grid, earned tiles have subtle shimmer + saturated colour, locked tiles are desaturated with a lock icon and one-line hint
   - **Streak showcase** — each of 5 streaks as a row: flame (scales with count), name, current/best, grace chip
   - **Active quests** — daily + weekly list

3. **Level-up celebration overlay** — full-screen modal that fires on level gain:
   - Dim backdrop (blur + `rgba(0,0,0,0.6)`)
   - Huge level number with radial burst (conic gradient particles)
   - New perks unlocked (text list with check icons)
   - Single primary CTA: "Claim +200 XP"
   - Should feel **earned**, not loud. Spring-in, hold 2s, tap to dismiss.

4. **Hexagonal Life Balance radar** — redesigned:
   - 6 domain dots sized by score, glow intensity = score
   - Concentric rings at 25/50/75/100
   - Centre shows overall average as a huge number with trend arrow (↑/↓ vs last week)
   - Tapping a domain dot expands a side panel with that domain's score breakdown

5. **Per-domain mini-card** — embeddable on module tabs (Health, Finance, etc.):
   - One card, ~120 px tall
   - Domain icon + name + current score + delta chip
   - Horizontal XP bar coloured by domain
   - Tiny sparkline of last 7 days (SVG path)
   - Single tap → Rewards tab scrolled to that domain

### Motion & Haptics Notes

For each surface, include short design notes on motion (artifact comments are fine):
- **XP bar** — spring fill when XP is added (stiffness 120, damping 14), 400ms ease-out
- **Level ring** — animated conic gradient on level up (1.2s)
- **Streak flame** — scale pulse 1.0 → 1.15 → 1.0 over 300ms when incremented
- **Quest card** — checkmark morph + confetti burst on complete (600ms)
- **Level-up overlay** — spring in from scale 0.8, fade backdrop, 800ms total
- **Haptics** — Success on level up and quest complete; Medium on badge earn; Light on streak tick

### Layout Principles

- **Glanceable** — every surface has ONE hero element, everything else supports it
- **High contrast** — body text at 17 min, labels 13, numbers big (28+)
- **Generous whitespace** — breathing room between sections (24–32)
- **Module colour discipline** — each engine has ONE colour; don't mix without purpose
- **Dark-first** — design dark, prove it works in light

### Constraints

- React Native port target, so: **no CSS filters, no complex CSS grid tricks, no `backdrop-filter`**. Use SVG, linear/radial gradients, opacity, transforms, and simple flex layouts only.
- All animations must be expressible in **Reanimated 3** (withSpring, withTiming, interpolate).
- Use emoji for icons where possible (🔥 streak, ⭐ badge, 🏆 level, 🎯 quest) — RN-safe and no asset pipeline.

### Deliverable

A single React artifact with a tab bar switching between the 5 surfaces above. Include a light/dark toggle in the artifact header. Annotate each surface with inline comments for motion, haptics, and which existing design token powers each colour. Prioritise clarity, game-feel, and theme-parity.

---

## After the Artifact Returns

1. Paste artifact into the Claude Code session.
2. Claude Code will port each surface to React Native, wiring it to `useGameStore` and the `useColors()` hook.
3. No new runtime deps — only `react-native-svg`, `react-native-reanimated`, and `expo-haptics` (all already installed).
