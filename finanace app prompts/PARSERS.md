# PARSERS.md — Statement Parsing Strategies

This is the messy, practical reality of parsing Indian financial statements. Each source has quirks. Parsers must be source-specific; generic parsers fail silently.

## General approach

Every parser follows this skeleton:

```typescript
async function parse(file: UploadedFile): Promise<ParseResult> {
  // 1. Fingerprint: confirm this is the expected format
  const fingerprint = await detectFingerprint(file);
  if (!fingerprint.matches) {
    return { error: 'Format mismatch', details: fingerprint.reason };
  }
  
  // 2. Extract: get the raw text/table data
  const raw = await extractContent(file);
  
  // 3. Locate: find transaction sections
  const sections = findTransactionSections(raw);
  
  // 4. Parse rows: per-row extraction with per-row confidence
  const rows = sections.flatMap(s => parseRows(s));
  
  // 5. Reconcile: verify opening + sum(credits) - sum(debits) = closing
  const reconciliation = verifyInternalConsistency(rows);
  
  // 6. Return: with all warnings and unparsed lines preserved
  return { transactions: rows, warnings, unparsedContent, reconciliation };
}
```

The **step 5 reconciliation check** is critical. If the parser produces rows whose math doesn't match the statement's summary, the parser is wrong — don't ship wrong numbers.

## ICICI Savings Account (reference implementation)

### Fingerprint
- First page contains: `"Statement of Transactions in Saving Account"`
- Account number pattern: `\d{12}` near the top
- Table header: `S No. | Transaction Date | Cheque Number | Transaction Remarks | Withdrawal | Deposit | Balance`

### Date format
- `DD.MM.YYYY` (NOT DD/MM or DD-MM)
- Example: `23.03.2026`

### Extraction strategy
1. Use `pdfplumber.extract_tables()` with these settings:
   ```python
   {"vertical_strategy": "lines", "horizontal_strategy": "lines", "intersection_x_tolerance": 8}
   ```
2. The table header is usually on page 1 only. Subsequent pages repeat data without header.
3. Multi-page statements: concatenate tables, maintain S No. continuity as a sanity check.

### Row structure
```
S No. | Date | [Cheque Number] | Remarks | Withdrawal | Deposit | Balance
```

Columns 4-6 are ALL floating point with comma thousands separators: `1,23,456.78` (Indian format) or `123,456.78`.

### Gotchas

**Wrapped remarks.** Long UPI descriptions wrap across 3-4 sub-rows within one S.No. row. The table extractor sometimes returns these as separate rows. Detection: row has date AND remarks but no amount. Solution: merge with next row by S.No.

**Ambiguous direction.** Only one of Withdrawal or Deposit is populated per row. If both are empty, it's a parse error, not a zero-rupee transaction.

**Legends page.** Last page is usually a legend (what UPI, NEFT, etc. mean). Skip pages that don't contain transaction rows.

**Opening balance.** Not always a row; often in header text as `"Opening Balance: ₹X"`. Extract separately.

**Interest paid rows.** `"195301502974:Int.Pd:31-12-2025 to 29-03-2026"` — this is income, direction=income, category=interest_earned.

**Debit card annual fee.** `"DCardfee0215MAR26-FEB27+GST"` — once-a-year charge, easy to miss. Category=fees_charges.

**NEFT salary pattern.** `"NEFT-{ref}-{EMPLOYER NAME}-{purpose}-{account}-{bank}"`. The employer name is between ref and purpose. Extract it for merchant resolution.

### Confidence scoring
- Table extraction clean + balance reconciles: 1.0
- Table extraction with 1-2 wrapped rows: 0.9
- Some rows had to be heuristically joined: 0.8
- Balance doesn't match (within ₹1): 0.7 (warn user)
- Balance off by >₹1: 0.3 (fail loud)

## ICICI Credit Card (Amazon Pay, Sapphiro, Emeralde variants)

### Fingerprint
- Contains: `"CREDIT CARD E-STATEMENT"` and `"ICICI Bank Credit Cards"`
- Card number pattern: `\d{4} XXXX XXXX \d{4}`

### Date format
- `DD-MMM-YY` (example: `13-OCT-23`)

### Structure
- Multiple "TRANSACTION DETAILS" sections if user has multiple cards on one statement
- Each section starts with `Card Number : XXXX XXXX XXXX XXXX`
- Rows: `Date | Ref. Number | Transaction Details | Currency | International amount | Amount(in ₹)`

