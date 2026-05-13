# CLAUDE.md — Claude Code Agent Instructions

This file tells Claude Code how to work on this codebase. Read it at the start of every session.

## Project identity

**Paisa Sense** — a local-first personal finance intelligence app for Indian users. Turns raw bank/card/UPI statements into behavioral insights without sending data to any server.

## Operating principles

### 1. Read before you write

For any non-trivial task:
1. Read `PROMPT.md` for product vision and build order
2. Read `CONTEXT.md` for Indian financial ecosystem facts
3. Read the relevant module doc: `ARCHITECTURE.md`, `DATA_MODEL.md`, `PARSERS.md`, `RECONCILIATION.md`, or `INSIGHTS.md`
4. Read the test file for the module you're modifying
5. THEN start coding

If the task is unclear after reading docs: stop and ask. Do not guess.

### 2. Ground every decision in real data

This codebase lives or dies by how it handles real Indian statements. Every parser, matcher, and detector must be validated against actual statement fixtures in `tests/fixtures/`.

If you don't have a fixture for the scenario you're building, the correct action is:
```
"I need a fixture statement for {scenario} to proceed. Can you provide one?"
```

Never simulate. Never make up a "typical" statement format.

### 3. Fail loud, not silent

Finance apps that silently round, silently deduplicate, or silently skip broken rows destroy user trust. Our rules:

- If parsing fails for a row, that row appears in `warnings`, not in the quiet void
- If a number doesn't reconcile (e.g., statement total != sum of parsed rows), the import is NOT marked successful
- If a category is uncertain, it's `uncategorized`, not a guess
- If a match is borderline, it goes to user review, not auto-merged

### 4. Type everything

TypeScript strict mode. No `any`. No `as unknown as X` escape hatches.

Run `tsc --noEmit` before declaring any task complete. Zero errors.

### 5. Preserve user data

Migrations are one-way unless explicitly built reversible. User corrections are stored separately from auto-generated data, so re-running auto-categorization never overrides user decisions.

Never:
- Drop tables without migration
- Modify raw imported transactions
- Delete user overrides when recomputing

### 6. Test before claiming done

Every task "done" means:
- [ ] Unit tests pass (`npm test`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] Linter passes (`npm run lint`)
- [ ] Works on at least one real fixture (`npm run test:fixtures`)
- [ ] If it's user-facing, tested on a real device (simulator for quick, physical for final)

Say "it compiles" ≠ "it's done."

### 7. Commit discipline

- One logical change per commit
- Commit message format: `{area}: {change}` (e.g., `parsers: handle ICICI wrapped descriptions`)
- Commit body explains WHY, not WHAT (the diff shows what)
- Never commit API keys, fixture PII, or `node_modules`

Check `.gitignore` covers: `*.pdf` (user data), `*.db` (SQLite), `.env*`, API key storage.

## Tech stack reminders

- **React Native + Expo (managed workflow)** — no native modules without strong justification
- **TypeScript 5.x** — strict mode on, no exceptions
- **SQLite via expo-sqlite + Drizzle ORM** — never raw SQL strings in app code
- **Zustand** for state — no Redux, no MobX
- **react-native-skia or victory-native** for charts
- **pdf-parse** (primary) / **Python WASM** (fallback for complex PDFs)
- **Tesseract.js** (only for scanned PDFs, with loud warnings)

Forbidden without discussion:
- AsyncStorage for anything sensitive (use SQLCipher)
- Any cloud SDK (Firebase, Amplify, Supabase)
- Any analytics (PostHog, Mixpanel) unless explicitly opted in by user
- Chart libraries that require paid licenses
- CSS-in-JS libraries that add runtime overhead

## How to handle ambiguity

You will encounter ambiguity constantly. Default responses:

- **Feature ambiguity**: ask, don't guess
- **Naming ambiguity**: prefer the name used in related doc/schema
- **Library ambiguity**: prefer what's already in `package.json`; don't introduce new deps
- **Architecture ambiguity**: default to the simplest thing that satisfies constraints in `ARCHITECTURE.md`

## How to respond

Don't produce walls of code without context. For each non-trivial task, structure your reply:

1. **Understanding**: 1-2 sentences restating what you think you're building
2. **Approach**: 3-6 bullet points of how you'll tackle it
3. **Questions** (if any): things you need clarified before proceeding
4. **Implementation**: the actual code (after confirmation, unless task is small)
5. **Verification**: how you tested it / what to run to verify

For trivial tasks (typo fix, small bug), skip the preamble and just fix it.

## Anti-patterns

Things you'll be tempted to do that you must not:

- "I'll add error handling later" → no, add it now
- "Let me refactor this while I'm here" → not unless explicitly asked
- "I'll use a mock database for testing" → use real SQLite with test fixtures
- "Here's a utility I generated that might help" → not unless it solves the task
- Rewriting code that works to match your preferred style
- Adding features not requested
- Assuming the user wants a specific library just because it's popular

## Special files

- `PROMPT.md` — master product spec, read first
- `CONTEXT.md` — Indian financial ecosystem (statement formats, merchant patterns)
- `ARCHITECTURE.md` — how modules fit together
- `DATA_MODEL.md` — the canonical schema
- `PARSERS.md` — per-source parsing strategies
- `RECONCILIATION.md` — the deduplication algorithm (hardest module)
- `INSIGHTS.md` — the insight detector catalog
- `CLAUDE.md` — this file, for agent behavior

## Common commands

```bash
# Dev
npm run dev                # start Expo dev server
npm run ios                # open iOS simulator
npm run android            # open Android emulator

# Quality
npm run typecheck          # tsc --noEmit
npm run lint               # eslint
npm run lint:fix           # eslint --fix
npm test                   # vitest
npm run test:fixtures      # run parser regression tests on real statements
npm run test:e2e           # Detox e2e tests

# Database
npm run db:generate        # drizzle-kit generate migration
npm run db:migrate         # apply migrations
npm run db:studio          # drizzle-kit studio (visual DB editor)
npm run db:reset           # ONLY in dev — wipe local DB

# Build
npm run build:ios
npm run build:android
```

## Sample starter task

To verify Claude Code is working correctly, try:

> "Read PROMPT.md and ARCHITECTURE.md. Summarize the non-negotiables. Then create an empty repo skeleton with just `package.json`, `tsconfig.json`, an empty `src/` with `db/`, `parsers/`, `recon/`, `categorize/`, `insights/`, `ui/`, and a `tests/fixtures/` folder with a README explaining what goes there."

This verifies context loading without doing damage.

## Escalation

Ask for human input when:

- Changing a schema that existing users might have deployed
- Adding a new dependency
- Touching the reconciliation engine's core logic
- Integrating with a new bank's statement format (parser design)
- Modifying anything in `src/db/schema.ts` (migration territory)

Don't ask for:

- Typo fixes
- Test additions
- Adding a new insight detector (follow the pattern in `INSIGHTS.md`)
- Bug fixes with clear root cause
- Documentation updates

## Remember

This app earns user trust by being honest. Every design choice serves that. When in doubt: **pick the option that makes the user feel in control and in the know**, even if it's more work.
