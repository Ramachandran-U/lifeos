/**
 * Generate the four celebration micro-sounds (M5, flag: soundEffects) as
 * small mono WAVs — deterministic synthesis, no Math.random, so re-running
 * the script reproduces byte-identical assets.
 *
 *   chime   — two-partial pluck (reward beats, standard tier)
 *   sweep   — soft rising whoosh (day-complete epic)
 *   fanfare — quick major arpeggio (level-up / milestone epic)
 *   sparkle — descending glitter (chest reveal)
 *
 * 22.05 kHz, 16-bit, mono; every asset stays well under the 50 KB budget.
 * Re-run: node scripts/generate-sfx.js
 */
const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sfx');

function wavBytes(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32760), 44 + i * 2);
  }
  return buf;
}

const sec = (s) => Math.round(s * SR);
const TAU = Math.PI * 2;

/** Sine partial with exponential decay, added into `out` from `start`. */
function pluck(out, start, freq, dur, gain, decay) {
  const n = sec(dur);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    out[start + i] += Math.sin(TAU * freq * t) * gain * Math.exp(-decay * t);
  }
}

function fadeEdges(out, ms = 6) {
  const n = sec(ms / 1000);
  for (let i = 0; i < n; i++) {
    const g = i / n;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
}

function chime() {
  const out = new Float64Array(sec(0.32));
  pluck(out, 0, 880, 0.32, 0.5, 9);
  pluck(out, 0, 1318.5, 0.32, 0.28, 12); // E6 partial — a warm major sixth
  fadeEdges(out);
  return out;
}

function sweep() {
  const out = new Float64Array(sec(0.55));
  // Rising glide 320 → 720 Hz with a soft attack envelope.
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const p = t / 0.55;
    const f = 320 + 400 * p * p;
    phase += (TAU * f) / SR;
    const env = Math.min(1, t / 0.08) * Math.exp(-3.2 * p);
    out[i] = Math.sin(phase) * 0.4 * env + Math.sin(phase * 2) * 0.08 * env;
  }
  fadeEdges(out);
  return out;
}

function fanfare() {
  const out = new Float64Array(sec(0.7));
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    pluck(out, sec(i * 0.09), f, 0.5, 0.34, 6);
    pluck(out, sec(i * 0.09), f * 2, 0.3, 0.1, 10);
  });
  fadeEdges(out);
  return out;
}

function sparkle() {
  const out = new Float64Array(sec(0.5));
  // Deterministic glitter: seven descending blips on a fixed pentatonic walk.
  const steps = [2093, 1864.7, 1567.98, 1396.9, 1244.5, 1046.5, 932.3];
  steps.forEach((f, i) => {
    pluck(out, sec(i * 0.055), f, 0.16, 0.22, 22);
  });
  fadeEdges(out);
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const sounds = { chime, sweep, fanfare, sparkle };
for (const [name, gen] of Object.entries(sounds)) {
  const file = path.join(OUT_DIR, `${name}.wav`);
  const bytes = wavBytes(Array.from(gen()));
  fs.writeFileSync(file, bytes);
  console.log(`generate-sfx: ${name}.wav ${(bytes.length / 1024).toFixed(1)} KB`);
}
