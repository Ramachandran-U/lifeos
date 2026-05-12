/**
 * Local k-NN merchant classifier — character-3-gram TF-IDF + cosine similarity.
 *
 * Why this exists: roughly 30% of transactions miss the regex `RULES` map.
 * Those used to go straight to the AI (expensive, rate-limited). Most of
 * them are very similar to merchants the rules already catch (e.g.
 * "SWIGGY GENIE" misses but is near "swiggy"). This classifier handles
 * those cases for free and only escalates to AI when no anchor is close.
 *
 * No external deps. ~100 lines. All learning happens at module load time
 * from the static `TRAINING_DATA` below.
 */

import type { TransactionCategory } from '@/ai/types';

const NGRAM_SIZE = 3;
const TOP_NEIGHBOURS = 3;

/**
 * Labelled merchant anchors. Mirrors and slightly extends the regex rule
 * map so the classifier covers the same canonical brands plus variants
 * the regex misses (UPI suffixes, P2A surface names, common typos).
 *
 * Add new anchors here as the schema-failure feed surfaces real merchants
 * we should learn — that's the distillation loop.
 */
const TRAINING_DATA: Array<{ merchant: string; category: TransactionCategory }> = [
  // food_delivery
  ['swiggy', 'food_delivery'], ['zomato', 'food_delivery'], ['eatsure', 'food_delivery'],
  ['dunzo daily', 'food_delivery'], ['magicpin food', 'food_delivery'], ['box8', 'food_delivery'],
  ['rebel foods', 'food_delivery'], ['faasos', 'food_delivery'],

  // groceries
  ['bigbasket', 'groceries'], ['blinkit', 'groceries'], ['zepto', 'groceries'],
  ['dmart', 'groceries'], ['reliance fresh', 'groceries'], ['jiomart', 'groceries'],
  ['instamart', 'groceries'], ['grofers', 'groceries'], ['nature\'s basket', 'groceries'],
  ['spencer\'s', 'groceries'], ['more megastore', 'groceries'],

  // dining_out
  ['starbucks', 'dining_out'], ['cafe coffee day', 'dining_out'], ['dominos', 'dining_out'],
  ['pizza hut', 'dining_out'], ['kfc', 'dining_out'], ['mcdonald', 'dining_out'],
  ['burger king', 'dining_out'], ['barbeque nation', 'dining_out'], ['biryani', 'dining_out'],
  ['restaurant', 'dining_out'], ['the bakery', 'dining_out'], ['kitchen', 'dining_out'],
  ['tiffin service', 'dining_out'], ['food court', 'dining_out'],

  // transport
  ['ola cabs', 'transport'], ['uber india', 'transport'], ['rapido', 'transport'],
  ['blu smart', 'transport'], ['redbus', 'transport'], ['meru cabs', 'transport'],
  ['irctc', 'transport'], ['dmrc metro', 'transport'], ['bmrcl metro', 'transport'],
  ['auto rickshaw', 'transport'], ['toll plaza', 'transport'], ['fastag', 'transport'],

  // fuel
  ['indian oil', 'fuel'], ['iocl petrol', 'fuel'], ['hpcl', 'fuel'], ['bharat petroleum', 'fuel'],
  ['bpcl fuel', 'fuel'], ['shell petrol', 'fuel'], ['reliance petrol pump', 'fuel'],

  // subscriptions
  ['netflix', 'subscriptions'], ['spotify', 'subscriptions'], ['amazon prime', 'subscriptions'],
  ['prime video', 'subscriptions'], ['hotstar', 'subscriptions'], ['disney+', 'subscriptions'],
  ['sonyliv', 'subscriptions'], ['zee5', 'subscriptions'], ['jiocinema', 'subscriptions'],
  ['apple music', 'subscriptions'], ['youtube premium', 'subscriptions'], ['icloud', 'subscriptions'],
  ['google one', 'subscriptions'], ['chatgpt plus', 'subscriptions'], ['notion', 'subscriptions'],

  // entertainment
  ['bookmyshow', 'entertainment'], ['pvr cinemas', 'entertainment'], ['inox movies', 'entertainment'],
  ['cinepolis', 'entertainment'],

  // shopping
  ['amazon', 'shopping'], ['flipkart', 'shopping'], ['myntra', 'shopping'], ['ajio', 'shopping'],
  ['meesho', 'shopping'], ['nykaa', 'shopping'], ['tata cliq', 'shopping'], ['croma', 'shopping'],
  ['reliance digital', 'shopping'], ['decathlon', 'shopping'], ['ikea india', 'shopping'],
  ['lifestyle store', 'shopping'], ['shoppers stop', 'shopping'],

  // utilities
  ['airtel', 'utilities'], ['jio', 'utilities'], ['vodafone', 'utilities'], ['vi postpaid', 'utilities'],
  ['bsnl', 'utilities'], ['tata sky', 'utilities'], ['bescom', 'utilities'], ['mseb', 'utilities'],
  ['tata power', 'utilities'], ['adani electricity', 'utilities'], ['torrent power', 'utilities'],
  ['mahanagar gas', 'utilities'], ['indraprastha gas', 'utilities'], ['act fibernet', 'utilities'],
  ['hathway broadband', 'utilities'],

  // rent
  ['rent', 'rent'], ['nobroker pay', 'rent'], ['landlord', 'rent'],

  // health
  ['apollo pharmacy', 'health'], ['medplus', 'health'], ['1mg', 'health'], ['pharmeasy', 'health'],
  ['netmeds', 'health'], ['practo', 'health'], ['tata 1mg', 'health'], ['max hospital', 'health'],
  ['fortis hospital', 'health'], ['cult fit', 'health'], ['gympik', 'health'],

  // education
  ['byju\'s', 'education'], ['unacademy', 'education'], ['coursera', 'education'],
  ['udemy', 'education'], ['upgrad', 'education'], ['great learning', 'education'],
  ['simplilearn', 'education'], ['scaler academy', 'education'], ['masai school', 'education'],

  // travel
  ['makemytrip', 'travel'], ['goibibo', 'travel'], ['yatra', 'travel'], ['ixigo', 'travel'],
  ['cleartrip', 'travel'], ['oyo rooms', 'travel'], ['airbnb', 'travel'], ['booking.com', 'travel'],
  ['agoda', 'travel'], ['indigo airlines', 'travel'], ['vistara', 'travel'], ['air india', 'travel'],

  // investments
  ['zerodha', 'investments'], ['groww', 'investments'], ['upstox', 'investments'],
  ['kuvera', 'investments'], ['paytm money', 'investments'], ['kfintech', 'investments'],
  ['camskra', 'investments'], ['mutual fund sip', 'investments'], ['nifty index fund', 'investments'],

  // insurance
  ['lic premium', 'insurance'], ['hdfc life', 'insurance'], ['icici prudential', 'insurance'],
  ['max life insurance', 'insurance'], ['bajaj allianz', 'insurance'], ['star health', 'insurance'],
  ['niva bupa', 'insurance'],

  // transfers
  ['upi transfer', 'transfers'], ['neft', 'transfers'], ['imps', 'transfers'], ['rtgs', 'transfers'],

  // fees_charges
  ['gst', 'fees_charges'], ['service charge', 'fees_charges'], ['atm fee', 'fees_charges'],
  ['annual fee', 'fees_charges'], ['late payment charge', 'fees_charges'],

  // cash_withdrawal
  ['atm cash withdrawal', 'cash_withdrawal'], ['cashwdl', 'cash_withdrawal'],

  // personal_care
  ['lakme salon', 'personal_care'], ['urban company', 'personal_care'], ['toni & guy', 'personal_care'],
  ['the salon', 'personal_care'], ['nykaa salon', 'personal_care'], ['spa', 'personal_care'],
].map(([merchant, category]) => ({ merchant: merchant as string, category: category as TransactionCategory }));

