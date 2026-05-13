# ARCHITECTURE.md — System Design

## Data flow (one sentence)

User uploads statements → Parser extracts raw transactions → Reconciliation engine deduplicates across sources → Categorizer assigns semantic meaning → Insights engine detects patterns → UI renders both numbers and narratives.

## Layered architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                            │
│  (Onboarding, Ledger, Insights Dashboard, Review Queue)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Zustand stores
┌──────────────────────────────┴──────────────────────────────┐
│                       Service Layer                         │
│  (Transaction queries, Insight composition, Export)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
   ┌─────────┐┌─────────┐┌──────────┐┌──────────┐┌────────┐
   │ Parsers ││ Recon   ││ Categor- ││ Insights ││ Export │
   │         ││ Engine  ││  izer    ││  Engine  ││        │
   └────┬────┘└────┬────┘└────┬─────┘└────┬─────┘└───┬────┘
        │          │          │            │          │
        └──────────┴──────────┼────────────┴──────────┘
                              │
                ┌─────────────┴─────────────┐
                │      Data Layer           │
                │  (SQLite + Drizzle ORM)   │
                └───────────────────────────┘
```

## Module responsibilities

### 1. Parsers (`src/parsers/`)

**One parser per (bank × statement-type) combination.** Do not build "universal" parsers — they fail silently on layout changes.

Each parser implements:

```typescript
interface StatementParser {
  readonly id: string;              // "icici-savings-v1"
  readonly displayName: string;     // "ICICI Savings Account"
  
  // Quick check: does this parser handle this file?
  canParse(file: UploadedFile): Promise<ParserMatchResult>;
  
  // Extract structured data
  parse(file: UploadedFile, opts?: ParseOptions): Promise<ParseResult>;
}

interface ParserMatchResult {
  matches: boolean;
  confidence: number;  // 0-1
  reason: string;      // for debugging
}

interface ParseResult {
  parserId: string;
  parsedAt: Date;
  source: StatementSource;
  statementPeriod: DateRange;
  accountIdentifier: string;  // last 4 digits, masked
  transactions: RawTransaction[];
  summary: ParsedSummary;
  warnings: ParseWarning[];   // e.g. "2 lines could not be parsed"
  unparsedContent: string[];  // raw lines we couldn't handle
}
```

Parsers NEVER write to the database. They return data. The service layer persists.

Parsers return `RawTransaction`, not `Transaction`. The canonical `Transaction` is created AFTER categorization and reconciliation.

### 2. Reconciliation engine (`src/recon/`)

Input: All `RawTransaction` records across sources.
Output: Deduplicated `Transaction` records + audit trail of merges.

The engine runs in passes:

1. **Self-transfer detection** — find rows that are same-user inter-account movements (use phone number matching, account number hints, reference patterns)
2. **Bank ↔ Card matching** — find bank outflows that pay credit card bills
3. **Bank ↔ UPI matching** — find bank UPI entries that correspond to PhonePe/GPay entries
4. **Investment detection** — flag transfers to investment platforms as savings, not expenses
5. **Merge resolution** — combine matched records into single canonical transactions with provenance

Each pass emits a `MatchCandidate` with:
- `confidence`: 0-1
- `reasoning`: human-readable explanation
- `rule_id`: which rule fired (for debugging)

Candidates with confidence > 0.95 auto-merge. Between 0.7-0.95 go to user review queue. Below 0.7 don't merge.

### 3. Categorizer (`src/categorize/`)

Three-tier system:

1. **Hard rules** (fast, deterministic) — regex merchant patterns. ~80% of transactions covered.
2. **Soft rules** (learned from user corrections) — per-user merchant→category map.
3. **LLM fallback** (Claude API, only for truly unknown) — batched, cached by merchant name hash.

User can override any categorization. Overrides become hard rules for that user.

Categories are a fixed set (no free-form) — see `DATA_MODEL.md`.

### 4. Insights engine (`src/insights/`)

An insight is a function that looks at transaction data and emits zero or more findings.

```typescript
interface InsightDetector {
  readonly id: string;
  readonly name: string;
  readonly minDataRequirement: DataRequirement;
  
  detect(data: InsightInput): Promise<Finding[]>;
}

