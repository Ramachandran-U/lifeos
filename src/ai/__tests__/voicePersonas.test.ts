/**
 * Voice persona catalog + system-instruction wiring.
 *
 * Guards the invariants the rest of the feature relies on: stable/unique ids,
 * a balanced curated set, a default that resolves to the historical voice, and
 * safe fallback for unknown/empty stored ids (a stale persona id must never
 * crash the companion). Also checks the persona tone directive is appended to
 * the voice system instruction without dropping the base prompt.
 */
import {
  VOICE_PERSONAS,
  VOICE_PERSONAS_BY_GENDER,
  DEFAULT_VOICE_PERSONA_ID,
  getVoicePersona,
  resolveVoiceName,
} from '@/ai/voicePersonas';
import { buildVoiceSystemInstruction } from '@/ai/prompts/voiceAgent';

describe('voice persona catalog', () => {
  it('has unique, non-empty ids and voice names', () => {
    const ids = VOICE_PERSONAS.map((p) => p.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(VOICE_PERSONAS.every((p) => p.voiceName.length > 0)).toBe(true);
    expect(VOICE_PERSONAS.every((p) => p.personaPrompt.length > 0)).toBe(true);
  });

  it('is a balanced curated set (3 female + 3 male)', () => {
    expect(VOICE_PERSONAS_BY_GENDER.female).toHaveLength(3);
    expect(VOICE_PERSONAS_BY_GENDER.male).toHaveLength(3);
    expect(VOICE_PERSONAS).toHaveLength(6);
  });

  it('groups every persona under exactly one gender bucket', () => {
    const grouped = [...VOICE_PERSONAS_BY_GENDER.female, ...VOICE_PERSONAS_BY_GENDER.male];
    expect(grouped.map((p) => p.id).sort()).toEqual(VOICE_PERSONAS.map((p) => p.id).sort());
  });

  it('default persona id exists in the catalog', () => {
    expect(VOICE_PERSONAS.some((p) => p.id === DEFAULT_VOICE_PERSONA_ID)).toBe(true);
  });

  it('default persona preserves the historical Puck voice', () => {
    expect(getVoicePersona(DEFAULT_VOICE_PERSONA_ID).voiceName).toBe('Puck');
    expect(resolveVoiceName(null)).toBe('Puck');
    expect(resolveVoiceName(undefined)).toBe('Puck');
  });
});

describe('getVoicePersona / resolveVoiceName fallback', () => {
  it('returns the requested persona for a known id', () => {
    const target = VOICE_PERSONAS[2];
    expect(getVoicePersona(target.id).id).toBe(target.id);
    expect(resolveVoiceName(target.id)).toBe(target.voiceName);
  });

  it('falls back to the default for unknown / empty ids (never crashes)', () => {
    const def = getVoicePersona(DEFAULT_VOICE_PERSONA_ID);
    expect(getVoicePersona('does-not-exist').id).toBe(def.id);
    expect(getVoicePersona('').id).toBe(def.id);
    expect(getVoicePersona(null).id).toBe(def.id);
    expect(getVoicePersona(undefined).id).toBe(def.id);
  });
});

describe('buildVoiceSystemInstruction persona wiring', () => {
  it('appends the persona tone directive while keeping the base prompt', () => {
    const base = buildVoiceSystemInstruction({ agentic: false });
    const withPersona = buildVoiceSystemInstruction({
      agentic: false,
      personaPrompt: 'Speak calmly and thoughtfully.',
    });
    expect(withPersona.startsWith(base)).toBe(true);
    expect(withPersona).toContain('Speak calmly and thoughtfully.');
    expect(withPersona.length).toBeGreaterThan(base.length);
  });

  it('is a no-op when no persona prompt is supplied', () => {
    expect(buildVoiceSystemInstruction({ agentic: true })).toBe(
      buildVoiceSystemInstruction({ agentic: true, personaPrompt: undefined }),
    );
  });
});
