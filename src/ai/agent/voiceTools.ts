import { format, subDays, parseISO } from 'date-fns';
import { getTransactionsInRange } from '@/finance/db/transactionDb';
import { merchantRollups } from '@/finance/analytics';
import { getUser } from '@/db/queries/users';
import { getRecentWeightLogs, getFoodEntriesByDate } from '@/db/queries/health';
import { calorieTargets } from '@/utils/health';
import { buildLifeOsTools, type ToolContext } from './tools';
import { buildNavTools } from './navTools';
import { buildLifeOsWriteTools } from './writeTools';
import { buildExploreTools } from './exploreTools';
import { getAllCareerPaths } from '@/db/careerStorage';
import { getContactsByUser, computeOverdue } from '@/db/queries/social';
import type { ActionQueue } from './actionQueue';
import type { AgentTool } from './runtime';

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const TOP_CATEGORIES = 6;
const TOP_MERCHANTS = 5;

/**
 * A read-only "where did my money go?" tool. Summarises recent spending (debits)
 * from the on-device finance store: total spent, a breakdown by category (with %
 * of total), and the top merchants, over a recent window. Amounts are converted
 * from paise to whole INR rupees so the model speaks natural numbers.
 *
 * Finance data is sensitive and stays on-device — this tool runs locally beside
 * the data, like every other agent tool. Nothing is sent to the proxy.
 */
function recentSpendingTool(ctx: ToolContext): AgentTool {
  return {
    declaration: {
      name: 'getRecentSpending',
      description:
        "The user's recent spending from their linked bank/UPI accounts: total spent, a " +
        'breakdown by category (with % of total), and top merchants, over a recent window. ' +
        "Amounts are in INR rupees. Use this to answer 'where did my money go?' and other " +
        'spending questions.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: `How many days back to summarise. Default ${DEFAULT_WINDOW_DAYS}.`,
          },
        },
      },
    },
    execute: async (args) => {
      const requested =
        typeof args.days === 'number' && args.days > 0 ? args.days : DEFAULT_WINDOW_DAYS;
      const days = Math.min(requested, MAX_WINDOW_DAYS);
      const end = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
      const start = format(subDays(parseISO(end), days - 1), 'yyyy-MM-dd');

      const debits = (await getTransactionsInRange(start, end)).filter(
        (t) => t.direction === 'debit',
      );
      if (debits.length === 0) {
        return {
          currency: 'INR',
          windowDays: days,
          totalSpentRupees: 0,
          byCategory: [],
          topMerchants: [],
          note: 'No transactions in this window. The user may not have synced their accounts (Gmail) yet.',
        };
      }

      const toRupees = (paise: number) => Math.round(paise / 100);
      const total = debits.reduce((sum, t) => sum + t.amount, 0);

      const byCategoryMap = new Map<string, number>();
      for (const t of debits) {
        byCategoryMap.set(t.category, (byCategoryMap.get(t.category) ?? 0) + t.amount);
      }
      const byCategory = Array.from(byCategoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_CATEGORIES)
        .map(([category, amount]) => ({
          category,
          amountRupees: toRupees(amount),
          pct: Math.round((amount / total) * 100),
        }));

      const topMerchants = merchantRollups(debits)
        .slice(0, TOP_MERCHANTS)
        .map((m) => ({ merchant: m.merchant, amountRupees: toRupees(m.total), count: m.count }));

      return {
        currency: 'INR',
        windowDays: days,
        totalSpentRupees: toRupees(total),
        byCategory,
        topMerchants,
      };
    },
  };
}

/**
 * A read-only "what should I eat?" tool. Returns the user's nutrition so far
 * today against their personalised calorie/macro target — consumed, target, and
 * what's remaining — plus their health goal, so the voice agent can ground meal
 * and lunch suggestions in real data instead of guessing. Reuses the same
 * Mifflin–St Jeor engine (`calorieTargets`) the Health screen shows; when vitals
 * are missing it returns the generic estimate flagged `personalised: false`.
 *
 * Health data is sensitive and stays on-device; this runs locally.
 */
