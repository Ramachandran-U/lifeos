/**
 * Transaction categorizer — four tiers, executed in order:
 *   1. SQLite/Dexie merchant cache. Memoizes prior categorizations
 *      (including user corrections). Cost: zero AI calls.
 *   2. Hard rule map (merchant keyword → category). Covers most Indian spend.
 *   3. Local k-NN classifier (character-3-gram TF-IDF + cosine). Distilled
 *      from the rule map; catches merchant strings that the regexes miss
 *      but that are clearly similar to a known anchor. Zero AI calls.
 *      See `merchantClassifier.ts`.
 *   4. Batched AI fallback. One AI round-trip per ~25 misses from tiers
 *      1-3, so a 100-transaction sync stays under Gemini's 20 RPM free tier.
 *
 * Every tier-3 + tier-4 result is written back to the cache so future
 * syncs skip the expensive tiers entirely for that merchant.
 */

import { categorizeMerchantsBatch } from '@/ai/functions';
import type { TransactionCategory } from '@/ai/types';
import { classifyMerchant } from './merchantClassifier';
import {
  getCachedCategories,
  setCachedCategoriesBulk,
  type MerchantCacheRecord,
} from '@/finance/db/transactionDb';

/**
 * Normalize a merchant string for cache lookups. Strips transaction-noise
 * (UPI ref numbers, timestamps, leading channel prefixes, repeated whitespace)
 * so "UPI/123456789/Swiggy Pvt Ltd" and "swiggy pvt ltd" hit the same row.
 */
export function normalizeMerchantForCache(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/^(upi|imps|neft|rtgs)[\s/\-:]+/i, '')   // channel prefix
    .replace(/\b\d{6,}\b/g, '')                       // long digit runs (ref nums)
    .replace(/\b\d{2}[:\-/]\d{2}[:\-/]\d{2,4}\b/g, '') // timestamps
    .replace(/[^a-z0-9& ]+/g, ' ')                    // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

interface Rule {
  pattern: RegExp;
  category: TransactionCategory;
}

const RULES: Rule[] = [
  // Food & groceries
  { pattern: /swiggy|zomato|eatsure|dunzo daily|magicpin/i, category: 'food_delivery' },
  { pattern: /bigbasket|blinkit|grofers|zepto|dmart|big bazaar|reliance fresh|jiomart|instamart/i, category: 'groceries' },
  { pattern: /starbucks|cafe|dominos|pizza|kfc|mcdonald|burger king|subway|barbeque|cafe coffee|resto|restaurant|hotel|kitchen|bakes|bakery|bar and rest|biriyani|biryani|dosa|tiffin|mess/i, category: 'dining_out' },
  { pattern: /freshop|veg plaza|mothers|azad group|imperial kitchen|little resto|bee hut|al taza|nikunjam|kl bakes|vijaya bar/i, category: 'dining_out' },

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
  { pattern: /lakme|urban company|salon|barber|spa|toni and guy|toni\s*&\s*guy/i, category: 'personal_care' },
];

export function categorizeByRule(merchant: string): TransactionCategory | null {
  for (const rule of RULES) {
    if (rule.pattern.test(merchant)) return rule.category;
  }
  return null;
}

interface CategorizeOpts {
  /** Maximum number of items sent to the AI in this sync. Default 50. */
  maxAiItems?: number;
  /** Size of each batched AI request. Default 25 — one request per batch. */
  batchSize?: number;
}

/**
 * Categorize a batch of (merchant, amount) pairs. Returns categories in
 * the same order as the input.
 *
 * Pipeline:
 *   1. Direction + channel routing (credits → income / rule; p2a UPI → transfers).
 *   2. Merchant cache lookup.
 *   3. Rule map.
 *   4. AI batched call(s) for whatever remains, capped at `maxAiItems`.
 *
 * AI results (and rule hits for new merchants) are written back to the
 * cache. User corrections in the cache are never overwritten.
 */
