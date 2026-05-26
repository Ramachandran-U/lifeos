# Onboarding narration

By default LifeOS uses **device-native TTS via `expo-speech`** (iOS Siri,
Android Google TTS, browser SpeechSynthesis on web). It's free, offline,
and requires zero setup — narration scripts live in
`src/integrations/elevenlabs/scripts.ts` and are spoken live.

**This directory is unused in the default configuration.**

## Optional: ElevenLabs upgrade path

If you upgrade to ElevenLabs Starter ($5/mo) you can swap in cinematic
voices. The plumbing for that:

1. Set `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) in `.env`.
2. Run `npm run gen:onboarding-audio`. The generation script renders the
   3 scripts to MP3s in this directory.
3. Update `src/hooks/useOnboardingNarration.ts` to load these bundled
   assets via `expo-av` instead of calling `expo-speech.speak()`. The
   prior implementation lived in git history (`useOnboardingNarration.ts`
   before the `expo-speech` pivot) if you want to revert.

Free-tier ElevenLabs does **not** work — the API blocks all library and
premade voices for free users, and only the web playground works.
