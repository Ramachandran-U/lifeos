import { render, screen } from '@testing-library/react-native';
import { SocialScoreCard } from '@/components/modules/social/SocialScoreCard';

describe('SocialScoreCard', () => {
  it('renders an em dash and the empty prompt when score is null', () => {
    render(<SocialScoreCard score={null} totalContacts={0} overdueCount={0} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Add a few people to see your social health.')).toBeTruthy();
    expect(screen.queryByText('/100')).toBeNull();
  });

  it('renders the score out of 100 and the in-cadence message when nothing is overdue', () => {
    render(<SocialScoreCard score={82} totalContacts={5} overdueCount={0} />);
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
    expect(screen.getByText("You're in cadence with everyone right now.")).toBeTruthy();
  });

  it('uses a singular "contact" for one overdue', () => {
    render(<SocialScoreCard score={60} totalContacts={4} overdueCount={1} />);
    expect(screen.getByText('1 contact overdue · 3 in cadence')).toBeTruthy();
  });

  it('uses a plural "contacts" for multiple overdue', () => {
    render(<SocialScoreCard score={45} totalContacts={6} overdueCount={3} />);
    expect(screen.getByText('3 contacts overdue · 3 in cadence')).toBeTruthy();
  });
});
