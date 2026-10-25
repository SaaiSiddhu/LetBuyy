# Preview tenant-image origin repair

Source implemented and verified; **the existing f607 preview-media browser case remains open**. No active candidate, runtime, database, browser, login or tab was accessed or changed.

The coordinator observed a real Cloud image blocked on the platform preview despite tenant/platform asset requests returning HTTP 200 with equal bytes. The source explains the mismatch: platform `localhost` and the synthetic tenant hostname are different HTTP origins. The unchanged CSP permits configured origins, while the fixture supplied `NEXT_PUBLIC_STOREFRONT_URL` only to Merchant.

The sole code change adds `NEXT_PUBLIC_STOREFRONT_URL:commerceOrigin` to the Commerce client environment in the existing fixture. Merchant retains its platform `http://localhost:<commercePort>` preview URL. The value comes from the existing strict synthetic-origin function; all other fixture bytes, including the Marketplace opt-in, are exact against the released `70f20d…` baseline. No CSP policy, renderer, mapper, asset, launcher or authentication code changed.

Final fixture SHA-256: `b17600512a50d3be39338325cc4baf83bdfd89508486a821b00328bb3d22e4b8`.

The four existing fixture/profile, observer, preview-framing and shared-security-header files passed **29/29, zero failures/skips**. Gateway `tsc --noEmit` exited 0. Fourteen other captured source/config/test/lock inputs stayed byte-identical. The unchanged CSP builder's pure parameter probe adds only the exact configured tenant origin to its existing `connect-src`, `img-src` and `frame-src` lists; `frame-ancestors` and every other directive remain unchanged. No generic HTTP or wildcard allowance was added.

An optional pure probe initially used a named ESM import against this repository's CommonJS-loaded TypeScript module and stopped before assertions. That loader failure is preserved separately. Loading through the existing CommonJS contract completed the probe; no source change or regression-test rerun was needed.

The [source release](source-release.json) pins the exact [delta](commerce-preview-origin.diff), baseline archive, checks and conservation evidence. The [future normal-image oracle](future-normal-image-load-oracle.json) requires the actual corrected runtime's platform preview CSP, real tenant `src/currentSrc`, visible Cloud image with positive natural dimensions, absence of the corresponding CSP refusal, and normal reload success. HTTP 200, equal asset SHA, a placeholder, source checks or the pure probe alone cannot close the browser case.

The bounded source lease is released. Root must independently admit the new pin and separately allocate any future copy/build/browser flow. Existing f607 and Marketplace candidates remain untouched.
