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
Categorizer                 src/finance/categorizer.ts
   ↓  rule-based first, Claude fallback (categorizeMerchant)
Dexie (IndexedDB)           src/finance/db/transactionDb.ts
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
| [`categorizer.ts`](../src/finance/categorizer.ts) | Merchant → category. Rules first, Claude `categorizeMerchant()` fallback |
| [`db/transactionDb.ts`](../src/finance/db/transactionDb.ts) | Dexie schema + CRUD. Web-only storage |
| [`insights.ts`](../src/finance/insights.ts) | Behavioural insight detectors (spikes, new merchants, category drift) |
| [`store/useTransactionStore.ts`](../src/finance/store/useTransactionStore.ts) | Zustand: transactions, sync state, OAuth token |

## Gotchas

- OAuth redirect lands at [`app/gmail-callback.tsx`](../app/gmail-callback.tsx) — completes PKCE exchange.
- The callback URI must match the one registered in Google Cloud (see `google client id connection.md`).
- **`EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` is required** for Google "Web application" OAuth clients even with PKCE — without it, the token exchange fails with `client_secret is missing`. Used by both initial exchange and refresh in [`oauth.ts`](../src/finance/gmail/oauth.ts).
- Parsers are bank-specific regex; adding a new bank = new parser + sender whitelist in [`fetcher.ts`](../src/finance/gmail/fetcher.ts) `BANK_QUERY` **and** [`detectSource`](../src/finance/parsers/emailParsers.ts).
- Current sender whitelist covers `hdfcbank.net`, `alerts.hdfcbank.com`, `icicibank.com`, `axisbank.com`, `axisbankmail.in`, `axis.bank.in`.
- **Subject is prepended to body** before parsing ([`useTransactionStore.ts`](../src/finance/store/useTransactionStore.ts)) — critical for image-only emails (e.g. Axis alerts) where the HTML body strips to whitespace but the subject carries the amount.
- **HDFC credit-card pattern is matched before the savings-account pattern** — otherwise the account regex's `(to|at)` clause wrongly snaps onto `at 19:19:23` timestamps in credit-card bodies. See comments in `parseHdfc`.
- Skipped-email count is surfaced in the UI next to ingested count, and the first 3 skipped bodies are logged to the console for parser debugging.
- Categorizer cache avoids re-hitting Claude for repeat merchants.
- Native (iOS/Android) doesn't use Dexie — currently this pipeline is web-only. Keep that in mind when touching `finance.tsx`.
- Finance **goals/milestones** are different from **transactions** — goals are AI-generated plans in SQLite; transactions are ingested from Gmail into Dexie. They only meet on the Finance screen.