// ─── feature extraction ──────────────────────────────────────────────────────

function ngrams(text: string, n = NGRAM_SIZE): string[] {
  // Pad with spaces so prefix/suffix grams exist; helps short merchant strings.
  const padded = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const out: string[] = [];
  for (let i = 0; i <= padded.length - n; i++) out.push(padded.slice(i, i + n));
  return out;
}

function tf(grams: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of grams) m.set(g, (m.get(g) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>, idf: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  // Cosine over the union of keys, weighted by IDF.
  for (const [g, va] of a) {
    const w = idf.get(g) ?? 1;
    const vbw = (b.get(g) ?? 0) * w;
    const vaw = va * w;
    dot += vaw * vbw;
    na += vaw * vaw;
  }
  for (const [g, vb] of b) {
    const w = idf.get(g) ?? 1;
    const vbw = vb * w;
    nb += vbw * vbw;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ─── train at module load ────────────────────────────────────────────────────

interface Anchor {
  category: TransactionCategory;
  source: string;
  tfVec: Map<string, number>;
}

const ANCHORS: Anchor[] = [];
const IDF = new Map<string, number>();

(function train() {
  const docCounts = new Map<string, number>();
  for (const { merchant, category } of TRAINING_DATA) {
    const grams = ngrams(merchant);
    const tfVec = tf(grams);
    ANCHORS.push({ category, source: merchant, tfVec });
    for (const g of new Set(grams)) docCounts.set(g, (docCounts.get(g) ?? 0) + 1);
  }
  const N = ANCHORS.length;
  for (const [g, df] of docCounts) IDF.set(g, Math.log((N + 1) / (df + 1)) + 1);
})();

// ─── inference ───────────────────────────────────────────────────────────────

export interface ClassifierResult {
  category: TransactionCategory;
  confidence: number;
  /** Best-matching anchor string, useful for debugging / further training. */
  matchedAnchor: string;
}

/**
 * Classify a merchant string. Returns `null` when no anchor crosses the
 * confidence floor — caller should fall back to AI.
 */
export function classifyMerchant(merchant: string, confidenceFloor = 0.55): ClassifierResult | null {
  const qGrams = ngrams(merchant);
  if (qGrams.length === 0) return null;
  const qTf = tf(qGrams);

  // Score all anchors, keep top K, vote by weighted similarity.
  const scored = ANCHORS.map((a) => ({ a, sim: cosine(qTf, a.tfVec, IDF) }));
  scored.sort((x, y) => y.sim - x.sim);

  const top = scored.slice(0, TOP_NEIGHBOURS);
  if (top.length === 0 || top[0]!.sim < confidenceFloor) return null;

  // Weighted vote across the top-K. Most votes wins; ties broken by best sim.
  const votes = new Map<TransactionCategory, { weight: number; bestSim: number; bestAnchor: string }>();
  for (const { a, sim } of top) {
    const v = votes.get(a.category) ?? { weight: 0, bestSim: 0, bestAnchor: a.source };
    v.weight += sim;
    if (sim > v.bestSim) {
      v.bestSim = sim;
      v.bestAnchor = a.source;
    }
    votes.set(a.category, v);
  }

  let bestCat: TransactionCategory | null = null;
  let bestWeight = -1;
  let bestSim = 0;
  let bestAnchor = '';
  for (const [cat, v] of votes) {
    if (v.weight > bestWeight) {
      bestWeight = v.weight;
      bestCat = cat;
      bestSim = v.bestSim;
      bestAnchor = v.bestAnchor;
    }
  }

  if (!bestCat) return null;
  return { category: bestCat, confidence: bestSim, matchedAnchor: bestAnchor };
}

/** Exposed for benchmarks / tests. */
export const __TRAINING_SIZE = TRAINING_DATA.length;
