# Handover — Design Enhancements (3D/tactile UI, motion, voice, ethical gamification)

> The sequenced build plan derived from the research in
> [docs/research/ui-ux-gamification-2026.md](../docs/research/ui-ux-gamification-2026.md)
> (2 adversarially-verified passes — that file is the source of truth for *findings*;
> this file is the source of truth for *what we build, in what order, and what's done*).
>
> Originated in the `feat/design-enhancements` worktree. Confidence tags (🟢/🟡) and
> section refs (§) point back to the playbook.

## Status (updated 2026-06-09)

**Legend:** ✅ Live in prod · 🔵 In open PR · 🟡 Partial / already in codebase · ⬜ Not started · ➖ Insight/decision (no build)

### Pass 1 — UI/UX, 3D & motion
| § | Finding | Conf. | Status | Evidence |
|---|---------|-------|--------|----------|
| 2 | 3D/tactile button, no new dep | 🟢 | ✅ Prod | `Button3D` + 6 tests (#158). Layered-rim + `translateY` (web-safer than `boxShadow:inset`) |
| 3 | Reanimated preset transitions + skeletons over spinners | 🟢 | ⬜ | `Skeleton` pre-exists; not systematized |
| 3 | Duration-based loading guide (<1s / 2–10s / >10s) | 🟡 | ⬜ | — |
| 3 | 60fps budget (transform/opacity only) | 🟢 | 🟡 | `Button3D` follows it; not an app-wide documented budget |
| 4 | Two-tier productive/expressive motion language | 🟢 | ⬜ | Documented only |
| 4 | Carbon easing + duration motion tokens | 🟢 | ⬜ | Not in `theme/motion.ts` |
| 6 | Library matrix — stay on Reanimated; scope Skia/Rive | 🟢 | ✅ Decision | No heavy lib adopted |
| 7 | Sketch: 3D primary button | ➖ | ✅ Prod | = `Button3D` |
| 7 | Sketches: loading / celebration / voice affordance | ➖ | ⬜ | — |
| 8 | Don't ship web-unverified `boxShadow:inset`; no app-wide Skia/Rive | 🟢 | ✅ Honored | — |

### Pass 1 — Gamified-learning mechanics (§5)
| Finding | Conf. | Status |
|---------|-------|--------|
| Gamification lifts learning (g≈0.49) > behavior (g≈0.25) | 🟢 | ➖ Insight |
| Competition+collaboration + narrative framing (highest-yield) | 🟢 | ⬜ |
| Motivation from relatedness + autonomy, not badge-as-competence | 🟡 | ⬜ |
| Brilliant interactive wrong-answer feedback (Explore/Polymath) | 🟡 | ⬜ |

### Pass 2 — Voice / conversational UX (§10)
| Finding | Conf. | Status |
|---------|-------|--------|
| Voice-augmented value map (logging/reflection/coaching; not data-dense) | 🟢 | ⬜ |
| Turn-taking/barge-in mandatory + tap-to-talk toggle | 🟢 | ⬜ |
| RCT: real-time voice → +43.7% speaking gains | 🟢 | ⬜ |
| Always pair voice w/ non-voice path + live captions | 🟢 | ⬜ |
| Assistant-state visualizer from `expo-audio` metering | 🟢 | ⬜ |
| RN/Expo UI feasibility (`expo-audio`/`expo-speech-recognition`) | 🟢 | ⬜ |

### Pass 2 — Ethical gamification & dark patterns (§11)
| Red line / finding | Conf. | Status | Evidence |
|--------------------|-------|--------|----------|
| #1 Streak loss-aversion guilt | 🟢 | ✅ Prod | 4 copy fixes + 14 regression tests (#158) |
| #2 Pay-to-restore | 🟢 | ✅ Verified absent | Audit: no IAP; shield is level-earned |
| #4 Grinding / sunk-cost | 🟢 | 🟡 Mostly clear | Badge tiers anti-grind by design |
| Overjustification → informational XP/badges | 🟢 | 🟡 Partial | Toast copy already informational; AI-coach prompt not fixed |
| #3 Social pressure / "overdue" wording | 🟢 | ⬜ | Flagged; opt-in guard already good |
| Audit vs all 7 darkness domains | 🟢 | ⬜ | No formal audit |

### Button3D rollout surface
| Surface | Status |
|---------|--------|
| Component + tests | ✅ Prod (#158) |
| Welcome CTA | ✅ Prod (#159) |
| Day-1 onboarding CTAs (vision/career/routine, 6) | 🔵 PR #160 |
| Day-3/7/14 + discovery onboarding CTAs | ⬜ |
| Other app CTAs (tabs, sheets) | ⬜ |

---

## Sequenced plan (remaining work)

Ordered by **leverage × low-risk-first**. Each phase is independently shippable.

### Phase A — Quick wins ✅ DONE
3D tactile button + streak dark-pattern fixes. Shipped to prod (#158, #159).

### Phase B — Finish the Button3D rollout 🔵 IN PROGRESS · effort S
- **B1** Day-1 onboarding CTAs — PR #160 (open).
- **B2** Remaining onboarding: `day3-health`, `day7-finance`, `day7-social`, `day14-polymath`, `discovery-paste/confirm/intro/chat`. Same prop-compatible swap; verify `style` props are layout-only first.
- **B3** High-traffic tab/sheet primary CTAs (selectively — keep 3D for *primary* filled actions only; secondary/ghost stay flat).
- **Guardrail:** preserve button text + `accessibilityRole` so CUJ e2e keeps passing. Verify via playwright, not screenshots (onboarding is auth-gated).

### Phase C — Motion-token system + branded loading 🟢 · effort M · §3,§4
- **C1** Add a two-tier motion language to `src/theme/motion.ts`: `productive` vs `expressive` easing + duration tokens (Carbon-derived starting scale, brand-tuned). Gate expressive motion behind *earned* events only.
- **C2** A duration-based loading helper: `<1s` nothing, `2–10s` skeleton, `>10s` progress+estimate. Wire the existing `Skeleton` + Reanimated `FadingTransition`/entering into a reusable content-swap.
- **Prereq:** resolve **web-parity open question** (Reanimated layout transitions + `boxShadow` on react-native-web) — see §9. `Button3D`'s `translateY` technique is already web-verified.

### Phase D — Complete the ethical-gamification pass 🟢 · effort S–M · §11
- **D1** AI-coach prompt framing (`src/ai/agent/whatNext.ts`): replace "streak is at risk"/"keep alive" with momentum framing (playbook item #5).
- **D2** Social "overdue" wording (`src/hooks/useNotifications.ts` `scheduleSocialOverdueNudge`) → soften guilt; keep opt-in guard (item #6).
- **D3** Reframe any remaining controlling XP/badge copy to informational.
- **D4** (optional) Formal audit of streaks/XP/badges vs all 7 darkness domains.

### Phase E — Gamified-learning mechanics 🟢/🟡 · effort L (product) · §5
- **E1** Cooperative-competitive framings over zero-sum leaderboards (Social engine + cross-engine XP).
- **E2** Narrative/quest framing for Explore/Polymath (expeditions/constellations already fit).
- **E3** Brilliant-style **interactive** wrong-answer feedback in learning content.
- **E4** Re-weight gamification to autonomy + relatedness.
- *Larger product changes — scope each as its own handover.*

### Phase F — Voice / conversational UX 🟢 · effort L · §10
- Net-new; LifeOS already owns the Gemini Live transport (`voiceClient.ts` — do not bypass).
- **Prereqs (answer first — §9):** Gemini Live barge-in + tap-to-talk on web? production round-trip latency vs sub-second turn-taking threshold?
- **F1** Assistant-state visualizer (`expo-audio` metering → Reanimated; web pulse fallback).
- **F2** Voice-augmented surfaces in ranked order: hands-free logging → evening reflection → "what next?" coaching → daily briefing → Explore/Polymath practice. Each: non-voice fallback + live captions, interruptible, confirm consequential actions.
- *Scope as its own handover; start with one surface (hands-free logging or reflection).*

---

## Standing guardrails (from §8 + §11 — apply to all phases)
- **No loss-aversion / streak-shaming copy.** Guarded by `src/constants/__tests__/notifications.test.ts` + `streakAtRisk` tests. Honour the "no streak shaming" promise in `notifications-settings`.
- **Never** ship pay-to-restore, social-pyramid pressure, grinding, or sunk-cost ("you'll lose X") framing.
- **No app-wide Skia/Rive** — reserve for one bespoke visual; lazy-load on web.
- **Don't trust `boxShadow:inset` on web** without validation — prefer transform-based depth.
- Animate transform/opacity only; cap ~100 animated nodes (low-end Android) / ~500 (iOS).

## Open questions / prerequisites (§9 of the playbook)
1. Web parity: Reanimated layout transitions + `boxShadow` at 60fps on react-native-web/Cloudflare Pages? (blocks Phase C)
2. Gemini Live barge-in + tap-to-talk on web; production latency. (blocks Phase F)
3. Skia/Rive justified for celebration visuals, or does transform/opacity cover it?
4. Reference-app actual motion values (Duolingo/Headspace/Brilliant) — unmeasured.