function todayNutritionTool(ctx: ToolContext): AgentTool {
  return {
    declaration: {
      name: 'getTodayNutrition',
      description:
        "The user's nutrition so far today vs their personalised calorie/macro target: " +
        'calories and protein/carbs/fat consumed, the target, what is remaining, and their ' +
        "health goal. Use this to answer 'what should I eat?', lunch/meal suggestions, and " +
        'whether they are on track today. Targets are guidance, not medical advice.',
      parameters: { type: 'object', properties: {} },
    },
    execute: () => {
      const today = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
      const user = getUser();
      const latestWeight = getRecentWeightLogs(1)[0]?.weight ?? null;
      const target = calorieTargets({
        weightKg: latestWeight,
        heightCm: user?.heightCm ?? null,
        age: user?.age ?? null,
        sex: user?.sex ?? null,
        activityLevel: user?.activityLevel ?? null,
        goalType: user?.healthGoalType ?? null,
      });

      const entries = getFoodEntriesByDate(today);
      const consumed = entries.reduce(
        (acc, e) => ({
          calories: acc.calories + (e.calories ?? 0),
          protein: acc.protein + (e.protein ?? 0),
          carbs: acc.carbs + (e.carbs ?? 0),
          fat: acc.fat + (e.fat ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const r = (n: number) => Math.round(n);

      return {
        goal: user?.healthGoalType ?? 'maintain',
        personalised: target.estimated,
        mealsLoggedToday: entries.length,
        target: { calories: target.calories, protein: target.protein, carbs: target.carbs, fat: target.fat },
        consumed: { calories: r(consumed.calories), protein: r(consumed.protein), carbs: r(consumed.carbs), fat: r(consumed.fat) },
        remaining: {
          calories: r(target.calories - consumed.calories),
          protein: r(target.protein - consumed.protein),
          carbs: r(target.carbs - consumed.carbs),
          fat: r(target.fat - consumed.fat),
        },
        note: target.estimated
          ? undefined
          : 'Target is a generic estimate — the user has not set their age/vitals. Suggest they add their age to personalise it.',
      };
    },
  };
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const INTERACTION_TYPES = ['call', 'message', 'in_person', 'email', 'other'] as const;

/**
 * "Add a goal" tool. Propose-only: it does NOT create anything — it pushes a
 * proposal the user confirms, after which the companion opens the Goals tab
 * pre-filled with this vision and runs the existing break-it-down flow. Collect
 * the user's goal in their own words first.
 */
function proposeCreateGoalTool(queue: ActionQueue): AgentTool {
  return {
    declaration: {
      name: 'proposeCreateGoal',
      description:
        "Propose creating a new goal and breaking it into a plan, from the user's own words " +
        '(e.g. "I want to run a marathon"). Does NOT create it — the user confirms first, then ' +
        'the Goals screen opens and builds the plan. Capture their goal as a single vision sentence.',
      parameters: {
        type: 'object',
        properties: {
          visionStatement: {
            type: 'string',
            description: "The goal in the user's words, e.g. 'I want to switch into product management'.",
          },
        },
        required: ['visionStatement'],
      },
    },
    execute: (args) => {
      const visionStatement = asString(args.visionStatement);
      if (!visionStatement) return { proposed: false, error: 'visionStatement is required' };
      queue.propose({
        kind: 'createGoalFromVision',
        summary: `Create & break down a goal: "${visionStatement}"`,
        payload: { visionStatement },
      });
      return { proposed: true };
    },
  };
}

/**
 * "Build my career path" tool. Propose-only. The model must gather the required
 * fields conversationally first (ask for the timeline if the user didn't say
 * one) — the schema marks them required so a half-formed call is rejected and
 * the model asks again. On confirm the companion opens Career pre-filled and
 * runs the existing strategy generator.
 */
function proposeCareerPathTool(queue: ActionQueue): AgentTool {
  return {
    declaration: {
      name: 'proposeGenerateCareerPath',
      description:
        'Propose generating a career path/upskill plan. Does NOT generate it — the user confirms ' +
        'first, then the Career screen opens and generates it. Before calling, make sure you know ' +
        'the current role, the target role, and a timeline (in months) — ASK the user for whatever ' +
        'is missing rather than guessing. weeklyHours and constraints are optional extras worth asking for.',
      parameters: {
        type: 'object',
        properties: {
          currentRole: { type: 'string', description: 'The user\'s current role, e.g. "Software Engineer".' },
          targetRole: { type: 'string', description: 'The role they want, e.g. "Engineering Manager".' },
          timelineMonths: { type: 'number', description: 'Target timeline in months, e.g. 24.' },
          weeklyHours: { type: 'number', description: 'Optional: hours per week they can commit.' },
          constraints: { type: 'string', description: 'Optional: constraints, e.g. "full-time job, toddler at home".' },
        },
        required: ['currentRole', 'targetRole', 'timelineMonths'],
      },
    },
    execute: (args) => {
      const currentRole = asString(args.currentRole);
      const targetRole = asString(args.targetRole);
      const timelineMonths = typeof args.timelineMonths === 'number' ? args.timelineMonths : null;
      if (!currentRole || !targetRole || !timelineMonths || timelineMonths <= 0) {
        return {
          proposed: false,
          error: 'currentRole, targetRole and a positive timelineMonths are required',
        };
      }
      const weeklyHours =
        typeof args.weeklyHours === 'number' && args.weeklyHours > 0 ? args.weeklyHours : undefined;
      const constraints = asString(args.constraints) ?? undefined;
      queue.propose({
        kind: 'generateCareerPath',
        summary: `Generate a career path: ${currentRole} → ${targetRole} over ${timelineMonths} months`,
        payload: { currentRole, targetRole, timelineMonths, weeklyHours, constraints },
      });
      return { proposed: true };
    },
  };
}

/**
 * "Sync my Google Fit" tool. INSTANT (idempotent, low-risk) — it syncs and
 * persists immediately and returns a compact summary the agent narrates ("tell
 * me what you see"). Mirrors the Health screen's Sync button via `syncAndPersistFit`.
 */
function syncGoogleFitTool(): AgentTool {
  const DEFAULT_DAYS = 14;
  const MAX_DAYS = 30;
  return {
    declaration: {
      name: 'syncGoogleFit',
      description:
        "Sync the user's Google Fit data now and get a summary (steps, sleep, workouts, weight, " +
        'recovery). Use when the user asks to sync their fitness/Fit data or wants to know what ' +
        'their recent activity looks like. Runs immediately — no confirmation needed.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: `How many days back to sync. Default ${DEFAULT_DAYS}.`,
          },
        },
      },
    },
    execute: async (args) => {
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        return { synced: false, error: 'Google is not configured on this build.' };
      }
      const requested = typeof args.days === 'number' && args.days > 0 ? args.days : DEFAULT_DAYS;
      const days = Math.min(requested, MAX_DAYS);
      try {
        // Lazy import so the (stores + Fit client) graph only loads when the
        // user actually syncs — keeps the tool module light to import.
        const { syncAndPersistFit } = await import('@/integrations/googleFit/sync');
        const summary = await syncAndPersistFit(clientId, days);
        return { synced: true, ...summary };
      } catch (err) {
        return {
          synced: false,
          error:
            err instanceof Error
              ? err.message
              : 'Could not sync — the user may need to connect Google Fit on the Health screen.',
        };
      }
    },
  };
}

/**
 * Spoken-confirm commit. The user can tap a confirm card OR just say "yes/do
 * it" — in the latter case the model calls this to apply everything it has
 * proposed this turn. The actual commit (DB writes via commitActions, or
 * navigate-and-generate for goal/career intents) is performed by the companion,
 * passed in as `commitPending`. Only call after the user has clearly agreed.
 */
function commitPendingActionsTool(commitPending: () => Promise<{ committed: number }>): AgentTool {
  return {
    declaration: {
      name: 'commitProposedActions',
      description:
        'Apply everything you have proposed this turn, once the user has clearly agreed (said ' +
        '"yes", "do it", "go ahead", etc.). Do NOT call this until the user has confirmed. Returns ' +
        'how many actions were applied (0 means there was nothing pending).',
      parameters: { type: 'object', properties: {} },
    },
    execute: async () => commitPending(),
  };
}

/**
 * Read-only "what's my career plan?" tool. Returns the user's saved career
 * path(s) — current/target role, timeline, current skills, and the top skill
 * gaps to close — so the agent can talk about an EXISTING plan, not just offer
 * to generate a new one. (Career paths persist on web; native returns none.)
 */
function careerStateTool(): AgentTool {
  return {
    declaration: {
      name: 'getCareerState',
      description:
        "The user's saved career path(s): current role, target role, timeline, current skills, " +
        'and the top skill gaps to close. Use this to answer questions about their career plan, ' +
        'what skills they need, or how their plan looks. Empty means no path yet — offer to build one.',
      parameters: { type: 'object', properties: {} },
    },
    execute: () => {
      const paths = getAllCareerPaths();
      if (paths.length === 0) {
        return {
          hasPath: false,
          note: "No career path saved yet — offer to build one (proposeGenerateCareerPath) or open the Career screen.",
        };
      }
      const sorted = [...paths].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      return {
        hasPath: true,
        count: sorted.length,
        paths: sorted.slice(0, 3).map((p) => ({
          name: p.name,
          currentRole: p.currentRole,
          targetRole: p.targetRole,
          timelineMonths: p.timelineMonths,
          currentSkills: p.currentSkills,
          topGaps: [...p.analysis.gaps]
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 5)
            .map((g) => ({ skill: g.skill, from: g.currentLevel, to: g.requiredLevel })),
          savedAt: p.savedAt.slice(0, 10),
        })),
      };
    },
  };
}

