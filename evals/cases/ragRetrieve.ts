import { indexItems, retrieveTopK, type IndexedItem } from '@/ai/rag/retrieve';
import { schemaValid, check } from '../grader';
import { z } from 'zod';
import type { EvalSuite } from '../types';

const HitsSchema = z.array(
  z.object({ id: z.string(), text: z.string(), score: z.number() }).passthrough(),
);

interface Input {
  query: string;
  corpus: { id: string; text: string }[];
  expectedTopId: string;
}

const suite: EvalSuite<Input, z.infer<typeof HitsSchema>> = {
  name: 'ragRetrieve',
  threshold: 1.0,
  run: async ({ query, corpus }) => {
    const idx: IndexedItem[] = await indexItems(corpus);
    return retrieveTopK(query, idx, 3);
  },
  cases: [
    {
      name: 'workout-query',
      input: {
        query: 'how was my workout',
        corpus: [
          { id: 'w', text: 'Lifted weights at the gym for one hour' },
          { id: 'r', text: 'Read about distributed systems' },
          { id: 'c', text: 'Cooked dinner with friends' },
        ],
        expectedTopId: 'w',
      },
      graders: [
        schemaValid(HitsSchema),
        check<z.infer<typeof HitsSchema>>('top hit is workout', (out) => out[0]?.id === 'w'),
        check('returns at most k=3', (out) => out.length <= 3),
        check('scores descending', (out) => out.every((h, i) => i === 0 || h.score <= out[i - 1]!.score)),
      ],
    },
    {
      name: 'finance-query',
      input: {
        query: 'savings progress and investing',
        corpus: [
          { id: 'a', text: 'Logged 7 hours of sleep' },
          { id: 'b', text: 'Set up SIP into a Nifty 50 index fund and reviewed savings rate' },
          { id: 'c', text: 'Walked 8000 steps' },
        ],
        expectedTopId: 'b',
      },
      graders: [
        schemaValid(HitsSchema),
        check<z.infer<typeof HitsSchema>>('top hit is finance entry', (out) => out[0]?.id === 'b'),
      ],
    },
    {
      name: 'empty-corpus',
      input: { query: 'anything', corpus: [], expectedTopId: '' },
      graders: [
        schemaValid(HitsSchema),
        check('returns empty array', (out) => out.length === 0),
      ],
    },
  ],
};

export default suite;
