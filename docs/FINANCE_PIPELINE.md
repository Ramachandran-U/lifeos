# Finance Intelligence Pipeline

Web-first. Transactions live in IndexedDB (Dexie), not SQLite. The finance goal/milestone side still uses the standard DB layer.

## Data flow

```
Gmail OAuth (PKCE)          src/finance/gmail/oauth.ts
   ↓  access token
Gmail API fetch             src/finance/gmail/fetcher.ts
   ↓  raw bank emails (HDFC / ICICI / Axis)
Regex parsers               src/finance/parsers/emailParsers.ts
   ↓  { amount, merchant, date, account, type }
Categorizer (4 tiers)       src/finance/categorizer.ts
   ↓  cache → rule → distilled k-NN → batched AI (categorizeMerchantsBatch)
Dexie (IndexedDB)           src/finance/db/transactionDb.ts (transactions + merchantCache)
   ↓
useTransactionStore         src/finance/store/useTransactionStore.ts
   ↓
Insight engine              src/finance/insights.ts   (spending spikes, category drift)
   ↓
UI: app/(tabs)/finance.tsx  + goal engine (SQLite)
```

## Key files

| File | Role |
|------|------|
| [`gmail/oauth.ts`](../src/finance/gmail/oauth.ts) | Google OAuth 2.0 with PKCE, token refresh |
| [`gmail/fetcher.ts`](../src/finance/gmail/fetcher.ts) | Paginated Gmail search (`from:` bank senders) |
| [`parsers/emailParsers.ts`](../src/finance/parsers/emailParsers.ts) | HDFC / ICICI / Axis regex → normalized transaction |
| [`categorizer.ts`](../src/finance/categorizer.ts) | Merchant → category. 4-tier pipeline: Dexie cache → rule map → local k-NN classifier → batched AI |
| [`merchantClassifier.ts`](../src/finance/merchantClassifier.ts) | Distilled local classifier: char-3-gram TF-IDF + cosine k-NN over 167 anchor strings. Zero deps, ~1 ms inference, no API cost. Confidence floor 0.55 — below that, falls through to AI |
| [`db/transactionDb.ts`](../src/finance/db/transactionDb.ts) | Dexie schema v2 + CRUD. `transactions` table + new `merchantCache` table (merchant_normalized → category, with `source: 'rule' \| 'ai' \| 'user'` — user corrections are never overwritten) |
| [`insights.ts`](../src/finance/insights.ts) | Behavioural insight detectors (spikes, new merchants, category drift) |
| [`store/useTransactionStore.ts`](../src/finance/store/useTransactionStore.ts) | Zustand: transactions, sync state, OAuth token |

## Gotchas

- OAuth redirect lands at [`app/gmail-callback.tsx`](../app/gmail-callback.tsx) — completes PKCE exchange.
- The callback URI must match the one registered in Google Cloud (see `google client id connection.md`).
- **Token exchange runs server-side via the Worker** at `POST /v1/google/token` (Web application OAuth clients require a secret even under PKCE). The secret lives as `GOOGLE_CLIENT_SECRET` in Wrangler secrets — never in the app bundle. See [`workers/ai-proxy/src/routes/googleToken.ts`](../workers/ai-proxy/src/routes/googleToken.ts) and [`src/integrations/google/oauth.ts`](../src/integrations/google/oauth.ts).
- Parsers are bank-specific regex; adding a new bank = new parser + sender whitelist in [`fetcher.ts`](../src/finance/gmail/fetcher.ts) `BANK_QUERY` **and** [`detectSource`](../src/finance/parsers/emailParsers.ts).
- Current sender whitelist covers `hdfcbank.net`, `alerts.hdfcbank.com`, `icicibank.com`, `axisbank.com`, `axisbankmail.in`, `axis.bank.in`.
- **Subject is prepended to body** before parsing ([`useTransactionStore.ts`](../src/finance/store/useTransactionStore.ts)) — critical for image-only emails (e.g. Axis alerts) where the HTML body strips to whitespace but the subject carries the amount.
- **HDFC credit-card pattern is matched before the savings-account pattern** — otherwise the account regex's `(to|at)` clause wrongly snaps onto `at 19:19:23` timestamps in credit-card bodies. See comments in `parseHdfc`.
- Skipped-email count is surfaced in the UI next to ingested count, and the first 3 skipped bodies are logged to the console for parser debugging.
- **Categorizer cache** (`merchantCache` table) means a 5-day-old sync of hundreds of transactions makes ≤2 batched AI calls, not hundreds. The cache is seeded by both rule hits and AI verdicts on first encounter; user category corrections are stamped `source: 'user'` and never overwritten by automation.
- **Free-tier Gemini rate-limit fix:** the AI tier now uses `categorizeMerchantsBatch` (one round-trip per ~25 merchants) instead of looping `categorizeMerchant`. A 100-merchant sync that used to fire 25 sequential calls in 2 seconds (instantly tripping the 20 RPM cap) now fires 1–2 batches.
- **Benchmark:** [`evals/benchmarks/merchantBenchmark.test.ts`](../evals/benchmarks/merchantBenchmark.test.ts) compares rule / classifier / LLM / stacked pipeline. Tracks accuracy + coverage + projected $/1k. Report at `evals/reports/benchmark-merchant.md`.
- Native (iOS/Android) doesn't use Dexie — currently this pipeline is web-only. Keep that in mind when touching `finance.tsx`.
- Finance **goals/milestones** are different from **transactions** — goals are AI-generated plans in SQLite; transactions are ingested from Gmail into Dexie. They only meet on the Finance screen.
