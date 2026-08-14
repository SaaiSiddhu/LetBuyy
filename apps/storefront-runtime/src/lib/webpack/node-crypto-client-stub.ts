// Client-only stub for `node:crypto`.
//
// theme-engine's barrel re-exports `theme-packager` (index.ts:41) and
// `theme-publish` (index.ts:46 -> theme-publish.ts:23), and theme-packager
// imports `node:crypto` for build-time bundle checksums. Client section
// components value-import DEFAULT_THEME_SETTINGS from that same barrel, so
// webpack must factorize every `export *` target and drags `node:crypto`
// into the browser graph.
//
// packageThemeBundle never runs in the browser, so the stub only needs to
// exist. It throws loudly if anything ever does reach for it client-side
// rather than silently returning a wrong digest.
export function createHash(): never {
  throw new Error(
    'node:crypto is server-only and must not be called from the browser bundle',
  );
}

export default { createHash };
