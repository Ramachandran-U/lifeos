# Claude Design Prompt — LifeOS Gamification & Game-Feel UI (Web)

> ⚠️ **OBSOLETE DESIGN TOKENS — historical reference only (banner refreshed 2026-06-14).** This prompt is two design generations old: its palette is pre-Aurora, and Aurora itself was superseded by the **Ink + Signal** recommit (June 2026 — `docs/DESIGN_MANIFESTO.md` + `docs/design-deep-dive/`; current tokens in `src/theme/colors.ts`). It also assumes Tailwind, whereas the stack is React Native Web with `src/theme/` tokens. Do **not** generate new UI from this prompt — kept for historical reference.

Paste the prompt below into Claude (claude.ai) with the **Artifacts** feature on. It will return a React + Tailwind artifact optimised for desktop/tablet web. After review, paste the artifact back to the Claude Code session so it can be ported to the React Native Web build.

---

## The Prompt

You are a **senior product designer** specialising in **game-feel web UI** for wellbeing and productivity apps. Design a cohesive, bold, celebration-worthy gamification system for **LifeOS** — an AI-first "Digital Life Architect" delivered as a responsive **web app** (running on React Native Web at `localhost:8081`). Output a **single React + Tailwind artifact** that visualises every surface below, responsive from **1440 px desktop down to 768 px tablet** and **gracefully collapsing to a centred 480 px column on narrow viewports**. Use no external images; rely on emoji, SVG, gradients, and motion.

### The App in One Line

LifeOS answers "What should I do next to improve my life?" through 6 engines — **Goals, Health, Finance, Career, Social, Polymath (curiosity/learning)** — feeding a Master Routine Planner. Users progress by completing routine blocks, logging health, hitting goal milestones, finishing learning resources, and maintaining streaks.

### Target Viewport & Layout Shell

- **Primary design width**: 1440 px desktop
- **Content max-width**: 1200 px, centred
- **Left rail**: persistent 240 px sidebar nav (Today, Goals, Health, Finance, Career, Social, Explore, **Rewards**) with module icon + label
- **Main content**: 12-column grid, 24 px gutter
- **Right rail** (optional on ≥1280 px): 320 px "Daily Briefing" + active quests pinned
- **Breakpoints**: ≥1280 show 3-column layout; 1024–1279 collapse right rail; 768–1023 hide left rail into hamburger; <768 stack to single column
- Must work identically in **dark (default) and light**, with a header toggle

### Aesthetic DNA

Blend these, keep it adult and premium:
- **Duolingo Web** — warmth, streak flames, XP gold
- **Linear / Arc** — calm precision, subtle motion, dense but legible
- **Notion** — generous type, card discipline
- **Habitica** — RPG HUD minus the pixel art

Avoid: cartoon mascots, childish fonts, loot-box energy, dense dashboards, hover-only interactions (this app ships to touch-capable devices too).

### Exact Design Tokens (use verbatim)

**Typography**
- Display / Headings: **Nunito** (700/800)
- Body / Labels: **DM Sans** (400/500/600)
- Scale: 12, 14, 16, 18, 22, 32, 44, 60 (web-sized; larger than mobile counterpart)

**Spacing** — 4pt grid: 4, 8, 16, 24, 32, 48, 64, 96
**Radii** — cards 20, buttons 14, pills 999

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

Every surface must render correctly in **both dark and light**.

### The Gamification System (design to this spec)

- **XP** earned per action — complete routine block (+10), complete goal task (+15), log food (+5), log weight (+10), upload blood report (+50), finish learning resource (+100), earn badge (+200), photo food log (+20)
- **Level** derived from total XP using `xpForLevel(n) = 100 * n * (n+1) / 2`. Show level as a ring around an avatar emoji.
- **6 Domain Scores** (0–100) — Goals, Health, Finance, Career, Social, Mind — as a hexagonal radar. On web this radar can be **larger** (up to 420 px) and sit beside module cards.
- **5 Streaks** — workout, learning, food tracking, journaling, social. One grace day per streak (dimmed flame).
- **8 Badges**: first_blueprint, first_blood_report, streak_30_any, skill_mastery, life_balance, goal_complete, week_1, food_photo. Design **earned + locked** states.
- **Quests** — 2–3 daily + 1 weekly. Each has module colour, title, XP reward chip, progress bar.

### Required Artifact Surfaces (single artifact, tabs or anchored sections)

