import type { TransactionCategory } from '@/ai/types';

/** 30 labelled Indian merchants spanning the most common transaction categories. */
export interface LabelledMerchant {
  merchant: string;
  amountRupees: number;
  expected: TransactionCategory;
}

export const MERCHANTS: LabelledMerchant[] = [
  // Food
  { merchant: 'SWIGGY*ORDER 12345', amountRupees: 450, expected: 'food_delivery' },
  { merchant: 'ZOMATO ONLINE BANGALORE', amountRupees: 380, expected: 'food_delivery' },
  { merchant: 'BIGBASKET', amountRupees: 2200, expected: 'groceries' },
  { merchant: 'BLINKIT GROCERIES', amountRupees: 540, expected: 'groceries' },
  { merchant: 'STARBUCKS COFFEE', amountRupees: 420, expected: 'dining_out' },
  { merchant: 'DOMINOS PIZZA', amountRupees: 580, expected: 'dining_out' },

  // Transport
  { merchant: 'OLA CABS', amountRupees: 240, expected: 'transport' },
  { merchant: 'UBER INDIA', amountRupees: 280, expected: 'transport' },
  { merchant: 'IRCTC TICKET', amountRupees: 1100, expected: 'transport' },
  { merchant: 'INDIAN OIL CORP', amountRupees: 2500, expected: 'fuel' },
  { merchant: 'HPCL FUEL STATION', amountRupees: 3000, expected: 'fuel' },

  // Shopping & subs
  { merchant: 'AMAZON.IN', amountRupees: 1899, expected: 'shopping' },
  { merchant: 'FLIPKART INTERNET', amountRupees: 2599, expected: 'shopping' },
  { merchant: 'MYNTRA', amountRupees: 1499, expected: 'shopping' },
  { merchant: 'NETFLIX', amountRupees: 649, expected: 'subscriptions' },
  { merchant: 'SPOTIFY INDIA', amountRupees: 119, expected: 'subscriptions' },
  { merchant: 'HOTSTAR PREMIUM', amountRupees: 299, expected: 'subscriptions' },

  // Utilities & rent
  { merchant: 'TATA POWER MUMBAI', amountRupees: 3200, expected: 'utilities' },
  { merchant: 'AIRTEL POSTPAID', amountRupees: 999, expected: 'utilities' },
  { merchant: 'JIO MOBILE RECHARGE', amountRupees: 299, expected: 'utilities' },
  { merchant: 'NOBROKER PAY RENT', amountRupees: 35000, expected: 'rent' },

  // Health & education
  { merchant: 'APOLLO PHARMACY', amountRupees: 540, expected: 'health' },
  { merchant: 'TATA 1MG', amountRupees: 720, expected: 'health' },
  { merchant: 'COURSERA INC', amountRupees: 4099, expected: 'education' },
  { merchant: 'UDEMY ONLINE COURSE', amountRupees: 499, expected: 'education' },

  // Travel
  { merchant: 'MAKEMYTRIP HOTEL', amountRupees: 8500, expected: 'travel' },
  { merchant: 'INDIGO AIR TICKET', amountRupees: 6299, expected: 'travel' },

  // Investments
  { merchant: 'ZERODHA BROKING', amountRupees: 25000, expected: 'investments' },
  { merchant: 'GROWW MUTUAL FUND SIP', amountRupees: 5000, expected: 'investments' },

  // Entertainment
  { merchant: 'BOOKMYSHOW MOVIE', amountRupees: 480, expected: 'entertainment' },
];
