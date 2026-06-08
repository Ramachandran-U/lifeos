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
