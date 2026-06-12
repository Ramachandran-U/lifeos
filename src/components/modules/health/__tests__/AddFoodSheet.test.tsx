/**
 * AddFoodSheet — failure-visibility behaviour around the voice ("Speak") flow.
 *
 * Repro context (2026-06-12): "speak to record what I ate not working". The
 * happy path was verified live against the deployed build; what was broken is
 * that every failure mode was silent — an AI parse error bounced back to the
 * choose screen with no message, and recognition ending with an empty
 * transcript left only a disabled Done button. These tests pin the fixes:
 *   1. useAI().error is rendered on the choose screen (raw proxy errors sanitised)
 *   2. "Listen again" appears when recognition ended with nothing heard
 *
 * useSpeechRecognition and useAI are mocked — the real Web Speech API needs a
 * browser, and the components jest env runs as native (where the hook reports
 * unsupported and the Speak card hides, by design).
 */

import { render, fireEvent } from '@testing-library/react-native';
import { AddFoodSheet } from '../AddFoodSheet';

const mockSpeechState = {
  supported: true,
  listening: false,
  transcript: '',
  error: null as string | null,
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
};
jest.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => mockSpeechState,
}));

const mockAiState = {
  call: jest.fn(async () => null),
  loading: false,
  error: null as string | null,
};
jest.mock('@/hooks/useAI', () => ({ useAI: () => mockAiState }));

// The save/parse paths are not under test; stub the modules whose imports
// would otherwise pull in the AI client / DB layers.
jest.mock('@/db/queries/health', () => ({
  createFoodEntry: jest.fn(),
  updateFoodEntry: jest.fn(),
}));
jest.mock('@/ai/functions', () => ({ recogniseFood: jest.fn() }));
jest.mock('@/ai/voiceFood', () => ({ parseSpokenMeal: jest.fn() }));

const renderSheet = () =>
  render(
    <AddFoodSheet
      visible
      mealType="breakfast"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSpeechState.listening = false;
  mockSpeechState.transcript = '';
  mockSpeechState.error = null;
  mockAiState.error = null;
});

describe('AddFoodSheet voice failure visibility', () => {
  it('offers the Speak option when speech recognition is supported', () => {
    const { getByText } = renderSheet();
    expect(getByText('Speak')).toBeTruthy();
    expect(getByText('Say what you ate')).toBeTruthy();
  });

  it('renders the AI error on the choose screen instead of failing silently', () => {
    mockAiState.error = 'Could not understand the spoken meal. Try again or type it.';
    const { getByText } = renderSheet();
    expect(getByText('Could not understand the spoken meal. Try again or type it.')).toBeTruthy();
  });

  it('sanitises raw proxy errors before showing them', () => {
    mockAiState.error = 'AI proxy 500: {"error":"upstream"}';
    const { getByText, queryByText } = renderSheet();
    expect(getByText('The AI service had a problem. Try again in a moment.')).toBeTruthy();
    expect(queryByText(/AI proxy 500/)).toBeNull();
  });

  it('offers "Listen again" when recognition ended with nothing heard', () => {
    const { getByText } = renderSheet();
    fireEvent.press(getByText('Speak'));
    // mockSpeechState reports listening=false + empty transcript → the dead-end
    // state the fix targets.
    fireEvent.press(getByText('Listen again'));
    // Once from handleStartVoice, once from the retry button.
    expect(mockSpeechState.start).toHaveBeenCalledTimes(2);
  });

  it('does not offer "Listen again" while still listening', () => {
    mockSpeechState.listening = true;
    const { getByText, queryByText } = renderSheet();
    fireEvent.press(getByText('Speak'));
    expect(queryByText('Listen again')).toBeNull();
  });
});
