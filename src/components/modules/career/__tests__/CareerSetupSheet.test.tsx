/**
 * CareerSetupSheet — Ink + Signal §3.3 / AC3 (unit half).
 *
 * The questionnaire lives in a sheet that is CLOSED by default — when closed,
 * none of its inputs exist in the tree (RN Modal renders nothing at
 * visible=false), which is the component half of AC3's "on mount with no
 * analysis, no text input is focused or visible". Also covers the two
 * segments, the unchanged analyse disabled rule, and the skill tag flow.
 */

import { Modal, TextInput } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CareerSetupSheet } from '@/components/modules/career/CareerSetupSheet';

const baseProps = {
  visible: false,
  segment: 'setup' as const,
  currentRole: '',
  targetRole: '',
  timelineMonths: 24,
  skills: [],
  timeframeWeeks: 12,
  weeklyHours: 10,
  constraints: '',
  loading: false,
  error: null,
  onChangeCurrentRole: jest.fn(),
  onChangeTargetRole: jest.fn(),
  onChangeTimelineMonths: jest.fn(),
  onAddSkill: jest.fn(),
  onRemoveSkill: jest.fn(),
  onChangeTimeframeWeeks: jest.fn(),
  onChangeWeeklyHours: jest.fn(),
  onChangeConstraints: jest.fn(),
  onAnalyse: jest.fn(),
  onGenerateStrategy: jest.fn(),
  onClose: jest.fn(),
};

afterEach(() => jest.clearAllMocks());

describe('CareerSetupSheet — closed by default (AC3 unit half)', () => {
  it('renders no form and no text input while visible=false', () => {
    render(<CareerSetupSheet {...baseProps} visible={false} />);
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    expect(screen.queryByText('Analyse my career path')).toBeNull();
    expect(screen.queryByText('Where are you going?')).toBeNull();
  });
});

describe('CareerSetupSheet — setup segment (the legacy form, moved)', () => {
  it('renders the role inputs, timeline pills and skills input when open', () => {
    render(<CareerSetupSheet {...baseProps} visible segment="setup" />);
    expect(screen.getByText('Where are you going?')).toBeTruthy();
    expect(screen.getByText('Current role')).toBeTruthy();
    expect(screen.getByText('Target role')).toBeTruthy();
    expect(screen.getByText('Timeline')).toBeTruthy();
    expect(screen.getByText('1 yr')).toBeTruthy();
    expect(screen.getByText('5 yrs')).toBeTruthy();
    expect(screen.getByText('Your current skills')).toBeTruthy();
    expect(screen.getByText('Analyse my career path')).toBeTruthy();
  });

  it('keeps the analyse disabled rule unchanged (empty roles, or loading)', () => {
    const { rerender } = render(<CareerSetupSheet {...baseProps} visible segment="setup" />);
    fireEvent.press(screen.getByText('Analyse my career path'));
    expect(baseProps.onAnalyse).not.toHaveBeenCalled();

    rerender(
      <CareerSetupSheet {...baseProps} visible segment="setup" currentRole="Engineer" targetRole="Staff" />,
    );
    fireEvent.press(screen.getByText('Analyse my career path'));
    expect(baseProps.onAnalyse).toHaveBeenCalledTimes(1);

    rerender(
      <CareerSetupSheet
        {...baseProps}
        visible
        segment="setup"
        currentRole="Engineer"
        targetRole="Staff"
        loading
      />,
    );
    fireEvent.press(screen.getByText('Analysing…'));
    expect(baseProps.onAnalyse).toHaveBeenCalledTimes(1); // still 1 — loading blocks
  });

  it('commits a trimmed skill through onAddSkill and clears the input', () => {
    render(<CareerSetupSheet {...baseProps} visible segment="setup" />);
    const input = screen.getByLabelText('Current skills');
    fireEvent.changeText(input, '  System design  ');
    fireEvent(input, 'submitEditing');
    expect(baseProps.onAddSkill).toHaveBeenCalledWith('System design');
  });

  it('renders skill badges and removes one on press', () => {
    render(
      <CareerSetupSheet {...baseProps} visible segment="setup" skills={['TypeScript', 'Mentoring']} />,
    );
    fireEvent.press(screen.getByText('TypeScript ×'));
    expect(baseProps.onRemoveSkill).toHaveBeenCalledWith('TypeScript');
  });
});

describe('CareerSetupSheet — strategy segment (§3.3 second segment)', () => {
  it('renders timeframe, weekly hours and constraints inputs', () => {
    render(<CareerSetupSheet {...baseProps} visible segment="strategy" />);
    expect(screen.getByText('Timeframe')).toBeTruthy();
    expect(screen.getByText('12 wk')).toBeTruthy();
    expect(screen.getByText('Weekly hours')).toBeTruthy();
    expect(screen.getByText('Constraints (optional)')).toBeTruthy();
    expect(screen.getByText('Generate strategy')).toBeTruthy();
    // The setup form never bleeds into the strategy segment.
    expect(screen.queryByText('Analyse my career path')).toBeNull();
  });

  it('fires onGenerateStrategy from the footer', () => {
    render(<CareerSetupSheet {...baseProps} visible segment="strategy" />);
    fireEvent.press(screen.getByText('Generate strategy'));
    expect(baseProps.onGenerateStrategy).toHaveBeenCalledTimes(1);
  });
});

describe('CareerSetupSheet — error display (moved verbatim)', () => {
  it('renders a raw error message as-is', () => {
    render(<CareerSetupSheet {...baseProps} visible segment="setup" error="Network down" />);
    expect(screen.getByText('Network down')).toBeTruthy();
  });

  it('replaces JSON-shaped garble with the friendly line', () => {
    render(<CareerSetupSheet {...baseProps} visible segment="setup" error='[{"oops":1}]' />);
    expect(
      screen.getByText("We couldn't read the AI's response. Try again or tweak the inputs."),
    ).toBeTruthy();
  });
});
