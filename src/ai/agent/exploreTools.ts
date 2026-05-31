import { getInterestsByUser } from '@/db/queries/interests';
import { listRecentSparkTitles } from '@/db/queries/sparks';
import { listExpeditions } from '@/db/queries/expeditions';
import type { AgentTool } from './runtime';

export interface ExploreToolContext {
  userId: string;
}

const EMPTY_PARAMS = { type: 'object', properties: {} } as const;

/**
 * Read-only tools over the user's REAL intellectual history, for the
 * agentic "pull thread" loop. The point of the Explore redesign is that the
 * next node should be grounded in what the user has actually explored — their
 * interests, the sparks they've seen, the expeditions they've taken — not
 * confabulated from the model's weights. These tools give the agent that
 * context on demand so it only pulls in what it needs (keeps token cost down).
 *
 * All READ-ONLY by design — exploration never mutates state.
 */
export function buildExploreTools(ctx: ExploreToolContext): AgentTool[] {
  const { userId } = ctx;

  return [
    {
      declaration: {
        name: 'getMyInterests',
        description:
          "The user's tracked interests: name, category, and how deep they want to go (taste/hobbyist/deep_dive). Use this to connect the thread to something they already care about.",
        parameters: EMPTY_PARAMS,
      },
      execute: () =>
        getInterestsByUser(userId)
          .filter((i) => i.status === 'active' || i.status === 'exploring')
          .map((i) => ({
            name: i.name,
            category: i.category,
            depth: i.explorationDepth,
          })),
    },
    {
      declaration: {
        name: 'getRecentSparkTitles',
        description:
          'Titles of curiosity sparks the user has been shown recently. Use this to AVOID repeating ground they have already covered, and to build on themes they keep returning to.',
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'How many days back to look. Default 14.' },
          },
        },
      },
      execute: (args) => {
        const days = typeof args.days === 'number' ? args.days : 14;
        return listRecentSparkTitles(userId, days);
      },
    },
    {
      declaration: {
        name: 'getMyExpeditions',
        description:
          "The structured exploration journeys the user has started. Returns title and theme. Use this to see what they have already committed real time to.",
        parameters: EMPTY_PARAMS,
      },
      execute: () =>
        listExpeditions(userId).map((e) => ({ title: e.title, theme: e.theme })),
    },
  ];
}
