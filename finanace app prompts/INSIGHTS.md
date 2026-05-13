# INSIGHTS.md — What "Intelligent Analysis" Means

Most finance apps show users a pie chart and call it insight. We don't. An insight is a finding the user wouldn't have noticed themselves, expressed as a narrative, backed by evidence, with a numeric impact and an actionable recommendation.

This document specifies each detector. Each lives in `src/insights/detectors/`.

## Detector contract

```typescript
export abstract class InsightDetector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  
  // What data does this detector need?
  abstract readonly requirements: {
    minMonthsOfData: number;
    requiredAccountTypes: AccountType[];
    requiredCategories?: Category[];
  };
  
  // Run the detection
  abstract detect(ctx: InsightContext): Promise<Finding[]>;
  
  // How often should this re-run?
  abstract readonly refreshTrigger: 'on_new_data' | 'monthly' | 'on_demand';
}
```

## Finding severity guide

- `info`: A fact the user should know but isn't a problem. "You earn ₹X. Your biggest merchant is Y."
- `notice`: Something worth attention but not urgent. "Your dining spend rose 40% YoY."
- `warning`: Likely losing money or missing opportunity. "Using wrong credit card for dining."
- `alert`: Immediate action needed. "Duplicate payment detected — ₹5,000 credit balance on card."

Never cry wolf. An `alert` the user can ignore trains them to dismiss all alerts.

## Tier 1 detectors (MVP — must ship)

### `RealIncomeDetector`

**Purpose:** Compute user's actual take-home income from credits pattern, not a user input.

**Algorithm:**
1. Find recurring credits matching salary patterns:
   - Monthly-ish frequency (28-32 day intervals)
   - Amounts within 5% of each other OR monotonically increasing (raises)
   - NEFT with corporate-sounding counterparty
   - Description contains salary indicators: `SAL`, `SALARY`, `PAYROLL`, company name
2. Subtract any refunds/corrections posted by same employer
3. Annualize based on observed months

**Edge cases:**
- Variable income (freelance, bonus-heavy roles)
- Multi-employer (consultants)
- Salary coming into multiple accounts
- Spousal account receiving partner's salary (not user's income)

**Finding example:**
> **Your monthly take-home is ₹1,23,370**
> Based on 12 months of NEFT credits from VEARC Technologies Pvt Ltd. Your income was stable in FY 2024-25. We haven't detected a raise in the past 12 months.

### `FixedCommitmentsDetector`

**Purpose:** Identify every recurring fixed outflow. Rent, EMIs, SIPs, subscriptions, insurance premiums.

**Algorithm:**
1. Group transactions by merchant
2. Within each merchant, find clusters of similar-amount transactions at regular intervals
3. For each cluster, compute:
   - Amount (median)
   - Frequency (monthly/quarterly/annual)
   - Next expected date
   - Category

**Output:** A table of fixed commitments, grouped by category, with total monthly burn.

**Finding example:**
> **Your fixed monthly commitments are ₹86,982**
> That's 70.5% of your take-home. Discretionary budget is ₹36,388/month.
> Breakdown: Rent ₹19,000 · Personal loan EMI ₹11,166 · INDmoney SIP ₹45,604 · Apple EMI ₹11,650 · Subscriptions ₹2,750 · Internet ₹944 (amortized)

### `TrueSavingsRateDetector`

**Purpose:** Savings rate = (investments + net savings account growth) / income. Not just "income minus expenses."

**Algorithm:**
1. Identify all investment outflows over period (INDmoney, Zerodha, AMC SIPs, etc.)
2. Compute change in liquid balance (savings account growth if positive)
3. Subtract any loan repayments (those are past-self's consumption, not today's savings)
4. Divide by total income

**Finding example:**
> **Your savings rate is 28.3%**
> 37% of income goes to investments (₹45,604/month to INDmoney). 9% goes to loan repayment, which isn't savings — it's paying for past consumption. Net wealth-building rate: 28%.

### `MicroSpendLeakDetector`

**Purpose:** Identify death by a thousand cuts — high-frequency small transactions that add up.

**Algorithm:**
1. Count transactions under ₹500 per month
2. Sum their total
3. Compute percentage of total transactions and total spending
4. Flag if >60% of transaction count and <15% of spending → classic micro-spend pattern
5. Bucket by time-of-day to identify impulse windows

