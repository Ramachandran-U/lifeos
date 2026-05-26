import type {
  CrossDisciplineLink,
  CrossDisciplineLinkInput,
  InterestSuggestions,
  InterestSuggestionsInput,
} from '../types';

// Per-category mock pool — chosen so the suggestions feel "adjacent" rather
// than random. The store rotates through these based on the user's existing
// interest categories.
const CATEGORY_POOL: Record<string, Array<{ name: string; category: string; blurb: string }>> = {
  arts: [
    { name: 'Linocut printmaking',  category: 'arts',    blurb: 'Hand-carved prints'    },
    { name: 'Watercolour journaling', category: 'arts',  blurb: 'Daily small paintings' },
    { name: 'Concrete poetry',      category: 'writing', blurb: 'Visual + textual form' },
  ],
  science: [
    { name: 'Citizen astronomy',    category: 'science', blurb: 'Lunar observation log'  },
    { name: 'Backyard mycology',    category: 'science', blurb: 'Mushroom ID + spore prints' },
    { name: 'Open-source biology',  category: 'science', blurb: 'DIY microscopy'        },
  ],
  tech: [
    { name: 'Tiny language models', category: 'tech',    blurb: 'On-device LLM tinkering' },
    { name: 'Generative geometry',  category: 'tech',    blurb: 'Three.js sketchbook'    },
    { name: 'Plain-text databases', category: 'tech',    blurb: 'SQLite as a notebook'   },
  ],
  sports: [
    { name: 'Trail running',        category: 'sports',  blurb: 'Long slow distance'    },
    { name: 'Kettlebell flow',      category: 'sports',  blurb: 'Single-bell complexes' },
    { name: 'Pickleball',           category: 'sports',  blurb: 'Low-barrier paddle sport' },
  ],
  music: [
    { name: 'Algorithmic composition', category: 'music', blurb: 'Code as a co-writer' },
    { name: 'Modal interchange',    category: 'music',   blurb: 'Borrowed-chord ear training' },
    { name: 'Field recording',      category: 'music',   blurb: 'Capture ambient sound' },
  ],
  writing: [
    { name: 'Essay-letters',        category: 'writing', blurb: '600-word weekly letter' },
    { name: 'Short-form criticism', category: 'writing', blurb: 'Reviews under 400 words' },
    { name: 'Annotated reading log',category: 'writing', blurb: 'Margin notes, public'   },
  ],
  language: [
    { name: 'Shadowing podcasts',   category: 'language',blurb: '15-min daily speak-along' },
    { name: 'Lang-via-cooking',     category: 'language',blurb: 'Recipes in the L2'      },
    { name: 'Pen-pal swap',         category: 'language',blurb: 'Letters to native speaker' },
  ],
  philosophy: [
    { name: 'Stoic journaling',     category: 'philosophy', blurb: 'Morning reflection prompts' },
    { name: 'Daily Tao reading',    category: 'philosophy', blurb: 'One chapter, slow'   },
    { name: 'Negative visualisation', category: 'philosophy', blurb: 'Premeditatio malorum practice' },
  ],
  other: [
    { name: 'Daily chess puzzle',   category: 'other',   blurb: 'One puzzle per coffee' },
    { name: 'Bread baking',         category: 'other',   blurb: 'Sourdough fundamentals' },
    { name: 'Birding by ear',       category: 'other',   blurb: 'Audio-first ID'        },
  ],
};

const ALL_CATEGORIES = Object.keys(CATEGORY_POOL);

export function buildMockInterestSuggestions(input: InterestSuggestionsInput): InterestSuggestions {
  const seedCategories = input.existingInterests.length > 0
    ? input.existingInterests.map((i) => i.category)
    : ALL_CATEGORIES;

  // Round-robin through the user's categories first, then fill from others.
  const ordered = [
    ...new Set([...seedCategories, ...ALL_CATEGORIES]),
  ].filter((c) => CATEGORY_POOL[c]);

  const out: Array<{ name: string; category: string; blurb: string }> = [];
  let cursor = 0;
  while (out.length < 6 && cursor < ordered.length * 3) {
    const cat = ordered[cursor % ordered.length];
    const pool = CATEGORY_POOL[cat];
    const pick = pool[Math.floor(cursor / ordered.length) % pool.length];
    if (!out.some((o) => o.name === pick.name)) out.push(pick);
    cursor++;
  }

  return {
    areas: out.map((o) => {
      const linkedInterest = input.existingInterests.find((i) => i.category === o.category);
      const why = linkedInterest
        ? `Adjacent to ${linkedInterest.name} — same category, different angle.`
        : `A different direction from what you currently track.`;
      return {
        name: o.name,
        category: o.category as InterestSuggestions['areas'][number]['category'],
        blurb: o.blurb,
        whyThisFits: why,
      };
    }),
  };
}

export function buildMockCrossDisciplineLink(input: CrossDisciplineLinkInput): CrossDisciplineLink {
  const { interestA, interestB } = input;
  return {
    headline: `${interestA.name} × ${interestB.name}`,
    description:
      `Both share a structural rhythm — the patterns you notice in ${interestA.name} often map onto the constraints ` +
      `you work within in ${interestB.name}. Move between them deliberately and each makes the other sharper.`,
    starterAction: `Spend 60 minutes producing one artefact that uses ${interestA.name} as input and ${interestB.name} as the medium — a single short output.`,
  };
}
