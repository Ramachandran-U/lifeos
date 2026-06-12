/**
 * speechErrorMessage — the Web Speech API error-code → user-copy mapping used
 * by the voice food-logging flow (AddFoodSheet "Speak" mode).
 *
 * Lives in a .tsx file so the `components` jest project picks it up: the node
 * project ignores /src/hooks/ entirely, and the components project only
 * matches src/hooks/**\/*.test.tsx (see jest.config.js). The function is pure,
 * so no rendering or Platform setup is needed.
 */

import { speechErrorMessage } from '../useSpeechRecognition';

describe('speechErrorMessage', () => {
  it('keeps the gentle retry copy for no-speech', () => {
    expect(speechErrorMessage('no-speech')).toBe("Didn't catch that — try again.");
  });

  it('maps both permission codes to the same mic-permission remedy', () => {
    const msg = speechErrorMessage('not-allowed');
    expect(msg).toContain('Microphone access is blocked');
    expect(speechErrorMessage('service-not-allowed')).toBe(msg);
  });

  it('explains a missing input device for audio-capture', () => {
    expect(speechErrorMessage('audio-capture')).toContain('No microphone found');
  });

  it('explains the cloud speech-service failure for network', () => {
    expect(speechErrorMessage('network')).toContain('speech service');
  });

  it('never leaks the raw code: unknown codes get a generic retry message', () => {
    const msg = speechErrorMessage('language-not-supported');
    expect(msg).not.toContain('language-not-supported');
    expect(msg).toContain('Try again');
  });
});
