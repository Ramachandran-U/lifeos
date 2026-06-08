#!/usr/bin/env node
// Renders onboarding narration scripts to MP3s and word-timestamp cue files
// under assets/audio/onboarding/. Run once at dev time when scripts change:
//
//   ELEVENLABS_API_KEY=sk_... npm run gen:onboarding-audio
//
// Outputs per script:
//   <id>.mp3       — bundled audio asset (played via expo-av)
//   <id>.cues.json — word-boundary timestamps for frame-accurate card reveals
//
// After running, check the "Suggested atMs updates" printed at the end and
// update the atMs values in src/integrations/elevenlabs/scripts.ts to match.
//
// Optional env:
//   ELEVENLABS_VOICE_ID  (default: Rachel — 21m00Tcm4TlvDq8ikWAM)
//   ELEVENLABS_MODEL_ID  (default: eleven_multilingual_v2)

const fs = require('fs');
const path = require('path');

// Minimal .env loader so the script works when invoked directly.
(() => {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
})();

// Re-declared from src/integrations/elevenlabs/scripts.ts.
// Keep in sync — the TS file is source of truth. Each introCard entry needs
// an `anchor` word/phrase that appears in the narration text; the gen script
// finds that word's start time and uses it as the accurate atMs value.
const ONBOARDING_SCRIPTS = [
  {
    id: 'day1-vision',
    text: "Welcome to LifeOS. Let's start with the most important question — what kind of life do you actually want? Be ambitious. We'll work backwards from there.",
    introCards: [
      { id: 'vision-north-star',    anchor: 'Welcome',    atMs: 0 },
      { id: 'vision-ai-breakdown',  anchor: 'question',   atMs: 4000 },
      { id: 'vision-ambition',      anchor: 'ambitious',  atMs: 9000 },
    ],
  },
  {
    id: 'day1-career',
    text: "Your career shapes a lot more than your bank balance. Tell us where you are and where you're headed — we'll figure out the skills that close the gap.",
    introCards: [
      { id: 'career-engine', anchor: 'career',  atMs: 0 },
      { id: 'career-gap',    anchor: 'headed',  atMs: 3500 },
      { id: 'career-blocks', anchor: 'skills',  atMs: 7500 },
    ],
  },
  {
    id: 'day1-routine',
    text: "This is where vision meets reality. We'll build a daily rhythm around your real schedule, not a fantasy one. Small blocks. Sustainable wins.",
    introCards: [
      { id: 'routine-blueprint', anchor: 'vision',   atMs: 0 },
      { id: 'routine-balance',   anchor: 'reality',  atMs: 2500 },
      { id: 'routine-flexible',  anchor: 'Small',    atMs: 7000 },
    ],
  },
];

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY is required. Get one at https://elevenlabs.io/');
  process.exit(1);
}

const outDir = path.join(__dirname, '..', 'assets', 'audio', 'onboarding');
fs.mkdirSync(outDir, { recursive: true });

/** Call /with-timestamps — returns audio buffer + per-word timing. */
async function synthWithTimestamps(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }

  const json = await res.json();
  const audioBuffer = Buffer.from(json.audio_base64, 'base64');

  // Collapse character-level alignment into word-level timestamps.
  const words = [];
  const { characters, character_start_times_seconds, character_end_times_seconds } =
    json.alignment;

  let wordChars = '';
  let wordStart = 0;
  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (wordChars === '') wordStart = character_start_times_seconds[i];

    if (ch === ' ' || ch === '\n') {
      if (wordChars.length > 0) {
        words.push({ word: wordChars, start: wordStart, end: character_end_times_seconds[i - 1] });
        wordChars = '';
      }
    } else {
      wordChars += ch;
    }
  }
  if (wordChars.length > 0) {
    words.push({
      word: wordChars,
      start: wordStart,
      end: character_end_times_seconds[characters.length - 1],
    });
  }

  return { audioBuffer, words };
}

/** Find the start time (ms) of the first word that contains `anchor` (case-insensitive). */
function findAnchorMs(words, anchor) {
  const needle = anchor.toLowerCase().replace(/[^a-z]/g, '');
  const match = words.find((w) => w.word.toLowerCase().replace(/[^a-z]/g, '').includes(needle));
  return match ? Math.round(match.start * 1000) : null;
}

(async () => {
  const suggestions = {};
  let totalChars = 0;

  for (const script of ONBOARDING_SCRIPTS) {
    const { id, text, introCards } = script;
    process.stdout.write(`  ${id} (${text.length} chars)… `);

    const { audioBuffer, words } = await synthWithTimestamps(text);

    // Write MP3.
    fs.writeFileSync(path.join(outDir, `${id}.mp3`), audioBuffer);

    // Write cue JSON with full word timestamps.
    const cueFile = { generatedAt: new Date().toISOString(), words };
    fs.writeFileSync(
      path.join(outDir, `${id}.cues.json`),
      JSON.stringify(cueFile, null, 2),
    );

    // Resolve anchor → real atMs for each card.
    const cardSuggestions = introCards.map(({ id: cardId, anchor, atMs }) => {
      const realMs = findAnchorMs(words, anchor);
      return { cardId, anchor, estimatedMs: atMs, realMs: realMs ?? atMs };
    });
    suggestions[id] = cardSuggestions;

    const durationS = words.at(-1)?.end ?? 0;
    console.log(`${(audioBuffer.length / 1024).toFixed(1)} KB, ${durationS.toFixed(1)}s`);
    totalChars += text.length;
  }

  console.log(`\nDone. ${totalChars} chars → ${outDir}\n`);
  console.log('Suggested atMs updates for src/integrations/elevenlabs/scripts.ts:');
  console.log('──────────────────────────────────────────────────────────────────');
  for (const [scriptId, cards] of Object.entries(suggestions)) {
    console.log(`\n  ${scriptId}:`);
    for (const { cardId, anchor, estimatedMs, realMs } of cards) {
      const changed = realMs !== estimatedMs ? ` ← was ${estimatedMs}ms` : '';
      console.log(`    ${cardId}  anchor:"${anchor}"  atMs: ${realMs}${changed}`);
    }
  }
  console.log(
    '\nNext step: update the atMs values above in scripts.ts, then upgrade\n' +
    'useNarration to load the .mp3 + .cues.json assets via expo-av for\n' +
    'frame-accurate card reveals (see assets/audio/onboarding/README.md).',
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
