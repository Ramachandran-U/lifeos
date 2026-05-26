#!/usr/bin/env node
// Renders the onboarding narration scripts to MP3s under
// assets/audio/onboarding/. Run once at dev time when scripts change:
//
//   ELEVENLABS_API_KEY=sk_... npm run gen:onboarding-audio
//
// Optional env:
//   ELEVENLABS_VOICE_ID  (default: Rachel — 21m00Tcm4TlvDq8ikWAM)
//   ELEVENLABS_MODEL_ID  (default: eleven_multilingual_v2)

const fs = require('fs');
const path = require('path');

// Minimal .env loader so the script works when invoked directly (Node
// doesn't auto-load .env the way Expo does). Anything already set in the
// real environment wins over the file.
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

// We can't `require` the TS source directly from a node script without
// adding ts-node. The scripts are short and edited rarely, so we re-declare
// them here. If they drift, the build will still work — but keep both lists
// in sync (src/integrations/elevenlabs/scripts.ts is the source of truth).
const ONBOARDING_SCRIPTS = [
  {
    id: 'day1-vision',
    text: "Welcome to LifeOS. Let's start with the most important question — what kind of life do you actually want? Be ambitious. We'll work backwards from there.",
  },
  {
    id: 'day1-career',
    text: "Your career shapes a lot more than your bank balance. Tell us where you are and where you're headed — we'll figure out the skills that close the gap.",
  },
  {
    id: 'day1-routine',
    text: "This is where vision meets reality. We'll build a daily rhythm around your real schedule, not a fantasy one. Small blocks. Sustainable wins.",
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

async function synth(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  let totalChars = 0;
  for (const { id, text } of ONBOARDING_SCRIPTS) {
    process.stdout.write(`  ${id} (${text.length} chars)… `);
    const buf = await synth(text);
    const file = path.join(outDir, `${id}.mp3`);
    fs.writeFileSync(file, buf);
    totalChars += text.length;
    console.log(`${(buf.length / 1024).toFixed(1)} KB`);
  }
  console.log(`\nDone. ${totalChars} characters rendered to ${outDir}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
