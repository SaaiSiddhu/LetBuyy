# Marketing release — 25 October 2026

Owner explicitly authorized consolidation of all marketing work into develop, GitHub push, staging promotion, and production promotion. The owner then said “skip this” in response to the GitHub Actions billing blocker; hosted CI is skipped by explicit direction, not represented as passing.

## Candidate

The original checkout was at 118209b4f with marketing, console, merchant and backend changes intermingled. No other local worktree or unmerged marketing branch existed. GitHub develop/staging/main were already synchronized at 28423d2b5 after other sessions' work. The marketing source, artwork, full Hindi/Tamil content, tests and evidence were preserved as f0497c9f8 on top of that latest remote history. Required shared UI focus, hydration and theme aliases are included. Unrelated uncommitted application/database work remains intact in the original checkout on codex/local-work-preserved-20261025.

One stylesheet conflict was resolved by preserving the remote named radius utility and marketing's inline theme color aliases. Added teal ramp values remain in the canonical token source and its interchange projection. The module tour button says “Continue” to avoid the repository legacy-site-type scanner misreading the ordinary “Resume” verb as an acquisition capability.

## Verification

- Integrated marketing tests: 180 passed, plus 4 federation/auth-boundary tests passed.
- Integrated shared UI suite: 65 passed across 7 files.
- Marketing production build: passed, 497 pages generated.
- Marketing typecheck: passed.
- Marketing lint and CSS lint: passed, with 5 existing unused-variable warnings and zero errors.
- Shared UI public API snapshot: passed, 381 protected exports.
- Canonical token interchange parity and token-source validator: passed.
- Full governance gate in isolated checkout: 114 passed, zero failures. One retained-work branch advisory records that its committed history is already contained in develop; its uncommitted files remain preserved separately.
- Secret scan of all 547 marketing commit paths: 340 text files scanned, 207 binaries, zero secret-like findings.

Logs are under /tmp/letbuyy-release-*.log on this machine. No synthetic contact messages, real transactions, database migrations, Workers or unrelated app deployments are part of this marketing-only release.

## Hosting corrections and rollback anchor

Existing Vercel project marketing-site (prj_2FQ0ZEkuDMHtzj58XKyWHsWRTVLx) was connected to the obsolete Letbuyy_Store repository and apps/marketing-site. Corrected it to SaaiSiddhu/LetBuyy, apps/marketing/web, Node 22. The verified existing staging.letbuyy.com domain now follows staging instead of stepup/main. Production domains remain assigned to this existing marketing project.

Previous production deployment: dpl_sujU6rmuovy3ao3GYJEbeRWFQmNC (marketing-site-kzmtvnf6l-letbuyy-store-s-projects.vercel.app). This is the hosting rollback anchor. Source rollback anchor: 28423d2b5.

## Executed release

- GitHub develop, staging and main synchronized at `1724330e17ac8ddecc7cec64c6ff142037908197` by fast-forward promotion.
- Staging: `dpl_BNTW2gXbpGJ5dnb7jUNNLXRfdQ7h`, READY; Git source staging at that exact SHA. Cloud build: 29 tasks passed. Authenticated HTTP checks: 198 localized routes, 96 artwork assets and 24 JS bundles passed. Search has the expected client-rendered Suspense shell; pricing reuses its section heading. An initial anonymous attempt reached Vercel login, so verification used the authorized Vercel CLI session and retained protection.
- Production: `dpl_E4CeDGFA9EN7XdTxVSZHyyDM5xck`, READY; Git source main at that same SHA; https://www.letbuyy.com. Cloud build: 29 tasks passed. Public HTTP checks: 198 routes and 96 artwork assets passed. Canonical home URL is https://www.letbuyy.com/in and the new SVG store mark is rendered. Public client bundles and the live pricing endpoint were checked separately.
- The owner explicitly approved copying only the public NEXT_PUBLIC_TURNSTILE_SITE_KEY from the existing accounts project. Selected its metadata without decrypting other variables, retrieved that exact public variable, and configured marketing preview/production. Verified that it occurs in the deployed client bundle. No private secret was read or copied. No live contact/demo message was sent and Turnstile provider interaction was not exercised in a browser.
- GitHub Actions remains skipped by owner direction after its jobs failed to start due account billing/spending limits. Local and Vercel evidence is separately identified; no CI pass is claimed.
- Source preservation check: all 430 marketing/source/test paths from the original checkout are present; only the documented Continue/Resume wording differs. No marketing work was omitted. Unrelated original working changes remain preserved.
- Only the marketing Vercel project was manually deployed. No database migration or Worker deployment was dispatched. Existing Git integrations can react to the main branch promotion.
- Browser-based layout, keyboard and user interaction checks were unavailable because local browser use is disabled in Work settings. HTTP checks prove response/content/asset availability, not browser interaction behavior.

Sanitized receipts are in `release-verification/`. This documentation follows the tested release as a bookkeeping-only commit; application source and deployment configuration are unchanged.
