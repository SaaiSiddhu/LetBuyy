# Console UI refinement — 21–22 October 2026

The Console keeps LetBuyy’s violet identity and canonical shared components, with a softer canvas, clearer surface separation and more consistent operational states. This is a refinement of the existing Console, not a new app or a new merchant-control authority.

Source: `develop` at `118209b4fde1b5a15313f4741bcac454690d15c8`, uncommitted working tree. The UI pass started with 129 pre-existing dirty files, preserved outside the explicitly changed UI and acceptance files. No deployment, migration, provider operation, external message or Git publication is part of this pass.

## Changed experience

- A softly tinted violet canvas, white/light or dark surfaces, quieter borders, consistent panel headers and more legible semantic text. Console-specific styling composes canonical tokens; it adds no `--lb-*` token overrides.
- More compact navigation, a clear current-workspace rail, consistent 44px control heights, stronger metric hierarchy, consistent table headers and accessible pagination labels/captions.
- Setup checks requiring attention appear first, with specific next destinations. Completed checks are available in a native disclosure. Progress and evidence timestamps retain the existing server verdict.
- Support uses a selected-ticket queue beside the conversation on desktop and a single column on narrow screens. Internal notes have distinct colour and explicit labels; messages include an IST timestamp. Existing reply, privacy, recovery and resolve contracts remain authoritative.
- Zero incidents/high-risk/SLA breaches use neutral treatment. Subscription labels use the existing shared status presentation, including trial and unknown states. Store and risk tones reflect their actual state.
- Account menus close on Escape/outside interaction and restore focus on Escape. The workspace finder restores its actual opener, including when the search input takes autofocus. The theme control waits for interactivity.

The browser exposed a shared saved-theme hydration defect: a persisted choice could update page/surface text while leaving the server-rendered design-system theme attribute unchanged. The canonical provider now starts from the server’s resolved theme and applies the saved choice through a React update. Real hydration regressions cover saved light and dark choices; no second theme controller was introduced.

## Verification

| Check | Actual result |
| --- | --- |
| Visual and keyboard browser | **1/1 pass**, `d324d60a899b`: normal login, finder and account focus recovery, page-two catalog, light/dark selection and saved-theme reload, 1440/390/320px layouts, suspension and unavailable API evidence. |
| All enabled Console pages | **1/1 pass**, `afbfd595bf9f`: 20 index pages, four populated details, two frozen-page refusals, page-two listing, failed-form draft retention and narrow-screen navigation. |
| Merchant/Console support | **1/1 pass**, `afbfd595bf9f`: normal merchant settings save/readback, Console MFA login, public/private replies, resolution and original-request recovery. The merchant sees public evidence only. |
| Independent approval | **1/1 pass**, `afbfd595bf9f`: two normal operator sign-ins, a distinct checker, one suspension effect, lost-reply recovery and safe repeat submission. |
| Shared UI and Console suites | **50/50** complete shared UI tests; **46/46** Console tests. Saved light/dark hydration and explicit modal opener restoration have direct regressions. |
| Production build | Console optimized production build exits **0**, including TypeScript, page generation and route processing. Built in a separate environment-free source copy. |
| Static checks | Console, shared UI and Gateway type checks; scoped Console ESLint; CSS stylelint; public API snapshot; unchanged design-system ratchet; whitespace check all pass. |

The connected four-suite receipt `afbfd595bf9f` remains **3 pass / 1 fail**, rather than being relabelled green: its initial visual measurement ran before outage-reload hydration. The corrected final visual receipt passes independently against unchanged runtime source. Both receipts show no cleanup failures and no remaining owned containers, networks or volumes. Console browser fixtures run the actual development application; the connected Merchant application and separate Console build use production compilation. No production Console browser or hosted result is inferred.

The final contrast sample contains 143 text observations: minimum **4.5669:1** in light mode and **6.5417:1** in dark/restricted/unavailable modes. The 4.5 threshold was unchanged. Screenshots of the overview, merchant checklist, catalog, dark error state, 320/390px view and support desk were inspected. [Durable screenshots and raw runner receipts](../docs/evidence/console-ui-refinement-2026-10-21/) and the paired JSON record retain the evidence.

The visual browser exercises normal Console magic-link/TOTP sign-in, finder focus/escape, account menu recovery, page-two catalog navigation, theme selection/reload, 1440/390/320px layouts, a suspended store and a real API-read failure. It samples actual browser-composed text colours against their backgrounds. This bounded sample is not full WCAG, screen-reader, zoom, device or performance certification.

Earlier failures remain evidence: finder focus restoration; pre-interactivity theme click; saved-theme reload mismatch; and a visual measurement taken before the saved theme finished hydrating. The last case is corrected by waiting for the actual design-system theme attribute, with the contrast threshold unchanged.

Raw logs and complete source fingerprints are under `/private/tmp/letbuyy-console-ui-20261021/`. The browser candidate excludes environment files and generated outputs and was compared against 9,979 source files with zero mismatches. Its application source matches the separate production-build copy; the latter only predates the final browser-capture test edits. All database work uses owned disposable infrastructure; existing development and hosted data are outside this verification boundary. A sandboxed Console test invocation required the normal IPC-capable runner; its subsequent full run passed. An unconfigured shared-package lint invocation is not counted as a passing check.

## Delivery boundary

The requested refinement is implemented and locally verified. Hosted release, actual assistive-technology/device evaluation and broader programme acceptance remain separate. The earlier support migration 370 still requires controlled hosted application; this UI change adds no migration or permissions.
