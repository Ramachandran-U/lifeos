/**
 * Voice personas for the voice companion (Gemini Live).
 *
 * A persona pairs a Gemini prebuilt voice (timbre) with a short personality
 * directive (tone) appended to the voice system instruction. This is the single
 * source of truth: the Settings picker renders from `VOICE_PERSONAS`, the user's
 * choice is stored as a persona `id` on the user row (`preferredVoiceId`), and
 * `VoiceCompanion` resolves it to a `voiceName` + `personaPrompt` at session
 * setup. Changing voice mid-conversation isn't supported by the Live API, so the
 * companion reconnects when the persona changes.
 *
 * Gender labels are PERCEIVED, not declared by Google — the prebuilt voices are
 * named after astronomical/mythological figures with no official gender. This
 * curated set was chosen to be a balanced, distinct 3 + 3; audition in AI Studio
 * (https://aistudio.google.com/app/live) before changing the lineup.
 */

/**
 * The Gemini Live prebuilt voice names this app uses. The native-audio model
 * (see MODEL in voiceClient.ts) supports ~30 voices; we expose a curated subset.
 * Widen this union (and VOICE_PERSONAS) to offer more.
 */
export type GeminiVoiceName = 'Puck' | 'Charon' | 'Orus' | 'Aoede' | 'Kore' | 'Leda';

export type VoiceGender = 'female' | 'male';

export interface VoicePersona {
  /** Stable id stored on the user row (`preferredVoiceId`). Never reuse/rename. */
  id: string;
  /** Friendly persona name shown in the picker. */
  name: string;
  /** One-line description of the voice's character, for the picker. */
  blurb: string;
  /** The Gemini prebuilt voice (timbre) this persona speaks with. */
  voiceName: GeminiVoiceName;
  /** Perceived gender — used only to group the picker. */
  gender: VoiceGender;
  /**
   * Tone directive appended to the voice system instruction. Keep it to one
   * sentence about *manner of speaking* — never about content or tools, so it
   * can't fight the base prompt's grounding/brevity rules.
   */
  personaPrompt: string;
}

export const VOICE_PERSONAS: readonly VoicePersona[] = [
  // ── Female-perceived ──────────────────────────────────────────────────────
  {
    id: 'sol',
    name: 'Sol',
    blurb: 'Warm and encouraging',
    voiceName: 'Aoede',
    gender: 'female',
    personaPrompt: 'Speak warmly and encouragingly, like a supportive friend cheering the user on.',
  },
  {
    id: 'vera',
    name: 'Vera',
    blurb: 'Crisp and focused',
    voiceName: 'Kore',
    gender: 'female',
    personaPrompt: 'Speak crisply and directly with calm confidence — clear and to the point.',
  },
  {
    id: 'indi',
    name: 'Indi',
    blurb: 'Youthful and upbeat',
    voiceName: 'Leda',
    gender: 'female',
    personaPrompt: 'Speak in a youthful, upbeat, playful way that keeps things light and motivating.',
  },
  // ── Male-perceived ────────────────────────────────────────────────────────
  {
    id: 'max',
    name: 'Max',
    blurb: 'Energetic and motivating',
    voiceName: 'Puck',
    gender: 'male',
    personaPrompt: 'Speak with high energy and momentum, like an upbeat coach keeping the user moving.',
  },
  {
    id: 'sage',
    name: 'Sage',
    blurb: 'Calm and measured',
    voiceName: 'Charon',
    gender: 'male',
    personaPrompt: 'Speak calmly and thoughtfully, in a measured, reassuring, grounded way.',
  },
  {
    id: 'rhys',
    name: 'Rhys',
    blurb: 'Steady and grounded',
    voiceName: 'Orus',
    gender: 'male',
    personaPrompt: 'Speak in a steady, grounded, no-nonsense way — straightforward and dependable.',
  },
] as const;

/**
 * Default persona id. `Max` (Puck) preserves the historical default voice
 * (`opts.voice ?? 'Puck'` in voiceClient.ts) so existing users hear no change
 * until they pick something else.
 */
export const DEFAULT_VOICE_PERSONA_ID = 'max';

/** Look up a persona by id, falling back to the default for unknown/empty ids. */
export function getVoicePersona(id?: string | null): VoicePersona {
  const found = id ? VOICE_PERSONAS.find((p) => p.id === id) : undefined;
  return found ?? VOICE_PERSONAS.find((p) => p.id === DEFAULT_VOICE_PERSONA_ID)!;
}

/** Resolve a stored persona id to the Gemini voice name to send at session setup. */
export function resolveVoiceName(id?: string | null): GeminiVoiceName {
  return getVoicePersona(id).voiceName;
}

/** Personas grouped for the Settings picker (female first, then male). */
export const VOICE_PERSONAS_BY_GENDER: Record<VoiceGender, VoicePersona[]> = {
  female: VOICE_PERSONAS.filter((p) => p.gender === 'female'),
  male: VOICE_PERSONAS.filter((p) => p.gender === 'male'),
};
