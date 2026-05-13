# RECONCILIATION.md — The Deduplication Algorithm

This is the hardest and most important module in the app. Get it wrong, and users see their spending totals doubled. Get it right, and this is the differentiator — no other Indian finance app does this well.

## The core problem

A single real-world transaction appears in multiple statements:

**Example:** User buys ₹500 worth of food via Swiggy, paid via PhonePe UPI from ICICI savings.

This transaction shows up in:

1. **PhonePe statement**: `Paid to Swiggy — Debit INR 500.00`
2. **ICICI savings statement**: `UPI/SWIGGY/xyz@paytm/payment on/ICIC/ref123/...` — Withdrawal 500.00

These are the **same transaction**. If we count both, user sees ₹1,000 spent. Wrong.

**Second example:** User pays credit card bill of ₹10,000.

1. **ICICI savings statement**: `UPI/CRED Club/cred.club@axis/payment on/...` — Withdrawal 10,000
2. **ICICI credit card statement**: `BBPS Payment received` — credit of 10,000

Again: one economic event, two statement entries. Must be linked; neither counted as "expense."

## The hierarchy principle

When the same transaction appears in multiple sources, treat:

- **Bank statement as the source of truth** (most reliable, complete)
- **Credit card/UPI/wallet as the enrichment** (richer merchant info)

The canonical `Transaction` preserves:
- Bank's date and amount (authoritative)
- Card/UPI's merchant description (more useful)
- A list of ALL source `RawTransaction` IDs (for audit)

## Match types and detection

### 1. Bank UPI ↔ PhonePe/GPay/Paytm

The most common match. Same money, two records.

**Signals (in order of reliability):**

1. **UPI reference number match** — the gold standard. Every UPI transaction has a UTR (Unique Transaction Reference). If both records expose it, direct match.
   - PhonePe field: `UTR No : 209146404552`
   - Bank statement field: embedded in description or separate column
   - **If UTR matches → confidence 1.0, auto-merge**

2. **Date + amount + UPI handle match**
   - Same date (calendar day in IST)
   - Same amount (to the paise)
   - UPI handle fragment matches (e.g., `swiggy` appears in both)
   - → confidence 0.95, auto-merge

3. **Date + amount only**
   - Same date and amount but no UPI match
   - Risky — user may have 2 legit ₹500 transactions on same day
   - → confidence 0.7, user review

4. **Date range ± 1 day + amount**
   - Accounts for slight delay between PhonePe and bank posting
   - → confidence 0.6, user review

### 2. Bank outflow ↔ Credit card payment

Bank sends money out → Credit card receives it.

**Signals:**

1. **Direct NEFT to card** — description contains card account number's last 4 digits
   - → confidence 0.98

2. **BBPS payment pattern**
   - Bank description: `UPI/[bank] Credit Card/...` or contains `BBPS`
   - Card statement: `BBPS Payment received` of same amount
   - Date proximity: within 3 business days (BBPS has settlement lag)
   - → confidence 0.9

3. **CRED payment (multi-card complication)**
   - Bank: `UPI/CRED Club/cred.club@axis/payment on/...`
   - Card: `BBPS Payment received` — but CRED may pay MULTIPLE cards from one bank transaction
   - Matching: if bank amount = sum of card BBPS credits within 3-day window and the card BBPS amounts don't match any other bank transaction → group match
   - → confidence 0.8 (group match is less certain)

4. **PayZapp, Paytm Postpaid, other aggregators**
   - Similar to CRED
   - Same logic

### 3. Self-transfers between user's own accounts

Money moves from User's account A to User's account B. NOT an expense.

**Signals:**

1. **Same phone number on both sides of UPI** — user's UPI handle on their own phone
   - Bank A description: `UPI/{user name}/{phone}@ybl/...`
   - Bank B description: `UPI/{user name}/{phone}@{different provider}/...`
   - → confidence 0.98

2. **IMPS with account masked but pattern matches**
   - `MMT/IMPS/ref123/IMPS/XXXXXX1234/Canara Bank` — the XXXXXX1234 is user's Canara account
   - If user has registered XXXXXX1234 as their own account → confidence 1.0, auto-merge
   - If not → confidence 0.6, user review (prompt: "Is this your own account?")

3. **NEFT/IMPS to self-beneficiary** — user may have set themselves as a beneficiary
   - Difficult to detect automatically; rely on user confirmation

