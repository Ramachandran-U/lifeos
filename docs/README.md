# LifeOS Docs Index

Context docs to help re-enter the project quickly. Start here, then open the specific doc you need.

| Doc | When to read |
|-----|--------------|
| [`../CLAUDE.md`](../CLAUDE.md) | Always — project conventions, tech stack, AI client pattern |
| [`../PRODUCT_TECHNICAL_DOC.md`](../PRODUCT_TECHNICAL_DOC.md) | Full technical spec — architecture, features, data model, AI functions |
| [`GAMIFICATION.md`](GAMIFICATION.md) | XP, levels, quests, badges, streaks, Rewards tab, HexRadar |
| [`FINANCE_PIPELINE.md`](FINANCE_PIPELINE.md) | Gmail OAuth → parsers → Dexie → categorizer → insights |
| [`WEB_VS_NATIVE.md`](WEB_VS_NATIVE.md) | The `Platform.OS === 'web'` storage branching pattern |
| [`AI_FUNCTIONS.md`](AI_FUNCTIONS.md) | Every AI function: input, output, Zod schema, mock path |
| [`TESTING.md`](TESTING.md) | Jest setup, how to run, what's covered, next steps |
| [`../claude-design-prompt-web.md`](../claude-design-prompt-web.md) | Web design prompt (artifact-driven UI) |
| [`../claude-design-prompt-mobile.md`](../claude-design-prompt-mobile.md) | Mobile design prompt |

## One-paragraph orientation

LifeOS is a React Native + Expo (Router 6) app that runs on iOS, Android, and web. All data is on-device: SQLite + Drizzle on native, localStorage/IndexedDB (Dexie) on web. Every query file branches on `Platform.OS`. AI calls go to Claude Sonnet 4 via REST; set `EXPO_PUBLIC_USE_AI_MOCK=true` to develop offline. State is Zustand; there is no backend. The user journey: auth → 3-screen onboarding (vision → career → routine) → main tabs (Today, Goals, Health, Finance, Career, Explore, **Rewards**). Gamification is cross-cutting — XP/badges/streaks are awarded by handlers across all modules.
