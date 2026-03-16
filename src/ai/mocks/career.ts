import { SkillGapAnalysis } from '../types';

export const MOCK_SKILL_GAP: SkillGapAnalysis = {
  gaps: [
    { skill: 'Product Strategy', currentLevel: 'beginner', requiredLevel: 'advanced', priority: 1 },
    { skill: 'Data Analysis & SQL', currentLevel: 'intermediate', requiredLevel: 'advanced', priority: 2 },
    { skill: 'Stakeholder Management', currentLevel: 'beginner', requiredLevel: 'expert', priority: 3 },
    { skill: 'User Research', currentLevel: 'none', requiredLevel: 'intermediate', priority: 4 },
    { skill: 'A/B Testing & Experimentation', currentLevel: 'none', requiredLevel: 'intermediate', priority: 5 },
    { skill: 'Technical Architecture', currentLevel: 'intermediate', requiredLevel: 'advanced', priority: 6 },
  ],
  resources: [
    { title: 'Inspired by Marty Cagan', type: 'book', estimatedHours: 12 },
    { title: 'Reforge Growth Series', type: 'course', estimatedHours: 40, url: 'https://reforge.com' },
    { title: 'SQL for Data Analysis (Mode Analytics)', type: 'course', estimatedHours: 20 },
    { title: 'Build a Product Teardown Portfolio', type: 'project', estimatedHours: 30 },
    { title: 'The Mom Test by Rob Fitzpatrick', type: 'book', estimatedHours: 6 },
  ],
};
