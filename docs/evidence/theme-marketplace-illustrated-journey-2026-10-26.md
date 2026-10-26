# Illustrated homepage theme journey — 26 October 2026

Owner request: redesign the benefits and onboarding-guide section shown in the supplied screenshot, with proper illustrations and clearer UI. Strict frontend-only continuation in the existing isolated `codex/theme-marketplace-20261026` worktree, base `339e988d0`. Header and marketing landing page remain unchanged.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

Replaced the repeated icon benefits strip and text-only guide cards with one ordered choose / personalise / prepare journey. Each shared Card has a purpose-built code-native illustration: sample storefront selection, a brand/editor composition, and desktop/mobile review with a checklist. These are decorative examples, not interactive editor controls, catalog listings, or a successful publication state. All artwork is aria-hidden; useful instructions and named guide links remain ordinary accessible content. Existing sample photographs are reused without edits; their provenance is already recorded in `public/showcase/provenance.json`.

Design: canonical semantic tokens and shared Card / Lucide icons, purple accents, photo detail, shorter copy, numbered steps and consistent link placement. Single-column cards on narrow screens, paired artwork/copy on tablets, three columns on larger screens. Illustrations use bounded aspect-ratio containers; copy remains in normal flow without fixed-height clipping. There is no new motion, client state, dependency, endpoint, renderer, or backend architecture.

Acceptance exercised: 61 package tests pass (24 source-contract and 37 UI/API/session tests), including a render regression verifying the ordered journey, three decorative illustrations, valid guide destinations and absence of fake editor controls. Production build and typecheck pass. App lint has zero errors and seven existing warnings. Changed CSS stylelint, design-system hard invariants/ratchet and diff whitespace checks pass. An initial ESLint invocation from repository root could not find the app configuration; the correctly scoped app lint passed. Read-only HTTP checks confirm homepage200, three illustrations in delivered markup, three guide destinations200, three reused image assets200 and delivered journey CSS. Header CSS is byte-identical to the prior commit, and backend/API/package/marketing diff is empty.

Local preview: http://localhost:9005/#how-it-works. Browser/device/keyboard visual acceptance remains deferred under the owner's automated-only preference; no claim of visually verified viewport fit or full accessibility certification. No merge, push, deployment, database change, or external side effect.

Post-commit quick gate logs: `/private/tmp/letbuyy-journey-close-20261026/`; build/test/lint/design logs: `/private/tmp/letbuyy-journey-{build,tests,lint,design}.log`.