/**
 * "Explore this idea" tool. Propose-only: it does NOT open anything — it pushes
 * a proposal the user confirms, after which the companion opens the Explore
 * rabbit hole on that idea (a single-idea Dive, or a cross-discipline Bridge
 * when `bridgeWith` is given). Reuses the same launch path as the Explore tab.
 */
function proposeExploreIdeaTool(queue: ActionQueue): AgentTool {
  return {
    declaration: {
      name: 'proposeExploreIdea',
      description:
        'Propose opening a deep-dive exploration (a "rabbit hole") on an idea the user is curious ' +
        'about. Does NOT open it — the user confirms first, then the Explore rabbit hole opens and ' +
        'they can branch deeper. Pass `topic` for one idea; also pass `bridgeWith` to connect TWO ' +
        'ideas across disciplines (e.g. topic "cooking", bridgeWith "chemistry"). Use when the user ' +
        'wants to explore / dig into / get curious about something.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The idea to explore, in the user\'s words, e.g. "how cities grow".' },
          bridgeWith: { type: 'string', description: 'Optional second idea to bridge with, for a cross-discipline exploration.' },
        },
        required: ['topic'],
      },
    },
    execute: (args) => {
      const topic = asString(args.topic);
      if (!topic) return { proposed: false, error: 'topic is required' };
      const bridgeWith = asString(args.bridgeWith) ?? undefined;
      queue.propose({
        kind: 'exploreIdea',
        summary: bridgeWith ? `Explore "${topic}" × "${bridgeWith}"` : `Explore "${topic}"`,
        payload: bridgeWith ? { topic, bridgeWith } : { topic },
      });
      return { proposed: true };
    },
  };
}

