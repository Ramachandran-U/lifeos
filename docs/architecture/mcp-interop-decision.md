# MCP / External Interop — Decision Record

> Should LifeOS adopt the Model Context Protocol (MCP) — either exposing itself as an MCP server, or consuming external MCP servers in the planner agent?
> Decision owner: founder. Evaluated: 2026-05-31.

## Status

🅿️ **Parked — too early to build, door deliberately left open.** Re-evaluate when one of the triggers below fires. This is not a "no"; it is a "not yet, and here's exactly what would change our minds."

## TL;DR

Building MCP now buys almost nothing, because retrofitting it later is a **thin adapter, not a rewrite** — our tool layer is already MCP-shaped. So the cost of waiting is low, which is itself the argument for waiting until a real consumer or data source exists.

## What grounds this

1. **Our tool layer is already MCP-shaped.** `AgentTool { declaration: AIToolDeclaration; execute }` ([src/ai/agent/runtime.ts](../../src/ai/agent/runtime.ts)) is isomorphic to an MCP tool: `declaration` ≈ MCP `name`/`description`/`inputSchema`, `execute` ≈ the `tools/call` handler. `buildLifeOsTools` ([src/ai/agent/tools.ts](../../src/ai/agent/tools.ts)) is a clean, typed, user-bound, read-only registry; `writeTools.ts` adds propose-then-confirm mutations. The hard, valuable part of "adding MCP" — a safe, well-described tool surface — already exists.
2. **Tools run on-device; the Worker executes nothing.** Differentiated data (health, contacts, journal bodies, people-graph) is deliberately local-only / never synced unencrypted. Only goals/tasks/routine sync (via the mutation log).
3. **Zero roadmap support, strong counter-signals.** No mention of MCP / interop / public API / third-party / ecosystem anywhere in `roadmap/` or `docs/`. Active rules cut the other way: the "no user data on a server" privacy promise (`ADMIN_PORTAL_PLAN.md`), the "necessity-not-convenience" integration philosophy, and Plaid/vector-DB explicitly deferred (`CLAUDE.md`). We are mid-**P1 Trust** (sync engine not done); **P5 Orchestration** has not started.

## Reasoning by direction

### (A) Expose LifeOS as an MCP server — *not now; earliest after P1 sync*
- **Hard constraint:** React Native can't host a stdio MCP server, so a server would live on the **Cloudflare Worker** — but the Worker only sees the **synced subset** (goals/tasks/routine). Health/contacts/journal are on-device, and the privacy contract says "no user data on a server." A server could therefore only ever expose a *slice*, and only without breaching that promise.
- **No consumer exists.** Pre-launch, flags-gated. Nobody is asking to drive LifeOS from an external agent yet.
- **Verdict:** A read-only server over the synced subset is *feasible later* (after P1 sync lands, OAuth'd via the Supabase bearer the Worker already validates). Build it when we actually want to dogfood LifeOS from Claude Desktop — not before.

### (B) Consume external MCP servers — *only when a concrete source appears*
- **Most plausible long-term** (pull tasks from Linear/Notion/GitHub into the planner). But it collides with the roadmap's "necessity-not-convenience" gating, and our existing integrations (Calendar/Fit/Gmail) are **direct REST**, not MCP — MCP is not the house pattern.
- **Architecture fork:** host the MCP client **on-device** (the agent runtime gains an MCP-over-HTTP client; preserves data locality) *or* on the Worker (breaks "Worker executes no tools" + locality). On-device is the locality-preserving choice.
- **Verdict:** Build only when there's a specific source we've decided to integrate that *already speaks MCP* and where MCP is genuinely less work than a direct REST client. Decide per-source, not as a platform bet.

### (C) Future-proofing — *already handled; one convention to keep*
- The `{ declaration, execute }` split already decouples tool *description* from *execution* from *data binding*. The same registry can be served over MCP (either end), consumed from MCP, or hit by the eval harness with no rewrite.
- **The entire "keep the door open" cost is one discipline:** keep new tools in the `AgentTool` shape and don't let provider-specific wire formats (Gemini `functionCall`/`functionResponse`) leak past `runtime.ts` into the tool definitions. We do this today.

## Why waiting is ~free

When we do build either direction, it is an **adapter**:
- **Server:** map each `AIToolDeclaration` → MCP tool schema, route MCP `tools/call` → the matching `execute`. Roughly one file on the Worker, over the synced-subset query layer.
- **Client:** wrap a remote MCP server's advertised tools as `AgentTool[]` and concat them into `buildLifeOsTools`'s return. The agent loop in `runtime.ts` already dispatches by name and handles unknown-tool / throwing-tool errors — no loop changes.

## Triggers that flip "parked" → "build"

| Trigger | What to build | Earliest |
|---|---|---|
| We want to drive LifeOS from Claude Desktop / another agent (dogfooding) | Read-only **server** over the synced subset, on the Worker, Supabase-OAuth'd. Never expose health/contacts. | After P1 sync lands |
| A specific external source we've committed to already speaks MCP and beats a REST client | **Client**, on-device, added to `buildLifeOsTools` | When that source is chosen |
| Third parties build on LifeOS (platform play) | Server + auth + registry | Post-PMF (out of current scope) |
