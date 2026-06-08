# MOTION · 12 scenes mapped to components

> Scenes 01–11 map to existing components; scene 12 (Celebration burst) ships a new
> `CelebrationBurst` component — added in DELTA Phase 10 (2026-06-09).

Each scene from the motion-pass HTML has a target file and a Reanimated 4
implementation pattern. The repo already has `react-native-reanimated@~4.1.1`
and the motion tokens — these are integration patterns, not new infra.

> **Rule.** Every animation reads `useMotionScale()` (or uses
> `useSpringConfig(token)` / `useTimingConfig(token)` which already wrap it).
> Reduce-motion users see content arrive instantly. This is non-negotiable.

---

## 01 · First mount

**Where.** `app/(tabs)/index.tsx`

**What.** Aurora wash fades in → greeting row springs → headline mask reveals →
hex radar surface arrives → 6 timeline rows stagger → ambient breath on live block.

**Pattern.**

```tsx
import { useStaggerDelay, useTimingConfig } from '@/theme/motion';
import Animated, { FadeIn } from 'react-native-reanimated';

const stagger = useStaggerDelay();
const reveal  = useTimingConfig('slow');   // 600 ms

// Greeting row
<Animated.View entering={FadeIn.delay(0).duration(reveal.duration).easing(reveal.easing)}>
  …
</Animated.View>

// Headline (mask reveal)
<Animated.View entering={FadeIn.delay(120).duration(reveal.duration)}>
  …
</Animated.View>

// Hex radar surface
<Animated.View entering={FadeIn.delay(280).duration(reveal.duration)}>
  …
</Animated.View>

// Timeline rows — index-staggered. RoutineBlock already has FadeIn(300);
// override its delay at the parent so the cascade is visible.
{routine.map((block, i) => (
  <Animated.View
    key={block.id}
    entering={FadeIn.delay(420 + stagger(i)).duration(420)}
  >
    <RoutineBlock {...block} />
  </Animated.View>
))}
```

**Ambient breath on the live block.** Already a shared value in
`RoutineBlock.tsx`. Add a 4-second sine via `useSharedValue` + `withRepeat`:

```tsx
const breath = useSharedValue(0);
useEffect(() => {
  if (!isActive) return;
  breath.value = withRepeat(
    withTiming(1, { duration: 4000, easing: EASING.inOut }),
    -1, true
  );
  return () => { breath.value = 0; };
}, [isActive]);

const liveStyle = useAnimatedStyle(() => {
  if (!isActive) return {};
  const t = breath.value;
  return {
    transform: [{ scale: 1 + t * 0.006 }],
    opacity: 0.92 + t * 0.08,
  };
});
```

---

## 02 · Long-press to complete

**Where.** `src/components/shared/RoutineBlock.tsx`

**What.** Replace tap-to-complete with hold-to-complete. A 1.0 s press fills
a progress arc on the time-rail dot; on commit, a haptic ring expands once,
a checkmark draws live, an XP toast lifts in, the block falls to 55 % opacity.

**Pattern.**

```tsx
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { EASING, SPRING } from '@/theme/motion';

const HOLD_MS = 1000;

const pressP   = useSharedValue(0);    // 0 → 1 over hold
const ringP    = useSharedValue(0);    // expansion ring on commit
const tickP    = useSharedValue(0);    // checkmark stroke draw
const blockP   = useSharedValue(isCompleted ? 1 : 0);  // fade to done tier
let holdTimer: NodeJS.Timeout | undefined;

const startHold = () => {
  if (isCompleted) return;
  pressP.value = withTiming(1, { duration: HOLD_MS, easing: EASING.inOut });
  holdTimer = setTimeout(() => commit(), HOLD_MS);
};

const cancelHold = () => {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = undefined;
  if (pressP.value < 1) {
    pressP.value = withTiming(0, { duration: 200, easing: EASING.out });
  }
};

const commit = () => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  ringP.value = withSequence(
    withTiming(1, { duration: 360, easing: EASING.out }),
    withDelay(60, withTiming(0, { duration: 320, easing: EASING.in })),
  );
  tickP.value = withDelay(140, withTiming(1, { duration: 320, easing: EASING.out }));
  blockP.value = withDelay(440, withTiming(1, { duration: 420, easing: EASING.out }));
  runOnJS(onComplete)(id);
};

<Pressable
  onPressIn={startHold}
  onPressOut={cancelHold}
  // …
/>
```

