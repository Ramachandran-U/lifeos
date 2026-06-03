import { render, screen } from '@testing-library/react-native';
import { SkillGapChart } from '@/components/modules/career/SkillGapChart';

describe('SkillGapChart', () => {
  it('renders a row per gap with the skill name and level transition', () => {
    render(
      <SkillGapChart
        gaps={[
          { skill: 'System design', currentLevel: 'beginner', requiredLevel: 'advanced', priority: 1 },
          { skill: 'Go', currentLevel: 'none', requiredLevel: 'intermediate', priority: 2 },
        ]}
      />,
    );
    expect(screen.getByText('System design')).toBeTruthy();
    expect(screen.getByText('beginner → advanced')).toBeTruthy();
    expect(screen.getByText('Go')).toBeTruthy();
    expect(screen.getByText('none → intermediate')).toBeTruthy();
  });

  it('renders nothing meaningful (no rows) for an empty gap list', () => {
    render(<SkillGapChart gaps={[]} />);
    expect(screen.queryByText(/→/)).toBeNull();
  });
});
