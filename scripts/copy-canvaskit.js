/**
 * Copy the CanvasKit WASM binary into `public/` so the web export ships it.
 *
 * @shopify/react-native-skia's web renderer needs CanvasKit (a ~7 MB WASM
 * build of Skia). We host it ourselves at `/canvaskit.wasm` instead of pulling
 * from a CDN so the app works offline and the payload is version-locked to the
 * installed skia package. The file is fetched LAZILY by `ensureSkia()`
 * (src/celebration/ensureSkia.ts) on the first standard/epic celebration beat
 * with the `celebrationEngine` flag on — never at boot — so shipping it adds
 * zero boot cost; it's just a static asset until requested.
 *
 * Runs as part of `web:export` (before `expo export`, so post-export-web.js
 * picks it up with the rest of `public/*`). Fails loudly if the binary is
 * missing — a silent skip would surface as a runtime fetch 404 on web only.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', 'full', 'canvaskit.wasm',
);
const DEST_DIR = path.join(__dirname, '..', 'public');
const DEST = path.join(DEST_DIR, 'canvaskit.wasm');

if (!fs.existsSync(SOURCE)) {
  console.error(
    `copy-canvaskit: FATAL — ${SOURCE} not found. ` +
    `Is @shopify/react-native-skia (and its canvaskit-wasm dependency) installed? Run npm ci.`,
  );
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SOURCE, DEST);
const sizeMb = (fs.statSync(DEST).size / (1024 * 1024)).toFixed(1);
console.log(`copy-canvaskit: copied canvaskit.wasm (${sizeMb} MB) -> public/canvaskit.wasm`);