### Extraction strategy
- Same pdfplumber approach as savings, BUT the statement summary (total outstanding, minimum due, payment due date) is on a different page and uses a different layout.
- Parse the statement summary separately — it's critical for understanding whether user is paying in full.

### Gotchas

**Multi-card statements.** User can have 3+ cards on one statement (we saw this: `4035 XXXX XXXX 6006`, `5241 XXXX XXXX 9000`, `3747 XXXX XXXX 001`). Each section needs separate account mapping. The `accountIdentifier` in RawTransaction must be the last-4 of the SPECIFIC card, not the user's primary card.

**EMI amortization entries.** 
```
08-MAR-26 Principal Amount Amortization - <4/6> AMPLE TECHNOLOGIES 0.00 11,196.77
08-MAR-26 Interest Amount Amortization - <4/6> AMPLE TECHNOLOGIES 0.00 453.58
```
These are EMI installments. Must be detected and grouped — they're one economic transaction (EMI payment) split into principal + interest for accounting. Group by ref number or date+merchant.

**Fuel surcharge waivers.** `"Fuel Trxn Off us"` with negative amount is a WAIVER credit, not a fuel purchase. Direction=refund or flag as fee_reversal.

**GST line items.** `"IGST-CI@18% 0.00 90.00"` is GST on a fee. Must be linked to the preceding fee transaction (they share the same date and are consecutive). Alternative: fold GST into the parent transaction amount.

**BBPS Payment received.** This is a PAYMENT to the card, i.e., a credit that reduces the balance. Direction should be `credit_card_payment` when matched with a bank outflow, otherwise `refund` (meaning: money received into card account).

**International transactions.**
```
16-JAN-25 P59PAH71145YV400000000X Planet Taxfree VAT Refund Galway, Irela IE* EUR 62.91 -5,391.21
```
- Currency column has 3-letter ISO code
- International amount column shows foreign currency
- Amount column shows INR equivalent
- `IE*` or similar suffix means VAT refund
- DCC fee and markup fee are separate line items appearing shortly after

**Statement period vs transaction period.** Don't assume all transactions in the PDF fall within the header's statement period. Check each date.

### Confidence scoring
Same as savings. Additionally:
- If EMI amortization entries don't come in principal+interest pairs: 0.7 (something's off)

## HDFC Savings Account

### Fingerprint
- Contains: `"Statement of Account"` and HDFC logo reference
- Account number: `\d{14}` (14 digits, different from ICICI)

### Date format
- `DD/MM/YY` — TWO-digit year (error prone, assume 2000s)

### Structure
Similar to ICICI but:
- Description field wraps more aggressively
- Balance column sometimes has `Cr`/`Dr` suffix
- Opening balance is explicitly labeled as a first row with description `"B/F"` (Brought Forward)

### Gotchas

**The `Cr`/`Dr` suffix.** `1,23,456.78 Cr` means credit balance. `1,000.00 Dr` means debit (overdrawn). Parse the suffix.

**HDFC's UPI descriptions.** Often end in `@hdfcbank` for internal transfers. Multiple consecutive UPI txns on the same date may share a reference pattern — group for dedup purposes.

**Interest on savings.** Posted as `"Int. Paid Till DD/MM/YY"` — income, interest_earned category.

## SBI Savings (hard mode)

Layout varies by:
- Account type (Basic, Regular, Premium)
- Rural vs urban branch
- Whether statement was generated from branch or YONO app

Start with the "YONO-generated PDF" format as the primary. Escalate to OCR for branch-generated (often scanned).

### Fingerprint
- Contains: `"STATE BANK OF INDIA"` or `"SBI"`
- Sometimes contains: `"YONO"` header

### Gotchas

**Scanned statements.** Many SBI branch-generated PDFs are images with no text layer. Detection: `pdf.pages[0].extract_text()` returns empty/short. Solution: rasterize + Tesseract OCR. Warn user of reduced accuracy.

**Inconsistent columns.** Sometimes Date | Txn Posting Date | Description | Debit | Credit | Balance. Other times Date | Description | Amount | Balance (with amount signed).

**Narration wrapping.** SBI truncates descriptions at ~45 chars then wraps. Re-join wrapped lines.

## PhonePe text export

### Fingerprint
- First line: `"Transaction Statement for +91XXXXXXXXXX"`
- Date range line follows

