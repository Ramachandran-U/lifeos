# Merchant Categorizer Benchmark

- Mode: **MOCK**
- Dataset size: 30 labelled Indian merchants

## Headline metrics

| System | Accuracy | Coverage | Avg latency (ms) | Projected $/1k calls |
|---|---|---|---|---|
| **Rule-based** | 96.7% | 100.0% | 0.13 | $0.0000 (offline) |
| **LLM (Haiku 4.5)** | 0.0% | 100.0% | 0.00 | $0.1300 |

## Methodology

For each merchant string the rule classifier runs first; if it returns null we fall back to the LLM. This benchmark runs both classifiers on the **full** dataset so we can quantify what we lose by skipping the LLM (the rules' coverage gap) and what we gain in cost by routing through rules first.

**Distillation path:** collect ~500 production merchant strings the rules miss, label with the LLM, fine-tune a 1.5B-param classifier (e.g. Llama 3.2 1B). Target: match LLM accuracy within 3 points at 1/20th the cost-per-call.

## Per-merchant detail

| Merchant | Expected | Rule | LLM |
|---|---|---|---|
| `SWIGGY*ORDER 12345` | `food_delivery` | food_delivery ✅ | other ❌ |
| `ZOMATO ONLINE BANGALORE` | `food_delivery` | food_delivery ✅ | other ❌ |
| `BIGBASKET` | `groceries` | groceries ✅ | other ❌ |
| `BLINKIT GROCERIES` | `groceries` | groceries ✅ | other ❌ |
| `STARBUCKS COFFEE` | `dining_out` | dining_out ✅ | other ❌ |
| `DOMINOS PIZZA` | `dining_out` | dining_out ✅ | other ❌ |
| `OLA CABS` | `transport` | transport ✅ | other ❌ |
| `UBER INDIA` | `transport` | transport ✅ | other ❌ |
| `IRCTC TICKET` | `transport` | transport ✅ | other ❌ |
| `INDIAN OIL CORP` | `fuel` | fuel ✅ | other ❌ |
| `HPCL FUEL STATION` | `fuel` | fuel ✅ | other ❌ |
| `AMAZON.IN` | `shopping` | shopping ✅ | other ❌ |
| `FLIPKART INTERNET` | `shopping` | shopping ✅ | other ❌ |
| `MYNTRA` | `shopping` | shopping ✅ | other ❌ |
| `NETFLIX` | `subscriptions` | subscriptions ✅ | other ❌ |
| `SPOTIFY INDIA` | `subscriptions` | subscriptions ✅ | other ❌ |
| `HOTSTAR PREMIUM` | `subscriptions` | subscriptions ✅ | other ❌ |
| `TATA POWER MUMBAI` | `utilities` | utilities ✅ | other ❌ |
| `AIRTEL POSTPAID` | `utilities` | utilities ✅ | other ❌ |
| `JIO MOBILE RECHARGE` | `utilities` | utilities ✅ | other ❌ |
| `NOBROKER PAY RENT` | `rent` | rent ✅ | other ❌ |
| `APOLLO PHARMACY` | `health` | health ✅ | other ❌ |
| `TATA 1MG` | `health` | health ✅ | other ❌ |
| `COURSERA INC` | `education` | education ✅ | other ❌ |
| `UDEMY ONLINE COURSE` | `education` | education ✅ | other ❌ |
| `MAKEMYTRIP HOTEL` | `travel` | dining_out ❌ | other ❌ |
| `INDIGO AIR TICKET` | `travel` | travel ✅ | other ❌ |
| `ZERODHA BROKING` | `investments` | investments ✅ | other ❌ |
| `GROWW MUTUAL FUND SIP` | `investments` | investments ✅ | other ❌ |
| `BOOKMYSHOW MOVIE` | `entertainment` | entertainment ✅ | other ❌ |
