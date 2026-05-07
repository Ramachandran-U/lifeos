/**
 * Post-process the Expo web export so Cloudflare Pages will deploy it cleanly.
 *
 * Two jobs:
 *  1. Copy `public/*` (manifest, icons) into `dist/`.
 *  2. Rename `dist/assets/node_modules` → `dist/assets/npm` and rewrite every
 *     reference in the JS bundle. Wrangler's `pages deploy` silently skips any
 *     path containing `node_modules`, which would otherwise drop our fonts.
 */
const fs = require('fs');
const path = require('path');

const DIST = 'dist';
const FROM_DIR = path.join(DIST, 'assets', 'node_modules');
const TO_DIR = path.join(DIST, 'assets', 'npm');
const FROM_REF = 'assets/node_modules';
const TO_REF = 'assets/npm';

// 1. Copy public/* → dist/
for (const f of fs.readdirSync('public')) {
  fs.copyFileSync(path.join('public', f), path.join(DIST, f));
}

// 2. Rename the assets/node_modules directory.
if (fs.existsSync(FROM_DIR)) {
  fs.rmSync(TO_DIR, { recursive: true, force: true });
  fs.renameSync(FROM_DIR, TO_DIR);
}

// 3. Rewrite path refs in every JS/HTML file under dist.
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(entry.name)) {
      const before = fs.readFileSync(p, 'utf8');
      if (before.includes(FROM_REF)) {
        fs.writeFileSync(p, before.split(FROM_REF).join(TO_REF));
      }
    }
  }
}
walk(DIST);

console.log('post-export-web: dist ready for Cloudflare Pages');
