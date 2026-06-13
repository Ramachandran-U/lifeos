-- ============================================================================
-- 0007_preferred_voice
--
-- Adds preferred_voice_id to the users table so the chosen Gemini Live voice
-- (Puck | Charon | Kore | Fenrir | Aoede) is persisted across sessions.
-- Set during the Day 1 voice-picker onboarding step; changeable in Settings.
-- ============================================================================

ALTER TABLE `users` ADD `preferred_voice_id` text;