**Press-progress arc on the time-rail dot.** Render a small circle around the
dot whose `strokeDashoffset` is driven by `pressP`. See the design HTML scene 02
for the exact visual; the arc has circumference `2πr`, dash array `2πr`,
offset `2πr * (1 - pressP)`.

**XP toast.** Use the existing `AchievementToast.tsx` component or post to
`useGameStore`'s reward queue if it already coordinates toasts (it does).

---

## 03 · Hex radar score morph

**Where.** `src/components/gamification/HexRadar.tsx`

**What.** When scores change (AI updates one domain), the polygon morphs
smoothly to the new shape rather than snapping. The affected dot pulses once.
The center score number ticks linearly with the morph.

**Pattern.** Reanimated path animation needs a derived value driving the
`d` attribute. Best implementation: keep the path computation pure but drive
it from `useDerivedValue` against a shared `morphP` (0..1), where the polygon
points interpolate between `previousScores` and `scores`.

```tsx
const morphP = useSharedValue(1);
const prevScoresRef = useRef(scores);

useEffect(() => {
  // When scores prop changes, animate from 0 → 1 over 1.6 s.
  morphP.value = 0;
  morphP.value = withTiming(1, { duration: 1600, easing: EASING.inOut });
  // Stash for the next morph cycle
  return () => { prevScoresRef.current = scores; };
}, [scores]);

const animatedDataPath = useDerivedValue(() => {
  return DOMAIN_META.map((d, i) => {
    const prev = prevScoresRef.current[d.key] ?? 0;
    const next = scores[d.key] ?? 0;
    const v = prev + (next - prev) * morphP.value;
    const p = pt(d.angleDeg, maxR * Math.max(0.02, v / 100));
    return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ') + 'Z';
});
```

**SVG paths in Reanimated** need `AnimatedProps` on `react-native-svg`. The
existing repo imports `Path` from `react-native-svg`. Wrap with
`Animated.createAnimatedComponent(Path)` and pass `animatedProps`.

**Pulse on the affected dot.** Take a prop `pulseKey?: DomainKey` from caller.
When set, that dot scales `1 → 1.2 → 1` over 800 ms (`EASING.bounce`).

---

## 04 · Streak +1 tick

**Where.** `src/components/gamification/StreakFlame.tsx` (or a new
`StreakCounter.tsx` if the number lives outside the flame).

**What.** Old number slides up + fades, new number springs in from below.
Flame inhales 200 ms before, then settles. A `+1` particle drifts up and
dissolves.

**Pattern.**

```tsx
import { EASING } from '@/theme/motion';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

const tickOut = useSharedValue(0);   // old number leaves
const tickIn  = useSharedValue(1);   // new number arrives (start visible if no animation pending)
const flame   = useSharedValue(0);   // inhale 0 → 1 → 0

const previousCount = useRef(count);

useEffect(() => {
  if (count === previousCount.current) return;
  // Inhale → tick → settle
  flame.value = withSequence(
    withTiming(1, { duration: 200, easing: EASING.in }),
    withTiming(0, { duration: 420, easing: EASING.out }),
  );
  tickOut.value = withTiming(1, { duration: 220, easing: EASING.in });
  tickIn.value = 0;
  tickIn.value = withDelay(80, withTiming(1, { duration: 360, easing: EASING.bounce }));
  previousCount.current = count;
}, [count]);

const oldStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: -tickOut.value * 32 }],
  opacity: 1 - tickOut.value,
}));
const newStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: (1 - tickIn.value) * 32 }],
  opacity: tickIn.value,
}));
const flameStyle = useAnimatedStyle(() => ({
  transform: [{ scale: 1 - flame.value * 0.06 }],
}));
```

Stack old and new numbers absolutely positioned; the container clips
`overflow: hidden`. The `+1` particle is a separate `Animated.Text` that
slides up 28 px and fades over 900 ms.

---

## 05 · Badge unlock

