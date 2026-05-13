/**
 * Post-process the Expo web export so Cloudflare Pages will deploy it cleanly.
 *
 * Three jobs:
 *  1. Copy `public/*` (manifest, icons) into `dist/`.
 *  2. Rename `dist/assets/node_modules` → `dist/assets/npm` and rewrite every
 *     reference in the JS bundle. Wrangler's `pages deploy` silently skips any
 *     path containing `node_modules`, which would otherwise drop our fonts.
 *  3. Neutralize `import.meta.env` references. Zustand v5's middleware barrel
 *     (`zustand/esm/middleware.mjs`) uses `import.meta.env.MODE` to decide
 *     whether to wire up Redux DevTools. Metro for web doesn't transform that
 *     Vite-style syntax, and Expo ships the bundle as a classic <script>
 *     (not `type="module"`), so the browser fails at parse time with
 *     `SyntaxError: Cannot use 'import.meta' outside a module`. We swap
 *     `import.meta.env` for `({MODE:"production"})` so the devtools branch is
 *     statically false and the syntax becomes legal. Safe: the substring is
 *     specific enough not to collide with anything else in our bundle.
 */
const fs = require('fs');
const path = require('path');

const DIST = 'dist';
const FROM_DIR = path.join(DIST, 'assets', 'node_modules');
const TO_DIR = path.join(DIST, 'assets', 'npm');
const FROM_REF = 'assets/node_modules';
const TO_REF = 'assets/npm';

const IMPORT_META_PATTERN = 'import.meta.env';
const IMPORT_META_REPLACEMENT = '({MODE:"production"})';

// 1. Copy public/* → dist/
for (const f of fs.readdirSync('public')) {
  fs.copyFileSync(path.join('public', f), path.join(DIST, f));
}

// 2. Rename the assets/node_modules directory.
if (fs.existsSync(FROM_DIR)) {
  fs.rmSync(TO_DIR, { recursive: true, force: true });
  fs.renameSync(FROM_DIR, TO_DIR);
}

// 3. Rewrite path refs + neutralize import.meta.env in every JS/HTML file.
let importMetaPatchedFiles = 0;
let importMetaPatchedHits = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(entry.name)) {
      const before = fs.readFileSync(p, 'utf8');
      let after = before;
      if (after.includes(FROM_REF)) {
        after = after.split(FROM_REF).join(TO_REF);
      }
      if (after.includes(IMPORT_META_PATTERN)) {
        const occurrences = after.split(IMPORT_META_PATTERN).length - 1;
        after = after.split(IMPORT_META_PATTERN).join(IMPORT_META_REPLACEMENT);
        importMetaPatchedFiles += 1;
        importMetaPatchedHits += occurrences;
      }
      if (after !== before) fs.writeFileSync(p, after);
    }
  }
}
walk(DIST);

if (importMetaPatchedFiles > 0) {
  console.log(`post-export-web: neutralized ${importMetaPatchedHits} import.meta.env occurrence(s) across ${importMetaPatchedFiles} file(s)`);
}
console.log('post-export-web: dist ready for Cloudflare Pages');
