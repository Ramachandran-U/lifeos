# Voice Features — reference

Consolidated reference for LifeOS's voice surfaces and the recently-shipped voice
work (personas, spoken onboarding, the finance lookup tool, telemetry). Voice runs
on **Gemini Live** over a WebSocket and is a **separate path** from the `callAI`
HTTP client — see `src/ai/voiceClient.ts` (via the Worker's `/gemini-live`).

---

## Surfaces

### VoiceCompanion (`src/components/shared/VoiceCompanion.tsx`)
The persistent, minimizable voice assistant, mounted once above the tab navigator
(`app/(tabs)/_layout.tsx`) so the live session survives tab navigation. Two states:
an expanded panel and a collapsed pill. It is the AI's voice surface but speaks in
**ink, not violet** — it was removed from the `violetVoiceCompliance` allowlist
(PR #201). It carries an **audio-reactive ink halo** (opacity tracks the live
mic/speech level; collapses when idle — glow never idles), level-reactive status
dots, transition haptics, full a11y, an error→Retry affordance, and a text-input
fallback when the socket is down. Read-only grounding by default; the agentic
tools (navigate / sync / propose-confirm) turn on behind `voice_agent_actions`.

### Spoken onboarding (`app/(onboarding)/discovery-voice.tsx`)
A real spoken "talk it through" onboarding — a Gemini Live conversation whose
transcript runs through the same `extractDiscoveryProfile → saveDiscoveryImport →
discovery-confirm` pipeline the paste flow uses. The text chat (`discovery-chat`)
remains the no-mic fallback. The screen is violet-free (ink only) and
**persona-aware** (see below).

---

## Voice personas (`src/ai/voicePersonas.ts`, `src/components/shared/VoicePersonaPicker.tsx`)

A persona pairs a Gemini **prebuilt voice** (timbre) with a one-line **tone
directive** appended to the system instruction. Six are shipped — Sol / Vera /
Indi (female-perceived) and Max / Sage / Rhys (male-perceived); default is **Max
(Puck)**, the historical voice. The user picks one in **Settings → Voice**
(`VoicePersonaPicker`, rendered in `app/settings.tsx`), which writes
`preferredVoiceId` on the user row via `updateUser` (so it persists + flows through
the sync/audit log) and mirrors into the reactive store.

Both `VoiceCompanion` and `discovery-voice` resolve `getVoicePersona(preferredVoiceId)`
and pass the persona's voice + tone to the live session, so the voice identity is
consistent across onboarding and the companion. Changing the persona while the
companion is open **reconnects** the session — the Live API fixes the voice at
setup and can't hot-swap mid-turn. The picker has a live audio preview
(`useVoicePreview`) and radio-group a11y; selection is ink (manifesto-compliant).

---

## On-device voice tools (`src/ai/agent/voiceTools.ts`)

Tools run **on-device** beside the user's local data (the Worker executes none —
it's a passthrough). The base set is read-only grounding; the agentic set is added
when `voice_agent_actions` is on. Writes are **propose-only** (queue a
`ProposedAction`, return `{ proposed: true }`) — nothing mutates without an
explicit confirm.

| Tool | Kind | Notes |
|---|---|---|
| `getRecentSpending` | read | "where did my money go?" — totals + category/merchant breakdown |
| `getMoneyWithPayee` | read | **flag-gated `voice_finance_payee`** — "how much have I sent to / received from \<payee\> over \<period\>?"; sent (debits) + received (credits) + net; asks the period first, disambiguates multiple payees |
| `getTodayNutrition` | read | calories/macros vs personalised target (guidance, not medical advice) |
| `navigateTo` / `getCurrentScreen` | instant | open a tab / report context (agentic) |
| `proposeCreateGoal` / `proposeGenerateCareerPath` | propose | open the domain screen pre-filled + run the existing generator on confirm |
| `syncGoogleFit` | instant | idempotent sync + compact summary |
| `commitProposedActions` | commit | applies everything proposed after a spoken "yes" |

`getMoneyWithPayee` is gated for a staged rollout — see
[`docs/rollout/voice_finance_payee.md`](rollout/voice_finance_payee.md). Finance
data is India/UPI/INR-centric (parsed from bank email alerts) and stays on-device.

---

## Telemetry

`voice_tool_invoked` fires from `voiceClient`'s tool-dispatch for **every** voice
tool. Props are **PII-free** — tool name + coarse booleans (`ok`, `found`,
`ambiguous`) only; never tool args, payee names, amounts, or transcripts (the
redaction lives in `src/ai/voiceToolTelemetry.ts`). Registered on both the client
`EVENTS` map and the Worker `ALLOWED_EVENTS` (kept in sync by
`telemetryEventSync.test.ts`); lands in Supabase `telemetry_events`; opt-in.

---

## Flags

| Flag | Default | Gates |
|---|---|---|
| `voice_agent_actions` | off | the agentic tool set (navigate/sync/propose-confirm) |
| `voice_finance_payee` | off | the `getMoneyWithPayee` read tool (staged rollout) |

Both honour an `EXPO_PUBLIC_FLAG_*` compile-time override for dev/QA, additive
(can only enable). Production gates on the Worker `/v1/config` runtime flag.
