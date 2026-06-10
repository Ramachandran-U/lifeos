import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Users ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  name: text('name').notNull(),
  age: integer('age'),
  heightCm: real('height_cm'),
  sex: text('sex'), // 'male' | 'female' — used for exact BMR; optional
  activityLevel: text('activity_level'), // sedentary | light | moderate | active | very_active
  visionStatement: text('vision_statement'),
  wakeTime: text('wake_time'),
  sleepTime: text('sleep_time'),
  workStartTime: text('work_start_time'),
  workEndTime: text('work_end_time'),
  sleepTargetHours: integer('sleep_target_hours'), // Day 3 onboarding: target hours/night
  healthGoalType: text('health_goal_type'), // Day 3 onboarding: build_strength | lose_weight | gain_endurance | improve_sleep | reduce_stress | maintain
  avatarUri: text('avatar_uri'), // file:// URI of the generated gamified avatar (on-device only)
  avatarSourceUri: text('avatar_source_uri'), // file:// URI of the original photo, kept for regeneration
  onboardingStage: integer('onboarding_stage').notNull().default(0),
  primaryDomains: text('primary_domains'), // JSON string[] — user's chosen focus domains from welcome-intent
  activatedModules: text('activated_modules'), // JSON string[] — modules user has supplied data for
  installDate: text('install_date'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

// --- Goals ---
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  goalType: text('goal_type').notNull(), // career | health | finance | learning | personal | social
  parentId: text('parent_id'),
  level: text('level').notNull(), // life | yearly | monthly | weekly | daily
  timeline: text('timeline'),
  status: text('status').notNull().default('active'), // active | completed | paused | abandoned
  energyLevel: text('energy_level'), // low | medium | high
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).default(false),
  metadata: text('metadata'), // JSON
  priority: integer('priority').notNull().default(0), // 0 = default; lower = higher priority
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