**Finding example:**
> **76% of your transactions are under ₹500**
> These 3,685 small transactions sum to ₹2.85 lakhs (9% of spending) but create most of your decision fatigue. Peak micro-spending: 9–10 PM on weekdays (₹45K across evening snack orders).

### `SubscriptionAuditDetector`

**Purpose:** List every recurring digital/service subscription with annual cost.

**Algorithm:**
1. Filter recurrence patterns where merchant type is `subscription_service`
2. For each, project annual cost
3. Detect "dormant" subscriptions (payments continuing but no apparent usage — hard to verify without external data, so just flag them for user review)
4. Compare monthly vs annual plans for known services where annual is cheaper (Amazon Prime, YouTube Premium, etc.)

**Finding example:**
> **You spend ₹33,000/year on 9 subscriptions**
> Amazon Prime (₹599/month → consider annual at ₹1,499 = save ₹5,689/year). Adobe Creative Cloud. ChatGPT Plus. Tata Play Fiber. Steam occasional. Review recommended: which of these do you actively use?

### `CreditCardOptimizationDetector`

**Purpose:** Check if user is using the "wrong" card for each category and quantify lost rewards.

**Algorithm:**
1. For each card, derive its reward profile from a static config (we maintain rules for major Indian cards)
2. For each transaction, compute reward earned (actual) vs reward if on best card (optimal)
3. Sum the gap

**Config example:**
```typescript
const cardProfiles = {
  'amazon_pay_icici': {
    rewards: {
      'amazon_purchase': 0.05,  // 5% on Amazon
      'default': 0.01,          // 1% elsewhere
    }
  },
  'hdfc_regalia': {
    rewards: {
      'dining': 0.04,
      'travel': 0.04,
      'default': 0.01,
    }
  },
  // ... 15-20 major cards
};
```

**Finding example:**
> **You're leaving ~₹28,000/year in unclaimed rewards**
> Using Amazon Pay ICICI (1% default) instead of Sapphiro (4% on dining) for 45% of your dining spend costs ₹12,400/year. Using Sapphiro instead of Amazon Pay for Amazon purchases costs another ₹15,600/year. Swap the default cards.

### `LifestyleInflationDetector`

**Purpose:** Identify whether user's spending is growing faster than income.

**Algorithm:**
1. For each year with ≥10 months of data, compute:
   - Income
   - Discretionary spending (excl. rent, EMI, SIP, taxes)
2. Compute year-over-year growth rate for each
3. Flag if spending_growth > income_growth by more than 5 percentage points

**Finding example:**
> **Your lifestyle inflated faster than income in 2024-25**
> Income grew 8% YoY (₹X → ₹Y). Discretionary spending grew 23% YoY (₹A → ₹B). Primary drivers: dining (+45%), travel (+67%). Flag this as a watchpoint.

### `DuplicatePaymentDetector`

**Purpose:** Find accidental duplicate credit card payments that sit as unused credit balance.

**Algorithm:**
1. Scan bank outflows to credit cards
2. For each card, find pairs of payments with:
   - Same or near-same amount (within ₹5)
   - Within 7 days of each other
3. Cross-reference with card statement to check if only one was "needed" (i.e., matched the statement total)

**Finding example:**
> **Potential duplicate payment: ₹27,112 sent twice to Sapphiro card**
> Payment 1: Jan 24, 2025, ₹27,112.06. Payment 2: Jan 29, 2025, ₹27,112.06. Total outstanding on Jan 23 statement was ₹27,112. Check your card for unused credit balance — you may have ₹27,112 sitting there unclaimed.

## Tier 2 detectors (v1.1)

### `PeakSpendingBehaviorDetector`
When do you spend most? Hour of day, day of week, correlation with weather/events.

### `MerchantConsolidationDetector`
"You ordered from Swiggy 45 times and Zomato 3 times. You're a Swiggy monopoly user — Zomato Gold could save you nothing. Don't pay for the subscription."

### `EmergencyFundDetector`
Compute: (liquid savings) / (monthly fixed + discretionary). Flag if < 6 months.

### `CashFlowProjectionDetector`
Based on patterns, project next month's closing balance. Flag cash crunch 30 days ahead.

