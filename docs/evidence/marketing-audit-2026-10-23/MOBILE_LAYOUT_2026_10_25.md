# Mobile layout follow-up — 25 October 2026

Requested fixes implemented in the existing marketing app:

- Mobile portrait hero no longer reserves a full viewport height below its content.
- Journey stages share one intrinsic CSS grid row, reserving the tallest stage's height at the current width. Inactive panels remain invisible, inert, and excluded from accessibility navigation. Text can still grow naturally on resize or text enlargement.
- Pricing opts out of the network illustration in `FinalCTA`; other callers retain the default illustration and other artwork is untouched.

Verification: marketing typecheck, MerchantJourney ESLint, CSS stylelint, 4 federation tests and 54 marketing tests passed after the first two fixes. The final pricing change is a scoped optional prop and its caller. Subsequent ESLint/typecheck and browser verification could not finish: the app's `node_modules` directory became unavailable during this session, ESLint could not resolve `eslint-config-next`, TypeScript could not resolve Next/React, and localhost:9006 returned HTTP 500. No dependency manifests, lockfile, or dependency directories were changed by this task. Visual card-height measurements and screenshots remain unverified.

Required repository governance run: 110 pass, 4 fail, 1 not applicable. Failures: route-ownership, legacy-site-type, sequential-migration and foundation-sql-policy-residue validators. These concern paths and policies outside these presentation changes. Output: `/tmp/letbuyy-mobile-spacing-governance.log` (local transient log).

Next verification once the local dependencies/server are restored: at phone and desktop widths switch all five journey stages, confirm equal workspace heights and only one accessible panel, inspect hero-to-capability spacing, and confirm pricing has no network illustration while other illustrations remain.
