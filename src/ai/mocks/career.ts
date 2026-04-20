import { SkillGapAnalysis } from '../types';

export function buildMockSkillGap(
  currentRole: string,
  targetRole: string,
  currentSkills: string[],
): SkillGapAnalysis {
  // Build gap list: mark user's existing skills as intermediate, add 3 generic gaps for the target role
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

  return {
    gaps,
    resources: [
      {
        title: `Beginner's guide to ${targetRole}`,
        type: 'course',
        estimatedHours: 15,
      },
      {
        title: `From ${currentRole} to ${targetRole}: career transition strategies`,
        type: 'book',
        estimatedHours: 8,
      },
      {
        title: `Build a portfolio project relevant to ${targetRole}`,
        type: 'project',
        estimatedHours: 30,
      },
      {
        title: `Find a mentor currently working as a ${targetRole}`,
        type: 'course',
        estimatedHours: 10,
      },
    ],
  };
}
