# DATA_MODEL.md — Canonical Data Model

Every transaction, after parsing and reconciliation, conforms to this shape. If a detail doesn't fit here, think hard before adding a field — the model is intentionally narrow.

## Core types

### `Money`

Never use `number` for money. Rupees have paise (2 decimal places), but we store as integer paise internally to avoid float issues.

```typescript
type Money = {
  paise: bigint;    // 1 rupee = 100n
  currency: 'INR';  // future-proofed; MVP is INR-only
};
```

Arithmetic helpers in `src/lib/money.ts`. Never use `+ - * /` directly on Money.

### `RawTransaction`

What parsers produce. Minimally processed, faithful to source.

```typescript
type RawTransaction = {
  id: string;                      // UUID
  sourceStatementId: string;       // FK to Statement
  sourceRowIndex: number;          // line number in statement for debugging
  
  postedDate: Date;                // as shown on statement
  valueDate?: Date;                // if separately listed
  
  description: string;             // raw, unmodified
  rawAmount: Money;                // absolute value
  direction: 'debit' | 'credit';   // simpler than signed
  
  // Bank-provided identifiers (used for dedup)
  referenceNumber?: string;        // UTR, transaction ID, whatever the bank provides
  upiHandle?: string;              // extracted from description if UPI
  counterpartyHint?: string;       // extracted name/merchant guess
  
  // Derived metadata
  balanceAfter?: Money;            // if statement shows running balance
  
  // Parser audit
  parserConfidence: number;        // 0-1, how sure is the parser?
  parserNotes?: string;
};
```

### `Transaction` (canonical)

After reconciliation and categorization.

```typescript
type Transaction = {
  id: string;                      // UUID, stable
  
  // Identity
  date: Date;                      // canonical date (resolved if sources disagree)
  amount: Money;                   // always absolute
  direction: Direction;            // see below
  
  // Semantic fields
  category: Category;              // see categories below
  subcategory?: string;            // free-form, user-defined
  merchant?: Merchant;             // FK, resolved merchant
  description: string;             // cleaned description
  
  // Provenance (CRITICAL for trust)
  sourceRecords: RawTransactionRef[];  // which raw rows composed this
  mergedAt?: Date;
  mergeReasoning?: string;         // "Matched bank UPI with PhonePe txn, UTR match"
  
  // User interaction
  userCategoryOverride?: Category;
  userNote?: string;
  userTags?: string[];
  isFlagged: boolean;              // user-starred for follow-up
  isHidden: boolean;               // exclude from summaries (e.g. one-off anomalies)
  
  // Derived facets (computed once, cached)
  isRecurring: boolean;
  recurrencePatternId?: string;    // FK to RecurrencePattern
  isInternalTransfer: boolean;     // between user's own accounts — excluded from income/expense
  isCreditCardPayment: boolean;    // bank outflow paying a card bill — excluded
  isInvestment: boolean;           // outflow to brokerage/AMC — excluded from expenses
  isRefund: boolean;               // credit that reverses a prior debit
  
  createdAt: Date;
  updatedAt: Date;
};
```

### `Direction`

Rather than positive/negative, we use an explicit direction:

```typescript
type Direction =
  | 'expense'              // money leaving for consumption
  | 'income'               // money arriving (salary, refunds, interest)
  | 'investment'           // money moving to wealth-building
  | 'transfer_self'        // moving between own accounts
  | 'transfer_other'       // P2P transfer (lent/gifted/owed)
  | 'loan_repayment'       // EMI payments
  | 'credit_card_payment'  // paying a card bill
  | 'refund'               // reversal of earlier expense
  | 'fee'                  // bank/service fees
  | 'tax'                  // TDS, direct tax, GST
  | 'cash_withdrawal';     // ATM — becomes untracked cash
```

**Why 11 directions instead of just debit/credit?** Because "₹20,000 went out" means very different things. Lumping them together is why existing apps give wrong advice.

### `Category`