### `TaxLiabilityEstimator`
Based on visible income, compute approximate tax slab and advance tax dates. Flag if no advance tax payments detected but income suggests need.

### `InvestmentDiversificationDetector`
If user's investments are visible via AMC auto-debits, check allocation balance (equity vs debt vs gold). Flag over-concentration.

### `RecurringUnknownDetector`
Flag things that look recurring but aren't categorized. "You have an ACH of ₹11,166 every month that's uncategorized. What is this?"

### `HiddenTravelBurstDetector`
Detect travel based on merchant patterns (hotels + flights + fuel in non-home city). Compute total trip cost (including forgotten expenses).

### `RelationshipFinancialFlowDetector`
Detect consistent bidirectional money flow with one individual. "You transferred ₹93K to Anjali and received ₹45K back over 21 months. Net: you're owed ₹48K. Is this intentional?"

### `SeasonalAnomalyDetector`
Detect unusual spending patterns. "November 2024 spending was 260% of your 12-month average. Main drivers: Amazon (₹75K), travel (₹42K). Was this planned?"

## Tier 3 detectors (v1.2+)

### `PartnerFinanceDetector`
If user has a partner and their finances overlap, detect joint accounts, shared expenses, and net financial flow. Helps couples understand their shared picture.

### `CareerSpendingStageDetector`
Compare user's spending profile to age + income cohort. "You're saving 28% at age 30 earning ₹15L — that's the 67th percentile. Industry peers save 22%."

### `RetirementTrajectoryDetector`
Project current savings + SIP forward using historical market returns. Show required vs current path.

### `BehavioralRegressionDetector`
When a user's discipline slips. "You maintained ₹45K/month SIP for 6 months, then paused 3 months. Restart?"

### `FriendGroupComparatorDetector` (opt-in only)
Aggregate anonymized insights across users who opt-in. "Your dining spend is in the top 10% of users in Bangalore earning ₹15-20L."

## Insight composition rules

An insight must:

1. **Have a specific number.** Not "you spend a lot on food" but "you spend ₹2.37L/year on Swiggy."
2. **Be actionable.** "Restart your SIP" not "consider investing more."
3. **Be ranked by magnitude.** Show the ₹28K/year reward optimization before the ₹300/month subscription audit.
4. **Include evidence.** Every insight links to the transactions that produced it.
5. **Be dismissible.** User can say "stop showing this" and it goes away.
6. **Not nag.** Show each insight once per refresh period. Never pop up.
7. **Respect severity.** Only truly urgent things get `alert` severity.

## Narrative generation

Each finding has a `narrative` field — 2-3 sentences of plain English. This can be:

- **Template-based** (fast, offline): `"You spent ₹{amount} on {category} in {period}. That's {pct}% of your income."`
- **LLM-generated** (richer, costs tokens): user's Claude API key generates a more human narrative given the raw facts

Config flag `insights.useLLMNarrative`. Default off for privacy-first users.

## Presentation

Insights dashboard organized by:

1. **This month's highlights** (top 3-5 findings)
2. **Money potentially being wasted** (warnings + alerts)
3. **Positive patterns** (info findings, to reinforce good behavior)
4. **Watchpoints** (notices — trends to monitor)

Never more than 8 findings on screen at once. Pagination if more.

## Anti-patterns to avoid

Don't build detectors that:

- **Moralize.** "You spend too much on alcohol" — user knows. Just show the number.
- **Assume goals.** "You're failing your budget." — we never asked them for a budget.
- **Stigmatize.** "You frequently dine out" — neutral, not shameful.
- **Surprise-notify.** Push notifications for insights are off by default. In-app only.

The tone is **trusted analyst**, not **disappointed parent**.

## Tests

For each detector, maintain:

- `tests/fixtures/insights/{detector_id}/positive.json` — data that should trigger a finding
- `tests/fixtures/insights/{detector_id}/negative.json` — data that should NOT trigger
- `tests/fixtures/insights/{detector_id}/expected.json` — expected Finding output

Snapshot-test narrative text (so unintended changes get caught).

## Future: custom insights

V2 feature — user can describe a pattern in natural language and we turn it into a detector via Claude.

Example: User types "Tell me when my monthly UberEats spend exceeds last month by 20%." System generates a detector config, runs it, emits findings.

Not MVP.
