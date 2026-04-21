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
- Parsers are bank-specific regex; adding a new bank = new parser + sender whitelist.
- Categorizer cache avoids re-hitting Claude for repeat merchants.
- Native (iOS/Android) doesn't use Dexie — currently this pipeline is web-only. Keep that in mind when touching `finance.tsx`.
- Finance **goals/milestones** are different from **transactions** — goals are AI-generated plans in SQLite; transactions are ingested from Gmail into Dexie. They only meet on the Finance screen.