1. **Today dashboard (full web layout)** — the signature screen:
   - **Left rail**: persistent nav with Rewards tab highlighted when active
   - **Main column**: greeting row (Level ring + name + trend) → Hexagonal Life Balance radar (large, 420 px) → Routine blocks grid (2 columns) → Daily Briefing card
   - **Right rail**: Top 3 streaks (stacked), 2 active quests, 1 weekly quest
   - Every card has quiet hover lift (translateY -2 px, shadow bump), but never requires hover to function

2. **Rewards page (full web layout)** — dedicated gamification surface:
   - Hero band: giant Level ring (240 px) + XP-to-next bar + total XP + trend sparkline
   - **Level ladder** (horizontal rail) — next 5 levels as connected stepping stones with perks
   - **Badge gallery** — responsive grid: 6 columns ≥1280, 4 cols ≥1024, 3 cols ≥768, 2 cols <768. Earned = saturated + shimmer on hover; locked = desaturated + lock + hint
   - **Streak showcase** — 5 rows, each with flame size scaling to count, best/current, grace chip
   - **Active quests** — daily + weekly, full-width cards

3. **Level-up celebration overlay** — centred modal ~520 px wide:
   - Dimmed backdrop `rgba(0,0,0,0.6)` (no `backdrop-filter` — use opacity only)
   - Level number at 120 px, radial conic-gradient burst behind
   - Perks unlocked list
   - Primary CTA: "Claim +200 XP" (keyboard-focusable, Enter to dismiss)
   - Spring-in 800 ms, tap anywhere outside to dismiss

4. **Hexagonal Life Balance radar** — centre-of-app:
   - 420 px square at desktop, scales down to 280 px
   - 6 domain dots, glow intensity = score, sized by score
   - Concentric rings at 25 / 50 / 75 / 100
   - Centre number (60 px) = overall average + trend arrow vs last week
   - Hover or click a domain dot → right-side slide panel with per-domain breakdown (on web this replaces the mobile-only expand)

5. **Per-domain mini-card** — embeddable on module pages (Health, Finance, etc.):
   - ~280 px wide × 140 px tall
   - Domain icon + name + current score + delta chip
   - Horizontal XP bar in domain colour
   - 7-day sparkline (SVG path)
   - Click → navigate to Rewards anchored to that domain

### Motion & Interaction Notes

For each surface include short design comments on:
- **XP bar** — spring fill when XP added (stiffness 120, damping 14)
- **Level ring** — conic gradient sweep on level up (1.2 s)
- **Streak flame** — scale 1.0 → 1.15 → 1.0 over 300 ms on increment
- **Quest card** — checkmark morph + subtle confetti on complete (600 ms)
- **Level-up overlay** — spring from scale 0.85, 800 ms
- **Card hover** — translateY(-2 px) + shadow-lg, 150 ms ease-out. **Never require hover for function** — every hover state has a keyboard-focus equivalent
- **Keyboard** — full tab order, Enter activates quests/badges, Esc closes overlay

### Layout Principles

- **Dense but calm** — desktop gets multi-column layouts, but each column has a single hero
- **Module colour discipline** — each engine has ONE colour; don't mix
- **Generous whitespace** — 32 px between major sections, 24 px between cards
- **Dark-first** — design dark, verify light works
- **No mouse-only** — every interaction works via keyboard and touch

### Constraints (React Native Web friendly)

- **No CSS filters** (`blur`, `backdrop-filter`, `drop-shadow` beyond simple box-shadow)
- **No CSS grid `subgrid`, no container queries**
- Use flexbox and simple `grid-template-columns` only
- Animations expressible in **Reanimated 3** (withSpring, withTiming, interpolate)
- Emoji icons preferred: 🔥 streak, ⭐ badge, 🏆 level, 🎯 quest — RN-safe
- No fixed positioning for critical content (sidebars use flex not `position: fixed`)

### Deliverable

A single React artifact. Top-level layout: sidebar + main + optional right rail, with tabs or anchor links switching between:
1. Today dashboard
2. Rewards page
3. Level-up overlay (toggle to preview)
4. Hexagonal radar (inline on Today, plus standalone view)
5. Per-domain mini-card (shown in a demo row)

Include a header light/dark toggle. Annotate each surface with inline comments mapping every colour to a design token and every animation to its Reanimated equivalent.

---

## After the Artifact Returns

1. Paste artifact into the Claude Code session.
2. Claude Code ports each surface to React Native components wired to `useGameStore` and `useColors()`.
3. Web-specific behaviours (hover lift, keyboard focus, three-column layout) use `Platform.OS === 'web'` guards where needed.
4. No new runtime deps — only `react-native-svg`, `react-native-reanimated`, `expo-haptics`.