### 4. Duplicate statement import

User uploads the same statement twice.

**Signals:**

1. **File hash match** — exact same file bytes → auto-reject import, notify user
2. **Statement metadata match** — same source + accountIdentifier + period → prompt user ("Already imported. Replace? Add as new?")

### 5. Refund ↔ Original transaction

Refunds reverse earlier spending.

**Signals:**

1. **Same merchant, opposite direction, amount match or sub-amount, date within 30 days**
   - Confidence depends on amount match exactness
   - Exact amount reversal + same merchant → 0.9
   - Partial refund (60-99% of original) → 0.7

2. **Card statement: negative amount with matching ref pattern**
   - Bank returns credit within a few days

## Algorithm: staged matching passes

Process in order. Each pass only considers transactions not yet matched by earlier passes.

```typescript
async function reconcile(rawTransactions: RawTransaction[]): Promise<ReconciliationResult> {
  const state = new ReconciliationState(rawTransactions);
  
  // Pass 1: duplicate imports (obvious dupes)
  await detectDuplicateImports(state);
  
  // Pass 2: UTR-matched UPI (highest confidence)
  await matchByUTR(state);
  
  // Pass 3: Credit card payments (bank ↔ card)
  await matchCreditCardPayments(state);
  
  // Pass 4: Self-transfers (exclude from income/expense)
  await detectSelfTransfers(state);
  
  // Pass 5: UPI by (date + amount + handle)
  await matchByDateAmountHandle(state);
  
  // Pass 6: Investment detection (flag, don't match)
  await detectInvestments(state);
  
  // Pass 7: EMI grouping (principal + interest → single EMI transaction)
  await groupEMIComponents(state);
  
  // Pass 8: Refund matching
  await matchRefunds(state);
  
  // Pass 9: Produce canonical transactions from matched groups
  const canonicalTransactions = produceCanonical(state);
  
  return {
    canonical: canonicalTransactions,
    pendingReview: state.pendingReview,
    unmatched: state.unmatched,
    statistics: state.stats,
  };
}
```

Each pass emits `MatchCandidate` records. Candidates are resolved based on confidence:

- **≥ 0.95**: auto-merge
- **0.7–0.94**: user review queue
- **< 0.7**: don't merge (treat as separate transactions)

## Conflict resolution

What if Pass 2 matches A↔B with confidence 0.96, and Pass 5 matches A↔C with confidence 0.92?

Rule: **first match wins if confidence ≥ 0.95**, else highest confidence wins. Always log competing matches for debugging.

What if Pass 2 matches A↔B AND A↔C both with confidence ≥ 0.95 (impossible in theory, but data quality...)?

→ Send all three to user review. Never silently pick one.

## User review queue

For every pending match, show:

- The two (or more) transactions side-by-side
- The reasoning ("Matched because amount is exact, dates are 1 day apart, both contain 'swiggy'")
- The rule that fired
- Buttons: "Yes, these are the same" / "No, keep separate" / "I'm not sure, skip for now"

User decisions are logged. The matcher LEARNS from decisions — if user consistently rejects "date ± 2 day" matches, that rule's weight drops for this user.

## Self-transfer registration

When user adds an account, also collect:
- **Their UPI handle(s)** — e.g., `9847770588@ybl`, `9847770588@paytm`
- **Their other account numbers (last 4)** — user can add these to enable matching
- **Their phone number(s)**

This registration makes self-transfer detection accurate. Without it, we flag every unknown-recipient transfer as a candidate self-transfer, wasting user time.

## Edge cases (actual real-world confusion)

### Case 1: "Payment via CRED pays 3 cards"

User has ₹50,000 CRED payment. Bank shows one outflow: ₹50,000 to CRED. Card A shows BBPS +₹15,000, Card B shows +₹22,000, Card C shows +₹13,000.

Algorithm:
- Detect bank ↔ multiple card candidates
- Check if sum of card amounts (15+22+13 = 50) matches bank amount ✓
- Check if all within 3-day window ✓
- Create a single `credit_card_payment` canonical transaction with ALL four source records
- Set `isCreditCardPayment = true` on each underlying raw record

### Case 2: "INDmoney SIP split across platforms"

User's ₹45,000 "monthly SIP" is actually:
- ₹20,000 directly to INDmoney
- ₹6,104 via PayU (FINZOOM IN)
- ₹19,000 to Mrs. Thakur (NOT an investment — it's rent! user's landlady)

