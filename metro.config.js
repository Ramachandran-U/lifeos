/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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