**Where.** `src/components/gamification/BadgeCard.tsx` +
`src/components/gamification/LevelUpOverlay.tsx` (which already exists).

**What.** Lock dissolves → halo blooms once (radial gradient, scale 1 → 1.3,
fade) → glyph springs in → label saturates.

The `RewardOrchestrator.tsx` already coordinates timing; this is the
visual.

**Pattern.** Drive from a single `unlockP: 0 → 1` shared value. Sub-anims are
ranges of that progress:

```tsx
// In BadgeCard.tsx, prop:
//   unlock?: 'idle' | 'unlocking' | 'unlocked'

const unlockP = useSharedValue(unlock === 'unlocked' ? 1 : 0);

useEffect(() => {
  if (unlock === 'unlocking') {
    unlockP.value = 0;
    unlockP.value = withTiming(1, { duration: 1700, easing: EASING.out });
  }
}, [unlock]);

const lockStyle = useAnimatedStyle(() => ({
  opacity: interpolate(unlockP.value, [0, 0.4, 0.6], [1, 1, 0], Extrapolate.CLAMP),
}));
const haloStyle = useAnimatedStyle(() => ({
  opacity:   interpolate(unlockP.value, [0.3, 0.5, 0.9], [0, 0.9, 0], Extrapolate.CLAMP),
  transform: [{ scale: interpolate(unlockP.value, [0.3, 0.9], [0.7, 1.3], Extrapolate.CLAMP) }],
}));
const glyphStyle = useAnimatedStyle(() => ({
  opacity:   interpolate(unlockP.value, [0.45, 0.8], [0, 1], Extrapolate.CLAMP),
  transform: [{ scale: interpolate(unlockP.value, [0.45, 0.8], [0.7, 1], Extrapolate.CLAMP) }],
}));
const labelStyle = useAnimatedStyle(() => ({
  opacity: interpolate(unlockP.value, [0.55, 0.9], [0, 1], Extrapolate.CLAMP),
}));
```

Halo is a `View` with a `radial-gradient` background (web) or a faint
`LinearGradient` mask (native).

---

## 06 · Quick-log sheet enter / exit

**Where.** `src/components/shared/VoiceAssistantSheet.tsx` +
`src/components/shared/LifeHubSheet.tsx`.

**Enter timing chart.**

| Element | Delay | Duration | Easing |
|---------|-------|----------|--------|
| FAB scale-in (anticipation) | 0 | 200 ms | `EASING.in` |
| Scrim alpha 0 → 0.55 | 150 ms | 480 ms | `EASING.out` |
| Sheet translateY (off → settled) | 180 ms | 540 ms | `SPRING.soft` |
| Grid tile stagger (50 ms step × 6) | 700 ms | 320 ms each | `SPRING.standard` |

**Exit timing chart.**

| Element | Delay | Duration | Easing |
|---------|-------|----------|--------|
| Sheet translateY back | 0 | 520 ms | `EASING.in` |
| Scrim alpha 0.55 → 0 | 80 ms | 460 ms | `EASING.in` |

**Pattern.** Bottom-sheet libraries handle most of this; if the project is
hand-rolled, use `useSharedValue` + `withSpring(useSpringConfig('soft'))`
for translateY.

For the inner tile stagger, wrap each tile in `<Animated.View entering={FadeIn.delay(stagger(i)).duration(320)}>` where `stagger = useStaggerDelay()`.

---

## 07 · Scroll dynamics · sticky header

**Where.** `app/(tabs)/index.tsx`

**What.** Hero greeting compresses into a sticky compact band as the page
scrolls. Aurora wash drifts at 0.5× scroll velocity (parallax).

**Pattern.** Use Reanimated's `useScrollViewOffset` + `useAnimatedScrollHandler`.

```tsx
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';

const scrollY = useSharedValue(0);
const onScroll = useAnimatedScrollHandler({
  onScroll: (e) => { scrollY.value = e.contentOffset.y; },
});

// Aurora wash — half velocity
const auroraStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: -scrollY.value * 0.5 }],
}));

// Sticky compact band — fade in 80 → 160 px
const bandStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [80, 160], [0, 1], Extrapolate.CLAMP),
  // Slight downward shift from off-screen as it appears
  transform: [{
    translateY: interpolate(scrollY.value, [80, 160], [-12, 0], Extrapolate.CLAMP)
  }],
}));

// Hero greeting — dim and shrink as scroll progresses 0 → 200 px
const heroStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [0, 200], [1, 0], Extrapolate.CLAMP),
}));
```

