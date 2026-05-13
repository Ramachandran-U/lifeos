# CONTEXT.md — Indian Financial Ecosystem

Claude Code is built on Western fintech assumptions. This document forces it to think Indian. Read this first for any task touching parsers, categorization, or insights.

## Statement formats you will encounter

| Source | Format | Parsing difficulty | Notes |
|--------|--------|---------------------|-------|
| ICICI savings (PDF) | Tabular, consistent | Easy | Has UTR, ref numbers, clean merchant strings |
| HDFC savings (PDF) | Multi-line entries | Medium | Transaction wraps across 2-3 lines |
| SBI savings (PDF) | Inconsistent | Hard | Different layouts for different account types |
| Axis savings (PDF) | Password-protected | Medium | User provides password; format is clean once unlocked |
| Kotak savings (PDF) | Column-based | Medium | Numeric columns sometimes merge |
| ICICI credit card (PDF) | Clean tabular | Easy | Identical format across card types (Amazon Pay, Sapphiro, Emeralde) |
| HDFC credit card (PDF) | Clean tabular | Easy | Similar to ICICI, different column order |
| SBI credit card (PDF) | Image-heavy | Hard | Often needs OCR, not text extraction |
| Amex (PDF) | Simple | Easy | Very clean, but different merchant description style |
| PhonePe export (TXT) | Line-based | Easy | Each transaction spans 5-6 lines in predictable pattern |
| Google Pay export (CSV) | CSV | Easy | When user can get it (G Pay doesn't expose export easily) |
| Paytm export (PDF) | Tabular | Medium | Merchant names often truncated |
| BHIM/other UPI | Varied | Hard | Smaller wallets, custom formats |

**Never assume format.** Every parser must detect its input and fail loudly if it doesn't match expected signature.

## Key merchant name patterns (must be categorized correctly)

### Payment aggregators that obscure real merchants
These prefixes hide the actual merchant. The parser must strip them AND look up the real merchant when possible.

- `RAZ*` or `RAZ ` → Razorpay (strip and look at what follows: `RAZ*Swiggy` = Swiggy)
- `PayU` or `PAYUS` → PayU (same as above)
- `CCAvenue` / `CCAVE` → CCAvenue
- `Cashfree` / `CASH*` → Cashfree Payments
- `IND*` → ICICI's own payment processor (common on Amazon)
- `BILLD*` → BillDesk
- `MOBI*` → MobiKwik payments

### UPI handle patterns
- `name@ybl` → PhonePe-registered UPI
- `name@paytm` → Paytm
- `name@okhdfcbank` / `@oksbi` / `@okaxis` → Google Pay on respective bank
- `name@apl` → Amazon Pay UPI
- `merchantname.rzp@hdfcbank` → Merchant collecting via Razorpay
- `name@axis` / `@axl` → Axis Bank UPI

### Food delivery (always miscategorized as "services" by naive parsers)
- `SWIGGY` / `Bundl Technologies` (parent company) → Food delivery
- `SWIGGY INSTAMART` → Groceries (NOT food — different budget!)
- `ZOMATO` → Food delivery
- `ZEPTO` → Groceries
- `BLINKIT` / `GROFERS` → Groceries
- `BIGBASKET` / `BB NOW` → Groceries
- `DUNZO` → Could be either; use amount heuristic

### Transportation
- `UBER` / `UBER INDIA SYSTEMS` → Ride-hailing
- `OLA` / `ANI TECHNOLOGIES` → Ride-hailing
- `RAPIDO` / `ROPPEN TRANSPORTATION` → Bike-taxi
- `REDBUS` / `PHPREDBUS` → Bus booking
- `IRCTC` → Train booking
- `INDIGO` / `6E` / `VISTARA` / `AIR INDIA` / `SPICEJET` → Flights
- `Fuel Trxn` with negative amount → Fuel surcharge waiver (not an expense — flag as cashback/credit)

### Credit card payments (critical — must NOT count as expenses)
These appear on bank statements but are internal money movement, not spending:
- `BBPS` + credit card number → Credit card bill payment
- `CRED CLUB` / `cred.club@axis` → Payment via CRED app (may cover multiple cards)
- `PayZapp` → HDFC's payment app
- `NEFT to [bank] Credit Card` → Direct credit card payment
- `Visa CC Payment` → Credit card payment
- `EURONET` transactions are often ATM withdrawals or forex loading, NOT credit card payments

**Critical rule**: bank outflow to a credit card must be matched against credit card BBPS/payment-received entry and deduplicated. Never count both.

### Investment platforms (must NOT count as expenses)
These are wealth transfers, not consumption. Track separately.
- `INDmoney` / `FINZOOM IN` / `indmoney3.payu` → INDmoney MF investments
- `Zerodha` / `zerodha.bro@hdfcbank` → Zerodha equity/MF
- `Groww` / `NEXTBILLION` → Groww investments
- `Upstox` / `upstoxsec20.rzp` → Upstox
- `Kuvera` → Kuvera MF
- `ET Money` → ET Money
- `Paytm Money` → Paytm Money
- `HDFC MF` / `SBI MF` / `ICICI MF` etc. → Direct AMC SIPs
- `ACH D-NACH-XX AMC` patterns → SIP auto-debits
- `SGB` suffix → Sovereign Gold Bond purchase

### Rent and recurring commitments (must be identified to compute true discretionary)
- Monthly same-day same-amount to individual name → Likely rent
- `NOBROKER` → Rental brokerage (one-off)
- `MagicBricks` / `99acres` → Rental/property search
- `Housing.com` → Same
- Any same-amount NEFT on 1st-5th of month to individual → Rent candidate

### EMI and loan indicators
- `ACH D-XXX` with consistent monthly amount → Likely EMI
- `Amortization - <N/M>` in credit card statements → Card-based EMI
- `AMPLE TECHNOLOGIES` in card statement → Apple product EMI
- `Principal Amount` + `Interest Amount` paired → EMI breakdown
- `LNPY` in ICICI statements → Linked loan payment

### Subscription services (often missed in categorization)
- `Adobe Systems Software` → Creative Cloud (₹599/mo typical)
- `AMAZON INDIA CYBS SI` → Amazon Prime (SI = standing instruction)
- `OPENAI` / `ANTHROPIC` → AI subscriptions
- `NETFLIX` / `HOTSTAR` / `PRIMEVIDEO` / `SONYLIV` / `ZEE5` → OTT
- `SPOTIFY` / `YTMUSIC` / `GAANA` → Music
- `Google One` / `APPLE.COM/BILL` → Cloud storage
- `MICROSOFT 365` → Office
- `LINKEDIN` → LinkedIn Premium
- `STEAMGAMES` → Gaming
- `INGDREAMPLUG` → Google Play Store (in India)
- `TATAPLAYFIBER` / `ACT FIBERNET` / `JIO FIBER` / `AIRTEL XSTREAM` → Internet
- `MYJIO` / `Airtel payments` → Telecom

### Travel (often bucketed wrong — has its own heuristic)
- `Booking.com` / `MAKEMYTRIP` / `GOIBIBO` / `YATRA` / `CLEARTRIP` / `EASEMYTRIP` → Travel aggregator
- Hotel names in non-home city → Travel accommodation
- `DCC Fee` → Dynamic Currency Conversion — indicates international transaction
- `MARKUP FEE` / `Intl Markup` → Forex markup — international transaction
- Currency code that's not INR → International

## Transaction legends (bank-specific codes)

ICICI uses these codes in the "Transaction Remarks" field:

| Code | Meaning |
|------|---------|
| NEFT | Inter-bank transfer |
| IMPS / MMT | Immediate Payment Service |
| UPI | Unified Payments Interface |
| BBPS | Bharat Bill Payment (credit card bills, utilities) |
| ACH | Auto-debit via NACH (SIPs, loans, insurance) |
| INFT | Within-ICICI transfer |
| RCHG | Recharge |
| VPS / IPS | Debit card transaction |
| DCardfee | Debit card annual fee (easy to miss — appears once a year) |
| Int.Pd | Interest paid (income — NOT expense) |
| DTAX / IDTX | Direct/Indirect tax |
| CCWD | Cardless cash withdrawal |
| VAT / MAT / NFS | Cash withdrawal at other bank ATM |
| EBA | Transaction on ICICI Direct (trading account) |
| SGB | Sovereign Gold Bond |
| LNPY | Linked loan payment |

Other banks use similar codes. When parser encounters unknown code, show it to user verbatim rather than guessing.

## Amount formats

- Indian statements use: `1,23,456.78` (Indian number system) or `123,456.78` (Western)
- Negative amounts can appear as: `-1234.00`, `1234.00-`, `1234.00 Cr`, or in a separate column
- Credit card statements: positive = expense/charge, negative = payment/refund — BUT this varies by bank, always check the statement header
- Bank statements: typically separate Withdrawal and Deposit columns, but some use signed single column
- Never assume. Always check the statement's column headers on page 1.

## Date formats (all of these are valid Indian statements)

- `DD/MM/YYYY` — most common
- `DD-MM-YYYY` — also common
- `DD-MMM-YY` — credit card statements (13-OCT-23)
- `DD.MM.YYYY` — ICICI savings account
- `DDMMYY` — some legacy formats

Parse with explicit format per source, never "guess". A date ambiguity between DD/MM and MM/DD is a 40% error source.

## GST (tax) on financial services

Anything ending in `+GST` or with a matching `IGST-CI@18%` line item adjacent = fee + GST. Count as a single fee expense, not two separate line items.

Negative GST reversals (`IGST-Rev-CI@18%`) indicate partial refunds — usually on fuel surcharge waivers. These are not income, just fee corrections.

## Phone numbers as identifiers

Indian UPI transactions embed the sender/receiver phone in the reference. Self-transfers across a user's own accounts all use the same phone number. Use this as the PRIMARY self-transfer detection signal.

Example:
- `UPI/U RAMACHAN/9847770588-5@a/Payment fr/HDFC BANK/...` (received)
- `UPI/RAMACHANDR/9847770588@ybl/Payment fr/CANARA BAN/...` (received)

Both use 9847770588 — the user's own phone. These are self-transfers, not income.

## Test fixtures checklist

Before calling any parser complete, test against:
- [ ] Empty statement (no transactions)
- [ ] Single-transaction statement
- [ ] Statement with all withdrawal / all deposit
- [ ] Statement spanning month boundary
- [ ] Statement with UTF-8 characters (names with accents, Hindi text)
- [ ] Statement with merchant names containing commas, asterisks, slashes
- [ ] Password-protected PDF (should prompt user)
- [ ] Scanned PDF with no text layer (should fall back to OCR or fail loudly)
- [ ] Statement where dates wrap (Dec → Jan)
- [ ] Refunds and reversals (negative amounts on credit card, unusual)
- [ ] Fee entries without a ref number
- [ ] Multi-currency line (foreign transaction)

## User trust rules

1. Never delete raw data. Always keep original statements and original extracted fields. User must be able to verify.
2. When categorizing, show the user the rule that fired ("Auto-categorized as 'Food & Dining' because merchant contains 'SWIGGY'").
3. When merging/deduplicating, show the merge reasoning ("Matched bank NEFT ₹61,412 on Mar 31 with credit card BBPS received ₹61,412 on Apr 2 — amount exact, dates within 2 days, same bank").
4. Expose a "debug" view that shows parser confidence scores, match confidence, unparsed lines. For power users.
5. Every summary number should be drillable — tap "Food & Dining ₹3.5L" → see every transaction that rolled up.

## Regulatory notes

- Do not use RBI Account Aggregator framework yet (requires licensing, adds server dependency).
- Do not integrate with Perfios / Finvu / other AA bridges (again, kills local-first).
- Statement import is legally fine — user's own data, user uploads voluntarily, processed on device.
- If we ever add a server component, it must be opt-in and the privacy policy must be drafted by an Indian lawyer familiar with DPDP Act 2023.