Algorithm:
- Merchant resolution correctly identifies INDmoney and FINZOOM IN as investment platforms
- Mrs. Thakur is an individual — flag for user categorization
- User classifies as "Housing: Rent" — remembered for future
- True monthly investment: ₹26,104, not ₹45,000

### Case 3: "UPI from one bank shows up twice in same statement"

Some banks post UPI entries on both the value date and the effective date (weekends, holidays). Same ref number, same amount, different dates.

Algorithm:
- Detect duplicate UTR/ref within same account
- Choose later date as canonical, drop earlier (usually a posting artifact)
- Note in audit: "De-duplicated intra-account duplicate"

### Case 4: "Refund split into multiple instalments"

User returns ₹10,000 purchase. Refund comes back as ₹6,000 one week, ₹4,000 next week.

Algorithm:
- Single-refund match fails
- Sub-amount refund detection: find all credits from same merchant within 45 days whose sum equals earlier debit
- Confidence: 0.75 (needs user verification)

### Case 5: "EMI interest and principal on separate lines"

Already covered in parser. Ensure reconciliation engine knows these are pre-grouped by parser, not to be re-matched.

### Case 6: "Cash withdrawn from ATM"

No merchant, no UPI ref. Just a debit. Becomes "untracked cash."

Algorithm:
- Cannot match to anything downstream — cash spending is invisible
- Mark as `direction: cash_withdrawal`
- Show user a running "cash available" estimate based on withdrawals minus any obvious cash expenses (not common)
- Don't panic; just flag in the ledger

### Case 7: "Foreign transaction in INR + foreign currency"

A single international transaction has multiple components:
- Base INR charge
- DCC fee
- IGST on DCC fee
- Forex markup fee
- IGST on markup

All on the same date, same merchant. Algorithm groups them into a single canonical transaction with amount = sum of all components, and stores the breakdown in metadata.

### Case 8: "P2P transfer that's actually income"

User paid ₹10,000 to a friend (lending). Later, friend returns ₹10,000.

Algorithm:
- Sent transaction: `direction = transfer_other`
- Received transaction: also `direction = transfer_other` initially
- Suggest to user: "We noticed you sent ₹10,000 to X on Jan 5 and received ₹10,000 from X on Jan 20. Is this a lending round-trip?"
- If yes: both get flagged as `isInternalTransfer = true`, excluded from income/expense

## Audit trail requirements

Every merge operation stores:

```typescript
{
  mergeId: uuid,
  mergedAt: timestamp,
  sourceTransactionIds: [raw_id_1, raw_id_2, ...],
  canonicalTransactionId: canonical_id,
  matchType: 'bank_upi_to_phonepe',
  rulesFired: ['utr_exact_match', 'amount_exact_match'],
  confidence: 0.98,
  autoMerged: true,
  userConfirmed: false,
  reasoning: 'UTR 209146404552 matches in both sources'
}
```

User can always "unmerge" — the operation is reversible.

## Learning from user corrections

When user:

- **Rejects an auto-merge**: increase that rule's false-positive score
- **Confirms a low-confidence match**: increase that rule's true-positive score  
- **Manually merges two unmatched transactions**: learn the pattern

After 50+ corrections, offer to retrain: "You've overridden the matcher 50 times. We can update your personal matching preferences. Review?"

Global rules are never changed by user data — only the user's personal weights. (Future version: opt-in, anonymized rule improvement crowdsourcing.)

## Testing requirements

The reconciliation engine is the highest-risk module. Test with:

- **Golden datasets**: hand-verified multi-source datasets where every transaction's "correct" classification is known
- **Synthetic adversarial tests**: generate 2 transactions on same date, same amount, different merchants (should NOT auto-merge)
- **Real user data (with consent)**: run on actual statements and check totals against user's known monthly spending

**Every real-world miss-match becomes a test case.** Keep the test suite fat.

## Monitoring

In-app debug panel shows:
- Total raw transactions: X
- Canonical transactions after recon: Y (should be < X)
- Dedup ratio: Y/X (typical: 0.6–0.8 for users with bank + card + UPI overlap)
- Auto-merged: A
- User-reviewed: B
- Unmatched: C

If dedup ratio is ~1.0, engine isn't matching anything — investigate. If it's < 0.3, engine is matching too aggressively — investigate.