**Sticky band content.** Avatar (32 px) + "Today" title + "balance N · X of M done"
meta + search icon + MicFab (32 px). Position with `position: 'absolute', top: insets.top`.

---

## 08 · AI insight reveal

**Where.** `src/components/shared/DailyBriefing.tsx`

**What.** Sparkle pulses (one-shot) → text types in at reading pace
(~49 chars/sec) → optional highlighted fragment colored via mid-text span →
follow-up action chip slides in last.

**Pattern.**

```tsx
function useTypedText(fullText: string, opts: { startDelay?: number; charsPerSec?: number; enabled?: boolean }) {
  const { startDelay = 0, charsPerSec = 49, enabled = true } = opts;
  const [chars, setChars] = useState(enabled ? 0 : fullText.length);
  useEffect(() => {
    if (!enabled) { setChars(fullText.length); return; }
    setChars(0);
    let i = 0;
    const tick = () => {
      if (i >= fullText.length) return;
      i = Math.min(fullText.length, i + 1);
      setChars(i);
      const stepMs = 1000 / charsPerSec;
      handle = setTimeout(tick, stepMs);
    };
    let handle = setTimeout(tick, startDelay) as NodeJS.Timeout;
    return () => clearTimeout(handle);
  }, [fullText, enabled]);
  return fullText.slice(0, chars);
}
```

Wrap content in a `useMotionScale() === 0` guard — reduce-motion users see
full text instantly.

**Sparkle pulse.** One-shot `withSequence` on a shared `sparkP` driving scale + opacity over 320 + 400 ms (in + out).

---

## 09 · Loading → loaded

**Where.** `src/components/ui/Skeleton.tsx` is already a thing. Today screen
already has loading boundaries.

**What.** Skeleton shimmer at a single calm pace (1.8 s sweep) → real content
replaces skeleton, fading in row-by-row with 90 ms stagger.

**Pattern.** No code change required if `Skeleton.tsx` already shimmers.
Verify it does. Add a small `LoadedFadeIn` wrapper for rows that crossfades
over a 700 ms `EASING.out` curve when the data resolves.

```tsx
// Optional helper, ~30 lines
export function LoadedFade({ loading, index = 0, children }: { loading: boolean; index?: number; children: React.ReactNode }) {
  const stagger = useStaggerDelay();
  if (loading) return null;
  return (
    <Animated.View entering={FadeIn.delay(stagger(index, 90)).duration(700)}>
      {children}
    </Animated.View>
  );
}
```

---

## 10 · Health logging from photo

**Where.** `app/(tabs)/health.tsx` (when the camera CTA fires).

**What.** Shutter flash → photo lands with soft-out → AI scan line sweeps top
to bottom → recognized items fade in sequentially → macro ring fills →
"+20 xp" toast.

**Pattern.** This is a flow, not a single component. Sketch:

```tsx
// 1. Shutter — one-shot 240 ms bell (opacity 0 → 0.6 → 0)
// 2. Photo — FadeIn.duration(480).scale(0.94 → 1)
// 3. Scan line — Animated.View with translateY driven by withTiming(700 → 1700ms, EASING.inOut)
// 4. Items list — useStaggerDelay (90 ms step) wrapping FadeIn.translateX(8 → 0)
// 5. Macro ring — Reanimated SVG circle stroke-dashoffset over 900 ms EASING.out
// 6. Toast — existing AchievementToast, dispatched on flow complete
```

If the actual camera + AI inference is fully wired, drop these into the
existing flow's success branch. If still mocked, hardcode a 600 ms delay
between "scan" and "items" so the choreography reads correctly.

---

## 11 · Idle · ambient

**Where.** `src/components/shared/AuroraBackground.tsx` + the live `RoutineBlock`.

**What.** Aurora orbs drift in lazy sine paths (±6 px on 8 s period). Live
block breathes (already covered in scene 01). Mic-FAB halo pulses on a 5 s
period. Status dot blinks every 2.6 s.

