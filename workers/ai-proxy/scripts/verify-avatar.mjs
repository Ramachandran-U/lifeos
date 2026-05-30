// Standalone verification for the nano-banana (gemini-2.5-flash-image) image
// path used by src/avatar.ts. Hits Gemini directly with the SAME request shape
// the worker sends, so a green run confirms the one unproven piece.
//
// Usage (PowerShell):
//   $env:GEMINI_API_KEY="..."; node scripts/verify-avatar.mjs path\to\photo.jpg
// Output: writes avatar-out.png next to the script on success.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.GEMINI_API_KEY;
const photoPath = process.argv[2];

if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
if (!photoPath) { console.error('Pass a photo path: node scripts/verify-avatar.mjs photo.jpg'); process.exit(1); }

const MODEL = 'gemini-2.5-flash-image';
const mimeType = photoPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
const imageBase64 = readFileSync(photoPath).toString('base64');

const prompt =
  'Transform the person in this photo into a bold, friendly, gamified cartoon ' +
  'avatar — a polished mobile-game hero portrait. Vibrant colours, clean thick ' +
  'outlines, soft cel-shading. Keep the face clearly recognisable. ' +
  'Head-and-shoulders framing. No text or logos.';

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }),
});

const text = await res.text();
if (!res.ok) { console.error(`Gemini ${res.status}:`, text.slice(0, 800)); process.exit(1); }

const parsed = JSON.parse(text);
const parts = parsed.candidates?.[0]?.content?.parts ?? [];
const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
if (!img) {
  console.error('No image part returned. Text:', parts.map((p) => p.text).filter(Boolean).join(' '));
  process.exit(1);
}
const inline = img.inlineData ?? img.inline_data;
const out = join(__dirname, 'avatar-out.png');
writeFileSync(out, Buffer.from(inline.data, 'base64'));
console.log('OK — image returned.');
console.log('  mimeType:', inline.mimeType ?? inline.mime_type);
console.log('  usage:', JSON.stringify(parsed.usageMetadata ?? {}));
console.log('  saved:', out);
