import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-router needs no real navigator here — capture pushes so we can assert the
// confirm→navigate-with-params handoff.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

// Haptics are native-only niceties; stub them so the transition effects don't
// touch a real device API under jest.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// The companion's intelligence lives in useVoice / the tool builders / the
// client — all unit-tested elsewhere. Mock them so each UI branch is
// deterministic and no socket or DB is touched.
const mockCallAIStream = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/ai/client', () => ({ callAIStream: (...a: unknown[]) => mockCallAIStream(...a) }));
jest.mock('@/ai/agent/voiceTools', () => ({ buildVoiceTools: () => [] }));
const mockCommitActions = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/ai/agent/actionQueue', () => ({ commitActions: (...a: unknown[]) => mockCommitActions(...a) }));
jest.mock('@/db/queries/users', () => ({ getUser: () => null }));

import { useVoice, type UseVoiceResult } from '@/hooks/useVoice';
import { VoiceCompanion } from '@/components/shared/VoiceCompanion';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUserStore } from '@/store/useUserStore';
import type { ProposedAction } from '@/ai/agent/actionQueue';

// A controllable useVoice — each test mutates `mockVoice` before render.
const sendText = jest.fn();
const connect = jest.fn();
const disconnect = jest.fn();
const resumeAudio = jest.fn();
let mockVoice: UseVoiceResult;

jest.mock('@/hooks/useVoice', () => ({
  useVoice: () => mockVoice,
}));

function setVoice(over: Partial<UseVoiceResult> = {}): void {
  mockVoice = {
    status: 'listening',
    isConnected: true,
    isSpeaking: false,
    isListening: true,
    isThinking: false,
    userSpeaking: false,
    transcript: '',
    userTranscript: '',
    error: null,
    audioLevel: 0,
    connect,
    disconnect,
    sendText,
    sendAudioChunk: jest.fn(),
    resumeAudio,
    ...over,
  };
}

const VISION_ACTION: ProposedAction = {
  kind: 'createGoalFromVision',
  summary: 'Turn "run a marathon" into a goal',
  payload: { visionStatement: 'Run a marathon' },
};

describe('VoiceCompanion', () => {
  beforeEach(() => {
    setVoice();
    useVoiceStore.setState({ open: false, minimized: false, pendingActions: [] });
    useUserStore.setState({ userId: 'user_fake_1' });
  });

  afterEach(() => {
    useVoiceStore.setState({ open: false, minimized: false, pendingActions: [] });
    useUserStore.getState().reset?.();
    jest.clearAllMocks();
  });

  it('renders nothing while the store is closed', () => {
    expect(render(<VoiceCompanion />).toJSON()).toBeNull();
  });

  it('shows the expanded panel with the upper-cased status when open', () => {
    useVoiceStore.setState({ open: true, minimized: false });
    render(<VoiceCompanion />);
    expect(screen.getByTestId('voice-sheet')).toBeTruthy();
    expect(screen.getByTestId('voice-status')).toHaveTextContent('LISTENING');
  });

  it('routes a typed message to the live session when connected', () => {
    useVoiceStore.setState({ open: true });
    setVoice({ isConnected: true });
    render(<VoiceCompanion />);
    fireEvent.changeText(screen.getByTestId('voice-input'), 'add a goal');
    fireEvent.press(screen.getByTestId('voice-send'));
    expect(resumeAudio).toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith('add a goal');
    expect(mockCallAIStream).not.toHaveBeenCalled();
  });

  it('falls back to the HTTP stream when the socket is down', async () => {
    useVoiceStore.setState({ open: true });
    setVoice({ isConnected: false });
    render(<VoiceCompanion />);
    fireEvent.changeText(screen.getByTestId('voice-input'), 'hello there');
    fireEvent.press(screen.getByTestId('voice-send'));
    await waitFor(() => expect(mockCallAIStream).toHaveBeenCalled());
    expect(sendText).not.toHaveBeenCalled();
  });

  it('surfaces an error with a Retry that reconnects', () => {
    useVoiceStore.setState({ open: true });
    setVoice({ error: 'Connection timed out.', status: 'error', isListening: false });
    render(<VoiceCompanion />);
    expect(screen.getByTestId('voice-status')).toHaveTextContent('ERROR');
    fireEvent.press(screen.getByTestId('voice-retry'));
    expect(resumeAudio).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });

  it('renders a confirm card and navigates with prefill params on confirm', () => {
    useVoiceStore.setState({ open: true, pendingActions: [VISION_ACTION] });
    render(<VoiceCompanion />);
    expect(screen.getByTestId('voice-confirm-card')).toBeTruthy();
    expect(screen.getByText('Turn "run a marathon" into a goal')).toBeTruthy();

    fireEvent.press(screen.getByTestId('voice-confirm-apply'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0] as { pathname: string; params: Record<string, string> };
    expect(arg.pathname).toContain('goals');
    expect(arg.params.voiceVision).toBe('Run a marathon');
    expect(arg.params.autorun).toBe('1');
    // The proposal is consumed from the queue.
    expect(useVoiceStore.getState().pendingActions).toHaveLength(0);
  });

  it('dismisses a proposal without navigating', () => {
    useVoiceStore.setState({ open: true, pendingActions: [VISION_ACTION] });
    render(<VoiceCompanion />);
    fireEvent.press(screen.getByTestId('voice-confirm-dismiss'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().pendingActions).toHaveLength(0);
  });

  it('collapses to a pill that shows the pending-action count', () => {
    useVoiceStore.setState({ open: true, minimized: true, pendingActions: [VISION_ACTION] });
    render(<VoiceCompanion />);
    expect(screen.getByTestId('voice-pill')).toBeTruthy();
    expect(screen.queryByTestId('voice-sheet')).toBeNull();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('expands from the pill when its body is tapped', () => {
    useVoiceStore.setState({ open: true, minimized: true });
    render(<VoiceCompanion />);
    fireEvent.press(screen.getByLabelText('Expand voice assistant'));
    expect(useVoiceStore.getState().minimized).toBe(false);
  });
});