interface Finding {
  severity: 'info' | 'notice' | 'warning' | 'alert';
  title: string;
  narrative: string;       // 2-3 sentences of plain English
  numericImpact?: Money;   // annualized rupee impact if applicable
  recommendation?: string; // what to do
  evidence: Transaction[]; // drill-down data
  confidence: number;
}
```

Detectors are pluggable. Each lives in `src/insights/detectors/` as a standalone file. Add new ones without touching existing code.

**Must-have detectors for MVP** (see `INSIGHTS.md` for full list):
- `RealIncomeDetector` — find salary, compute net take-home
- `FixedCommitmentsDetector` — rent, EMIs, SIPs, subscriptions
- `TrueSavingsRateDetector` — investments ÷ income
- `MicroSpendLeakDetector` — high-frequency small transactions
- `SubscriptionAuditDetector` — all recurring charges
- `CreditCardOptimizationDetector` — right card for right category
- `PeakSpendingHourDetector` — behavioral pattern (needs UPI timestamp data)
- `LifestyleInflationDetector` — year-over-year growth
- `HiddenTravelDetector` — spending bursts that look like trips
- `DuplicatePaymentDetector` — same amount paid twice (bank error or user error)
- `RecurringUnknownDetector` — transactions that look recurring but aren't categorized

### 5. Storage (`src/db/`)

SQLite with SQLCipher encryption. User sets a passphrase on first run. Passphrase is never stored in plaintext — used to derive encryption key via Argon2.

Schema lives in `src/db/schema.ts` using Drizzle ORM. Migrations versioned and forward-compatible.

**Never schema-break without a migration.** A user with 3 years of categorized data loses everything if we wipe the DB.

### 6. UI layer

React Native with Expo. Key screens:

- **Onboarding**: Add accounts → Upload statements → See first insights
- **Ledger**: Searchable, filterable transaction list
- **Insights**: Dashboard with findings from the insight engine
- **Review queue**: Match candidates awaiting user verification
- **Settings**: Account management, API key management, export/delete

Every number in the UI must be traceable. Tap a number → see the query → see the transactions.

## Key design decisions

### Why local-first?

Users won't trust a finance app with all their statements in the cloud. Existing Indian apps (Money View, Walnut, CRED) do server-side processing. We don't. That's the differentiator.

Trade-off: We can't provide cross-device sync in MVP. Users accept this for privacy.

### Why BYOK for Claude?

Running the categorization LLM on our infra means:
- We'd see all merchant names (violates local-first)
- We'd need a server to host the key (adds cost, failure mode)
- User's usage is rate-limited by our quota

BYOK (Bring Your Own Key) means user pays their own Claude API costs (tiny — ~$0.10/month for typical user), we see nothing, we scale infinitely.

### Why not use AA (Account Aggregator)?

The RBI-sanctioned Account Aggregator framework requires:
- Regulatory license (we don't have)
- Server-side data handling (violates local-first)
- Integration with one of 7 AAs (business deal, dependency)

Statement upload is a worse UX but a clean architecture. Revisit in V2.

### Why SQLite over IndexedDB/local JSON?

SQLite because:
- Mature, battle-tested, ~1 million line codebase
- Transactions, indexes, migrations all built-in
- SQLCipher provides AES-256 encryption at rest
- Drizzle ORM gives typed queries
- Export to CSV/JSON trivial

### Why Zustand over Redux?

Redux is overkill. Zustand is 400 lines, gives us the same guarantees, zero boilerplate.

### Why TypeScript strict?

Money math with untyped JavaScript causes production incidents. We track rupees. We use TypeScript strict. No debate.

## Performance budgets

- Parsing a 1-year PDF statement: under 5 seconds on mid-range phone
- Loading 10,000 transactions in ledger: under 500ms
- Running all insight detectors: under 3 seconds
- App cold start: under 2 seconds

If a feature blows a budget, we simplify the feature.

## Failure modes and recovery

### Parser fails on a new statement format

- Show user exact error message
- Offer to send (optionally) redacted sample to improve parser
- Let them manually categorize at least the summary (income, total expense) as a fallback

### Recon engine produces wrong match

- User can split any merged transaction back into components
- System learns: that match rule loses weight for that user

### User corrupts their data

- Auto-backup encrypted DB to user's iCloud/Drive on every import (opt-in)
- Export to CSV is one tap away
- Never auto-delete; show "archive" with 30-day recovery

## Out of scope (do not build)

- Bank API integrations
- Goal setting / budgeting (opinionated, not our game)
- Social features
- Ads of any kind
- Referral systems
- Investment advice
- Tax filing integration (different product)
