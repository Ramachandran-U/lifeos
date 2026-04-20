/**
 * Transaction categorizer — two tiers:
 *   1. Hard rule map (merchant keyword → category). Covers ~70% of Indian spend.
 *   2. Claude fallback for misses. Capped per sync to control cost.
 */

import { categorizeMerchant } from '@/ai/functions';
import type { TransactionCategory } from '@/ai/types';

interface Rule {
  pattern: RegExp;
  category: TransactionCategory;
}

const RULES: Rule[] = [
  // Food & groceries
  { pattern: /swiggy|zomato|eatsure|dunzo daily|magicpin/i, category: 'food_delivery' },
  { pattern: /bigbasket|blinkit|grofers|zepto|dmart|big bazaar|reliance fresh|jiomart|instamart/i, category: 'groceries' },
  { pattern: /starbucks|cafe|dominos|pizza|kfc|mcdonald|burger king|subway|barbeque|cafe coffee/i, category: 'dining_out' },

  // Transport & fuel
  { pattern: /ola|uber|rapido|meru|blu smart|redbus/i, category: 'transport' },
  { pattern: /hpcl|iocl|bpcl|shell|indian oil|bharat petrol|reliance petrol/i, category: 'fuel' },
  { pattern: /metro|dmrc|mmrda|bmrcl|irctc/i, category: 'transport' },

  // Subscriptions & entertainment
  { pattern: /netflix|spotify|prime video|amazon prime|hotstar|disney|sonyliv|zee5|jiocinema|apple music|youtube premium/i, category: 'subscriptions' },
  { pattern: /bookmyshow|pvr|inox|cinepolis/i, category: 'entertainment' },

  // Shopping
  { pattern: /amazon|flipkart|myntra|ajio|meesho|nykaa|tata cliq|croma|reliance digital/i, category: 'shopping' },

  // Utilities & rent
  { pattern: /airtel|jio|vi |vodafone|bsnl|tata sky|d2h/i, category: 'utilities' },
  { pattern: /electricity|bescom|mseb|torrent power|adani electricity|tata power/i, category: 'utilities' },
  { pattern: /gas|ihgl|mahanagar gas|indraprastha gas/i, category: 'utilities' },
  { pattern: /rent|landlord|nobroker pay/i, category: 'rent' },

  // Health
  { pattern: /apollo|medplus|1mg|pharmeasy|netmeds|practo|tata 1mg|max hospital|fortis/i, category: 'health' },

  // Education
  { pattern: /byju|unacademy|coursera|udemy|upgrad|great learning|simplilearn/i, category: 'education' },

  // Travel
  { pattern: /makemytrip|goibibo|yatra|ixigo|cleartrip|oyo|airbnb|booking\.com|agoda|indigo|vistara|air india/i, category: 'travel' },

  // Investments & insurance
  { pattern: /zerodha|groww|upstox|kuvera|paytm money|sip|mutual fund|kfintech|camskra/i, category: 'investments' },
  { pattern: /lic |hdfc life|icici pru|max life|bajaj allianz|star health|insurance/i, category: 'insurance' },

  // Income
  { pattern: /salary|payroll|credit from employer/i, category: 'income' },

  // Transfers & cash
  { pattern: /atm |cash withdrawal|cashwdl/i, category: 'cash_withdrawal' },
  { pattern: /upi transfer|neft|imps|rtgs/i, category: 'transfers' },

  // Fees
  { pattern: /fee|charge|gst|service charge/i, category: 'fees_charges' },

  // Personal care
  { pattern: /lakme|urban company|salon|barber|spa/i, category: 'personal_care' },
];

export function categorizeByRule(merchant: string): TransactionCategory | null {
  for (const rule of RULES) {
    if (rule.pattern.test(merchant)) return rule.category;
  }
  return null;
}

interface CategorizeOpts {
  maxAiCalls?: number;
}

/**
 * Categorize a batch of (merchant, amount) pairs. Returns a map keyed by index.
 * Tier 1 uses rules. Tier 2 calls Claude, capped at `maxAiCalls` per invocation.
 */
export async function categorizeBatch(
  items: Array<{ merchant: string; amount: number; direction: 'debit' | 'credit' }>,
  opts: CategorizeOpts = {},
): Promise<TransactionCategory[]> {
  const maxAi = opts.maxAiCalls ?? 5;
  const results: TransactionCategory[] = new Array(items.length).fill('other');
  let aiBudget = maxAi;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.direction === 'credit') {
      results[i] = categorizeByRule(it.merchant) ?? 'income';
      continue;
    }
    const ruleHit = categorizeByRule(it.merchant);
    if (ruleHit) {
      results[i] = ruleHit;
      continue;
    }
    if (aiBudget > 0) {
      aiBudget -= 1;
      try {
        const r = await categorizeMerchant(it.merchant, it.amount / 100);
        results[i] = r.category;
      } catch {
        results[i] = 'other';
      }
    } else {
      results[i] = 'other';
    }
  }

  return results;
}
