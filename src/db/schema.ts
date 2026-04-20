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
  visionStatement: text('vision_statement'),
  wakeTime: text('wake_time'),
  sleepTime: text('sleep_time'),
  workStartTime: text('work_start_time'),
  workEndTime: text('work_end_time'),
  onboardingStage: integer('onboarding_stage').notNull().default(0),
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
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
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

// --- Contacts ---
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nickname: text('nickname'),
  relationshipType: text('relationship_type').notNull(), // inner_circle | close_friend | family | mentor | colleague | acquaintance
  preferredCadenceDays: integer('preferred_cadence_days').notNull(),
  lastContactDate: text('last_contact_date'),
  notes: text('notes'),
  birthday: text('birthday'), // MM-DD
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

// --- Contact Interactions ---
export const contactInteractions = sqliteTable('contact_interactions', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull(), // call | message | in_person | email | other
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Interests ---
export const interests = sqliteTable('interests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // arts | science | tech | sports | music | writing | language | philosophy | other
  weeklyMinutesTarget: integer('weekly_minutes_target').notNull(),
  weeklyMinutesActual: integer('weekly_minutes_actual').notNull().default(0),
  enjoymentLevel: integer('enjoyment_level'), // 1-5
  explorationDepth: text('exploration_depth').notNull().default('taste'), // taste | hobbyist | deep_dive
  status: text('status').notNull().default('active'), // active | exploring | paused
  discoveredBy: text('discovered_by').notNull().default('user'), // user | ai_suggestion
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

// --- Learning Resources ---
export const learningResources = sqliteTable('learning_resources', {
  id: text('id').primaryKey(),
  careerProfileId: text('career_profile_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // course | book | project | person | practice
  url: text('url'),
  estimatedHours: real('estimated_hours'),
  priority: integer('priority').notNull(),
  status: text('status').notNull().default('not_started'), // not_started | in_progress | completed
  completedAt: text('completed_at'),
  weeklyMinutes: integer('weekly_minutes'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- Skill Gaps ---
export const skillGaps = sqliteTable('skill_gaps', {
  id: text('id').primaryKey(),
  careerProfileId: text('career_profile_id').notNull(),
  skill: text('skill').notNull(),
  currentLevel: text('current_level').notNull(), // none | beginner | intermediate | advanced
  requiredLevel: text('required_level').notNull(), // beginner | intermediate | advanced | expert
  priority: integer('priority').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- Career Profiles ---
export const careerProfiles = sqliteTable('career_profiles', {
  id: text('id').primaryKey(),
  currentRole: text('current_role').notNull(),
  targetRole: text('target_role').notNull(),
  timelineMonths: integer('timeline_months').notNull(),
  currentSkills: text('current_skills'), // JSON string[]
  status: text('status').notNull().default('active'), // active | completed
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
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

// --- Habits ---
export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  module: text('module').notNull(), // goal | health | finance | career | social | polymath
  frequency: text('frequency').notNull().default('daily'), // daily | weekly
  targetCount: integer('target_count').notNull().default(1),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  lastCompletedDate: text('last_completed_date'),
  status: text('status').notNull().default('active'), // active | paused | archived
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
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
