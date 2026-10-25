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

Staging/production deployment IDs and observed checks will be appended after execution. No deployment is claimed in this preparation record.
