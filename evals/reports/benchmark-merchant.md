# Merchant Categorizer Benchmark

- Mode: **MOCK**
- Dataset size: 30 labelled Indian merchants
- Classifier training size: 167 anchors (distilled from rule map)

## Headline metrics

| System | Accuracy | Coverage | Avg latency (ms) | Projected $/1k calls |
|---|---|---|---|---|
| **Rule-based** | 96.7% | 100.0% | 0.20 | $0.0000 (offline) |
| **Local classifier (k-NN char-3-gram)** | 96.7% | 96.7% | 1.43 | $0.0000 (offline) |
| **LLM (claude-haiku-4-5-20251001)** | 0.0% | 100.0% | 0.07 | $0.1300 |

## Stacked pipeline (cache → rule → classifier → AI)

- Stack accuracy: **96.7%**
- AI hit rate (% of inputs that escalated to LLM): **0.0%**
- Projected stack cost per 1k inputs: **$0.0000** (vs $0.1300 for LLM-only)

## Methodology

For each merchant string we run the rule map, then the distilled classifier, then the LLM, 
independently — so we can measure each tier in isolation. The "Stacked pipeline" section 
models the production routing (rules first, classifier second, AI last) so the AI hit rate 
and projected cost reflect what users actually pay.

The **local classifier** is a character-3-gram TF-IDF vector space + cosine k-NN over the 
anchor strings in `src/finance/merchantClassifier.ts`. It is the distillation step: zero 
training cost, ~0.1 ms per inference, no API calls. The anchors are seeded from the regex 
rule map and the merchant_cache (which captures user corrections).

**Next distillation step (deferred):** dump real production merchant strings + their AI 
verdicts from the `merchant_cache` table, retrain the classifier with `__TRAINING_SIZE` 
in the hundreds, and ratchet the confidence floor up as coverage rises. The benchmark 
tracks whether stack accuracy stays at parity with LLM-only.

## Per-merchant detail

| Merchant | Expected | Rule | Classifier | LLM |
|---|---|---|---|---|
| `SWIGGY*ORDER 12345` | `food_delivery` | food_delivery ✅ | food_delivery (0.87) ✅ | other ❌ |
| `ZOMATO ONLINE BANGALORE` | `food_delivery` | food_delivery ✅ | food_delivery (0.60) ✅ | other ❌ |
| `BIGBASKET` | `groceries` | groceries ✅ | groceries (1.00) ✅ | other ❌ |
| `BLINKIT GROCERIES` | `groceries` | groceries ✅ | groceries (0.76) ✅ | other ❌ |
| `STARBUCKS COFFEE` | `dining_out` | dining_out ✅ | dining_out (0.77) ✅ | other ❌ |
| `DOMINOS PIZZA` | `dining_out` | dining_out ✅ | dining_out (0.76) ✅ | other ❌ |
| `OLA CABS` | `transport` | transport ✅ | transport (1.00) ✅ | other ❌ |
| `UBER INDIA` | `transport` | transport ✅ | transport (1.00) ✅ | other ❌ |
| `IRCTC TICKET` | `transport` | transport ✅ | transport (0.76) ✅ | other ❌ |
| `INDIAN OIL CORP` | `fuel` | fuel ✅ | fuel (0.95) ✅ | other ❌ |
| `HPCL FUEL STATION` | `fuel` | fuel ✅ | fuel (0.57) ✅ | other ❌ |
| `AMAZON.IN` | `shopping` | shopping ✅ | shopping (0.88) ✅ | other ❌ |
| `FLIPKART INTERNET` | `shopping` | shopping ✅ | shopping (0.73) ✅ | other ❌ |
| `MYNTRA` | `shopping` | shopping ✅ | shopping (1.00) ✅ | other ❌ |
| `NETFLIX` | `subscriptions` | subscriptions ✅ | subscriptions (1.00) ✅ | other ❌ |
| `SPOTIFY INDIA` | `subscriptions` | subscriptions ✅ | subscriptions (0.78) ✅ | other ❌ |
| `HOTSTAR PREMIUM` | `subscriptions` | subscriptions ✅ | subscriptions (0.68) ✅ | other ❌ |
| `TATA POWER MUMBAI` | `utilities` | utilities ✅ | utilities (0.89) ✅ | other ❌ |
| `AIRTEL POSTPAID` | `utilities` | utilities ✅ | utilities (0.65) ✅ | other ❌ |
| `JIO MOBILE RECHARGE` | `utilities` | utilities ✅ | — | other ❌ |
| `NOBROKER PAY RENT` | `rent` | rent ✅ | rent (0.89) ✅ | other ❌ |
| `APOLLO PHARMACY` | `health` | health ✅ | health (1.00) ✅ | other ❌ |
| `TATA 1MG` | `health` | health ✅ | health (1.00) ✅ | other ❌ |
| `COURSERA INC` | `education` | education ✅ | education (0.90) ✅ | other ❌ |
| `UDEMY ONLINE COURSE` | `education` | education ✅ | education (0.56) ✅ | other ❌ |
| `MAKEMYTRIP HOTEL` | `travel` | dining_out ❌ | travel (0.84) ✅ | other ❌ |
| `INDIGO AIR TICKET` | `travel` | travel ✅ | travel (0.57) ✅ | other ❌ |
| `ZERODHA BROKING` | `investments` | investments ✅ | investments (0.69) ✅ | other ❌ |
| `GROWW MUTUAL FUND SIP` | `investments` | investments ✅ | investments (0.86) ✅ | other ❌ |
| `BOOKMYSHOW MOVIE` | `entertainment` | entertainment ✅ | entertainment (0.84) ✅ | other ❌ |
