# LifeOS

> One question, asked continuously: **"What should I do next to improve my life?"**

Most apps store your life. LifeOS is being built to *understand* it — to reason about your goals, energy, money, relationships, and ambitions, and fold them into a single liveable day. Not a planner. Not a habit tracker. An AI-native system that adapts to who you're becoming.

React Native + Expo. Runs on iOS, Android, and the web from one codebase.

---

## The idea in one breath

Six engines feed one planner:

```
   Goals · Health · Finance · Career · Social · Curiosity
                          │
                          ▼
              The Routine Builder  →  your day
```

Each engine understands a dimension of your life. The planner reasons across all of them. The interesting part isn't any single engine — it's what happens when they start talking to each other.

---

## What makes it different (the part we care about)

Anyone can build six dashboards. The bet here is on the layer above them — the one that:

- notices when you're **overcommitted relative to your sleep debt**,
- explains **why** a goal keeps stalling instead of just flagging that it did,
- and rebalances the week before you burn out, not after.

That's the moat, and it's where the work is going next. The how — an event-sourced spine that powers sync, memory, and reasoning from a single source of truth — lives in [`roadmap/`](roadmap/). It's a good read if you like systems design.

---

## Under the hood (a peek, not the whole map)

The AI layer is real engineering, not a chatbot wrapper:

- A **multi-step planning agent** — retrieve → propose → critique → commit — every step traced.
- **RAG, model routing, prompt caching, and a cost ledger** so each call uses the right model at the right price.
- **Seven eval suites** (mock for CI, live against real Claude) gating anything that touches the AI surface — including medical-adjacent safety checks with PII and prompt-injection resistance.

Want the wiring diagrams, eval thresholds, and the distillation track? They moved to [`docs/`](docs/) and [`evals/`](evals/) so this page stays honest about what matters.

---

## Where it's headed

A five-phase program is underway to turn LifeOS from "advanced goal system" into a true adaptive life OS: **trust foundation → cognitive engine → AI coach → memory graph → orchestration.** The sequencing, dependency map, and per-phase designs are in [`roadmap/01-program-roadmap.md`](roadmap/01-program-roadmap.md).

Short version: trust first (your life, synced and recoverable), then make it think.

---

## Curious? Start here

| If you want… | Open |
|---|---|
| The system-design thesis (start here) | [`roadmap/00-architecture-audit.md`](roadmap/00-architecture-audit.md) |
| The five-phase plan | [`roadmap/01-program-roadmap.md`](roadmap/01-program-roadmap.md) |
| Architecture & AI internals | [`docs/`](docs/) · [`src/ai/`](src/ai/) |
| How the AI layer is kept honest | [`evals/`](evals/) |

```bash
npm install
npx expo start        # iOS / Android / web
npm run evals         # exercise the AI layer, deterministically
```

---

*Built to feel alive. Designed for people who'd rather become someone than organise a to-do list.*
