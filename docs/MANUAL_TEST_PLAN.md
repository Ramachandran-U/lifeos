# LifeOS — Manual Test Plan (release regression)

> A reproducible, human-run regression checklist keyed to the **persistent test user**. Run it before a production deploy (or after a risky change) on the deployed web build and, when possible, a native build. It covers the flows that are impractical to fully automate — the master planner, the what-next agent, voice, and avatar generation — plus a confidence pass over every engine.
>
> **This complements the automated suites, it does not replace them.** Each row notes whether an automated test already guards it (§ "Automated vs manual" at the end). As automation grows, move rows from "manual" to "covered" and shrink this list.
>
> Related: [PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md) (tech-debt gate) · [MANUAL_OPS_TODO.md](MANUAL_OPS_TODO.md) (dashboard/CLI ops) · [PARKED_ITEMS_RUNBOOK.md](PARKED_ITEMS_RUNBOOK.md).

---

## 0. Setup

- [ ] **Credentials.** Sign in as the persistent test user: `lifeos-e2e-test@example.com` (password in gitignored `e2e/.env.test` as `PLAYWRIGHT_TEST_PASSWORD`, or recreate via `npm run e2e:create-test-user`). Never use a real personal account.
- [ ] **Target surface.** Prefer the de-facto prod web surface `https://lifeos-6r5-eqa.pages.dev` (see [PARKED_ITEMS_RUNBOOK.md](PARKED_ITEMS_RUNBOOK.md) §1.1). For native, use the latest EAS build (§1.2 of the runbook).
- [ ] **Build flags.** Confirm the build under test is **NOT** in AI-mock mode (`EXPO_PUBLIC_USE_AI_MOCK` unset/false) so the planner/agent/voice exercise the real proxy. Note which feature flags are on for this cohort (`agent_what_next`, `aiCoachActions`, profile-avatar gen, `sync_engine_enabled`).
- [ ] **Fresh state, when needed.** Some sections assume an onboarded user with data. If the test user is empty, either run the relevant create steps first or use a throwaway account for the fresh-onboarding section (§11).
- [ ] **Browser console open** (web) — watch for red errors / white screens throughout.

> Legend: ✅ pass · ❌ fail (file an issue + link) · ⏭️ skipped (flag off / N/A).

---

## 1. Auth & routing
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 1.1 | Open the app signed out | Lands on Welcome; "Sign in" + "Get started" visible | ☐ |
| 1.2 | Sign in with the test-user creds | Resolves to **Today** (onboarded), not the onboarding flow | ☐ |
| 1.3 | Hard-refresh while signed in | Stays on Today (session restored), no flash of sign-in | ☐ |
| 1.4 | Deep-link to `/(tabs)/goals` while signed in | Goals tab loads directly, no bounce to `/` | ☐ |
| 1.5 | Sign out (Profile → sign out) | Returns to Welcome; refresh stays signed out (token cleared) | ☐ |

## 2. Today (home) + master planner
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 2.1 | Open Today | Greeting ("Good morning/…"), life-balance dashboard, today's routine render; **no white screen** | ☐ |
| 2.2 | Trigger **"What should I do next?"** (if `agent_what_next` on) | A concrete next-action answer appears within a few seconds; no raw error text | ☐ |
| 2.3 | Generate / view today's **day plan** (master planner) | A coherent block schedule across domains; times are sane; no duplicate blocks | ☐ |
| 2.4 | **Re-plan rest of day** | Diff preview shows added/removed/moved blocks; **Undo** restores the prior plan | ☐ |
| 2.5 | Complete a routine block (hold-to-complete) | Block flips to completed (+XP tag); progress updates; can undo | ☐ |
| 2.6 | Complete all of today's blocks | "All done" celebration; no crash on the empty-remaining state | ☐ |

## 3. Goals engine
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 3.1 | Open Goals | Goal tree + "Today's Tasks" render | ☐ |
| 3.2 | Create a goal → AI decompose | A hierarchy (life → milestones → tasks) is proposed; editable; saves | ☐ |
| 3.3 | Complete a daily task | Task leaves the active "Today's Tasks" list; Life Score reflects it | ☐ |
| 3.4 | Open a goal → view trajectory | TrajectoryCard renders (ahead/behind/just-started); no crash with no data | ☐ |
| 3.5 | Rebalance goal hours (if surfaced) | A proposal sheet; applying changes weekly hours; dismiss is a no-op | ☐ |

## 4. Health engine
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 4.1 | Open Health | Hydration + energy quick-loggers render | ☐ |
| 4.2 | Log water (+500 ml ×2) | Total increments; Undo appears; persists across refresh | ☐ |
| 4.3 | Set energy level | Header reflects the selected level; persists | ☐ |
| 4.4 | Add a food entry | Calories/macros update for the day; entry editable/deletable | ☐ |
| 4.5 | Edit vitals (weight/sleep) | Saves; recent-weight trend updates | ☐ |

## 5. Finance engine
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 5.1 | Open Finance | Module mounts; existing goals render | ☐ |
| 5.2 | Create a financial goal → AI plan | A savings plan + milestones proposed; saves to the goal | ☐ |
| 5.3 | View a goal | Progress (saved/target) + milestones render correctly | ☐ |
| 5.4 | (If Gmail finance on) reconnect Gmail & import | Transactions categorise; a manual category is never overwritten by import | ☐ |

## 6. Career engine
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 6.1 | Open Career | Module mounts | ☐ |
| 6.2 | Generate a career strategy | Skill-gap chart + steps render; **Commit all** persists them | ☐ |
| 6.3 | Re-open after commit | Committed plan is still there | ☐ |