export async function categorizeBatch(
  items: Array<{ merchant: string; amount: number; direction: 'debit' | 'credit'; channel?: 'p2a' | 'p2m' }>,
  opts: CategorizeOpts = {},
): Promise<TransactionCategory[]> {
  const maxAiItems = opts.maxAiItems ?? 50;
  const batchSize = opts.batchSize ?? 25;
  const results: TransactionCategory[] = new Array(items.length).fill('other');
  const cacheWrites: MerchantCacheRecord[] = [];
  const now = Date.now();

  // First pass: routing rules + index of items that need a cache lookup.
  const needsCache: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.direction === 'credit') {
      results[i] = categorizeByRule(it.merchant) ?? 'income';
      continue;
    }
    if (it.channel === 'p2a') {
      results[i] = 'transfers';
      continue;
    }
    needsCache.push(i);
  }

  // Second pass: cache lookup. One bulk query, not N queries.
  const keys = needsCache.map((i) => normalizeMerchantForCache(items[i].merchant));
  let cache: Awaited<ReturnType<typeof getCachedCategories>> = new Map();
  try {
    cache = await getCachedCategories(Array.from(new Set(keys)));
  } catch {
    // Dexie unavailable (e.g. native build) — fall through; rules + AI still work.
  }

  const needsRule: number[] = [];
  for (const idx of needsCache) {
    const key = normalizeMerchantForCache(items[idx].merchant);
    const cached = cache.get(key);
    if (cached) {
      results[idx] = cached.category as TransactionCategory;
    } else {
      needsRule.push(idx);
    }
  }

  // Third pass: rule map for cache misses. Write rule hits to cache.
  const needsClassifier: number[] = [];
  for (const idx of needsRule) {
    const ruleHit = categorizeByRule(items[idx].merchant);
    if (ruleHit) {
      results[idx] = ruleHit;
      cacheWrites.push({
        merchantKey: normalizeMerchantForCache(items[idx].merchant),
        category: ruleHit,
        confidence: 1,
        source: 'rule',
        updatedAt: now,
      });
    } else {
      needsClassifier.push(idx);
    }
  }

  // Tier 3.5: local k-NN classifier (free, zero-latency). Caches its
  // confident verdicts. Anything below the confidence floor falls through.
  const needsAi: number[] = [];
  for (const idx of needsClassifier) {
    const verdict = classifyMerchant(items[idx].merchant);
    if (verdict) {
      results[idx] = verdict.category;
      cacheWrites.push({
        merchantKey: normalizeMerchantForCache(items[idx].merchant),
        category: verdict.category,
        confidence: verdict.confidence,
        source: 'rule', // treat as deterministic — never user-correctable-by-AI
        updatedAt: now,
      });
    } else {
      needsAi.push(idx);
    }
  }

  // Fourth pass: AI fallback, batched. Cap total items, deduplicate by
  // normalized key so we don't waste tokens categorizing the same merchant
  // twice in one sync.
  if (needsAi.length > 0) {
    const aiCandidates = needsAi.slice(0, maxAiItems);
    const seen = new Map<string, number>();
    const uniqueItems: Array<{ merchant: string; amountRupees: number }> = [];
    const uniqueIndices: number[] = [];
    for (const idx of aiCandidates) {
      const key = normalizeMerchantForCache(items[idx].merchant);
      if (seen.has(key)) continue;
      seen.set(key, uniqueItems.length);
      uniqueItems.push({ merchant: items[idx].merchant, amountRupees: items[idx].amount / 100 });
      uniqueIndices.push(idx);
    }

    for (let start = 0; start < uniqueItems.length; start += batchSize) {
      const chunk = uniqueItems.slice(start, start + batchSize);
      const chunkIndices = uniqueIndices.slice(start, start + batchSize);
      let chunkResults;
      try {
        chunkResults = await categorizeMerchantsBatch(chunk);
      } catch {
        // Whole batch failed — leave as 'other', don't cache the failure.
        continue;
      }
      for (let k = 0; k < chunkResults.length; k++) {
        const r = chunkResults[k];
        const origIdx = chunkIndices[k];
        results[origIdx] = r.category;
        if (r.confidence > 0) {
          cacheWrites.push({
            merchantKey: normalizeMerchantForCache(items[origIdx].merchant),
            category: r.category,
            confidence: r.confidence,
            source: 'ai',
            updatedAt: now,
          });
        }
      }
    }

    // Apply AI results to any duplicates we collapsed earlier.
    for (const idx of aiCandidates) {
      if (results[idx] !== 'other') continue;
      const key = normalizeMerchantForCache(items[idx].merchant);
      const reusedKeyIdx = seen.get(key);
      if (reusedKeyIdx !== undefined) {
        const reusedResult = results[uniqueIndices[reusedKeyIdx]];
        if (reusedResult && reusedResult !== 'other') results[idx] = reusedResult;
      }
    }
  }

  if (cacheWrites.length > 0) {
    setCachedCategoriesBulk(cacheWrites).catch(() => {
      // Cache write failure is non-fatal — categorizations still flow.
    });
  }

  return results;
}
