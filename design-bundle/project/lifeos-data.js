(function () {
  const DARK = {
    background: '#0D0D0D', surface: '#1A1A2E', surfaceAlt: '#16213E',
    card: '#1F1F3A', border: '#2E2E4A',
    textPrimary: '#FFFFFF', textSecondary: '#A8A8C0', textMuted: '#6B6B88',
    sidebarBg: '#13131F', sidebarBorder: '#2E2E4A', overlay: 'rgba(0,0,0,0.6)',
    goal: '#FF6B35', goalLight: '#3A1E10',
    health: '#00C896', healthLight: '#0A2E22',
    finance: '#F0B429', financeLight: '#2E2208',
    career: '#5B4FE8', careerLight: '#1A1642',
    social: '#FF4D8B', socialLight: '#3A0F1F',
    polymath: '#00B4D8', polymathLight: '#052830',
    xp: '#FFD700', streak: '#FF6B35', badge: '#A855F7',
    primary: '#5B4FE8', primaryLight: '#1A1642',
    success: '#00C896', warning: '#F0B429', error: '#FF4444',
  };

  const LIGHT = {
    background: '#F4F4F8', surface: '#FFFFFF', surfaceAlt: '#EEEEF5',
    card: '#FFFFFF', border: '#DDD9F0',
    textPrimary: '#0D0D1A', textSecondary: '#4A4A6A', textMuted: '#9090B0',
    sidebarBg: '#FFFFFF', sidebarBorder: '#DDD9F0', overlay: 'rgba(0,0,0,0.35)',
    goal: '#FF6B35', goalLight: '#FFF0EB',
    health: '#00C896', healthLight: '#E0FBF4',
    finance: '#F0B429', financeLight: '#FFFBEB',
    career: '#5B4FE8', careerLight: '#EDE9FF',
    social: '#FF4D8B', socialLight: '#FFE8F2',
    polymath: '#00B4D8', polymathLight: '#E0F8FF',
    xp: '#FFD700', streak: '#FF6B35', badge: '#A855F7',
    primary: '#5B4FE8', primaryLight: '#EDE9FF',
    success: '#00C896', warning: '#F0B429', error: '#FF4444',
  };

  // Domain metadata with angle on hex (clockwise from top)
  const DOMAIN_META = [
    { key: 'goals',   label: 'Goals',   emoji: '🎯', colorKey: 'goal',     angle: -90  },
    { key: 'health',  label: 'Health',  emoji: '💚', colorKey: 'health',   angle: -30  },
    { key: 'finance', label: 'Finance', emoji: '💰', colorKey: 'finance',  angle: 30   },
    { key: 'career',  label: 'Career',  emoji: '🚀', colorKey: 'career',   angle: 90   },
    { key: 'social',  label: 'Social',  emoji: '🤝', colorKey: 'social',   angle: 150  },
    { key: 'mind',    label: 'Mind',    emoji: '🔭', colorKey: 'polymath', angle: -150 },
  ];

  const MODULE_META = {
    goal:     { label: 'Goals',   emoji: '🎯', colorKey: 'goal'     },
    health:   { label: 'Health',  emoji: '💚', colorKey: 'health'   },
    finance:  { label: 'Finance', emoji: '💰', colorKey: 'finance'  },
    career:   { label: 'Career',  emoji: '🚀', colorKey: 'career'   },
    social:   { label: 'Social',  emoji: '🤝', colorKey: 'social'   },
    polymath: { label: 'Explore', emoji: '🔭', colorKey: 'polymath' },
  };

  const NAV_ITEMS = [
    { id: 'today',    label: 'Today',    emoji: '☀️'  },
    { id: 'goals',    label: 'Goals',    emoji: '🎯'  },
    { id: 'health',   label: 'Health',   emoji: '💚'  },
    { id: 'finance',  label: 'Finance',  emoji: '💰'  },
    { id: 'career',   label: 'Career',   emoji: '🚀'  },
    { id: 'social',   label: 'Social',   emoji: '🤝'  },
    { id: 'explore',  label: 'Explore',  emoji: '🔭'  },
    { id: 'rewards',  label: 'Rewards',  emoji: '🏆'  },
  ];

  const BADGE_META = {
    first_blueprint:    { label: 'First Blueprint',   emoji: '📋', desc: 'Completed onboarding & built your first routine'       },
    first_blood_report: { label: 'Health Report',     emoji: '🩸', desc: 'Uploaded your first health data report'                },
    streak_30_any:      { label: '30-Day Streak',     emoji: '🔥', desc: 'Maintained any habit streak for 30 consecutive days'   },
    skill_mastery:      { label: 'Skill Master',      emoji: '🧠', desc: 'Completed a full learning resource or course'          },
    life_balance:       { label: 'Life Balance',      emoji: '⚖️',  desc: 'All 6 domain scores above 60 simultaneously'          },
    goal_complete:      { label: 'Goal Crusher',      emoji: '🏆', desc: 'Completed your first major goal milestone'             },
    week_1:             { label: 'Week One',          emoji: '📅', desc: 'Opened LifeOS for 7 consecutive days'                  },
    food_photo:         { label: 'Food Photographer', emoji: '📸', desc: 'Logged a meal using the camera feature'                },
  };

  const STREAK_META = {
    workout:      { label: 'Workout',    emoji: '💪', colorKey: 'health'   },
    learning:     { label: 'Learning',   emoji: '📚', colorKey: 'polymath' },
    foodTracking: { label: 'Food Log',   emoji: '🥗', colorKey: 'health'   },
    journaling:   { label: 'Journaling', emoji: '✍️',  colorKey: 'goal'     },
    social:       { label: 'Social',     emoji: '🤝', colorKey: 'social'   },
  };

  function xpForLevel(n) { return 100 * n * (n + 1) / 2; }

  function levelFromXP(xp) {
    let n = 1;
    while (xpForLevel(n + 1) <= xp) n++;
    return n;
  }

  function xpProgressInLevel(xp) {
    const level = levelFromXP(xp);
    const start = xpForLevel(level);
    const end = xpForLevel(level + 1);
    const pct = Math.min(1, (xp - start) / (end - start));
    return { level, current: xp - start, needed: end - start, pct };
  }

  const MOCK = {
    user: { name: 'Alex Chen', avatar: 'AC' },
    totalXP: 4820,
    weeklyXP: 340,
    xpHistory: [180, 220, 95, 310, 270, 180, 340],
    domainScores: { goals: 72, health: 58, finance: 45, career: 81, social: 33, mind: 67 },
    lastWeekScores: { goals: 65, health: 62, finance: 40, career: 75, social: 28, mind: 60 },
    streaks: {
      workout:      { count: 12, graceUsed: false, best: 18 },
      learning:     { count: 23, graceUsed: false, best: 23 },
      foodTracking: { count: 5,  graceUsed: true,  best: 14 },
      journaling:   { count: 8,  graceUsed: false, best: 21 },
      social:       { count: 2,  graceUsed: false, best: 9  },
    },
    badges: ['first_blueprint', 'week_1', 'goal_complete', 'food_photo'],
    quests: [
      { id: 'q1', title: 'Log 3 meals today',          module: 'health',   xp: 30,  progress: 2, total: 3, type: 'daily'  },
      { id: 'q2', title: 'Complete morning routine',    module: 'goal',     xp: 50,  progress: 3, total: 5, type: 'daily'  },
      { id: 'q3', title: 'Finish a learning resource',  module: 'polymath', xp: 100, progress: 0, total: 1, type: 'weekly' },
    ],
    routineBlocks: [
      { id: 'b1', time: '07:00', title: 'Morning Meditation', module: 'health',   duration: 15, status: 'completed' },
      { id: 'b2', time: '07:30', title: 'Review Goals',       module: 'goal',     duration: 20, status: 'completed' },
      { id: 'b3', time: '09:00', title: 'Deep Work Sprint',   module: 'career',   duration: 90, status: 'active'    },
      { id: 'b4', time: '12:00', title: 'Lunch + Log Food',   module: 'health',   duration: 30, status: 'pending'   },
      { id: 'b5', time: '18:00', title: 'Network Outreach',   module: 'social',   duration: 20, status: 'pending'   },
      { id: 'b6', time: '20:00', title: 'Read / Learn',       module: 'polymath', duration: 45, status: 'pending'   },
    ],
    levelPerks: {
      8:  ['Finance Insights', 'Custom Avatar Frame', '+5% XP Boost'],
      9:  ['Advanced Goal Templates', 'Weekly Report PDF', 'Streak Shield (1/mo)'],
      10: ['AI Coach Mode', 'Priority Briefings', '+10% XP Boost'],
      11: ['LifeOS Premium Badge', 'All Modules Unlocked', 'Founder Status'],
      12: ['Mentor Mode', 'Custom Themes', 'API Access'],
    },
  };

  window.LIFEOS = {
    DARK, LIGHT,
    DOMAIN_META, MODULE_META, NAV_ITEMS,
    BADGE_META, STREAK_META,
    xpForLevel, levelFromXP, xpProgressInLevel,
    MOCK,
  };
})();
