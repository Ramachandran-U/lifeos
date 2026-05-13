# Paisa Sense — Claude Code Project Spec

A complete specification package for building **Paisa Sense**, a local-first personal finance intelligence app for Indian users, using Claude Code.

## What's in this folder

This isn't a codebase — it's the **specification** for building one. These are the docs Claude Code reads to understand the product, architecture, and edge cases before writing a single line of code.

| File | Purpose | Read when |
|------|---------|-----------|
| `PROMPT.md` | The primary instruction — product vision, non-negotiables, build order | Start here |
| `CLAUDE.md` | How Claude Code should behave — operating principles, commands, anti-patterns | Every session |
| `CONTEXT.md` | Indian financial ecosystem facts — statement formats, merchant patterns | Before parsers, categorization, reconciliation work |
| `ARCHITECTURE.md` | System design — module boundaries, data flow | Before structural changes |
| `DATA_MODEL.md` | The canonical schema — every type, every relationship | Before DB or core type changes |
| `PARSERS.md` | Per-source parsing strategies — ICICI, HDFC, SBI, PhonePe, etc. | Before adding or modifying parsers |
| `RECONCILIATION.md` | The deduplication algorithm | Before touching reconciliation engine |
| `INSIGHTS.md` | The insight detector catalog | Before building new insights |

## How to use this with Claude Code

### 1. Set up the project

Create a new directory for the app:

```bash
mkdir paisa-sense
cd paisa-sense
```

Copy these spec files into the root of the project:

```bash
cp /path/to/spec/*.md .
```

### 2. Start Claude Code

```bash
claude
```

### 3. Kick off with the master prompt

First message to Claude Code:

```
Read PROMPT.md and CLAUDE.md. Confirm you understand:
1. What Paisa Sense is
2. The non-negotiables
3. The build order

Then read ARCHITECTURE.md and DATA_MODEL.md. Summarize the key architectural decisions.

After that, set up the repo skeleton per CLAUDE.md's "sample starter task" section.

Don't start implementing actual features yet — just scaffold.
```

### 4. Proceed module by module

Once the skeleton exists, work through the build order defined in `PROMPT.md`:

**Phase 1 — Data foundation:**
```
Read PARSERS.md carefully, focusing on the ICICI savings section. 
Build src/parsers/icici-savings.ts per the reference implementation described.
I will provide a fixture statement once you have the parser skeleton ready.
```

**Phase 2 — Reconciliation:**
```
Read RECONCILIATION.md. Implement the matcher per the staged passes described.
Start with Pass 1 (duplicate imports) and Pass 2 (UTR-matched UPI).
Pause after each pass so I can verify before proceeding.
```

...and so on through each phase.

### 5. When blocked

Claude Code will stop and ask for:
- Sample statements (PDFs) — redact any PII before sharing
- Clarification on ambiguous requirements — push back on docs if needed
- Architectural decisions — avoid deciding alone

## Key design principles

These come from `PROMPT.md` but worth repeating:

1. **Local-first.** All data on device. No server. No cloud. No analytics.
2. **Never hallucinate a number.** Blank > wrong rupee amount.
3. **Deduplication is the hard problem.** Get this right or the app is worse than useless.
4. **Statements change.** Parsers degrade gracefully, fail loud.
5. **User is the authority.** Every auto-decision is reversible and explainable.

## Tech stack (decided, not for debate)

- React Native + Expo
- TypeScript strict
- SQLite + Drizzle ORM + SQLCipher encryption
- Zustand for state
- pdf-parse (+ Python WASM fallback)
- Claude API (BYOK) for categorization and narratives

## What this app does NOT do

- Cloud sync
- Budget tracking / nagging
- Goal setting
- Automatic bank integration (AA/API)
- Bill payment
- Investment recommendations
- Tax filing

Do one thing (make sense of money) extremely well.

## Current status

Spec complete. Code not started. Next step: start Claude Code session and begin Phase 1.

## Adding a new bank

To add support for a new bank's statement format:

1. Collect at least 3 sample statements (different months, different account types if possible)
2. Update `CONTEXT.md` with format quirks, date format, merchant patterns specific to that bank
3. Add a new parser in `src/parsers/{bank}-{type}.ts`
4. Add fixtures to `tests/fixtures/{bank}/`
5. Write parser tests
6. Update `DATA_MODEL.md`'s `StatementSource` enum

## Adding a new insight

1. Read `INSIGHTS.md` for detector contract
2. Create `src/insights/detectors/{detector_id}.ts`
3. Add positive/negative fixtures
4. Register in insight registry
5. Update `INSIGHTS.md` catalog

## Questions you'll wrestle with

These don't have single right answers. Think carefully:

1. **Should a "refund" be income or negative expense?** — Probably negative expense; it offsets a prior consumption.
2. **Should P2P transfers be categorized?** — Only if recurring (rent, family support). One-offs stay as `transfer_other`.
3. **Should we detect spouses' income?** — No. We track user's money. Joint account inflows from a partner are transfers, not income, unless user says otherwise.
4. **How do we handle EMIs — as expense or as loan repayment?** — Separate direction (`loan_repayment`). Principal portion reduces net worth liability; interest is genuine expense.
5. **What counts as "savings"?** — Money that builds net worth: investments + liquid balance growth. NOT loan repayment (that's past consumption).

These are discussed in the relevant module docs.

## License

Your project. Use as you see fit.

## Credits

This specification was developed through iterative analysis of real Indian financial statements (UPI, credit card, and bank) — the patterns, edge cases, and reconciliation challenges described are drawn from actual data.
