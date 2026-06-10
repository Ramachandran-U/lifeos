/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports `wa-sqlite.wasm` as a module; Metro only
// resolves it when `.wasm` is a registered asset extension. Without this the
// web cold-bundle fails to resolve the wasm import.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');

// Rive state-machine assets (`assets/rive/*.riv`) load via require() on
// native; Metro needs `.riv` registered as an asset extension (same precedent
// as `.wasm` above) or the companion asset fails to resolve at bundle time.
if (!config.resolver.assetExts.includes('riv')) config.resolver.assetExts.push('riv');

// Exclude the web-export output dir (`dist/`) from Metro's file map so the
// watcher doesn't crawl/crash on it during local web dev (`expo start --web`
// after a `web:export`). The node_modules negative-lookahead keeps package
// `dist/` folders resolvable — without it, every `node_modules/*/dist/` would
// be excluded and the bundle breaks.
const distBlock = /^(?!.*[\\/]node_modules[\\/]).*[\\/]dist[\\/].*/;
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = existingBlockList
  ? (Array.isArray(existingBlockList) ? [...existingBlockList, distBlock] : [existingBlockList, distBlock])
  : distBlock;

/**
 * zustand@5.0.12 ships an ESM build (`zustand/esm/middleware.mjs`) that uses
 * `import.meta.env.MODE` for devtools mode detection. Metro's web bundler
 * resolves that `.mjs` file via the package's `"import"` export condition, but
 * doesn't transform `import.meta` — so the browser throws
 *   SyntaxError: Cannot use 'import.meta' outside a module
 * and the entire bundle dies (black page, every Playwright route fails).
 *
 * Fix: redirect the bare specifiers `zustand` and `zustand/middleware` to their
 * CJS files (`./index.js`, `./middleware.js`), which contain no `import.meta`
 * usage. This matches what the `"react-native"` export condition already does
 * on native, so behaviour is identical across platforms.
 *
 * Re-evaluate this shim if/when:
 *   - zustand drops the `import.meta.env` line from middleware,
 *   - or Metro gains an `import.meta` transform on web,
 *   - or zustand is pinned to a version that never had this line.
 */
const ZUSTAND_CJS_ALIASES = {
  zustand: path.join(__dirname, 'node_modules/zustand/index.js'),
  'zustand/middleware': path.join(__dirname, 'node_modules/zustand/middleware.js'),
};

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (Object.prototype.hasOwnProperty.call(ZUSTAND_CJS_ALIASES, moduleName)) {
    return {
      type: 'sourceFile',
      filePath: ZUSTAND_CJS_ALIASES[moduleName],
    };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