/**
 * Read-only contacts list WITH a `ref` per contact (the overdue summary in
 * buildLifeOsTools exposes names only). The agent needs the ref to log a
 * reconnect via proposeLogContact, and `overdueByDays` lets it answer "who
 * should I reach out to?". Social data is sensitive and stays on-device.
 */
function contactsTool(ctx: ToolContext): AgentTool {
  return {
    declaration: {
      name: 'getContacts',
      description:
        "The user's contacts, each with a `ref` (use it for proposeLogContact), their relationship, " +
        'and how overdue a reconnect is (overdueByDays > 0 means overdue). Use to find a contact ' +
        "before logging a reconnect, or to answer who they're due to reach out to.",
      parameters: { type: 'object', properties: {} },
    },
    execute: () =>
      getContactsByUser(ctx.userId).map((cn) => ({
        ref: cn.id,
        name: cn.name,
        relationship: cn.relationshipType,
        overdueByDays: computeOverdue(cn).overdueBy,
      })),
  };
}

/**
 * "Log what I ate" tool. Propose-only: pushes a logFood proposal the user
 * confirms, after which it is SAVED to today's food log (commitActions →
 * createFoodEntry). One call per food item; the agent supplies the nutrition
 * estimate (it is the food-logging engine here).
 */
function proposeLogFoodTool(queue: ActionQueue, today: string): AgentTool {
  return {
    declaration: {
      name: 'proposeLogFood',
      description:
        'Propose logging ONE food or drink item the user said they ate. Does NOT log it — the user ' +
        'confirms first, then it is saved. Provide your best estimate of grams + calories + macros ' +
        '(protein/carbs/fat), like a food logger. For a meal with several items, call this once per ' +
        'item. mealType is breakfast | lunch | dinner | snack (default snack).',
      parameters: {
        type: 'object',
        properties: {
          foodName: { type: 'string', description: 'The food/drink, e.g. "2 boiled eggs".' },
          quantityG: { type: 'number', description: 'Approx quantity in grams.' },
          calories: { type: 'number', description: 'Estimated calories (kcal).' },
          protein: { type: 'number', description: 'Estimated protein (g).' },
          carbs: { type: 'number', description: 'Estimated carbs (g).' },
          fat: { type: 'number', description: 'Estimated fat (g).' },
          mealType: { type: 'string', description: 'breakfast | lunch | dinner | snack. Default snack.' },
          date: { type: 'string', description: 'yyyy-MM-dd. Defaults to today.' },
        },
        required: ['foodName', 'quantityG', 'calories', 'protein', 'carbs', 'fat'],
      },
    },
    execute: (args) => {
      const foodName = asString(args.foodName);
      const quantityG = asNumber(args.quantityG);
      const calories = asNumber(args.calories);
      const protein = asNumber(args.protein);
      const carbs = asNumber(args.carbs);
      const fat = asNumber(args.fat);
      if (!foodName || quantityG == null || calories == null || protein == null || carbs == null || fat == null) {
        return { proposed: false, error: 'foodName + numeric quantityG, calories, protein, carbs, fat are required' };
      }
      const mealType = asString(args.mealType) ?? 'snack';
      const date = asString(args.date) ?? today;
      queue.propose({
        kind: 'logFood',
        summary: `Log ${foodName} (~${Math.round(calories)} kcal)`,
        payload: { date, mealType, foodName, quantityG, calories, protein, carbs, fat },
      });
      return { proposed: true };
    },
  };
}

