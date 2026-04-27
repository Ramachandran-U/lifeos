import type { DiscoveryExtraction } from '../types';

export const MOCK_DISCOVERY_EXTRACTION: DiscoveryExtraction = {
  identity: {
    firstName: 'Sam',
    ageBand: '30-35',
    location: 'Bengaluru',
    seasonOfLife: 'Rebuilding after a hard year — wants structure without burnout.',
    confidence: 'medium',
  },
  goals: [
    {
      title: 'Ship a side project to 100 paying users',
      domain: 'career',
      horizon: '1y',
      why: 'Wants an income source that is not tied to the day job.',
      quote: 'I keep starting things and not finishing them.',
      confidence: 'high',
    },
    {
      title: 'Lose 8 kg and hold it',
      domain: 'health',
      horizon: '1y',
      why: 'Energy has dropped and clothes do not fit.',
      quote: null,
      confidence: 'high',
    },
    {
      title: 'Build 6 months of emergency fund',
      domain: 'finance',
      horizon: '1y',
      why: 'Layoffs in the industry have made them anxious.',
      quote: null,
      confidence: 'medium',
    },
  ],
  health: {
    conditions: [],
    constraints: ['bad left knee — no high impact running'],
    currentHabits: ['walks most evenings', 'inconsistent gym'],
    energyPattern: 'Sharpest 8am–11am, crashes after lunch.',
    confidence: 'medium',
  },
  finance: {
    currency: 'INR',
    monthlyIncomeBand: null,
    topGoals: ['6 months emergency fund', 'start SIP'],
    anxieties: ['job security', 'not saving enough'],
    confidence: 'medium',
  },
  career: {
    role: 'Senior product manager',
    seniority: 'senior',
    aspirations: ['become a founder', 'build an audience'],
    skillsLearning: ['writing in public', 'basic coding'],
    confidence: 'high',
  },
  relationships: {
    keyPeople: [
      { firstName: 'Priya', role: 'partner', cadence: 'daily' },
      { firstName: 'Arjun', role: 'closest friend', cadence: 'weekly' },
    ],
    socialEnergy: 'ambivert',
    confidence: 'medium',
  },
  curiosity: {
    activeInterests: ['essay writing', 'chess'],
    dormantInterests: ['piano'],
    confidence: 'medium',
  },
  values: ['honesty', 'craft', 'family first', 'quiet ambition'],
  workingStyle: {
    peakHours: 'early morning',
    focusBlocks: '90-minute deep work blocks',
    restNeeds: 'one full offline day a week',
    confidence: 'medium',
  },
  communication: {
    tone: 'direct',
    avoid: ['toxic positivity', 'vague pep talk'],
    confidence: 'medium',
  },
  struggles: [
    { area: 'consistency', description: 'Starts strong for two weeks, then falls off.', quote: 'I keep starting things and not finishing them.' },
  ],
  triedAlready: ['Notion templates', 'habit tracker apps', 'therapy'],
  asks: ['help me finish what I start', 'keep it calm — no hype'],
};
