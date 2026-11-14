# LetBuyy marketing release candidate

**Held locally.** Build `1iA7dvwq_bIyb4K8i8XV0` includes the verified accessibility repair. Both pages still fail every simulated mobile LCP sample against 2.5s. The pricing median is **3.450s** and the first-store guide median is **3.829s**. The required marketing approval gate remains closed. [All performance samples and investigation](PERFORMANCE-VERIFICATION.md)

## Exact reviewed source

- Working checkout `codex/local-work-preserved-20261025`, source HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`. The tested working snapshot contains 1,289 files and includes previously verified owner edits.
- Materialize the archived closure with SHA-256 `9a0145e2fbf5396660526e9fe1d64004fc598fd1e0df6403cd6fd13ce2d02dbe`, then apply the six-file patch with SHA-256 `fe8a50677d6a85aaec08713f18c588c61aeeb64e8810e9e0cab4f19b793e8d71`. All candidate file hashes were verified in both the isolated build source and the owner checkout after applying only those hunks. [Source archive](../../../letbuyy-seo-release-readiness-2026-11-03/MARKETING-RELEASE-SOURCE.tar.gz) · [Accessibility patch](ACCESSIBILITY-REPAIR.patch) · [Exact source manifest](evidence/candidate-source-manifest.json)
- The comparison base for the app patch is local `main` at `e6c4b448a2a91712b11887b0228f8129bd1aaa3e`. The 163-path app patch was applied to matching main blobs in scratch and verified byte for byte. The CSV also lists verification and shared workspace differences for individual review before creating a production commit. [App patch against main](MARKETING-SOURCE-vs-main.patch) · [Path delta](SOURCE-DELTA.csv) · [Patch proof](evidence/source-proof.json)
- The candidate changes only contrast for pricing labels, guide text and category labels, legal controls, and underlining for existing privacy/contact links. It preserves the category hue using the existing theme text token. The CSS splitting, font scheduling and Turbopack trials were excluded. No provider changes were made.

## Build and verification

The frozen dependency set uses Node 22.23.3, pnpm 10.6.2 and Next 16.1.6. The existing isolated lockfile installation was reused. The filtered build rebuilt all 29 tasks with zero cache hits. It uses canonical `https://www.letbuyy.com` URLs, local gateway port 9010, local Accounts port 9002, and the exact local listener on 9019 for verification. A production build uses the approved hosted origins on the reconciled integration revision.

| Gate | Exact result | Evidence |
|---|---|---|
| `pnpm exec turbo run build --filter=@letbuyy/marketing-site` | 29/29, zero cached | [Build](evidence/access-build.log) |
| `pnpm --filter @letbuyy/marketing-site test` | 224 marketing plus four auth boundary tests, all passed | [Tests](evidence/access-marketing-test.log) |
| `pnpm --filter @letbuyy/marketing-site typecheck` and `lint` | TypeScript, ESLint and stylelint passed | [Types](evidence/access-marketing-typecheck.log) · [Lint](evidence/access-marketing-lint.log) |
| `pnpm --filter @letbuyy/ui validate:aliases` and scoped boundary checks | 138 protected token groups, manifest/import/export and dead-twin checks passed | [Tokens](evidence/access-token-alias-validator.log) · [Imports](evidence/undeclared-import-validator.log) · [Exports](evidence/package-export-validator.log) · [Boundary](evidence/marketing-dead-twin-validator.log) |
| Exact local SEO inventory | 489 inspected. 477 HTML 200s, 12 expected 308s, three additional 404 controls, 690 parsed JSON-LD blocks, 189 XML entries with 105 localized guides, 567 reciprocal alternate links. The three 200 HTML directories carry noindex/follow and stay out of the XML. | [URL inventory](evidence/candidate/PRODUCTION-CANONICAL-URL-INVENTORY.csv) · [Raw robots](evidence/candidate/production-canonical-robots.txt) · [XML and alternate checks](evidence/candidate/sitemap-and-alternate-verification.json) |
| Chromium pricing and guide journeys | 48 cases and eight interaction cases passed, including touch and desktop nav, JS-off initial content, all four real plans, comparison, signup navigation and return, guide tabs and contents. | [Browser results](evidence/candidate/browser/browser-verification.json) |
| Automated accessibility and motion | 24 cases with zero detected violations after the patch and eight animation checks passed. Manual reviewer/device checks remain. | [Accessibility and motion](evidence/access-patch-browser.json) · [Human review checklist](REVIEW-CHECKLIST.md) |
| Required mobile Lighthouse | Six simulations failed LCP. Six applied samples passed. All TBT and CLS passed. | [Full performance verification](PERFORMANCE-VERIFICATION.md) |

The guide, pricing and SEO behavior above comes from the verified local build. Google reprocessing, branded result appearance, rich result eligibility and field performance need follow-up on an approved release. [Separate release scopes and rollback](RELEASE-SCOPES.md) · [Post-release verification](POST-RELEASE-VERIFICATION.csv)