### Structure
Each transaction is a 5-6 line block:
```
Apr 01, 2022
05:01 PM
Paid to Bay Fruit
Transaction ID : T2204011701188911675988
UTR No : 209146404552
Debited from XX1880
Debit INR 95.00
```

### Extraction strategy
State machine parser, not line-by-line regex. Walk through lines tracking what we expect next.

### Gotchas

**Missing UTR.** Wallet-to-wallet (PhonePe wallet, not bank) transactions don't have UTRs. Skip that field gracefully.

**Failed transactions.** `"Failed"` or `"Payment failed"` in description — direction is still debit but mark as failed; exclude from analysis.

**Received from.** `"Received from X"` — direction=credit.

**Multi-word amounts.** `"Debit INR 1,23,456.78"` or `"Debit INR 95.00"` — parse carefully; Indian number format may apply.

**Time zone.** Always IST. Store as UTC internally (subtract 5:30 hours).

**Account identifier.** `"Debited from XX1880"` — the last 4 digits of bank account. Use as accountIdentifier hint.

## Google Pay export (when available)

Google Pay doesn't expose a native export. Users can:
1. Request a "Google Takeout" data dump — comes as JSON/CSV
2. Screenshot and OCR (terrible, avoid)
3. SMS parsing (requires permissions; not our approach for local-first)

Support Takeout JSON when user provides it:

### Structure
```json
{
  "transactions": [
    {
      "timestamp": "2024-03-15T14:30:00Z",
      "type": "sent",
      "amount": {"amountMicros": "50000000000", "currencyCode": "INR"},
      "counterparty": "Merchant Name",
      "note": "Optional user note",
      "upiTransactionId": "..."
    }
  ]
}
```

### Gotchas

**`amountMicros`** — divide by 1,000,000 for rupees.

**No category info.** Google Pay doesn't categorize — it's all up to us.

## Paytm

PDF export from Paytm app. Tabular, similar to PhonePe but more compact. 

### Gotchas

**Paytm Wallet ≠ Paytm Bank ≠ Paytm UPI.** Three different sources, three different transaction flows. User may have entries from multiple. Handle each as a separate statement source.

**Merchant name truncation.** Paytm truncates merchant names at ~25 chars, often making different merchants look the same. Use UPI handle as tie-breaker.

## Password-protected PDFs

Many banks send password-protected statements. Standard password patterns:

- **ICICI**: Usually the first 4 letters of customer name (uppercase) + date of birth in DDMM format
- **HDFC**: First 4 of customer name (lowercase) + DDMM of DOB
- **SBI**: Often just the account number, or customer ID
- **Axis**: Customer ID + date of birth
- **Kotak**: Customer ID in lowercase
- **Amex**: Date of birth (DDMMYY) + last 5 digits of card number

**Never store passwords.** If user provides password, use it for this session only, then discard. The decrypted PDF in memory is never written to disk.

## Recommended libraries

### JavaScript (for in-app parsing, preferred)
- `pdf-parse` — simple, fast, works for clean text PDFs
- `pdfjs-dist` — heavier but handles more formats
- No JS equivalent of pdfplumber exists; for table extraction on complex PDFs, fall back to WASM

### Python via WASM (for complex cases)
- `pdfplumber` compiled to WASM via Pyodide — slow (3-5s load time) but handles the weird cases
- Run in a Web Worker to avoid blocking UI
- Only load on first tough PDF encountered

### OCR (last resort)
- `tesseract.js` for client-side OCR
- Slow (~10s per page), but works for scanned statements
- Always warn user about reduced accuracy

## Failure escalation

If parser confidence < 0.8:
1. Show warnings to user explicitly
2. Offer manual editing of parse results before import
3. Prompt user to optionally submit (redacted) sample to improve parser

If parser hard-fails:
1. Show the exact PDF page where parsing broke
2. Offer "enter totals manually" fallback so user isn't blocked
3. Log (locally) what went wrong; user can opt-in to share with us to fix

## Testing requirements

For each parser, maintain test fixtures:
- `tests/fixtures/{source}/happy_path.pdf` — typical statement
- `tests/fixtures/{source}/edge_cases/` — every known edge case
- `tests/fixtures/{source}/expected/` — expected output JSON

**Every real-world parser failure becomes a fixture + test.** Never fix a parser without a failing test first.
