import type { AgentTool } from './runtime';
import type { AppScreen, ToolContext } from './tools';

/**
 * Navigation + screen-context tools for the agentic voice assistant.
 *
 * These are INSTANT (reversible) actions in the hybrid action model — no
 * propose/confirm. The agent calls `navigateTo` to open the right tab (e.g.
 * "add a goal" → opens Goals) and keeps the conversation going, and
 * `getCurrentScreen` to know where the user is ("if I'm on Health and you say
 * 'sync my Fit'…"). The actual navigation is performed by the voice companion
 * via `ctx.navigate`; this file stays provider/router-agnostic, like every
 * other tool — see runtime.ts.
 */

const SCREENS: AppScreen[] = [
  'today',
  'goals',
  'health',
  'finance',
  'career',
  'social',
  'explore',
  'life',
  'profile',
  'rewards',
];

function isScreen(value: unknown): value is AppScreen {
  return typeof value === 'string' && (SCREENS as string[]).includes(value);
}

export function buildNavTools(ctx: ToolContext): AgentTool[] {
  const tools: AgentTool[] = [];

  if (ctx.navigate) {
    const navigate = ctx.navigate;
    tools.push({
      declaration: {
        name: 'navigateTo',
        description:
          'Open one of the app screens so the user can see it while you keep talking. ' +
          'Use this to take the user where the conversation is going — e.g. "add a goal" → ' +
          "navigate to 'goals'; talk about fitness → 'health'; career planning → 'career'. " +
          'This is instant and reversible — no confirmation needed.',
        parameters: {
          type: 'object',
          properties: {
            screen: {
              type: 'string',
              description: `Which screen to open. One of: ${SCREENS.join(', ')}.`,
            },
          },
          required: ['screen'],
        },
      },
      execute: (args) => {
        if (!isScreen(args.screen)) {
          return { navigated: false, error: `screen must be one of: ${SCREENS.join(', ')}` };
        }
        navigate(args.screen);
        return { navigated: true, screen: args.screen };
      },
    });
  }

  if (ctx.currentScreen) {
    const currentScreen = ctx.currentScreen;
    tools.push({
      declaration: {
        name: 'getCurrentScreen',
        description:
          'The screen the user is currently looking at. Call this when the user says ' +
          'something context-dependent ("sync my fit", "generate it now") so you act on the ' +
          'right area instead of guessing.',
        parameters: { type: 'object', properties: {} },
      },
      execute: () => ({ screen: currentScreen() }),
    });
  }

  return tools;
}
