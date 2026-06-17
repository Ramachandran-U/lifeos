# Rollout runbook — `voice_finance_payee` (voice "money sent to / received from a payee")

Turnkey steps to validate and GA the read-only voice tool **`getMoneyWithPayee`**
(`src/ai/agent/voiceTools.ts`) — *"how much have I sent to / received from
\<person or business\> over \<period\>?"*. The tool is gated behind the runtime
flag **`voice_finance_payee`** (default **off**; `src/store/useFlagStore.ts`
`FALLBACK_FLAGS`).

---

## 0. How targeting actually works (read first)

Flags resolve in the Worker (`workers/ai-proxy/src/routes/config.ts`) from two
Supabase tables — `flags` (key / `default_value` / `status`) and
`flag_overrides` (`scope_json` → `value`). An override matches on **three scopes,
AND-ed** (`matchesScope`):

| scope key        | meaning                                   |
|------------------|-------------------------------------------|
| `platform`       | `ios` \| `android` \| `web`               |
| `tester_email`   | exact, case-insensitive                   |
| `app_version_lt` | semver upper bound (exclusive)            |

> **There is no geographic-region and no percentage rollout.** "Validate on a
> region" in practice means an **email-allowlist cohort** (best for control) or
> **`platform:web`** (broad canary — web is the only deployed platform). Because
> the feature only has data for users with linked **Indian bank/UPI** accounts,
> pick cohort emails who actually have those accounts.

Precedence: the matched override `value` wins over `default_value`; the client
merges Worker over fallback (`{ ...FALLBACK_FLAGS, ...json.flags }`), and
`isEnabled('voice_finance_payee')` is `Boolean(value)`. There is **no admin UI**
for overrides — use the Supabase SQL editor.

---

## 1. Ensure the flag row exists (default off)

```sql
insert into flags (key, type, default_value, status, description)
values ('voice_finance_payee','bool','false'::jsonb,'active',
        'Read-only voice tool: "how much sent to / received from <payee>?" (getMoneyWithPayee)')
on conflict (key) do nothing;
```

## 2. Turn it on for a validation cohort

One override row per validator email (add people with linked Indian bank/UPI):

```sql
insert into flag_overrides (flag_id, scope_json, value)
select id, '{"tester_email":"lalith.rao@tinubu.com"}'::jsonb, 'true'::jsonb
from flags where key = 'voice_finance_payee';
-- repeat per additional validator email
```

Broad web canary instead (everyone on web):

```sql
insert into flag_overrides (flag_id, scope_json, value)
select id, '{"platform":"web"}'::jsonb, 'true'::jsonb
from flags where key = 'voice_finance_payee';
```

## 3. Verify resolution (no app needed)

```bash
curl "https://<worker>/v1/config?platform=web&email=lalith.rao@tinubu.com" | jq '.flags.voice_finance_payee'   # → true
curl "https://<worker>/v1/config?platform=web&email=someone-else@x.com"    | jq '.flags.voice_finance_payee'   # → false
```

**Propagation:** ~5 min for live sessions (`STALE_MS` in `useFlagStore`),
immediate on app restart (boot does a forced fetch).

---

## 4. What to measure — telemetry

A PII-free event fires whenever a voice tool runs (added with this feature):

- **`voice_tool_invoked`** (`src/utils/telemetry.ts` `EVENTS.voiceToolInvoked`;
  emitted in `voiceClient.ts`'s `toolCall` path; allowlisted in
  `workers/ai-proxy/src/routes/telemetry.ts`). Props — **booleans + tool name
  only, never args/results**:
  - `tool` — e.g. `getMoneyWithPayee`
  - `ok` — the tool ran without throwing
  - `found` — did it find data (a tool can run ok yet find nothing)
  - `ambiguous` — did the payee name match multiple payees

Lands in the Supabase **`telemetry_events`** table (`device_id, event, props,
app_version, platform, ts`). Telemetry is **opt-in** (`useTelemetryStore.enabled`,
default off — Settings → Privacy), so cohort validators must have it on.

Useful queries (Supabase SQL editor):

```sql
-- invocations + found-rate over the cohort, last 14 days
select
  count(*)                                          as invocations,
  count(*) filter (where (props->>'found')='true')  as found_true,
  count(*) filter (where (props->>'ambiguous')='true') as ambiguous,
  count(*) filter (where (props->>'ok')='false')    as errored,
  count(distinct device_id)                          as devices
from telemetry_events
where event = 'voice_tool_invoked'
  and props->>'tool' = 'getMoneyWithPayee'
  and ts > now() - interval '14 days';
```

---

## 5. Success criteria (GA gate)

Over a ~2-week window on the cohort:

- **Adoption:** a healthy share of voice-active validators invoke it (devices > 0
  and growing).
- **`found:true` ≥ ~60%** of invocations — proves the data actually answers the
  question (not just that people tried). A low found-rate means the bank-label /
  payee data doesn't serve the query well.
- **Low `ambiguous` rate** and **`ok:false` ≈ 0** (no tool errors).
- Positive qualitative feedback (it answered the real question, right payee).

Meet these → GA: flip the default and remove the overrides.

```sql
update flags set default_value = 'true'::jsonb, updated_by = '<you>'
where key = 'voice_finance_payee';
delete from flag_overrides
where flag_id = (select id from flags where key = 'voice_finance_payee');
```

## 6. Kill criteria + switch

Kill if: `ok:false` spikes, `found:false` dominates (data model doesn't serve the
question), repeated wrong-payee complaints, or any crash tied to it.

```sql
-- instant global off (forces false on next /v1/config fetch, ~5 min / restart)
update flags set status = 'killed' where key = 'voice_finance_payee';
-- or just pull the cohort:
delete from flag_overrides
where flag_id = (select id from flags where key = 'voice_finance_payee');
```

---

## Notes / limits

- **India/UPI/INR-centric:** transactions parse from HDFC/ICICI/Axis email
  alerts (paise). Users without those have no data — choose the cohort
  accordingly, and broaden when more parsers land.
- The tool is **read-only and on-device**; finance data never leaves the device.
  Only the PII-free `voice_tool_invoked` booleans are sent (opt-in).
- The tool description tells the agent to **ask the period first** and to
  **disambiguate** when several payees match — no prompt-file change.