// --- Goal Comments ---
export const goalComments = sqliteTable('goal_comments', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  userId: text('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Routine Blocks ---
export const routineBlocks = sqliteTable('routine_blocks', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(), // HH:MM
  title: text('title').notNull(),
  module: text('module').notNull(), // goal | health | finance | career | social | polymath | rest | work | meal
  linkedEntityId: text('linked_entity_id'),
  status: text('status').notNull().default('upcoming'), // upcoming | in_progress | completed | skipped
  calendarEventId: text('calendar_event_id'),
  energyRequired: text('energy_required'), // low | medium | high
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Health Logs ---
export const healthLogs = sqliteTable('health_logs', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD
  weight: real('weight'),
  sleepHours: real('sleep_hours'),
  steps: integer('steps'),
  energyLevel: integer('energy_level'), // 1-5
  waterMl: real('water_ml'), // per-row increment; sum across the day's rows = total intake
  recoveryScore: real('recovery_score'), // 0-100 readiness; latest per day feeds the replanner
  notes: text('notes'),
  source: text('source').notNull().default('manual'), // manual | healthkit | health_connect
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Food Entries ---
export const foodEntries = sqliteTable('food_entries', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD
  mealType: text('meal_type').notNull(), // breakfast | lunch | dinner | snack
  foodName: text('food_name').notNull(),
  quantityG: real('quantity_g').notNull(),
  calories: real('calories').notNull(),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  fibre: real('fibre'),
  source: text('source').notNull().default('manual'), // manual | search | photo
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Blood Reports ---
export const bloodReports = sqliteTable('blood_reports', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD
  reportName: text('report_name').notNull(),
  parsedMarkers: text('parsed_markers'), // JSON
  aiSummary: text('ai_summary'),
  aiSuggestions: text('ai_suggestions'), // JSON
  rawFileUri: text('raw_file_uri'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Interests ---
export const interests = sqliteTable('interests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(), // arts | science | tech | sports | music | writing | language | philosophy | other
  weeklyMinutesTarget: integer('weekly_minutes_target').notNull(),
  weeklyMinutesActual: integer('weekly_minutes_actual').notNull().default(0),
  enjoymentLevel: integer('enjoyment_level'), // 1-5
  explorationDepth: text('exploration_depth').notNull().default('taste'), // taste | hobbyist | deep_dive
  status: text('status').notNull().default('active'), // active | exploring | paused
  discoveredBy: text('discovered_by').notNull().default('user'), // user | ai_suggestion
  timeProtected: integer('time_protected', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Exploration Log ---
export const explorationLog = sqliteTable('exploration_log', {
  id: text('id').primaryKey(),
  interestId: text('interest_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  minutesSpent: integer('minutes_spent').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Financial Goals ---
export const financialGoals = sqliteTable('financial_goals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  goalType: text('goal_type').notNull(), // home | retirement | education | business | emergency_fund | financial_freedom | other
  targetAmount: real('target_amount'),
  currency: text('currency').notNull().default('USD'),
  targetDate: text('target_date'),
  incomeBracket: text('income_bracket'), // under_30k | 30k_50k | 50k_75k | 75k_100k | 100k_150k | 150k_plus
  monthlySavings: real('monthly_savings'),
  riskProfile: text('risk_profile'), // conservative | moderate | aggressive
  status: text('status').notNull().default('active'), // active | completed | paused
  metadata: text('metadata'), // JSON
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Finance Milestones ---
export const financeMilestones = sqliteTable('finance_milestones', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  title: text('title').notNull(),
  targetAmount: real('target_amount').notNull(),
  targetDate: text('target_date').notNull(),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Gamification ---
export const gamification = sqliteTable('gamification', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  domainScores: text('domain_scores').notNull().default('{}'), // JSON: { goals, health, finance, career, social, mind }
  streaks: text('streaks').notNull().default('{}'), // JSON: { workout, learning, foodTracking, journaling, social }
  badges: text('badges').notNull().default('[]'), // JSON: BadgeId[]
  totalXP: integer('total_xp').notNull().default(0),
  weeklyXP: integer('weekly_xp').notNull().default(0),
  // Streak protection (streak_protection_v1). Freezes are EARNED (one per
  // FREEZE_EARN_XP of XP routed through grantXP), banked to a small cap, and
  // auto-consumed by the streak engine when a streak would otherwise reset.
  streakFreezes: integer('streak_freezes').notNull().default(0),
  freezeProgressXP: integer('freeze_progress_xp').notNull().default(0), // XP accrued toward the next freeze
  cosmetics: text('cosmetics').notNull().default('[]'), // JSON: string[] — owned companion-cosmetic ids (chest drops)
  companion: text('companion'), // JSON: { name, createdAt, equipped: string[] } | null until named
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Daily Quests (quests_v2) ---
// Procedurally selected per local day by src/gamification/questEngine.ts
// (template drafts insert synchronously; the AI pass may retitle/retarget
// drafts still at progress 0). Rollover is implicit: a new day_local means new
// rows; old actives are simply ignored. XP is granted only at claim time.
export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  dayLocal: text('day_local').notNull(), // YYYY-MM-DD device-local
  kind: text('kind').notNull().default('daily'), // 'daily' | 'weekly'
  title: text('title').notNull(),
  module: text('module').notNull(), // QuestModule (goal/health/finance/career/social/polymath)
  metricKey: text('metric_key').notNull(), // QuestMetricKey — the progress event it tracks
  target: integer('target').notNull(),
  progress: integer('progress').notNull().default(0),
  xp: integer('xp').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'claimed' | 'rerolled'
  source: text('source').notNull().default('template'), // 'template' | 'ai'
  templateId: text('template_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

// --- Chests (variable_rewards_v1) ---
// Variable-reward chest drops on PEAK moments (all-blocks-complete, streak
// milestones ≥30, all-quests-claimed sweep, comeback), capped at one grant per
// local day. ETHICS BY CONSTRUCTION: chests only ever ADD (xp / freeze /
// cosmetic — see src/gamification/lootTable.ts); there are no timers, no
// expiry, no purchase path, and an unopened chest waits indefinitely. The
// roll is sealed at grant time: `seed` is stored on the row, so the claim
// roll is reproducible and provably untouched by when the user opens it.
export const chests = sqliteTable('chests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  source: text('source').notNull(), // 'peak_beat' | 'milestone' | 'quest_sweep' | 'comeback'
  status: text('status').notNull().default('pending'), // 'pending' | 'opened'
  seed: text('seed').notNull(), // PRNG key fixed at grant; claim roll = rngFromKey(seed)
  contents: text('contents'), // JSON ChestContents — null until claimed
  dayLocal: text('day_local').notNull(), // grant day (device-local) — backs the ≤1/day cap
  grantedAt: text('granted_at').notNull(),
  claimedAt: text('claimed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

// --- XP Events (append-only ledger) ---
// Every XP grant is appended here via grantXP (useGameStore) in addition to
// bumping the gamification counters. Rows are immutable; amounts are always
// positive. This is the league-ready spine: a future server-side weekly league
// is a GROUP BY over synced day_local buckets — no client migration needed.
// Insert-only ⇒ the default sync fold handles it (no CRDT merger required).
export const xpEvents = sqliteTable('xp_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(), // always > 0, immutable
  domain: text('domain'), // DomainKey | null for non-domain sources
  source: text('source').notNull(), // 'block' | 'goal_task' | 'quest' | 'badge' | 'chest' | 'milestone' | 'comeback' | 'food' | 'resource' | 'misc'
  refId: text('ref_id'), // blockId / questId / badgeId / chestId
  dayLocal: text('day_local').notNull(), // YYYY-MM-DD in device-local time
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Daily Reflections ---
export const dailyReflections = sqliteTable('daily_reflections', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD — one reflection per user per day
  mood: integer('mood'), // 1-5
  blockReviews: text('block_reviews').notNull(), // JSON: Record<blockId, 'did' | 'skipped' | 'rescheduled'>
  tweakAccepted: integer('tweak_accepted', { mode: 'boolean' }),
  tweakPayload: text('tweak_payload'), // JSON: the AI suggestion offered
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Discovery Imports ---
export const discoveryImports = sqliteTable('discovery_imports', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  rawText: text('raw_text').notNull(),
  extracted: text('extracted').notNull(), // JSON: DiscoveryExtraction
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Chatbot ---
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- User Profile (Onboarding v2 canonical "what we know about you") ---
export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  profile: text('profile').notNull(), // JSON: UserProfile
  source: text('source').notNull(), // chat | import | form | hybrid
  confidenceOverall: real('confidence_overall').notNull().default(0),
  routineUnlocked: integer('routine_unlocked', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Contacts (Social — on-device only, never synced) ---
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  nickname: text('nickname'),
  relationshipType: text('relationship_type').notNull(), // inner_circle | close_friend | family | mentor | colleague | acquaintance
  preferredCadenceDays: integer('preferred_cadence_days').notNull(),
  lastContactDate: text('last_contact_date'), // YYYY-MM-DD
  notes: text('notes'),
  birthday: text('birthday'), // MM-DD
  source: text('source').notNull().default('manual'), // manual | phone_import
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

// --- Contact Interactions (Social — on-device only) ---
export const contactInteractions = sqliteTable('contact_interactions', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull(), // call | message | in_person | email | other
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Expeditions (Explore v2 — journey definitions, immutable) ---
export const expeditions = sqliteTable('expeditions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  theme: text('theme').notNull(),
  domain: text('domain').notNull().default('polymath'),
  steps: text('steps').notNull().default('[]'), // JSON ExpeditionStep[]
  totalSteps: integer('total_steps').notNull(),
  source: text('source').notNull(), // ai | curated | spark
  seedSparkId: text('seed_spark_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Expedition Progress (one row per user per expedition; synced) ---
export const expeditionProgress = sqliteTable('expedition_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expeditionId: text('expedition_id').notNull(),
  status: text('status').notNull().default('active'), // active | completed | abandoned
  currentStep: integer('current_step').notNull().default(0),
  completedSteps: text('completed_steps').notNull().default('[]'), // JSON int[]
  startedAt: text('started_at').notNull(),
  lastActivityAt: text('last_activity_at').notNull(),
  completedAt: text('completed_at'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Sparks (Explore v2 — the daily curiosity hit) ---
export const sparks = sqliteTable('sparks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD — one spark per user per day
  title: text('title').notNull(),
  body: text('body').notNull(),
  threadStarter: text('thread_starter').notNull(),
  seedInterest: text('seed_interest').notNull().default(''),
  adjacentField: text('adjacent_field').notNull().default(''),
  status: text('status').notNull().default('new'), // new | seen | saved | dismissed | explored
  threadId: text('thread_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Cognitive Insights (Phase 2 cognitive engine) ---
export const cognitiveInsights = sqliteTable('cognitive_insights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(), // domain_stagnation | ...
  domain: text('domain').notNull(), // goals | health | finance | career | social | polymath
  evidence: text('evidence').notNull(), // JSON: { delta, daysFlat, currentScore }
  suggestions: text('suggestions').notNull().default('[]'), // JSON: InsightSuggestion[]
  status: text('status').notNull().default('proposed'), // proposed | shown | accepted | dismissed | expired
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at'),
});

// --- Durable Memory (Phase 2 cognitive engine — long-horizon facts) ---
// Distilled, lasting facts about the user (beyond the 14-day RAG window),
// produced by the consolidation pass from behaviour events + reflections.
export const memoryFacts = sqliteTable('memory_facts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(), // preference | pattern | milestone | constraint
  text: text('text').notNull(), // the fact, one short natural-language sentence
  embedding: text('embedding'), // JSON number[] — for JS-cosine retrieval (no vector DB)
  salience: real('salience').notNull().default(1), // 0..1, decays over time; bumped on re-observation
  sourceWindow: text('source_window'), // e.g. "2026-05-16..2026-05-30"
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false), // exempt from decay/expiry
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at'), // nullable; null = no expiry
});

// Tombstones for facts the user deleted — consolidation skips re-deriving
// anything semantically matching one of these, so "forget" actually sticks.
export const memorySuppressions = sqliteTable('memory_suppressions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  text: text('text').notNull(), // the deleted fact's text (for display/debug)
  embedding: text('embedding'), // JSON number[] — matched by JS-cosine
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Behaviour Events ---
export const behaviourEvents = sqliteTable('behaviour_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(), // block_completed | goal_completed | food_logged | photo_food | weight_logged | blood_report | skill_started | finance_milestone | streak_maintained
  module: text('module').notNull(), // goal | health | finance | career | social | polymath
  metadata: text('metadata'), // JSON
  hour: integer('hour').notNull(), // 0-23
  dayOfWeek: integer('day_of_week').notNull(), // 0-6, 0=Sunday
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- AI Suggestions (outcome tracking — see 0004_ai_suggestions.sql for kill/keep hypothesis) ---
export const aiSuggestions = sqliteTable('ai_suggestions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  task: text('task').notNull(), // e.g. 'routine.generate', 'goal.decompose'
  variant: text('variant').notNull(), // 'single_shot' | 'agent'
  model: text('model'),
  inputHash: text('input_hash').notNull(), // SHA-256 of canonicalised input; raw input not stored
  outputSummary: text('output_summary'), // short opaque summary
  outputRef: text('output_ref'), // foreign id pointing to the durable artefact (routine date, goal id, ...)
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const suggestionOutcomes = sqliteTable('suggestion_outcomes', {
  id: text('id').primaryKey(),
  suggestionId: text('suggestion_id').notNull(),
  windowDays: integer('window_days').notNull(), // 14 for the kill/keep decision
  blocksTotal: integer('blocks_total'),
  blocksCompleted: integer('blocks_completed'),
  completionRate: real('completion_rate'), // blocks_completed / blocks_total
  domainScoreDelta: real('domain_score_delta'), // context only; NOT the kill/keep metric
  measuredAt: text('measured_at').notNull().default(sql`(datetime('now'))`),
});

// --- Rabbit-Hole Trees (Explore v3 — the navigable decision-tree map) ---
// One row per rabbit-hole tree. The WHOLE tree is a single JSON blob so the web
// render path reads it synchronously and the layout stays a pure function of one
// object (see docs/rabbit-hole-tree-map-redesign.md). LOCAL ONLY for now —
// rabbit-hole sync is parked to Phase 7, so writes are NOT routed through the
// mutation log. `sparks.thread_id` is stamped with this row's id on creation.
export const rabbitHoleTrees = sqliteTable('rabbit_hole_trees', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sparkId: text('spark_id').notNull(),
  anchorJson: text('anchor_json').notNull(), // JSON: RabbitHoleAnchor
  treeJson: text('tree_json').notNull(), // JSON: { nodeMap, rootId, cursorId }
  scoringJson: text('scoring_json').notNull(), // JSON: RabbitHoleScoring (idempotency ledger)
  title: text('title'), // null until the user (optionally) names the map
  xpAwarded: integer('xp_awarded').notNull().default(0), // running total banked so far
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'), // soft delete; 90-day prune
});

// --- Constellation Edges (Explore v3 — local edge source for the star-map) ---
// Rabbit-hole journeys emit led_to / synapse edges here on qualifying milestones;
// projectConstellation() reads them as an EXTRA edge source. Local + rebuildable;
// bypasses the sync mutation log (the sync union has no rabbit-hole type yet).
export const constellationEdges = sqliteTable('constellation_edges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromId: text('from_id').notNull(),
  toId: text('to_id').notNull(),
  relation: text('relation').notNull(), // within | synapse | led_to
  weight: integer('weight').notNull().default(1),
  sourceTreeId: text('source_tree_id'), // the rabbit-hole tree that produced it
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
