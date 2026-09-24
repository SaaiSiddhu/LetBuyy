// Client-only stub for `node:crypto`.
//
// Mirrors apps/customer_web/src/lib/webpack/node-crypto-client-stub.ts —
// same root cause, different app. theme-engine's barrel re-exports
// `theme-packager` (index.ts:41) and `theme-publish` (index.ts:46), and
// theme-packager imports `node:crypto` for build-time bundle checksums. The
// theme editor page and its client panels value-import from that same barrel
// (`src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`), so webpack
// must factorize every `export *` target and drags `node:crypto` into the
// browser graph:
//
//   Module build failed: UnhandledSchemeError: Reading from "node:crypto"
//   is not handled by plugins (Unhandled scheme).
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