## 7. Social engine
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 7.1 | Open Social | Social score + contacts render (empty state is graceful) | ☐ |
| 7.2 | Add a contact (name, cadence) | Appears in the list; persists | ☐ |
| 7.3 | Log an interaction | Cadence/"overdue" status updates accordingly | ☐ |

## 8. Explore (Curiosity / Polymath) engine
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 8.1 | Open Explore | Today's spark + constellation render | ☐ |
| 8.2 | Open a spark → rabbit-hole thread | AI thread generates and is readable; no raw error | ☐ |
| 8.3 | Start / progress an expedition | Step completes; progress advances; persists | ☐ |

## 9. Chat / Evening reflect / Reviews
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 9.1 | Open Chat (`/chat`) → send a message | A relevant reply renders; no bounce to `/` | ☐ |
| 9.2 | Evening reflect → submit | Reflection saves; summary/insight renders | ☐ |
| 9.3 | Monthly insight / annual review | Report renders with the user's history; no crash on sparse data | ☐ |

## 10. Voice assistant (AI, hard to automate)
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 10.1 | Start voice; speak a request | Mic captures; transcript appears; the turn **completes** (no stuck "thinking") | ☐ |
| 10.2 | Model replies | Audio reply **plays** (web + native); barge-in interrupts cleanly | ☐ |
| 10.3 | End session | Stops cleanly; no lingering mic indicator | ☐ |

## 11. Avatar generation (flag-gated, AI)
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 11.1 | Profile → edit avatar → generate (if flag on) | An avatar is produced and saved; cost is recorded; failure shows a friendly error | ☐ |

## 12. Onboarding (use a throwaway account, not the persistent user)
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 12.1 | Create a fresh account / sign in as a never-onboarded user | Routes to `day1-vision` | ☐ |
| 12.2 | Walk Day 1 (vision → career → routine) | Each step ≤3 questions, one AI personalisation, celebrates completion | ☐ |
| 12.3 | Discovery fast-start (paste/chat → confirm) | Extracted profile is sensible and confirmable | ☐ |

## 13. Cross-device sync (the differentiator)
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 13.1 | Sign in as the test user on **two** devices/browsers (A and B) | Both reach Today | ☐ |
| 13.2 | On A: create a goal / complete a routine block | The change is recorded locally | ☐ |
| 13.3 | On B: refresh after a few seconds | The change from A appears on B (goals/routine/reflections sync) | ☐ |
| 13.4 | Confirm sensitive data does NOT cross | Health/finance/contacts stay local-only on each device (privacy boundary) | ☐ |
| 13.5 | Settings → Sync pill | Shows "Synced · just now" (green) during normal use | ☐ |

## 14. Settings / privacy / data
| # | Step | Expected | Result |
|---|------|----------|:--:|
| 14.1 | Profile → Appearance toggle | Theme switches; persists | ☐ |
| 14.2 | Notifications preferences | Toggles persist; a disabled nudge stays disabled | ☐ |
| 14.3 | (If `backup_enabled`) export → import a backup | Round-trips; wrong passphrase fails cleanly ("Could not decrypt — wrong passphrase or corrupted backup."); spinner shows during derivation | ☐ |
| 14.4 | Privacy / data-residency / how-it-works / terms screens | All render | ☐ |

---

## Automated vs manual coverage map

Rows already guarded by an automated test (so a green CI run + this manual pass = full confidence). Update this as specs land.

| Area | Automated by | Manual-only residue |
|------|--------------|---------------------|
| Auth & routing (§1) | `e2e/auth-routing.spec.ts`, `auth-signout.spec.ts` | — |
| Today render (§2.1) | `e2e/today-fully-loaded.spec.ts`, `ambient.spec.ts` | Planner/replan quality (§2.2–2.4) |
| Goals task complete (§3.3) | `e2e/goals-task-complete.spec.ts` | AI decompose quality (§3.2), rebalance (§3.5) |
| Health water/energy (§4.2–4.3) | `e2e/health-logging.spec.ts` | Food/vitals (§4.4–4.5) |
| Finance render (§5.1) | `e2e/finance-goals.spec.ts` | AI plan (§5.2), Gmail import (§5.4) |
| Career strategy (§6.2) | `e2e/career-strategy.spec.ts` | — |
| Social render (§7.1) | `e2e/social-contacts.spec.ts` | Add-contact / interaction (§7.2–7.3) |
| Explore render (§8.1) | `e2e/explore-spark.spec.ts` | Rabbit-hole / expedition (§8.2–8.3) |
| Routine completion (§2.5) | `e2e/routine-completion-modules.spec.ts` | — |
| Profile avatar (§11) | `e2e/profile-avatar.spec.ts` (flag-gated) | Real generation quality |
| Authed Today w/ data (§2.1) | `e2e/engine-authed.spec.ts` (real session) | — |
| Chat (§9.1) | `e2e/smoke.spec.ts` (mount only) | Reply quality |
| Voice (§10) | `e2e/voice-assistant.spec.ts` (basic) | Turn-complete + audio playback on real devices |
| Cross-device sync (§13) | `src/sync/**` unit (82%); **no e2e yet** | The full two-device journey (planned: B-P1) |
| Reviews / evening-reflect (§9.2–9.3) | route smoke only | Submit + report content |

> **Seeding for automated runs:** `e2e/seedTestUser.ts` provides `fresh` / `midOnboarding` / `fullyLoaded` fixtures (chromium init-script + authenticated session injection). For manual runs, drive the create flows above to build state — that exercise *is* the test.
