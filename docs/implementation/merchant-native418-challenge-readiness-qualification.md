# Native418 browser challenge readiness qualification

Scope: CI fixtures only, based on published source 786eef646587ea583873e8f2ec7f650c0cfe291d. Application code, native418 SQL, identity policy and provider verification are unchanged. New exact-source CI and all hosted release gates remain mandatory.

## Failure and repair

The 786 Unit lane's theme editor fixture stopped before login because the real `cf-turnstile-response` remained empty at the locator matcher's implicit 5000 ms deadline. Its diagnostic recorded initialization, no draft writes and no gateway failure. Original failure log SHA256: `937cdbb6466921a856c93af19cb9492c1dafb33c292185f5592a9b1b2ae38a32`. The run was retained and canceled, never accepted.

Playwright locator matchers have a separate default deadline from the page's existing 30000 ms action budget. Theme, payment-setup and shipping/tax fixtures were the three remaining browser callers relying on the implicit 5-second challenge wait. They now explicitly wait within that existing 30-second action budget. Overall suite deadlines and all positive, negative, recovery, money and tenant assertions are unchanged. The widget must still produce a real response, and normal login must still pass server-side verification.

Theme navigation waits for DOM readiness before challenge readiness. A fixture-only optional `LETBUYY_EXECUTABLE_TEST_WIDGET_DELAY_MS=6500` holds the actual Cloudflare SDK request until 6.5 seconds after DOM readiness, then continues the unchanged request. Only 0 and 6500 are accepted. No SDK, token, authentication response or Siteverify result is fabricated. The callback records elapsed time without token contents. The canonical database environment filter is unchanged.

## Actual local evidence

Managed run:

`/Volumes/Projects/LetBuyy Workspace/runs/20261117T121323Z-native418-real-widget-control-and-full-journeys-4fadb25740da44b19c6b7cff37919e97`

- Original 5-second matcher, actual 6.5-second SDK gate: expected timeout reproduced before login, one failed test, no draft writes, no skips or cleanup failures. Negative-control log SHA256: `fbfee6f98e59744b8f15058d1db5a722cb7e914f061728139861df2fad242f35`.
- Final fixture source restored before the positive cases: full normal theme, payment-setup and shipping/tax journeys passed 3/3; zero failures, cancellations, skips or cleanup failures.
- Independent owned database/browser: full theme journey with the real delayed SDK passed 1/1, including lost-save recovery, serialized saves, reviewed conflict replacement and lost-publication recovery. Zero failures, cancellations, skips or cleanup failures.
- Actual theme security readiness was 4704 ms normally and 8726 ms with the 6500 ms gate. The original threshold could fail before an otherwise usable widget was ready.
- Gateway typecheck passed after both positive lanes.
- Browser-qualified theme fixture source SHA256: `1ce10f63b5662ee4531bb6afeaf9b909afea666848dcac7b4a35c544c35057e5`.

`negative-control.json`, `challenge-qualification.json`, each lane's `report.json`, TAP logs and `gateway-typecheck.log` retain exact scope and results. The two theme executions are repeats of the same business journey under different startup conditions, not distinct feature acceptances.

Two earlier local attempts remain unaccepted: one lost its encrypted scratch mount before assertions; another correctly had its OWNED-prefixed fault flag stripped by the database safety filter and ran a normal successful journey. Neither was credited as the delayed negative control. The corrected flag avoids database-ownership names without weakening that filter.

## Preservation and remaining gates

The exact canceled fixture IDs were recovered through the canonical dead-owner/label/age-checked reaper; no shared stack was stopped. The restored encrypted cache is held open by its finite qualification parent. Parent image `/Volumes/T7 Shield/Canonical-Projects.sparsebundle` mounts at `/Volumes/T7 Projects`; its existing native418 child image mounts at `/private/tmp/letbuyy-native418-encrypted-ci-cache`. No replacement image, key or plaintext backup was created.

This evidence does not certify full CI, hosted signup/sign-in, production deployment, native iPhone/Android login or 122-feature parity. Preserve the approved source freeze, exact native418 recovery/artifact bindings, real staged account verification and guarded production activation. No CI waiver or security bypass is included.

## Follow-up source and neighbour controls

The first broader local pure run remained failed: an inline comment containing a scanner keyword triggered the unchanged no-skip rule, and the killed-run lifecycle case could not create its raw neighbour network under supplemental default-pool pressure. Its failed result is retained; the 114-validator governance lane in that run passed separately.

The comment is now on its own line, with no executable change. Lifecycle witnesses now reuse the existing checked private-pool allocator while preserving their original incomplete or absent ownership labels. Actual inspected labels must match exactly, so the foreign/unlabelled witnesses cannot become fully owned fixture resources. Cleanup binds the positively observed network IDs, names and labels. The shared Docker daemon's defaults, assertions, reaper ownership guards and suite-selection rules are unchanged.

Focused source no-skip and real killed-run/reaper controls passed 2/2 with two owned default-pool neighbours held: zero failures/skips and no cleanup failures. Actual witness subnets were 10.233.148.128/28 and 10.233.31.160/28; the live witness kept only its original two labels and the other kept no labels. All original assertions that the reaper preserves both witnesses executed. Other file cases were unselected; this is not a full pure-lane result.

Evidence: /Volumes/Projects/LetBuyy Workspace/runs/20261117T123435Z-native418-widget-source-and-reaper-controls-29dcc1c12e4346beab1316328c2f98ab. The original successful browser source differs only by the full-line comment relocation. Current source inventory records the final file hash; new full exact-source CI remains required.
