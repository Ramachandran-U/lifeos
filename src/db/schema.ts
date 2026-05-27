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
  visionStatement: text('vision_statement'),
  wakeTime: text('wake_time'),
  sleepTime: text('sleep_time'),
  workStartTime: text('work_start_time'),
  workEndTime: text('work_end_time'),
  sleepTargetHours: integer('sleep_target_hours'), // Day 3 onboarding: target hours/night
  healthGoalType: text('health_goal_type'), // Day 3 onboarding: build_strength | lose_weight | gain_endurance | improve_sleep | reduce_stress | maintain
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