Fixed enum (user can't add new categories — they CAN add subcategories under them).

```typescript
type Category =
  | 'food_dining'          // restaurants, delivery (Swiggy/Zomato food)
  | 'groceries'            // supermarket, Blinkit/Zepto/Swiggy Instamart
  | 'transport_fuel'       // Uber, Ola, fuel, parking, tolls
  | 'transport_travel'     // flights, trains, hotels, trip-related
  | 'utilities'            // electricity, water, gas, internet, mobile
  | 'housing'              // rent, maintenance, property tax
  | 'shopping_general'     // retail, Amazon/Flipkart general
  | 'shopping_electronics' // phones, laptops, gadgets
  | 'shopping_clothing'    // apparel, footwear
  | 'shopping_home'        // IKEA, Pepperfry, furniture, home goods
  | 'entertainment'        // movies, events, streaming
  | 'health_medical'       // pharmacy, doctor, hospital
  | 'health_fitness'       // gym, sports gear, apps
  | 'personal_care'        // salon, cosmetics, self-care
  | 'education'            // courses, books, tuition
  | 'alcohol_bars'         // separate from food — different behavioral signal
  | 'insurance'            // life, health, vehicle, term insurance
  | 'subscriptions'        // all recurring digital services
  | 'fees_charges'         // bank fees, late fees, GST
  | 'taxes'                // direct tax, TDS
  | 'gifts_donations'      // gifts, charity
  | 'professional'         // work-related spending
  | 'family_support'       // transfers to parents/relatives
  | 'other'                // only when truly unclassifiable
  | 'uncategorized';       // not yet reviewed
```

**Why 24 categories and not 10?** Because "Shopping" as one bucket hides iPhone purchases next to toothbrush purchases. Behavioral signals emerge from granularity.

**Why `alcohol_bars` separate?** Because it has different behavioral implications than food spending. Flag-worthy.

**Why `family_support` separate from transfers?** Because in Indian households this is a recurring ongoing commitment, not ad-hoc generosity.

### `Merchant`

Normalized merchant entity. One row per unique merchant, regardless of how many variants of its name appear in statements.

```typescript
type Merchant = {
  id: string;
  canonicalName: string;          // "Swiggy"
  aliases: string[];              // ["SWIGGY", "Bundl Technologies", "www.swiggy.in", "PayUSwiggy", "RAZ*Swiggy", ...]
  category: Category;             // default category
  merchantType: MerchantType;
  website?: string;
  isPaymentAggregator: boolean;   // Razorpay, PayU etc. — not a real merchant
  createdAt: Date;
  userId?: string;                // null = system-wide; set = user-custom merchant
};

type MerchantType =
  | 'online_marketplace'   // Amazon, Flipkart
  | 'food_delivery'
  | 'groceries_delivery'
  | 'ride_hailing'
  | 'public_transit'
  | 'airline'
  | 'hotel'
  | 'restaurant'
  | 'bar_liquor'
  | 'retail_store'
  | 'utility'
  | 'subscription_service'
  | 'financial_service'
  | 'government'
  | 'individual'           // P2P transfer
  | 'unknown';
```

### `Statement`

Represents a parsed source document. Never deleted — raw data is gospel.

```typescript
type Statement = {
  id: string;
  fileName: string;
  fileHash: string;                // SHA-256, used to prevent duplicate imports
  
  source: StatementSource;         // which bank/app
  accountIdentifier: string;       // "XXXXXX1880" — masked
  parserId: string;
  parserVersion: string;
  
  statementPeriod: DateRange;
  totalTransactionsParsed: number;
  totalTransactionsFailed: number;
  
  rawTransactions: string;         // JSON blob of all raw transactions (for re-processing)
  warnings: ParseWarning[];
  
  importedAt: Date;
  importedBy: string;              // user ID
};

type StatementSource =
  | 'icici_savings'
  | 'icici_credit_card'
  | 'hdfc_savings'
  | 'hdfc_credit_card'
  | 'sbi_savings'
  | 'sbi_credit_card'
  | 'axis_savings'
  | 'axis_credit_card'
  | 'kotak_savings'
  | 'kotak_credit_card'
  | 'amex_credit_card'
  | 'phonepe_upi'
  | 'gpay_upi'
  | 'paytm_upi'
  | 'other';
```

### `Account`

User-facing representation of a bank account, credit card, or wallet.

```typescript
type Account = {
  id: string;
  nickname: string;                // "Main HDFC Savings"
  accountType: AccountType;
  bank?: string;                   // "HDFC", "ICICI"
  accountIdentifier: string;       // last 4 digits
  cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'rupay';
  
  openingBalance?: Money;
  currentBalance?: Money;          // computed from latest statement
  currentBalanceAsOf?: Date;
  
  isActive: boolean;
  isPrimary: boolean;              // user's main salary account
  createdAt: Date;
};

type AccountType =
  | 'savings'
  | 'current'
  | 'credit_card'
  | 'upi_wallet'
  | 'fd_rd'
  | 'investment_demat'
  | 'cash'
  | 'loan_account';
```

### `MatchCandidate`

Produced by reconciliation engine when same transaction appears in multiple sources.

```typescript
type MatchCandidate = {
  id: string;
  transactionIds: string[];        // 2+ RawTransaction IDs
  matchType: MatchType;
  confidence: number;              // 0-1
  rulesFired: string[];            // which recon rules matched
  reasoning: string;               // human-readable
  status: 'pending' | 'auto_merged' | 'user_confirmed' | 'user_rejected';
  resolvedAt?: Date;
};

type MatchType =
  | 'bank_upi_to_phonepe'
  | 'bank_to_credit_card_payment'
  | 'self_transfer'
  | 'duplicate_import'
  | 'refund_to_original';
```

### `RecurrencePattern`

Detected recurring transaction cluster.

```typescript
type RecurrencePattern = {
  id: string;
  merchantId: string;
  canonicalAmount: Money;          // most common amount
  amountVariance: number;          // how much it varies
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'irregular';
  typicalDay?: number;             // 1-31 for monthly, 1-7 for weekly
  firstSeen: Date;
  lastSeen: Date;
  occurrenceCount: number;
  nextExpected?: Date;
  isActive: boolean;
};
```

### `Finding` (insights output)

Already defined in `ARCHITECTURE.md`, repeated here for completeness.

```typescript
type Finding = {
  id: string;
  detectorId: string;              // which insight detector produced this
  severity: 'info' | 'notice' | 'warning' | 'alert';
  title: string;
  narrative: string;               // 2-3 sentences
  numericImpact?: Money;           // annualized impact
  recommendation?: string;
  evidence: TransactionRef[];
  confidence: number;
  generatedAt: Date;
  dismissedAt?: Date;              // user said "got it, stop showing"
};
```

## Relationships (entity graph)

```
User ──┬── Account (1:N)
       │      └── Statement (1:N)
       │              └── RawTransaction (1:N)
       │                      └── Transaction (N:1, after merge)
       │                              ├── Merchant (N:1)
       │                              ├── MatchCandidate (N:M)
       │                              └── RecurrencePattern (N:1 optional)
       ├── Finding (1:N)
       └── UserCategoryRule (1:N)
```

## Invariants

These must hold after any operation. Add assertions, not just tests.

1. **Raw data is immutable.** Once a `RawTransaction` is created, it's read-only. Corrections happen at the `Transaction` layer via overrides.

2. **Every `Transaction` traces back to ≥1 `RawTransaction`.** No synthesized transactions. (Even "opening balance" is a raw row.)

3. **Sum of `direction='expense'` transactions over period = user's expense total.** If this disagrees with statement totals after reconciliation, there's a bug.

4. **Internal transfers and credit card payments net to zero** when computing "money gone forever."

5. **Amount is always positive.** Sign comes from `direction`, not from `amount.paise`.

6. **Dates are stored in UTC.** UI displays in user's timezone (always Asia/Kolkata for Indian users).

7. **Money values never use floating point.** Ever. Enforce via typechecker and `Money` constructor.

## Migration principles

- Never rename columns
- Never change types (add new column with new type, deprecate old)
- Never delete user data automatically — only via explicit user action
- Every schema version bump has a forward migration AND a rollback migration
- Test migrations against real fixture databases before releasing

## Indexing strategy

Performance-critical queries:
- Transactions by date range: `INDEX (date, direction)`
- Transactions by merchant: `INDEX (merchantId, date)`
- Transactions by category: `INDEX (category, date)`
- Search transactions by description: `FTS5` virtual table

Parse time indexes on `Statement.fileHash` (unique) to prevent duplicate imports.

## Export format

Users can export their data as:
- **CSV**: one row per canonical Transaction
- **JSON**: full graph including RawTransactions and MatchCandidates
- **Encrypted backup**: SQLCipher DB file directly

Import from JSON round-trip must be lossless.
