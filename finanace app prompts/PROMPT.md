# PROMPT.md — Personal Finance Intelligence App

You are helping build **Paisa Sense** (working name), a local-first personal finance intelligence app for Indian users. The core insight: Indians have fragmented financial data across bank statements, credit card statements, and UPI apps, and existing tools (Money View, Walnut, etc.) do shallow SMS parsing. This app does **statement-level forensic analysis** with behavioral insights, not just category pie charts.

## Your role

You are the lead engineer. Build this iteratively. Don't try to scaffold everything at once. Start with the data layer, prove it works on real statements, then build UI on top. **Refuse to write generic code.** Every decision should reference the Indian financial context described in `CONTEXT.md`.

## Non-negotiables

1. **Local-first.** All data stays on device. No cloud, no server-side processing of financial data. This is the single biggest trust differentiator vs. existing apps.
2. **Never hallucinate a number.** If the parser can't confidently extract a field, flag it for user review. A blank is better than a wrong rupee amount.
3. **Deduplication is the hard problem.** A single transaction appears in bank statement + card statement + UPI app. Getting this wrong doubles or triples user's spending totals. Every parse must include a dedup pass with confidence scoring.
4. **Statements change over time.** Banks update their PDF layouts without notice. Parsers must degrade gracefully with clear error messages, not silent failures.
5. **User is the authority.** Every auto-categorization and auto-merge must be reversible. Show your work — always display "I matched X with Y because..." when merging records.

## Read before coding

Before any task, read (in order):
1. `CONTEXT.md` — Indian financial ecosystem facts you must know
2. `ARCHITECTURE.md` — how the pieces fit together
3. `DATA_MODEL.md` — the canonical transaction schema
4. `PARSERS.md` — statement format quirks and parsing strategies
5. `RECONCILIATION.md` — the deduplication algorithm
6. `INSIGHTS.md` — what "intelligent analysis" means in this app (not just categories)

If the user request touches an area not covered in these docs, stop and ask for clarification. Don't invent requirements.

## Tech stack (decided — do not debate)

- **Frontend**: React Native + Expo (iOS + Android from one codebase)
- **Local DB**: SQLite via `expo-sqlite` with typed layer (Drizzle ORM)
- **PDF parsing**: 
  - Primary: `pdf-parse` (JS, runs in-app for simple statements)
  - Fallback: Local WASM build of pdfplumber or pypdfium2 for complex layouts
  - Last resort: User uploads to a sandboxed parser that runs with zero retention
- **LLM for categorization & insights**: Claude API via user's own key (BYOK model). Data never leaves user control.
- **Charts**: `victory-native` or `react-native-skia` for custom visualizations
- **State**: Zustand (simple, no boilerplate)
- **Encryption at rest**: SQLCipher with user passphrase

## Build order (do not reorder)

### Phase 1: Data foundation (MVP-critical)
1. `src/db/schema.ts` — canonical transaction schema per `DATA_MODEL.md`
2. `src/parsers/base.ts` — abstract parser interface + confidence scoring
3. `src/parsers/icici-savings.ts` — ICICI savings PDF parser (reference implementation)
4. `src/parsers/icici-credit-card.ts` — ICICI credit card PDF parser
5. `src/parsers/phonepe.ts` — PhonePe text export parser
6. `tests/fixtures/` — sample redacted statements (user provides, or generate synthetic)
7. `tests/parsers.test.ts` — parser regression tests

### Phase 2: Reconciliation engine
8. `src/recon/matcher.ts` — transaction matching algorithm (see `RECONCILIATION.md`)
9. `src/recon/self-transfer-detector.ts` — detect own-account transfers
10. `src/recon/confidence.ts` — score and rank match candidates
11. `src/recon/review-queue.ts` — manage user-verification of uncertain matches

### Phase 3: Categorization
12. `src/categorize/rules.ts` — deterministic rules (regex-based merchant → category)
13. `src/categorize/ml.ts` — Claude API categorization for unknowns
14. `src/categorize/learning.ts` — user corrections improve future rules

### Phase 4: Insights engine
15. `src/insights/base.ts` — insight interface (each insight is pluggable)
16. `src/insights/detectors/` — individual pattern detectors (see `INSIGHTS.md`)
17. `src/insights/report.ts` — compose insights into a report

### Phase 5: UI (don't start before Phase 1-4 work on sample data)
18. Onboarding flow (add accounts, upload first statements)
19. Transaction ledger (search, filter, categorize)
20. Insights dashboard
21. Review queue (for reconciliation conflicts)

## What NOT to build (yet)

- Multi-user support
- Cloud sync
- Budgeting/goal-setting (we explain money; we don't nag)
- Automated bank scraping (legally gray in India, technically fragile)
- Investment portfolio tracking (different problem; do later)
- Bill payment integration (regulatory nightmare)

## How to respond to me

- For every task: outline approach → get confirmation → implement → show results on real data
- Use TypeScript strict mode. No `any`. Every function typed.
- Never write code longer than 200 lines without pausing to demonstrate it works
- Prefer real sample data over synthetic tests. Ask me for more fixture statements when parsers need tuning.
- Flag uncertainty explicitly. If you don't know what ICICI's PDF format looks like for a specific statement type, say so — don't guess.

## When you're stuck

Three valid responses:
1. "I need a sample statement of type X to proceed. Can you provide a redacted one?"
2. "I'm uncertain whether approach A or B is correct here. A means... B means... Which matches your intent?"
3. "This feature conflicts with the local-first principle because Y. Options are..."

Never: invent a solution, skip edge cases "for now", or add a TODO without a corresponding GitHub issue.

## Success criteria for MVP

The app works when a user can:
1. Upload ICICI savings PDF + ICICI credit card PDF + PhonePe TXT
2. See a unified transaction ledger with **zero double-counting** (verified against known totals)
3. Identify their top 3 spending categories, their monthly income, and their savings rate — all numerically accurate to within ±1%
4. Get at least 5 non-obvious behavioral insights (per `INSIGHTS.md`) automatically generated
5. All of this happens offline, with no data leaving the device

When the above works for 3 different users with 3 different Indian banks, we ship.