/** "Log my weight" tool. Propose-only → saved on confirm (createHealthLog). */
function proposeLogWeightTool(queue: ActionQueue, today: string): AgentTool {
  return {
    declaration: {
      name: 'proposeLogWeight',
      description:
        "Propose logging the user's body weight in kilograms. Does NOT log it — the user confirms " +
        'first, then it is saved to their health log.',
      parameters: {
        type: 'object',
        properties: {
          weightKg: { type: 'number', description: 'Body weight in kg, e.g. 70.5.' },
          date: { type: 'string', description: 'yyyy-MM-dd. Defaults to today.' },
        },
        required: ['weightKg'],
      },
    },
    execute: (args) => {
      const weightKg = asNumber(args.weightKg);
      if (weightKg == null || weightKg <= 0) return { proposed: false, error: 'a positive weightKg is required' };
      const date = asString(args.date) ?? today;
      queue.propose({ kind: 'logWeight', summary: `Log weight ${weightKg} kg`, payload: { date, weightKg } });
      return { proposed: true };
    },
  };
}

/**
 * "Log that I reached out" tool. Propose-only → on confirm logs the interaction
 * AND marks the contact recently-contacted (commitActions → logInteraction).
 * `ref` comes from getContacts.
 */
function proposeLogContactTool(queue: ActionQueue): AgentTool {
  return {
    declaration: {
      name: 'proposeLogContact',
      description:
        'Propose logging that the user reached out to a contact (this also marks them recently ' +
        'contacted, clearing an overdue nudge). Does NOT log it — the user confirms first. `ref` is ' +
        'the contact ref from getContacts. type is call | message | in_person | email | other.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Contact ref from getContacts.' },
          type: { type: 'string', description: 'call | message | in_person | email | other. Default other.' },
          notes: { type: 'string', description: 'Optional short note about the interaction.' },
        },
        required: ['ref'],
      },
    },
    execute: (args) => {
      const ref = asString(args.ref);
      if (!ref) return { proposed: false, error: 'ref is required' };
      const requested = asString(args.type);
      const type = (INTERACTION_TYPES as readonly string[]).includes(requested ?? '') ? (requested as string) : 'other';
      const notes = asString(args.notes) ?? undefined;
      queue.propose({
        kind: 'logContactInteraction',
        summary: `Log a ${type} with a contact`,
        payload: notes ? { ref, type, notes } : { ref, type },
      });
      return { proposed: true };
    },
  };
}

