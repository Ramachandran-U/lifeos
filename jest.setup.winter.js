/**
 * Workaround for the jest-expo `components` project under Expo SDK 54 (issue #70).
 *
 * Expo's WinterCG runtime (`expo/src/winter/runtime.native.ts`) installs a set
 * of LAZY global getters (`TextDecoder`, `TextDecoderStream`, `URL`,
 * `URLSearchParams`, `__ExpoImportMetaRegistry`, `structuredClone`) whose bodies
 * run `require(...)` only when the global is first accessed (babel-preset-expo
 * also rewrites every `import.meta.*` into the registry global). By the time a
 * getter fires, the `runtime.native` module that owns that `require` has
 * finished executing, so jest's runtime rejects the deferred load with:
 *
 *   "You are trying to import a file outside of the scope of the test code."
 *
 * That makes the whole `components` suite fail to start in a clean checkout / CI.
 *
 * Fix: stub each module the getters lazily `require`, so the require resolves
 * from the mock registry synchronously instead of hitting the file-load path
 * that throws. We can't mock `./runtime` itself (it has a `.native` variant, so
 * doMock can't resolve it unambiguously), but the leaf modules below are each a
 * single file. The stubs delegate to Node's built-ins (jest runs on Node 22),
 * so the installed globals stay functional — and `__ExpoImportMetaRegistry`
 * stays defined so transformed `import.meta.url` reads return undefined rather
 * than throwing. (Mirrors jest-expo's own `jest.doMock('expo/src/winter/FormData')`.)
 *
 * Runs first in the components project's setupFiles, before jest-expo's preset
 * setup does `require('expo/src/winter')` and installs the getters.
 */
jest.doMock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return undefined;
    },
  },
}));

jest.doMock('expo/src/winter/TextDecoder', () => ({
  TextDecoder: require('node:util').TextDecoder,
}));

jest.doMock('expo/src/winter/TextDecoderStream', () => {
  const web = require('node:stream/web');
  return {
    TextDecoderStream: web.TextDecoderStream,
    TextEncoderStream: web.TextEncoderStream,
  };
});

jest.doMock('expo/src/winter/url', () => {
  const url = require('node:url');
  return { URL: url.URL, URLSearchParams: url.URLSearchParams };
});

jest.doMock('@ungap/structured-clone', () => ({
  default: (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
}));