**Aurora drift pattern.**

```tsx
const drift = useSharedValue(0);
useEffect(() => {
  drift.value = withRepeat(
    withTiming(1, { duration: 8000, easing: EASING.inOut }),
    -1, true
  );
}, []);

const orb1Style = useAnimatedStyle(() => ({
  transform: [
    { translateX: Math.sin(drift.value * Math.PI * 2) * 6 },
    { translateY: Math.cos(drift.value * Math.PI * 2 + 0.8) * 4 },
  ],
}));
```

Use two orbs with different phases (`+ 0.8`, `+ 1.6`) so they don't move in
lockstep.

**Mic-FAB halo.** Single hairline circle behind the FAB, scaling 1 → 1.18 on a
5 s sine, opacity 0.15 → 0.40. Should be barely perceptible.

**Status dot blink.** Render a 5 px dot that goes 1.0 → 0.4 → 1.0 on a 2.6 s
cycle (100 ms on, 400 ms decay, hold dim, return). Place inside live-block
header where "42m left" label sits.

---

## 12 · Celebration burst

**Where.** `src/components/gamification/CelebrationBurst.tsx` (new), mounted by
`RewardOrchestrator.tsx` on peak reward beats.

**What.** A short radial particle burst behind the reward chip on celebration peaks —
streak hits and large XP gains (≥ 50). 12 dots fly outward on an even angular spread,
arc down under "gravity," shrink, and fade in ~700 ms. This is the one moment that
*radiates* — resting badges/streaks stay flat (see DELTA Phase 5), so the burst reads
as an event, not ambient noise. Honors guardrail 3: it fires on a single reward beat,
not alongside a tab switch.

**Pattern.** Fixed-count children so hook order is stable; the parent returns `null`
under reduce-motion (no burst), and is keyed by the beat id upstream so a fresh mount
re-fires.

```tsx
function Particle({ index, count, color, size, motionScale }) {
  const tx = useSharedValue(0), ty = useSharedValue(0);
  const opacity = useSharedValue(1), scale = useSharedValue(1);
  useEffect(() => {
    const dur = (ms) => ms / motionScale;
    const angle = (index / count) * Math.PI * 2;
    const dist = 54 + (index % 3) * 16;          // staggered radius
    const ox = Math.cos(angle) * dist, oy = Math.sin(angle) * dist;
    tx.value = withTiming(ox, { duration: dur(640), easing: EASING.out });
    ty.value = withSequence(
      withTiming(oy, { duration: dur(280), easing: EASING.out }),
      withTiming(oy + 48, { duration: dur(420), easing: EASING.inOut }),  // gravity
    );
    scale.value = withTiming(0.35, { duration: dur(700), easing: EASING.out });
    opacity.value = withDelay(dur(280), withTiming(0, { duration: dur(420) }));
  }, []);
  // …Animated.View dot positioned at the origin, transformed by tx/ty/scale…
}
```

**Palette.** Streak beats burst in `[streak, warning, xp]`; XP beats in
`[domainHue, xp, primaryLight]`.

---

## Cross-cutting guardrails

1. **Every `withTiming` / `withSpring` reads `useMotionScale()`** — directly
   or via `useSpringConfig` / `useTimingConfig`. Phase 10's verify run will
   spot-check this by toggling reduce-motion in iOS settings (or via
   `usePreferencesStore.setState({ motionIntensity: 'off' })`) — the entire
   app should jump to final state instantly with no errors.

2. **No animation initiates from user input under 80 ms.** Pressing a button
   should *feel* immediate (scale 0.985 within `EASING.out`), but the
   downstream effect (e.g. badge unlock toast) can take its time. Don't
   collapse the choreography to look "snappy" — calm wins.

3. **No more than one attention-pulling animation on screen at a time.**
   The AI insight reveal completes before the chart begins. The badge halo
   blooms while the toast is held, not at the same moment as a tab switch.

4. **Haptics belong on commit, not on intent.** The long-press progress
   should not haptic until the hold completes. The streak +1 should haptic
   once on the commit, not on every increment.

5. **Idle scenes never animate faster than 3 s.** If you find yourself
   writing `duration: 1500` on something that loops, slow it down.