/** Deps the companion injects to turn on the agentic (act-capable) tool set. */
export interface VoiceAgentDeps {
  /** Queue the propose tools push onto; the companion renders + commits it. */
  queue: ActionQueue;
  /** Apply every confirmed action (spoken-yes path). */
  commitPending: () => Promise<{ committed: number }>;
}

/**
 * The tool set the voice assistant can call. The base set is read-only
 * (`buildLifeOsTools` — goals, today's routine, sleep, momentum, contacts — plus
 * a finance spending summary and today's nutrition) so the agent can ground its
 * answers in the user's real data, exactly like the text "what should I do next?"
 * agent does.
 *
 * When `agent` is supplied (companion + the `voice_agent_actions` flag on), the
 * agentic tools are appended: navigation/screen-context (instant), the
 * propose-only write tools (routine/goal), and the voice-specific
 * propose/sync/commit tools. Everything that writes still goes through
 * propose→confirm; navigation and Fit-sync are instant. All tools run on-device.
 */
export function buildVoiceTools(ctx: ToolContext, agent?: VoiceAgentDeps): AgentTool[] {
  const base = [
    ...buildLifeOsTools(ctx),
    recentSpendingTool(ctx),
    todayNutritionTool(ctx),
    // Explore (curiosity) + career are now grounded too: interests / sparks /
    // expeditions and the saved career path(s) — read-only, always on. Contacts
    // (with refs) ground "who should I reach out to?" + enable logging below.
    ...buildExploreTools({ userId: ctx.userId }),
    careerStateTool(),
    contactsTool(ctx),
  ];
  if (!agent) return base;
  const today = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
  return [
    ...base,
    ...buildNavTools(ctx),
    ...buildLifeOsWriteTools({ today: ctx.today }, agent.queue),
    proposeCreateGoalTool(agent.queue),
    proposeCareerPathTool(agent.queue),
    proposeExploreIdeaTool(agent.queue),
    proposeLogFoodTool(agent.queue, today),
    proposeLogWeightTool(agent.queue, today),
    proposeLogContactTool(agent.queue),
    syncGoogleFitTool(),
    commitPendingActionsTool(agent.commitPending),
  ];
}
