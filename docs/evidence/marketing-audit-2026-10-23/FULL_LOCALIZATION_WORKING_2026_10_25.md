# Full-site localization and legal alignment — 25 October 2026

The owner explicitly selected **Full site, including legal documents and articles** for Tamil and Hindi. Implementation is complete for the current public marketing runtime. English (`/in`), Tamil (`/in-ta`), and Hindi (`/in-hi`) remain the three supported locales. Work was performed solo; no commit, push, deployment, backend schema change, or new runtime was made.

## Interface changes

- Footer region/language picker is compact (208px), with an inline India header, close action, native language labels, current-option focus, Escape focus return, outside-click/blur dismissal, and accessible dialog association. Switching preserves page, query and fragment; explicit country/lang query overrides track the chosen locale.
- Removed duplicate Platform sitemap and Public sitemap column links. The bottom Sitemap link remains.
- Header Why LetBuyy icon uses Store; product overview uses LayoutDashboard rather than twinkles. Earlier illustrative platform shortcut icons are preserved.
- Legal hub and all 15 documents share `components/legal/legal-layout.module.css`: consistent gutters and reading width, responsive metadata, compact status/summary panels, aligned hub rows and a visible numbered timeline on mobile.
- The 8:02pm privacy screenshot showed opposite alignment in Previous and Next cards. Both now explicitly start-align, use identical padding/gap, and stack into one mobile column. The stronger `.document [class~='lgl-pager-link'][class~='is-next']` selector overrides the legacy right-alignment rule.
- Native-language headings use natural character spacing and additional line height. The locale layout includes a server-rendered lang/dir wrapper; the existing document-language sync remains.

## Translation implementation

- All **15 legal documents** have complete source-locked Hindi and Tamil translations under `src/lib/i18n/content/{language}/legal/`. Every summary, clause heading, body paragraph, list and note is retained. English source files remain unchanged. Translations preserve structural IDs, routes, audience/group metadata and paragraph/list cardinality; SHA-256 checks reject stale translations. Translated legal documents link to the governing English text and identify the translation as a reading reference.
- All **35 guides** have complete Hindi and Tamil translations under `src/lib/i18n/content/{language}/articles/`. `article-content.ts` preserves every block, table cell, checklist, metric, example and prompt. Executable code stays unchanged; prose prompt examples are translated. Stable English section anchors are attached to translated headings, preserving TOC, deep links and bespoke illustration selection.
- `article-summary.ts` and the small `article-summaries.json` provide client-safe localized titles/subtitles/descriptions for search and listings without shipping full body catalogues. Article routes validate full source hashes server-side. Category, author, tag, reading-plan, recommendation and previous/next views use translated presentation data. Search matches both localized text and English terminology, retaining canonical category/tag values.
- Typed dictionaries cover navigation/footer/legal interface text. `copy-catalog.ts` supplies explicit Hindi/Tamil presentation messages for homepage sections, navigation submenus, reader controls, illustrations/captions/alt text, contact/support/demo/create pages, ticket statuses, errors, conditional contact options and Indian states, changelog/release history, sitemap, and pricing labels/features/tooltips. No DOM translation widget or external translation service was added.
- Contact/demo selections retain canonical submission values and default the preferred reply language to the selected site language. Working-hour response wording follows the existing shared SLA calculation; no routing or promise changed. User-entered content, proper names, URLs, code, event identifiers and technical tag IDs are preserved.
- Route metadata and alternate links are localized for the legal hub, resources, contact, support, pricing, changelog, releases and sitemap. Article metadata uses translated content. The obsolete homepage English-only notice was removed.

## Verification

- Production build passed: `/tmp/letbuyy-verified-build.log` (497 generated pages).
- **184 tests passed**: four federation boundary tests plus 180 marketing tests (`/tmp/letbuyy-verified-tests.log`). New coverage checks all legal and article translations, immutable source/IDs/code/table shape, stale-source rejection, summary/detail parity, interpolation variables, full category/author/release copy and conditional contact taxonomy, plus query/hash-preserving language switching.
- Marketing typecheck passed. ESLint/CSS lint passed with zero errors; five existing warnings remain (unused ConnectedModules, two Footer img warnings, unused bookmark props). `/tmp/letbuyy-final-types.log`, `/tmp/letbuyy-final-lint.log`.
- Standalone design-system and token-source validators passed. The destructive full governance wrapper was not run. `/tmp/letbuyy-final-design-system.log`, `/tmp/letbuyy-final-token-source.log`.
- Generated HTML audit passed for **150 article/legal routes**: all **4,434 expected content strings**, every stable section/clause anchor, exactly one footer Sitemap link per route. `/tmp/letbuyy-final-localized-render-audit.json`.
- Hindi and Tamil generated-page reader-text audits found remaining Latin text only in proper names, technical tags/identifiers, URLs, code/event names and product names. `/tmp/letbuyy-untranslated-audit.json`, `/tmp/letbuyy-tamil-untranslated-audit.json`.
- All **68 distinct rendered local image paths exist**. `/tmp/letbuyy-final-image-assets.json`.
- **Live mobile/keyboard/zoom verification was unavailable:** CUA reported browser use disabled in Work settings. No new live browser screenshots or pixel-perfect visual verification are claimed. Static generated HTML and source CSS checks do not replace this.

## Preview

Local preview restarted and ready at `http://localhost:9006/in`; privacy at `/in/legal/privacy`. Current exec session at completion: 48620, log `/tmp/letbuyy-ready-preview.log`. Recheck the actual listener PID before any later build; stop the preview before writing production output into the same `.next` directory and restart afterward.

The repository has extensive pre-existing unrelated dirty changes. Preserve them. Do not run `scripts/validate-governance.mjs`: it clears runtime node_modules and `.next`. Relevant standalone validators are safe. Do not rerun `/tmp/letbuyy-sync-article-translations.cjs`: the article catalogue has since been split into `article-catalog.ts` and `article-summaries.json`; update those owners deliberately for later content changes.
