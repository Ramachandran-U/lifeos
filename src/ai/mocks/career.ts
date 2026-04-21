import { SkillGapAnalysis, CareerStrategy, CareerStrategyInput, Motivation, MotivationInput } from '../types';

export function buildMockSkillGap(
  currentRole: string,
  targetRole: string,
  currentSkills: string[],
): SkillGapAnalysis {
  const existingSkillGaps = currentSkills.slice(0, 3).map((skill, i) => ({
    skill,
    currentLevel: 'intermediate' as const,
    requiredLevel: 'advanced' as const,
    priority: i + 1,
  }));

  const genericGaps = [
    {
      skill: `Core knowledge required for ${targetRole}`,
      currentLevel: 'beginner' as const,
      requiredLevel: 'advanced' as const,
      priority: existingSkillGaps.length + 1,
    },
    {
      skill: 'Communication & stakeholder management',
      currentLevel: 'beginner' as const,
      requiredLevel: 'expert' as const,
      priority: existingSkillGaps.length + 2,
    },
    {
      skill: `Practical experience in ${targetRole} responsibilities`,
      currentLevel: 'none' as const,
      requiredLevel: 'intermediate' as const,
      priority: existingSkillGaps.length + 3,
    },
  ];

  const gaps = [...existingSkillGaps, ...genericGaps];

  return mockSkillGapFromGaps(gaps, currentRole, targetRole);
}

function mockSkillGapFromGaps(
  gaps: SkillGapAnalysis['gaps'],
  currentRole: string,
  targetRole: string,
): SkillGapAnalysis {
  return {
    gaps,
    resources: [
      { title: `Beginner's guide to ${targetRole}`, type: 'course', estimatedHours: 15 },
      { title: `From ${currentRole} to ${targetRole}: career transition strategies`, type: 'book', estimatedHours: 8 },
      { title: `Build a portfolio project relevant to ${targetRole}`, type: 'project', estimatedHours: 30 },
      { title: `Find a mentor currently working as a ${targetRole}`, type: 'course', estimatedHours: 10 },
    ],
  };
}

export function buildMockCareerStrategy(input: CareerStrategyInput): CareerStrategy {
  const { currentRole, targetRole, timeframeWeeks, weeklyHours } = input;
  const weeks = Math.max(6, timeframeWeeks);
  const foundationEnd = Math.round(weeks * 0.33);
  const buildEnd = Math.round(weeks * 0.75);

  const weeklyOutput = Array.from({ length: weeks }, (_, i) => {
    const w = i + 1;
    if (w <= foundationEnd) {
      return {
        week: w,
        artifact: `Reading log + 1 implementation exercise`,
        description: `Published notes covering the week's core concepts plus one runnable code artifact checked into a public repo.`,
      };
    }
    if (w <= buildEnd) {
      return {
        week: w,
        artifact: `Feature shipped on portfolio project`,
        description: `One end-to-end feature merged, with a short write-up explaining the trade-offs you chose.`,
      };
    }
    return {
      week: w,
      artifact: `Proof artifact: demo, post, or interview`,
      description: `One public signal that a ${targetRole} hiring manager would read — demo video, technical post, or practitioner conversation.`,
    };
  });

  return {
    realityCheck: `Moving from ${currentRole} to ${targetRole} in ${weeks} weeks at ~${weeklyHours}h/week is tight but not fantasy — provided you stop consuming and start shipping by week 3. The biggest risk isn't knowledge; it's pattern-matching tutorials into the feeling of progress without producing artifacts a hiring manager can evaluate. Most people in this transition fail because they underestimate the interview-signal gap, not the skill gap.`,
    skillGaps: [
      { skill: `Core depth required for ${targetRole}`, currentLevel: 'working knowledge', requiredLevel: 'can design from first principles', priority: 'must' },
      { skill: `System design for ${targetRole} problems`, currentLevel: 'tutorial-level', requiredLevel: 'production-level trade-offs', priority: 'must' },
      { skill: 'Public technical writing', currentLevel: 'rarely writes', requiredLevel: 'publishes 1 post/2 weeks', priority: 'should' },
      { skill: 'Portfolio project relevant to target role', currentLevel: 'none shipped', requiredLevel: '1 deployed, documented project', priority: 'must' },
      { skill: `Stakeholder communication in ${targetRole} context`, currentLevel: 'follows instructions', requiredLevel: 'scopes + defends decisions', priority: 'should' },
      { skill: 'Interview signal (practitioner network)', currentLevel: '0 referrals', requiredLevel: '3+ conversations with target-role practitioners', priority: 'nice' },
    ],
    phases: [
      {
        name: 'Foundation',
        weeks: `1-${foundationEnd}`,
        focus: 'Close the knowledge gap fast enough to start building in week 4.',
        milestones: [
          `Complete one deep course on core ${targetRole} fundamentals`,
          `Ship 3 small implementation exercises to a public repo`,
          `Publish 1 short post summarising what you learned`,
        ],
      },
      {
        name: 'Build',
        weeks: `${foundationEnd + 1}-${buildEnd}`,
        focus: 'Ship a portfolio project that a practitioner would take seriously.',
        milestones: [
          'Scope one project that a hiring manager would recognise as real work',
          'Deploy it publicly with a written trade-off doc',
          'Get it reviewed by at least one practitioner',
        ],
      },
      {
        name: 'Proof',
        weeks: `${buildEnd + 1}-${weeks}`,
        focus: 'Convert work into interview signal.',
        milestones: [
          'Publish 1 technical post tied to the project',
          'Have 3 conversations with target-role practitioners',
          'Apply to 10+ target-role positions with tailored material',
        ],
      },
    ],
    dailyPlan: {
      deepWork: [
        '45 min: implement one core concept from scratch, no tutorial',
        '30 min: read 1 primary source (paper, docs, codebase) and take Feynman-style notes',
      ],
      build: [
        '60 min: move portfolio project forward by one merged commit',
        '30 min: write one short paragraph documenting what you built and why',
      ],
      review: [
        '15 min: rewrite yesterday\'s notes in your own words',
        '10 min: log blockers into the goal card for today',
      ],
    },
    weeklyOutput,
    failurePoints: [
      'Watching tutorials for week 3+ without shipping a single commit',
      'Over-scoping the portfolio project so it never reaches "deployed"',
      'Skipping the write-up — without a public artifact the work is invisible',
      'Networking only after the project is "perfect" — it never is',
      'Treating weekly hours as aspirational; if you can\'t protect 80% of them, reduce scope, not quality',
    ],
    mvs: {
      metric: `1 deployed, documented ${targetRole}-relevant project + 1 public write-up + 3 practitioner conversations`,
      outcome: `By week ${weeks}: a URL you can send to a hiring manager + a post they can read + 3 people who will vouch for you. Binary: you have these or you don't.`,
    },
  };
}

export function buildMockMotivation(input: MotivationInput): Motivation {
  const { module, context } = input;
  const snippet = context.slice(0, 40).trim() || module;
  return {
    quote: `"${snippet}" only pays off if you ship a visible artifact this week — otherwise it's consumption dressed as progress.`,
    microTip: `Pick one concrete output for ${module} and book 60 minutes on your calendar right now.`,
  };
}
