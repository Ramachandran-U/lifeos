import { GoalHierarchy } from '../types';

export function buildMockGoalHierarchy(visionStatement: string, name?: string): GoalHierarchy {
  // Derive a clean primary goal title directly from the user's own words
  const vision = visionStatement.trim();
  // Capitalise first letter, strip trailing period if present
  const primaryTitle = vision.charAt(0).toUpperCase() + vision.slice(1).replace(/\.$/, '');

  return {
    primaryGoal: {
      title: primaryTitle,
      type: 'career',
    },
    yearly: {
      title: `Make serious progress toward: ${primaryTitle}`,
      milestone: `Complete the foundational steps that put this goal within reach`,
    },
    monthly: [
      { month: 1, title: 'Research & Foundation', milestone: 'Understand the full requirements and create a clear roadmap' },
      { month: 2, title: 'Skill Building', milestone: 'Acquire the core skills and knowledge needed for the goal' },
      { month: 3, title: 'First Real Steps', milestone: 'Take the first concrete actions toward the goal and measure progress' },
    ],
    weekly: [
      {
        week: 1,
        focus: 'Research and plan',
        tasks: [
          `Research what it concretely takes to achieve: ${primaryTitle}`,
          'Identify the 3 biggest skill gaps or requirements',
          'Find 2–3 people who have done this and study their path',
        ],
      },
      {
        week: 2,
        focus: 'Build your knowledge base',
        tasks: [
          'Read or watch 3 resources directly related to the goal',
          'Write down the key milestones in your own words',
          'Identify one mentor or community to join',
        ],
      },
      {
        week: 3,
        focus: 'Take the first action',
        tasks: [
          'Complete one small but real step toward the goal',
          'Share your goal with someone who can hold you accountable',
          'Set a 90-day target and write it down',
        ],
      },
      {
        week: 4,
        focus: 'Review and adjust',
        tasks: [
          'Review what you learned and did this month',
          'Adjust your plan based on new information',
          'Commit to one habit that supports this goal daily',
        ],
      },
    ],
    dailyTaskExamples: [
      `Spend 30 min on a skill directly required for: ${primaryTitle}`,
      'Read or watch one piece of educational content on the topic (20 min)',
      'Journal on progress and blockers (10 min)',
      'Do one outreach or networking action related to the goal (15 min)',
      'Review your goal roadmap and update your task list (10 min)',
    ],
  };
}
