from pathlib import Path
import json,re,os,hashlib
R=Path('/Volumes/Projects/LetBuyy/docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22'); E=R/'evidence';repo=Path('/Volumes/Projects/LetBuyy')
profiles=json.loads((E/'authored-theme-profiles.json').read_text());P=json.loads((E/'proposed-portfolio.json').read_text());A=json.loads((E/'current-presets-audit.json').read_text())['results'];family=['fabric','dwell','savor','atelier','pitch','tinker','ritual','heritage','horizon','vessel']
def write(f,s):(R/f).write_text(s.strip()+'\n')
def src(p):return '['+p+']('+os.path.relpath(repo/p,R)+')'
write('00_SCOPE_METHOD_AND_EVIDENCE.md','''# Scope, method and evidence

Status: research and original design proposal, 22 October 2026. No architectural amendment, implementation authorization, or UX certification is created by this collection.

## Starting questions

1. Does source-level rendering reproduce the reported sameness, and which stage introduces it?
2. How do the currently listed free Shopify demos differ at home, collection, product, navigation, option and cart-entry levels?
3. Which ten niche journeys are defensible, and which data/operational dependencies must be completed before their controls can exist?
4. Can the canonical Liquid architecture deliver those differences without renderer forks or loss of merchant work?

## Authority and recovered context

Read current Constitution and canonical-system theme registry under `GOVERNANCE_REWRITE_2026_06_10`, root `AGENTS.md`, relevant commerce, merchant, theme-engine and research instructions; applied the LetBuyy and web-ui-ux-system skills. Research proposals remain below accepted governance. The canonical Liquid/portable theme winner, one merchant editor, one server-authoritative commerce system, hosted checkout, tenant boundaries and approved India merchant envelope are constraints. Topology here means page/section/journey organization.

Recovered earlier theme-discovery, theme-research, phase-2 and current identity/onboarding research. The referenced “Research Shopify identity UI/UX” chat was read through `read_thread` during context recovery, including older turns as needed. Its observations are context, not fresh authority. Current source corrections are recorded in 05.

Pinned checkout at experiment start: branch `letbuyy/theme-release-performance-resume`, HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d`. Existing modifications to the parent research index/analysis and identity/onboarding research were preserved. Work in the other identity implementation folder is unrelated and was not edited. No branch changes, commits, pushes, theme installation, publication, database writes or payment actions were performed.

## Repeated browser protocol

The already-authorized Shopify Themes screen was inspected safely. No account identifier or authenticated screenshot is published here. Public official catalog entries supplied listing and demo URLs. The final comparable pass used standalone storefronts, measured at 1440 × 1000 and 390 × 844 CSS pixels, DPR 1. Every theme has home and product desktop/mobile captures. Twenty-two have separate collection captures; Spotlight's homepage is the catalog entry actually observed. All 23 now have an empty-cart entry capture. Menu opening and variant choices have separate probe logs.

For each demo, follow an observed category/product link; do not invent a route to fill coverage. Home desktop captures are full-page; route/device captures are viewport screenshots unless labelled otherwise. DOM measurements include below-fold section/text ordering. Additional story/fit/care/recipe pages were opened when linked: 21 themes, with two lacking a relevant separate entry in inspected navigation. Pitch's observed newsletter link leads to a contact page; it is a form inspection, not an editorial story or a submitted signup.

Official listings were inspected for free/developer/version/family and features. Non-persistent probes selected available variants, opened menus/cart, and exercised a no-result search on Fabric. A Fabric filter drawer was opened, but applying a Color filter was not confirmed because the matching text resolved to a hidden element. Do not count that attempt as a successful filter journey. Controls observed in all themes are distinct from controls exercised. No cart additions or checkout were attempted; no local files were sent to Shopify.

## Tooling corrections

Early embedded preview attempts gave inaccurate/transition viewport readings and iframe pointer errors. Final standalone captures supersede them for comparable claims. A requested viewport is not evidence until `innerWidth/innerHeight` is read. Some first desktop product captures show unloaded media while mobile captures show the image; this is recorded as incomplete loading, not a deliberate empty design or a measured performance defect. No network timing benchmark was run.

A first variant probe required input IDs; newer themes expose labelled radios without IDs. Follow-up semantic radio probes succeeded on seven modern-family demos; Colorblock's native size select was also changed. Products without extra options are not failed variant workflows. Initial Studio routing selected a gift card; a supplementary art PDP was inspected before interpreting the art experience.

## Evidence vocabulary

| Label | Meaning |
|---|---|
| OBSERVED | Direct current browser content/state. |
| MEASURED | Rendered geometry, computed declarations, deterministic source-render output. |
| DOCUMENTED | Opened first-party documentation or current source. |
| HISTORICAL | Prior chat/report/archive, not current verification. |
| INFERRED | Explanation or merchant fit derived from evidence. |
| PROPOSED | Original LetBuyy recommendation. |
| BLOCKED | A required observation could not be established, with reason. |

Evidence IDs, state, source, interpretation and limitations appear in the ledger. A computed font-family list does not prove which font binary painted glyphs. A screenshot does not prove keyboard accessibility. Source hashes prove equality in the supplied experiment, not all merchant behavior. Catalog completeness does not mean all possible configurations were tested.

## Source-derived experiment

`evidence/audit-presets.mts` imports public canonical pure builders, builds all ten bundles, renders index/collection/product using the same six synthetic products, computes template/main-HTML hashes and checks composition type resolution. It also computes additive/full-design application diffs without persisting anything. Thirty HTML artifacts are generated; all ten home fixtures plus representative collection/product fixtures were opened locally in the browser. The fixture bypasses the full Next data-loading app, contains no real merchant catalog, and does not prove installed catalog/draft/release state. Its explicit image/price fixtures were corrected to the renderer's expected featured-image and major-unit contracts before the final run.

## Research limits

No read-only persisted catalog/release snapshot was retrieved; no credentials were accessed to manufacture that branch. Actual merchant saved instances, releases, editor parity and deployed font requests remain unverified. Intermediate-width breakpoints, all hover/focus states, full keyboard/screen-reader behavior, reduced motion, long-content resilience, all filter combinations and non-empty cart are incomplete. These are limitations in a comparative expert study, not claims of defects. No interviews, task success study, conversion experiment or causal UX result was performed.
''')
# Census
s='''# Current free-theme census

**OBSERVED:** the official [free-theme collection](https://themes.shopify.com/collections/free-themes) listed 23 entries on 22 October 2026. All entries were free and developed by Shopify. The initial 23-name seed reconciled exactly: no new name, missing seed or paid entry was encountered. Each listed theme had a reachable demo. Version dates are listing disclosures, not a source-code pin for a deployed demo.

| Theme / dossier | Current listing | Version / date | Evidenced family | Demo | Coverage |
|---|---|---|---|---|---|
'''
for p in profiles:
 slug=p['slug'];l=json.loads((E/f'{slug}-listing.json').read_text());version='4.3.0' if slug in family else '16.1.0'
 s+=f'| [{slug.title()}](shopify-theme-dossiers/{slug}.md) | [Official]({l["url"]}) | {version} / 2026-10-09 | {"Horizon collection" if slug in family else "Earlier cohort; ancestry not asserted"} | [Open]({l["demoUrl"]}) | Home + PDP both devices; {"home catalog" if slug=="spotlight" else "collection both devices"}; empty cart |\n'
s+='''
## Package, preset and content distinctions

Each catalog entry exposed a same-named preset route in this inspection. This does not establish that it has only one possible style or that every preset is an independent engine. Horizon membership is documented by the listing's collection statement; the other 13 share many visible section conventions, but this research did not inspect their source trees to prove an inheritance graph. Features listed on a product page are documented claims; the actual inspected demo configuration may not show all of them.

Dossiers state observed merchant/product positioning and apparent catalog breadth separately from official marketing. Catalog counts vary by selected collection and are not a theme maximum. The listing's “More themes for…” industry links are broad discovery taxonomy, not a one-theme/one-niche law.

## Excluded / historical register

| Name/class | Disposition | Why |
|---|---|---|
| Debut, Brooklyn, Narrative, Simple, Supply, Venture, Boundless, Minimal | Historical examples; excluded | Not present in this day's free collection; no claim made here about installation support elsewhere. |
| Paid Theme Store entries | Outside census | Not an entry in the free collection; no paid catalog audited. |
| Duplicate embedded preview sessions | Evidence attempts, not extra themes | A preview surface is not another catalog identity. |
| Unreachable listed demos | None encountered in final pass | Individual media/state limitations remain in coverage. |

Evidence: `catalog-dom.txt`, listing JSON files, route summaries and [machine-readable coverage](evidence/coverage-matrix.json). Exact developer/free status comes from the official catalog/listing observations, not a static name list.
''';write('01_CURRENT_FREE_THEME_CENSUS.md',s)
write('02_THEME_FAMILIES_AND_FOUNDATIONS.md','''# Families, foundations and what may be transferred

## Evidenced shared family

**DOCUMENTED:** Fabric, Dwell, Savor, Atelier, Pitch, Tinker, Ritual, Heritage, Horizon and Vessel identify themselves as part of the Horizon collection in current official listing copy. They currently disclose version 4.3.0. Their demos show a repeated product-grid density control, named option controls, compact purchase patterns and mobile drawer conventions, yet can produce very different opening compositions. Shared family is not an assertion that all files or every behavior are identical.

The other 13 entries disclose version 16.1.0. Their visible reusable patterns include regular collection grids, conventional filter/sort controls, media-first PDPs and cart pages/drawers. “Earlier section-theme cohort” in this collection is a descriptive grouping, not a verified code-inheritance tree. No source repository diff was performed, and coincident version numbers do not prove a common engine.

Shopify's theme architecture separates layouts, templates, sections, blocks and assets/configuration. That explains why the same foundation can host distinct compositions without separate applications. This is a technical model from [official theme architecture](https://shopify.dev/docs/storefronts/themes/architecture), not evidence of private backend architecture.

## Observed design clusters, not ancestry claims

| Design approach | Examples | Distinction that survives some neutralization |
|---|---|---|
| Campaign/editorial apparel | Fabric, Colorblock, Ritual | Full media versus color panels versus typographic capsule and cutout categories. |
| Curated object/material story | Atelier, Dwell, Vessel, Craft, Heritage | Product scale, room context, provenance and gallery/detail orientation. |
| Food/care education | Savor, Crave, Taste, Sense, Pitch, Refresh | Pack choice, recipe or ingredient framing, benefit panels, typography/section rhythm. |
| Tiny curated/direct catalog | Origin, Spotlight, Horizon | Homepage product options versus immediate catalog versus minimal hero/grid. |
| Retrieval/creator/operational | Trade, Studio, Publisher, Tinker | Bulk quantity rows, artist-based collections, publication context, task-based objects. |

A photograph can make two regular grids feel unrelated; that effect disappears under neutral treatment. Conversely, Trade's quantity table and Origin's two-product direct selection remain different even without their photography. A unique homepage does not automatically imply a unique collection or product model. LetBuyy must differentiate all three where the purchasing task warrants it.

## What remains shared in LetBuyy

One Liquid compiler/renderer and sandbox, one versioned document model, common navigation/option/quantity/cart islands, one server-authoritative price/stock path, tenant/permission checks, shared editor controls and hosted checkout. Niche variation belongs in ordered composition, schema-supported layout/card/fact variants, bindings and an experience palette. Do not add ten React renderer forks or a new token authority. Existing React compatibility surfaces are not a mandate to extend them for new niche sections.

The platform/editor purple identity is a different axis from a merchant's storefront palette. Keep platform chrome stable while storefront defaults use the niche palettes. Merchant colors are still subject to semantic-state/contrast checks; business statuses never depend on color alone.

## Typography availability and licensing

The current `experience-fonts.ts` registry includes Inter, Playfair Display, Cormorant Garamond, Libre Baskerville, Lato and Source Sans Pro. The storefront layout emits its Google Fonts stylesheet with `display=swap`. This is source integration, not a successful network/font-file readback from a deployed merchant store.

The proposed families have open font distributions. Opened license records identify SIL OFL 1.1 for [Inter](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt), [Playfair Display](https://github.com/google/fonts/blob/main/ofl/playfairdisplay/OFL.txt), [Cormorant Garamond](https://github.com/google/fonts/blob/main/ofl/cormorantgaramond/OFL.txt), [Libre Baskerville](https://github.com/google/fonts/blob/main/ofl/librebaskerville/OFL.txt), [Lato](https://raw.githubusercontent.com/google/fonts/main/ofl/lato/OFL.txt) and the current [Source Sans 3 distribution](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt). The legacy Source Sans Pro registry name must be checked against the exact Google-served family or mapped through an approved compatibility update. Do not treat Source Sans 3's license file as a binary identity proof for an old cached Pro file.

Before packaging/self-hosting, pin actual font binaries and their accompanying license/copyright files, verify supported weights and retain required notices. This research downloads no font assets. Use supplied system/serif fallbacks on blocked font requests, verify INR and wrapping, and test actual Indian-language glyph coverage rather than assuming Latin display faces cover them.
''')
# Cross-theme matrix with carefully bounded qualitative axes
s='''# Cross-theme design matrix

This matrix is expert synthesis of the captured configuration. It is not a conversion score, theme source comparison or statement about every merchant-customizable layout. **O/M** = observed/measured configuration; **I** = interpreted intent. Typography is a computed family declaration. Detailed evidence and tradeoffs are in each linked dossier.

| Theme | Leading intent / catalog (I/O) | Opening rhythm / density (O) | Collection/card model (O) | PDP model / selection (O) | Type / color distribution (M/O) |
|---|---|---|---|---|---|
'''
for p in profiles:
 s+=f'| [{p["slug"].title()}](shopify-theme-dossiers/{p["slug"]}.md) | {p["approach"]} | {p["home"].split("→")[0].strip()} | {p["collection"].split(";")[0]} | {p["pdp"].split(";")[0]} | {p["visual"]} |\n'
s+='''
## Axis interpretation

- **Editorial versus utility:** Atelier, Origin and Publisher spend substantial opening space on brand/curation; Trade and Spotlight put merchandise/ordering closer to the entry. Circuit and Marginalia intentionally shift further toward retrieval.
- **Small versus broad:** Origin's observed two-product list and Craft's selected three-bundle collection contrast with Horizon's 176-item and Vessel's 193-item collections. Collection counts are content, not hard design limits.
- **Image versus information:** All themes use media strongly; Trade's variant table remains information-heavy. LetBuyy's electronics/furniture proposals require specifications/dimensions that images cannot reliably communicate.
- **Campaign versus category:** Fabric's campaign leads into apparel taxonomy, Ritual opens with manifesto/categories, Studio makes creators a major discovery axis, and Tinker groups workspace tasks.
- **Bleed/asymmetry versus regularity:** Dwell/Vessel use large lifestyle media; Heritage opens an asymmetric garment layout; older cohort collection grids often return to regular cards. Asymmetry alone is decorative unless it helps the task.
- **Gallery and mobile ordering:** Desktop orientation varies, especially Heritage's information-left gallery-right arrangement. Mobile commonly returns to gallery then options/purchase; repeated shared controls are desirable. Not all sticky states were exercised.
- **Variant model:** Radio pills/swatches recur; Colorblock uses native selects; Savor pack size is a purchasing unit; Studio gift-card amounts are a separate fixture. Trade uses multi-variant quantity rows.
- **Cart presentation:** Drawers dominate several modern-family captures; many earlier demos navigate to a full empty-cart page with recommendations. Cart entry is verified; successful mutation and checkout are untested.
- **Configuration flexibility:** Official listings document customization, but this study did not install themes or inspect their entire editor schemas. Do not rank flexibility from screenshots. Demo content can hide or exaggerate a shared component model.

[Inspection sheets](visuals/inspection-sheets/) align home, collection and product opening crops. Their blank/missing image areas are capture/loading limits where noted. For exact route/state/device evidence use the [coverage matrix](evidence/coverage-matrix.json).
''';write('03_CROSS_THEME_DESIGN_MATRIX.md',s)
# Current audit table
s='''# LetBuyy existing ten-preset audit

**MEASURED:** the current catalog builder produces one shared template set and one shared source-file set across all ten identities. Rendering the same synthetic catalog produces identical **main HTML per page type** for homepage, collection and product, across all ten presets. All 30 render calls returned `rendered`. Settings and layout-level styles can differ; this is not a claim that every complete HTML byte or painted pixel is identical.

Reproduce without a database:

```sh
node --import tsx docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/evidence/audit-presets.mts
```

This writes only this research collection's fixtures/results. The script does not publish or query a merchant store. [Machine results](evidence/current-presets-audit.json), [HTML fixture index](visuals/current-source-fixtures.html) and [browser fixture log](evidence/source-fixture-browser-review.json).

## Actual common templates

- Homepage: banner-carousel → hero-banner → category-grid → featured-products → product-grid → video-hero → spotlight → testimonials → newsletter-signup.
- Collection: collection-banner → collection-filter → collection-product-list.
- Product: product-detail → featured-products.
- Bundle contains 23 template keys, including shared utility/customer routes. The experiment covers the three primary page types, not all 23 routes.

## Per-identity differences and non-differences

| ID | Current niche | Heading / body registry | Primary / accent / canvas | Declared home composition | Measured shipped structure |
|---|---|---|---|---|---|
'''
for a in A:
 st=a['settings'];comp=' → '.join(x['type'] for x in a['declaredComposition']['index'])
 s+=f'| {a["preset"]} | {a["industry"]} | {st["headingFontFamily"]} / {st["bodyFontFamily"]} | {st["primaryColor"]} / {st["accentColor"]} / {st["backgroundColor"]} | {comp} | Same Core home/collection/PDP; no niche interaction delta in compared main HTML |\n'
s+='''
The declared arrays are authored intent. They are not the arrays in `createFirstPartyCatalogBundle`'s rendered templates. Even after they are applied, section ordering alone will not supply a fit workflow, normalized electronics specs or product-specific allergen data.

## Composition application experiment

| Preset | Full design adds/removes | Full content-risk count | Additive adds/removes | Missing registered section types |
|---|---:|---:|---:|---|
'''
for a in A:
 f=a['fullApplyDiff']['summary'];ad=a['additiveApplyDiff']['summary'];s+=f'| {a["preset"]} | {f["sectionsAdded"]} / {f["sectionsRemoved"]} | {f["contentAtRisk"]} | {ad["sectionsAdded"]} / {ad["sectionsRemoved"]} | {len(a["missingCompositionTypes"])} |\n'
s+='''
All currently declared composition types resolve in this experiment. A previous claim that absent section registrations explain today's sameness would be stale. Full-design mode can remove six or seven starter sections and reports content risk; it must not be applied automatically to existing merchant documents. Additive mode retains unmatched sections and reports no removals in this fixture, but still needs review for duplicate/awkward arrangement. Style-only does not create a niche journey.

## Interaction, typography and evidence boundary

The compared bundles use the same underlying product/quantity/cart/search behavior. Token differences include color, font and radius; they do not change the compared main section markup. The source font registry and storefront layout already integrate stylesheet loading. Actual loaded font binaries in a deployed merchant store were not measured; the standalone fixture does not emulate the complete Next font/data pipeline.

Thumbnails generated by the current catalog script share one SVG composition, a clothing-like silhouette and the same campaign message. The thumbnails therefore do not substantiate ten niche layouts. Source-derived screenshots reproduce shared content and arrangement; synthetic data cannot establish all variant, stock or merchant-specific states.

**Confidence:** high for deterministic builder/template/main-HTML equality and bounded source trace; medium for the explanation of the owner's live experience; unresolved for persisted database catalog rows, actual merchant drafts/releases and deployed editor/storefront parity. Source validation did not inspect or mutate those records.

## Source boundaries

'''+ '\n'.join('- '+src(p) for p in ['packages/theme-engine/src/first-party-theme-catalog.ts','packages/theme-engine/src/theme-presets.ts','packages/theme-engine/src/experience-compositions.ts','packages/theme-engine/src/experience-apply.ts','packages/theme-engine/src/theme-bundle-core.ts','packages/theme-engine/src/theme-bundle.ts','packages/theme-engine/src/experience-fonts.ts','apps/commerce/web/src/app/store/[subdomain]/layout.tsx'])
write('04_LETBUYY_EXISTING_TEN_AUDIT.md',s)
write('05_DIFFERENTIATION_ROOT_CAUSE_ANALYSIS.md','''# Differentiation root cause and unresolved branches

## Established cause in the current source path

**RC-01 / DOCUMENTED + MEASURED:** `createFirstPartyCatalogBundle` starts with the Core fixture, changes package identity, and overlays listing settings (`first-party-theme-catalog.ts:34–46`). It does not apply `EXPERIENCE_COMPOSITIONS`. The same-catalog 30-render experiment confirms identical primary template/main markup across all ten identities. This reproduces the reported structure-level sameness without relying on comments, thumbnails or cache speculation.

**RC-02 / DOCUMENTED:** `scripts/liquid-parity/build-first-party-catalog.mjs:22–28` constructs each catalog document from `base.default_template`, changes identity and settings, then retains its bundle/templates. Its SQL generation feeds migration 372. `ON CONFLICT(slug) DO NOTHING` also means re-running this historical catalog insert is not a valid update strategy for existing rows. Do not run or rewrite that migration as a research repair.

**RC-03 / DOCUMENTED:** `ThemeExecutionAdapter.installTheme` verifies the site, gets the selected theme's default template, merges identity, validates it and passes that document to `install_owned_theme_v1`. It correctly starts from the selected design rather than merging the outgoing store. If the selected catalog document contains Core composition, installation preserves it. Fix the selected artifact and assert the pipeline, rather than adding a second renderer in the installer.

**RC-04 / DOCUMENTED:** onboarding calls `applyExperienceToTemplateConfig` (`stores.ts` current onboarding path; helper at `theme-presets.ts:510–538`). The helper overlays `experienceId`, `themeSettings` and config current settings, not templates. It is a settings path, distinct from the richer pure document-application API.

**RC-05 / BOUNDED SEARCH:** searching `apps` and `services` for `applyExperienceToDocument`, `applyExperienceToSections` and `computeExperienceApplyDiff` returned two explanatory comments in the AI customization panel/proxy, not a runtime invocation. This strongly supports missing production composition wiring within the searched roots; it is not proof about external deployed systems or untracked code elsewhere.

## Why a source change alone will not update an installed storefront

The release builder stores `template_snapshot`, `settings_snapshot` and a release manifest including the Liquid bundle (`theme-execution.adapter.ts:570–615`). The storefront resolver selects the bundle from the supplied store configuration/release manifest. Merchant instances/drafts and published snapshots are separate state. Updating a default catalog definition must not rewrite an existing saved release. Preview/publish/readback must be tested end to end on an explicitly selected test site during implementation.

Old snapshots are therefore a plausible additional cause of unchanged deployed output, but **not verified** in this research. Do not label the entire problem caching. No cache invalidation, republish or SQL update was performed.

## Representation gaps that remain after composition wiring

1. A section array may differ only by announcement, trust and newsletter placement. That is weak niche differentiation.
2. Product-card anatomy and PDP selection remain common unless the canonical schema/sections consume different layout/fact settings.
3. Product DTO metadata is not automatically present in `productToLiquidDrop`. Typed niche facts need an explicit validated hydration contract.
4. Sort/price/vendor controls in `collection-filter` are conditional on server-supplied payloads. Those facet payloads are absent in the inspected drop construction, so flags alone cannot activate functioning filters.
5. A composition that includes generic assurances can invent free shipping or certification unless merchant content/policy controls it. Do not ship the example composition promises as universal merchant facts.
6. Shared thumbnail geometry promises style changes, not the ten actual journeys the owner requested.

## Corrections to older explanations

| Earlier lead | Current finding | Implication |
|---|---|---|
| Non-system fonts never load | Font registry and storefront head integration now exist | Verify network/paint later; do not rebuild a font system. |
| Missing filter/FAQ/video composition types cause collapse | Current pure resolution returns zero missing types | Test consumption/layout behavior, not registry presence alone. |
| Unique array means unique experience | Separate arrays exist, shipped bundle templates remain equal | Assert rendered artifact and buying mission. |
| Thumbnail proves installed design | Thumbnail generator uses one geometry | Generate previews from the exact versioned artifact. |
| Publishing is equivalent to changing defaults | Releases freeze snapshot/bundle | Preserve merchant ownership and explicit publication. |

## Confidence and next decisive test

High confidence: current source catalog construction, experiment equality, helper semantics, generated catalog SQL and release-snapshot architecture. Inference: these paths explain the owner's particular installed store. Blocked/unverified: actual catalog row payload, instance draft, active release ID/snapshot, deployed font requests, and preview/published DOM parity.

First implementation test: select two distinguishable representative designs on a disposable tenant-isolated test fixture; install, save/read back, preview, publish through the existing service, read back the release and render the published route. Assert exact document identity and meaningful home/collection/PDP structural differences at each boundary. No production merchant mutation is needed to prove the design.

## Source trace

'''+ '\n'.join('- '+src(p) for p in ['scripts/liquid-parity/build-first-party-catalog.mjs','database/supabase/migrations/372_first_party_theme_catalog.sql','services/api-gateway/src/execution/theme-execution.adapter.ts','services/api-gateway/src/routes/themes.ts','services/api-gateway/src/routes/stores.ts','packages/theme-engine/src/theme-presets.ts','packages/theme-engine/src/experience-apply.ts','apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx','apps/commerce/web/src/lib/theme-engine/template-resolver.ts','apps/commerce/web/src/lib/theme-engine/composition-engine.tsx']))
s='''# Ten-niche portfolio and differentiation review

**PROPOSED:** exactly ten customer-facing design approaches. Working names are original proposals, not cleared trademarks or approved registry labels. Existing preset IDs stay stable. This document does not authorize an automatic identity migration.

| # | Working name / current ID | Bounded niche | Primary mission | Distinguishing home → collection → product organization |
|---|---|---|---|---|
'''
for i,p in enumerate(P,1):
 f=f'{i:02d}-{p["id"]}-{p["name"].lower()}.md';s+=f'| {i} | [{p["name"]} / {p["id"]}](letbuyy-design-blueprints/{f}) | {p["niche"]} | {p["mission"]} | {p["home"][0]} → {p["collection"].split(";")[0]} → {p["pdp"].split(".")[0]} |\n'
s+='''
## Identity transition decisions

- Existing Sense→fashion, Forge→electronics, Refresh→food, Craft→home, Aura→beauty, Ride→sports and Dawn→books retain their broad positioning, but receive explicitly versioned new designs.
- Bloom currently targets pets. Toys is a **product decision**, not a harmless rename. Preserve existing pet instances, drafts/releases and their versioned catalog identity; offer the new toys design explicitly. If stable-ID semantics prohibit this reassignment, approve an identity-transition plan before changing registry metadata. The portfolio still has exactly ten marketed target designs.
- Nova is currently generic/general. Personalized products is an explicit, dependency-gated positioning change. Do not claim it supports production customization until the C/D contracts pass.
- Summit is the current generic fallback. Gifts must not inherit unknown-industry onboarding automatically. Keep the neutral base/template fallback available internally or prompt a deliberate design choice. A neutral foundation is not an eleventh marketed niche preset.

## Shared quality, distinct task support

The same select, quantity, validation, cart and checkout controls should behave consistently. Differentiation comes from the user's question: Does it fit? Is it age-appropriate? Is it compatible? What is in the pack? Will it fit my room? Is this gift suitable? What exact text will be produced? What is the ingredient/use? Is this equipment suited to the activity? Is this the correct edition?

The palette is subordinate to those questions. The [gallery](visuals/design-review.html) contains 60 color schematics (10 × 3 pages × 2 devices) and 60 corresponding neutral diagrams. These are annotated hierarchy proposals, not final mockups or implemented stores. Both colored and neutral artifacts use placeholder geometric imagery; all niche-specific photography must be original/licensed and merchant-relevant.

## Pairwise differentiation matrix

Read the upper triangle as the principal meaningful distinction. This is a review heuristic, not an unexplained similarity score or a user-study result.

'''
# Every pair explicitly contrasts decision model, with compact row table.
short={p['id']:p['name'] for p in P}
missions={p['id']:p['uncertain'].rstrip('.') for p in P}
comparison={
('sense','bloom'):'Fit/size evaluation versus adult age/contents suitability; portrait styles versus activity bento.',
('sense','forge'):'Outfit/fit rail versus model compatibility and unit-aware specifications; editorial versus search-first.',
('sense','refresh'):'One garment variant versus pantry pack quantities/ingredients; portrait grid versus shelf rows.',
('sense','craft'):'Body fit and silhouette versus room fit/dimensions; outfit gallery versus panoramic room/diagram.',
('sense','summit'):'Know what to wear versus discover what suits a recipient; fit facets versus occasion/budget.',
('sense','nova'):'Choose an existing SKU versus specify a new text configuration and review it.',
('sense','aura'):'Garment measurements versus ingredients/use/shades; shared radio mechanics, different evaluation.',
('sense','ride'):'Silhouette/outfit context versus activity-specific equipment facts; size semantics differ.',
('sense','dawn'):'Outfit discovery and size selection versus author/title retrieval and edition discrimination.',
('bloom','forge'):'Age/interest and pieces versus device model/compatibility; guided bento versus dense spec matrix.',
('bloom','refresh'):'Adult play suitability/warnings versus ingredient/allergen and net quantity evaluation.',
('bloom','craft'):'Toy contents/age versus room-scale measurement/assembly; compact object versus spatial gallery.',
('bloom','summit'):'Age/interest is product suitability; occasion/recipient/budget is gift discovery across types.',
('bloom','nova'):'Choose a safe-to-describe stocked object versus configure/validate exact production text.',
('bloom','aura'):'Age/contents/warnings versus use/ingredients/shade; different factual panels despite calm cards.',
('bloom','ride'):'Adult toy purchaser and interests versus activity equipment specs and category-specific sizes.',
('bloom','dawn'):'Activity bento and piece facts versus subject index and bibliographic list rows.',
('forge','refresh'):'Model/spec comparison versus repeat shelf purchase with pack/net quantity and allergen context.',
('forge','craft'):'Device compatibility table versus spatial dimension diagram and material/finish evaluation.',
('forge','summit'):'Known-device retrieval versus open-ended recipient/occasion exploration.',
('forge','nova'):'Select supported manufacturer SKU versus create a bounded configuration snapshot.',
('forge','aura'):'Technical compatibility reference versus factual ingredients, use and named shade.',
('forge','ride'):'Connector/model specifications versus activity/conditions and equipment-specific fit.',
('forge','dawn'):'Model/units matrix versus title/author/edition text retrieval; spec cards versus narrow-cover rows.',
('refresh','craft'):'Pack quantity/ingredient purchase versus room-scale dimensions, assembly and shipping policy.',
('refresh','summit'):'Repeat pantry staple retrieval versus suitability-led ready-made gift browsing.',
('refresh','nova'):'Existing pack SKU/quantity versus configured text that must survive order creation.',
('refresh','aura'):'Food allergens/net quantity and preparation versus beauty ingredients/use and shade selection.',
('refresh','ride'):'Ingredient/storage/pack facts versus activity conditions and equipment sizing.',
('refresh','dawn'):'Shelf/pack quantity rows versus bibliography/edition and reading excerpt; both retrieval-led with different facts.',
('craft','summit'):'Spatial fit/finish/delivery uncertainty versus recipient suitability, packaging and box contents.',
('craft','nova'):'Select stocked furniture finish versus define a new bounded text configuration.',
('craft','aura'):'Room panorama/dimension diagram versus product texture, directions and ingredients.',
('craft','ride'):'Room/material/assembly evaluation versus activity/conditions/spec compatibility.',
('craft','dawn'):'Large room-scale two-up images versus narrow covers, subject index and reading column.',
('summit','nova'):'Discover a ready-made gift by recipient versus specify and review production text; primary journeys remain separate.',
('summit','aura'):'Cross-product occasion/recipient discovery versus product-use routine/ingredient evaluation.',
('summit','ride'):'Occasion/budget suitability versus activity-specific technical evaluation.',
('summit','dawn'):'Gift suitability/packaging versus correct author/title/edition and permitted excerpt.',
('nova','aura'):'Input validation/review creates a configuration versus choosing a known care SKU/shade.',
('nova','ride'):'Production constraints and text snapshot versus equipment/activity compatibility facts.',
('nova','dawn'):'Form-led specify/review workflow versus search/list/read/edition selection.',
('aura','ride'):'Ingredients/use/routine versus activity/conditions/performance; both require sourced factual claims.',
('aura','dawn'):'Use/shade/ingredient exploration versus author/format/language retrieval.',
('ride','dawn'):'Activity and measured equipment fit versus subject/creator and bibliographic edition; technical grid versus reading list.'}
s+='| Pair | Difference beyond color/name/photography |\n|---|---|\n'
for i,a in enumerate(P):
 for b in P[i+1:]:s+=f'| {a["name"]} ↔ {b["name"]} | {comparison[(a["id"],b["id"])]} |\n'
s+='''
## Closest approaches and review risk

Fashion and sports share size controls; distinguish actual garment fit from category-specific equipment attributes, without inventing different button mechanics. Food and beauty both need ingredients; food adds allergen/net-quantity/pack evaluation while beauty adds use/routine/shade. Toys and gifts overlap in recipient suitability, but toys centers the adult purchaser's age/contents question; gifts begins from occasion/budget across product types. Electronics and books are retrieval-led, but their card anatomy, evaluation tables and query semantics differ. These distinctions are specified, not proven through user testing.

## Merchant theme-selection journey

1. Gallery labels the niche, bounded catalog fit, primary journey and required content. Show three small actual page previews, not one reused hero illustration. Never use a generated glamour thumbnail as evidence of installed behavior.
2. Preview the exact package/version and composition on home, collection and product; desktop and mobile are actual viewport renderings. Distinguish demo sample data from the merchant's data. Empty merchant catalogs show a labelled sample-data preview option, separate from live inventory, with missing-content guidance.
3. Recommendation uses explicit industry/catalog facts with an explainable reason and override. Unknown industry must not silently select Gifts. Toys/personalization identity changes require explicit choice and versioning.
4. Selecting a new library design starts its own instance from that selected artifact, using existing ownership/limits. Existing instances do not inherit the outgoing design's settings or get overwritten by catalog updates.
5. An existing merchant can choose style-only, additive composition or full-design application through current canonical APIs once wired. Show sections added/removed/reordered and content-at-risk; preserve custom sections, drafts and release history. Persist and read back before reporting saved.
6. Preview shows draft status and exact document version. Publish is a separate explicit action. A failed save or conflict retains recoverable edits; failed publication leaves the last working public release.
7. Thumbnails regenerate from the actual artifact at a fixed fixture set and crop. Gallery metadata records package/document version and preview checksum so a card cannot promise one composition while installation delivers another.
8. Missing capabilities are stated plainly: “requires product measurements” or “personalization not available until configured,” never a working-looking inert control. Merchant editor chrome stays within its platform identity.
''';write('06_TEN_NICHE_PORTFOLIO.md',s)
# Capability ledger: source support only, not deployed verification.
cap=[
('Versioned niche compositions','Deliver chosen design at install','experience-compositions / experience-apply','theme-engine + gateway theme execution','B','Apply through canonical catalog document builder and versioned artifact; production wiring absent in searched roots','Keep last valid document on failure','Validate known section schema/settings; no arbitrary executable markup','Prove two distinct catalog documents survive install/readback/render'),
('Section layout and card variants','Support different evaluation patterns','theme-bundle / built-in schemas / type map','theme-engine','C','Bounded layout/card/facts settings consumed in Liquid and editor schema','Default to known supported layout with clear missing-content state','Schema validate enum; escape merchant text; preserve Liquid limits','A setting changes the actual rendered DOM and survives editor save'),
('Product name/price/media/variants','Select a real purchasable SKU','ProductSchema, commerce-core, productToLiquidDrop','shared-types + commerce-core + storefront adapter','A','No new DTO; verify each niche option through current path','Missing media placeholder; unavailable option labelled','Prices/stock resolved server-side; tenant context enforced','Variant selection, stock race and cart amount agree with gateway'),
('Typed niche facts','Show fit/specs/ingredients/dimensions/bibliography','ProductSchema.metadata exists; productToLiquidDrop omits metadata','commerce-core + shared-types + data-binding adapter','C','Define bounded namespaced validated schemas and deliberate safe Liquid hydration; generic metadata is insufficient','Critical absence explicitly labelled; optional facts omitted','No arbitrary HTML, source execution or cross-tenant lookups','Save facts/read back and render exact units/value/absent state'),
('Metafield dynamic binding','Bind merchant facts without duplicated content','dynamic-source-binding.ts comments and missing hydration search','theme-engine + existing gateway metafield domain','B/C','Wire existing owner through sanitized SiteDrops hydration; service file named in comments is absent','Show declared fallback only; never silently invent data','Authorize site/resource access, limit values and safe field types','Wrong-site binding denied; missing binding does not leak another product'),
('Category navigation and basic search','Reach products with available contracts','navigation drops; search island; public product query','existing storefront/gateway product owner','A','Use actual observed query fields and pagination','No results preserves query and offers a broader category','Bound query length/page; tenant-scope results','Query and back navigation produce expected products without fake counts'),
('Niche facets and sorting','Narrow catalog by real attributes','collection-filter conditional sort_options/price_ranges/vendors; absent hydration','commerce-core query + gateway + storefront data binding','C','Extend current paginated query contract with bounded typed filters/sort and supplied URLs/counts','Hide unsupported facets; unknown values explicit; clear-one/all','Allowlist sort/filter keys; indexed query budget; no raw SQL fragments','Facet round-trip, pagination consistency, selected size means in-stock matching SKU'),
('Fit measurements','Judge garment fit','Variant options + merchant content; no size recommendation contract found','commerce-core content + productDetail','A/C','A static supplied size guide can render; C per-product typed measurement and facet support','Not supplied; no inferred best size','Bound units/rows; avoid personal body profiling','Measurement table remains readable at zoom and matches chosen product'),
('Compatibility and comparison','Avoid wrong technical model','Metadata/variant primitives; no normalized compare endpoint found','commerce-core + gateway product query','C/D','C unit-aware typed facts and 2–3-product comparison; D merchant source/claim responsibility','Unconfirmed/incomparable values visible; no empty compare tray','Tenant/product visibility and query limits; truthful source dates','Two products compare same named unit without fabricated compatibility'),
('Ingredient/allergen/use content','Evaluate food/care facts','Description/rich text exists; metadata not hydrated','commerce-core + canonical Liquid facts block','A/C','Static merchant text A; structured product-specific ingredient/warning groups C','Explicit missing critical facts; never infer allergen-free','Sanitize content; no health diagnosis or generated safety claims','Selected product shows correct ingredient/warning list before CTA'),
('Dimension/material diagrams','Evaluate room fit','Media/description A; normalized facts C','commerce-core + productDetail facts','A/C','Typed unit conversion and text equivalent alongside merchant diagram','No size badge if unknown; instructions remain text','No fake measurement inferred from image; accessible alternate text','Diagram agrees with text and chosen variant dimensions'),
('Quantity and stock feedback','Submit valid purchase quantity','StorefrontCartLineInputSchema and cart-routes; variant/cart islands','checkout-core + gateway cart + storefront islands','A','Reuse quantity bound, pending and server result handling','Retain selection on inventory/network errors','Server reprices; no client total/provider authority; idempotency where required','Duplicate click does not duplicate an unintended action; stock race explained'),
('Unit-price display','Compare pantry pack value','Price exists; net-quantity contract not established','commerce-core + server product presentation','C','Normalized quantity/unit and server-derived unit price with rounding rule','Hide unit price if quantity/unit missing; retain actual sale price','Avoid currency-unit confusion and client-authoritative totals','2 × 250g price and displayed per-100g value match known fixture'),
('Gift messages','Attach supported note to intended order','Cart properties primitive and order notes exist separately','checkout-core + gateway cart/order + merchant order view','C/D','Typed length/escaping, line-versus-order scope, retention/readback and fulfillment visibility; policy decision D','No note field before full support; recover entered text after validation error','Minimize personal text; tenant-isolated access, retention and output encoding','Message survives cart update, order creation and merchant readback exactly once'),
('Text personalization','Record exactly what will be produced','Cart properties accept unknown values; order item input does not prove configuration propagation','checkout-core + commerce-core + gateway order + merchant fulfillment','C/D','Product-defined allowlist/limits, normalized config/version, server price consequences, distinct line identity, order snapshot, policy','Validate near field; reviewed summary; no silent loss at checkout','Escape text, reject unsupported fields, bound payload; no trust in client price','Two configurations stay separate and order/merchant view read back exact approved text'),
('Customization uploads / proof approval','Accept customer artwork or approved proofs','No complete approved workflow established in this research','Existing media/storage/order owners only if later approved','E','Deferred initial scope; needs file validation, malware controls, access, retention, proof/version and operational policy','No upload widget or approval promise','Private assets, signed access, content validation and explicit upload authorization','Not a first-release acceptance item; requires separate approved scope'),
('Shipping rates / delivery dates','Know actual shipping constraints','Shipping-profile field/checkout rate contracts exist; ETA evidence not established','existing gateway shipping / checkout-core','A/D','A actual policy/rate links; D trustworthy delivery window/eligibility contract before promise','Link real policy; say estimate unavailable; checkout recalculates','Server validates eligible rates and site ownership; no fabricated date','Invalid rate rejected and actual final quote differs only with explanation'),
('Reviews / ratings','Use genuine customer feedback','Product review domain schemas/API; Liquid drop carries rating/count but reviews empty','commerce-core reviews + gateway moderation + storefront binding','B','Wire approved published reviews to Liquid and accessible summary; verify counts/moderation','No reviews yet; no seeded ratings on real stores','Output escaping, visibility/moderation, customer authority and privacy','Only published site/product reviews render; absent feedback stays absent'),
('Stock urgency / back-in-stock','Explain availability honestly','productToLiquidDrop stock/available exists; notification workflow not proven','commerce-core inventory + queue owner if later scoped','A/D','A factual stock/availability; D opt-in back-in-stock notification/consent work','Unavailable text and other products; no fake countdown','No invented scarcity or default notification signup','Server stock change reflected; notification absent until consent and delivery verified'),
('Curated recommendations / outfits','Support relevant additional products','featured-products / collection bindings available','theme-engine + commerce-core','A/C','A explicit curated product/collection list; C bounded outfit link group; no personalization engine needed','Omit empty related list and retain product CTA','Only public same-site products; no inferred sensitive profiling','Related links are real products with independent price/stock'),
('Sold-as-one sets / configurable bundles','Sell a listed set honestly','Ordinary Product/Variant can represent a set; inventory coupling not proven','commerce-core inventory + checkout-core','A/D','A single SKU with supplied contents; D component inventory/pricing/returns for configurable bundles','Do not render build-a-box without support','Recompute totals/stock server-side; no synthetic bundle discount','Listed SKU sells as one; any later multi-item bundle has reconciliation/inventory tests'),
('Subscriptions / local instant delivery / AR','Broaden operations','No workflow established; outside bounded initial niche designs','Existing canonical domain owners only after product scope approval','E','Deferred; never activate reserved services or new marketplace/runtime','No decorative subscribe/date/AR controls','New obligations require separate policy/provider/security review','Excluded from initial definition of done'),
('Fonts and semantic storefront tokens','Keep niche identity readable','experience-fonts.ts and commerce layout; existing theme settings overlay','theme-engine storefront settings; platform DS remains canonical','A/C','A registry/loading integration; C full semantic state pair settings where not currently modeled','Test actual fallback fonts; reject unusable override contrast','Allowlisted font sources; no arbitrary third-party tracking asset by preset','Font requests/glyphs and state contrast verified with network denied and real language fixtures'),
('Artifact-derived gallery previews','Make selection promise match install','catalog thumbnail generator currently one SVG geometry','existing catalog tooling + merchant themes UI','C','Capture actual versioned home/collection/PDP fixture; bind checksum/version to gallery','Label unavailable preview and missing merchant content','No private catalog/customer data in public samples','Thumbnail artifact ID equals selected installation artifact ID'),
('Draft / preview / publish / recovery','Preserve ownership and last good store','theme routes/execution adapter, instances/releases, preview tokens','canonical gateway theme execution + merchant editor + storefront resolver','A/B','A existing operations; B composition API wiring and version diff; add focused end-to-end assertions','Conflict/error preserves draft; failed publish retains prior release','Tenant/permission checks, scoped preview token, immutable release semantics','Save/readback → preview → explicit publish → release readback → storefront DOM matches')]
ledger=[]
for n,row in enumerate(cap,1):ledger.append(dict(zip(['feature','customerPurpose','dataSource','canonicalOwner','support','missingContract','emptyError','security','acceptanceEvidence'],row))|{'id':f'CAP-{n:02d}'})
(E/'capability-ledger.json').write_text(json.dumps(ledger,indent=2))
s='''# Component and data capability map

Classes describe **current source support**, not a deployed end-to-end certification: **A** supported canonical primitive; **B** exists but not wired into this target path; **C** bounded extension; **D** material product/policy/provider decision; **E** deferred/outside initial scope. A composite label means the primitive and complete workflow have different status. Do not advertise the complete feature based on the primitive alone.

## Canonical source ownership

'''+ '\n'.join('- '+src(p) for p in ['packages/shared-types/src/index.ts','packages/commerce-core/src/index.ts','packages/checkout-core/src/index.ts','packages/theme-engine/src/theme-bundle.ts','packages/theme-engine/src/built-in-section-schemas.ts','packages/theme-engine/src/section-type-map.ts','packages/theme-engine/src/dynamic-source-binding.ts','apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts','apps/commerce/web/src/lib/theme-engine/composition-engine.tsx','services/api-gateway/src/routes/storefront/cart-routes.ts'])+'''

Key source facts: ProductSchema supports options, variants, prices, stock, media, tags and metadata. The Liquid product adapter explicitly copies selected fields and omits generic metadata. `StorefrontCartLineInputSchema` accepts `properties`; cart routes preserve them, but ordinary order-item input carries product/variant/quantity. That is insufficient proof of a personalized production contract. `collection-filter` gates sort/price/vendor UI on supplied data that current inspected hydration does not produce. A section registration or settings toggle does not complete the capability.

## Feature contracts

'''
for a in ledger:
 s+=f'''### {a['id']} · {a['feature']} — {a['support']}

**Customer purpose:** {a['customerPurpose']}. **Data:** {a['dataSource']}. **Owner:** {a['canonicalOwner']}.

**Missing contract / dependency:** {a['missingContract']}. **Empty/error behavior:** {a['emptyError']}.

**Security/authority:** {a['security']}. **Acceptance evidence:** {a['acceptanceEvidence']}.

'''
s+='''## Reuse versus extension rule

Composition metadata selects a canonical section's layout/card/fact schema. One shared facts table can support different typed groups for devices, room dimensions, toys and bibliography without becoming an unvalidated bag of HTML. Domain schemas own names/units; the renderer owns safe presentation. Reuse option, quantity and cart mechanics; change where factual context occurs. Add a new section only for a distinct reusable responsibility that existing primitives cannot express, and register its schema/type/Liquid implementation/editor control/parity fixtures together.

No app-block marketplace, extension executor, reserved search/media service or parallel React implementation is needed for these designs. A broader business feature cannot be smuggled into a theme setting. Required future schema changes must follow current authority, shared types, RLS/GUC, validation and migration governance; this task creates no database migration.
''';write('07_COMPONENT_AND_DATA_CAPABILITY_MAP.md',s)
write('08_IMPLEMENTATION_PLAN.md','''# Implementation plan — canonical Liquid portfolio

Status: **PROPOSED, production changes not implemented**. The research proves a bounded source cause and supplies designs; it does not authorize deployment, publication, account changes or migration execution. The intended implementation is completion of the existing winner, governed by AUTH-R1, WIN-R3/R4, ARCH-R11–18 and Theme-Liquid security/parity gates. Keep the approved runtime topology and India merchant envelope.

## Delivery model and dependency order

Product/content decisions → prove artifact/application path with two distinct designs → shared typed facts and discovery contracts → expand the ten versioned compositions → merchant switching/previews → security/accessibility/performance/release qualification. Personalization remains gated until its full order/fulfillment contract works. Do not make another nine themes before proving the first selected document reaches the buyer.

No calendar estimate is justified without inspecting implementation ownership and CI availability. Each phase below has an executable exit, dependencies and rollback. These are future checks, not tests claimed as run during research.

## Phase 0 — ratify scope, identity and contract inventory

**User-visible outcome:** merchants are promised exactly the capabilities that can ship, with honest niche/content fit.

**Source boundaries:** `theme-presets.ts`, `industry-experience-map.ts`, `first-party-theme-catalog.ts`, current canonical registry and gallery metadata. Review `experience-compositions.ts` sample claims before using any default text. Do not edit governance to convert a proposal into law.

**Work:** approve Bloom pet→toys and Summit generic→gifts transition semantics; decide stable-ID/version strategy and neutral unknown-industry fallback. Confirm Nova personalization launch gate. Define typed content field groups, required-versus-optional fields, units, claim ownership and original/licensed asset list. Names remain working labels pending clearance. Classify each CAP row as first-release, gated or excluded.

**Validation:** compare active registry/industry resolution and fixture merchant cases (known, unknown, empty catalog, existing pet store, existing generic store). Verify no accepted change creates an eleventh marketed preset or rewrites an existing instance.

**Security/accessibility/performance:** no new runtime/provider; preserve tenant boundaries; explicit Unicode/unit assumptions; budget fonts/media before collecting assets.

**Recovery / done:** reversible metadata/version plan documented, product decisions recorded, required content fixtures prepared. If a decision remains open, preserve existing mappings and continue independent shared-contract work; never silently repurpose existing merchants.

## Phase 1 — prove a representative vertical slice

**User-visible outcome:** selecting Threadline (fashion) versus Pantry produces visibly different home, collection and product structures after installation, editor save, preview and publication on an isolated test site. This slice is the central fix for the reported sameness.

**Exact source boundaries:**

- `packages/theme-engine/src/first-party-theme-catalog.ts`: build the selected versioned document from canonical Core plus actual composition, rather than a settings-only bundle overlay.
- `packages/theme-engine/src/experience-compositions.ts` and `experience-apply.ts`: use their schema-validated composition/diff semantics; ensure template sections and bundle templates agree.
- `packages/theme-engine/src/theme-document.ts`, `theme-bundle-core.ts`, `theme-bundle.ts`: preserve one portable document/package shape and registered Liquid source.
- `scripts/liquid-parity/build-first-party-catalog.mjs`: produce new artifact-aware catalog output; historical migration 372 is evidence, not the place to retroactively alter deployed rows.
- `services/api-gateway/src/execution/theme-execution.adapter.ts` install/draft/preview/publish/release artifact path, and `services/api-gateway/src/routes/themes.ts`: preserve actor/site checks, limits, version conflicts and explicit publish.
- `apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx` and existing editor owner of its apply callback: route deliberate design application through the existing document APIs; no parallel editor.
- `apps/commerce/web/src/lib/theme-engine/template-resolver.ts` and `composition-engine.tsx`: ensure draft/release bundle resolution consumes the exact chosen document.

**Reusable changes:** version metadata, canonical composition application, source-derived preview fixture, explicit apply mode and artifact identity assertions. Only the minimum schema-supported apparel and pantry layout variants are needed to prove hierarchy; unsupported facets remain absent. A static factual guide can be merchant content; do not pretend this proves fully structured product facts.

**Persisted test sequence:** select catalog version → install on owned test tenant → read back instance/document → edit a meaningful section → save/read back exact version → signed draft preview → publish through canonical service → read back release snapshot/manifest → render published route → compare home/collection/PDP and selected settings. Assert release/draft IDs rather than trusting success toast. Run second-tenant denial and stale-version conflict cases. Actual merchant data is unnecessary.

**Tests:** unit composition/document invariants; contract exact schema/settings round-trip; existing `theme-catalog-install.postgres.test.ts` extended with real structural assertions; ephemeral-PG integration for install/draft/release/readback; E2E browser screenshot/DOM at desktop/mobile. Add a regression that intentionally reduces a design to token-only changes and fails the differentiation assertion. Do not assert brittle whole-page hashes where merchant content legitimately differs: assert role/order/card/fact/purchase model invariants and representative screenshots.

**Security/accessibility/performance:** keep Liquid sandbox escape/XSS/limits hard gates, preview-token site scope and permissions; verify focus, option labels and no sticky occlusion; ensure no repeated catalog fetch or large hero asset on every render. Measure actual render/request/image/interaction stages rather than perceived speed.

**Rollback / done:** failed publication retains previous valid release; old package/instance remains selectable. No destructive rewriting of drafts. Done only when persisted readback and published browser output agree for both designs; updating a generator or producing two arrays is insufficient.

## Phase 2 — complete shared factual content and discovery

**User-visible outcome:** each niche can show trustworthy product-specific facts and functional retrieval; controls reflect real data.

**Sources:** `packages/shared-types/src/index.ts`, `packages/commerce-core/src/index.ts`, existing gateway product/create/update/query owners, `apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts`, `composition-engine.tsx` product/drop adapters, `packages/theme-engine/src/dynamic-source-binding.ts`, `theme-bundle.ts` collection/product sections, `built-in-section-schemas.ts`, `section-type-map.ts` and existing merchant product/editor forms.

**Work:** bounded typed namespaces for garment fit, toy contents/age, electronics units/compatibility, pantry ingredient/net quantity, furniture dimensions, gift contents, beauty use/ingredients, activity equipment and bibliography. Validate approved metadata at the domain boundary or use the existing canonical metafield owner where appropriate; do not create another product DTO. Add deliberately safe Liquid drop fields, with unknown/missing states. Normalize units explicitly. Query extensions add allowlisted typed filters/sort, pagination and supplied URLs/counts. Preserve meaningful query state. No reserved search-service activation.

**Assets/content:** synthetic positive/negative fixtures plus real merchant-supplied content requirements; no fabricated reviews, certification or promises. One full object/product image and appropriate alternate text per fixture; diagrams include text equivalents.

**Tests:** domain unit validation/conversions; contract create/update/read/hydrate; integration facets+pagination and variant availability; tenant/security denial; E2E no-results/clear filters/back navigation. Test missing facts, long names, mixed units, unavailable variants and unrecognized metadata. Avoid a green test that only sees an empty database; include positive controls.

**Accessibility/performance:** semantic tables/lists with labels and reading order; reflow at 320 CSS px and text zoom; bounded result sizes and query indexes, no N+1 facts requests; placeholder geometry for media. Prototype budgets are proposals, not measured current baselines: responsive hero ≤250KB where feasible, no autoplay video by default, at most two font families per experience with justified weights. Set and measure actual page/JS/image budgets against representative low-bandwidth/mobile hardware before acceptance.

**Rollback / done:** versioned optional fields tolerate absent content; unsupported UI stays hidden. If a schema migration is actually needed, allocate its number only after reconciling current authority/current max and paired DOWN requirements. Do not copy the historical “next 162” note over the current migration history or rewrite migration 372. Expand/backfill/verify/contract only when applicable, never drop a shape early. Done when supplied facts/filters survive persisted readback and actual Liquid render with correct missing states.

## Phase 3 — implement the portfolio in reusable patterns

**User-visible outcome:** all ten installed designs express their distinct missions on home/collection/product/mobile, with shared reliable purchase controls.

**Sources:** same engine composition/schema/Liquid files; `theme-presets.ts` settings and `experience-fonts.ts`; commerce storefront head/token integration; current approved UI token authority. Extend the existing approved island runtime only where a bounded interaction is necessary. New Liquid capabilities are not added to the legacy React section renderer.

**Implementation groups:**

1. Shared card/fact presentation: apparel, toy, technical, pantry, dimension, gift, care, equipment, book and customization-base variants. These are schema-selected patterns, not ten copied `ProductCard` files.
2. Shared layout responsibilities: editorial split, guided category bento, search/index rail, shelf list, room index, occasion finder, process steps, routine links and subject shelves.
3. Product layouts: fit, contents, technical, ingredient, spatial, configuration review and reading. Reuse option/quantity/cart mechanics and facts primitives.
4. Experience-level ordered templates, safe defaults, palette roles, width/density/image rules and original media brief. Remove universal free-shipping/spec-verified claim defaults from unsupplied content.

**Dependencies:** Phase 2 data gates; Phase 0 identity decisions. Defer comparison until typed data works. Gifts message field waits for persistence/fulfillment; MadeYours waits for its complete workflow. Ready-made sets remain ordinary stock SKUs.

**Tests:** each blueprint's niche scenario plus shared contract/unit/security/regression pack; same-catalog structural assertions; screenshot/DOM desktop/mobile comparisons; neutral review detects brand-only changes. Preserve per-section parity/security/performance gates required by TEST-R6. A new Liquid layout is judged against its accepted behavior/reference and the canonical shared section; do not create a new React fork merely to obtain a comparison target.

**Recovery / done:** introduce versioned package defaults, not in-place mutation of merchant releases. Prior version stays recoverable. Each design's required content, missing-content behavior and actual implementation status are visible. Done only when all six page/device combinations and actual interactions satisfy their blueprint; a gallery image alone cannot exit the phase.

## Phase 4 — explicit personalization and optional messaging slice

**User-visible outcome:** MadeYours can support the approved bounded text configuration, and Kindred can show an actual supported gift note if that scope is chosen.

**Sources:** `packages/checkout-core/src/index.ts` cart-line/order contracts, existing gateway storefront cart/order execution, `packages/commerce-core` product configuration schema, canonical cart islands/context, merchant order/fulfillment presentation. One cart/order system; no separate customization service.

**Work:** product-defined text/method limits, normalized Unicode/grapheme rules, escaping, configuration version/hash, server validation and price consequences, distinct line identity, immutable order snapshot and merchant fulfillment readback. Add review/edit at product/cart; invalid revalidation cannot silently discard data. Gift notes have explicit line/order scope and retention. File uploads/proof approval/subscriptions are excluded from this slice.

**Tests:** permitted/disallowed/overlong/Unicode input, two different configurations of the same SKU, edit/reprice, malicious markup, duplicate requests, concurrent stock changes, cart-to-checkout-to-order persistence, merchant readback and wrong-tenant denial. Money/order changes trigger applicable full domain suites, not a presentation-only test pack.

**Accessibility/security/performance:** errors near field plus announcement/summary; no color-only error; secure text handling at every output; no extra private file storage or external preview service. Preview is labelled illustrative unless exact production fidelity has been established.

**Recovery / done:** do not enable the public configurator until all order/readback gates pass. A failed configuration mutation retains recoverable text and prior valid cart; failed publish keeps prior release. If the product/policy decision is not approved, MadeYours remains a specified but unshipped design and must be labelled accordingly in the gallery.

## Phase 5 — merchant choice, safe switching and truthful previews

**User-visible outcome:** selection previews accurately represent installed artifacts, and existing merchant work is protected.

**Sources:** current merchant Themes gallery/editor, `ExperiencePicker.tsx`, `SchemaFormRenderer.tsx`, existing draft/session/publish routes, `theme-execution.adapter.ts`, catalog thumbnail/build tooling. Inspect current handler boundaries before editing; no replacement editor or alternate draft store.

**Work:** niche fit/content requirements; multi-page desktop/mobile previews from exact artifact; labelled sample versus merchant data; explainable industry recommendation with override; style/additive/full diff and explicit application; saved/readback/conflict status distinct from preview and published status. Preserve custom section IDs/content where the chosen mode promises preservation. Maintain theme library limits and ownership rules.

**Tests:** new merchant, empty catalog, existing custom sections, existing pet/general designs, unknown industry, stale draft, preview expiry, library full, save/network failure and failed publish. Thumbnail/version checksum equals selected install artifact. Verify controls work in actual mobile browser, not only editor device frame. Confirm preview origin cannot confer merchant/admin permissions.

**Recovery / done:** last good release and prior instance remain available; settings-only switch does not remove sections; full-design content risk is concrete and reviewable. Done when selection, install, preview and published store tell the same versioned design story and recovery does not lose edits.

## Phase 6 — release qualification and rollout readiness

**User-visible outcome:** a qualified, recoverable portfolio rather than ten polished screenshots.

**Required proof:** appropriate full 9-class Theme-Liquid coverage (unit, integration, contract, E2E, security, performance, regression, rollback and deletion validation where applicable). No deletions are proposed here; if implementation later deletes a loser, DEL-R1–6 gates apply. Keep sandbox-escape/stored-XSS/limits and section parity as hard gates; preserve cross-tenant positive-control denial, preview scope, server totals/idempotency and hosted checkout. Run touched package/app builds/typechecks and mandatory governance; a green structural lint is not behavioral proof.

**Browser acceptance:** all ten designs at 1440×1000 and 390×844; add 768/1024 and 320px reflow where appropriate; long translated names, missing media/facts, zero products, 1/200 product catalogs, unavailable variant, stock/price race, keyboard, focus return, validation errors, 200% text zoom, reduced motion and screen reader. Separate navigation shell, data, image, interactivity and cart acknowledgement timings. Use actual network/performance instrumentation; do not infer cache design.

**Package commands available today:** `pnpm --filter @letbuyy/theme-engine test`, `pnpm --filter @letbuyy/theme-engine typecheck`, gateway `test:unit`/isolated `test:db` through the repo harness, touched merchant/commerce checks, and `node scripts/validate-governance.mjs`. These are implementation checks to select based on touched boundaries. Do not run an owned-database suite against a real merchant database.

**Rollout/recovery:** only an approved implementation task may proceed to publication/deployment; this research performs neither. Use existing release/version mechanism and explicit test-site qualification; retain prior package/release. No manual publish SQL or cache-clearing procedure is a substitute for the canonical service path. Done requires traceable implementation, persisted readback, browser evidence, known limitations and release recovery proof.

## Handoff status vocabulary

| State | This research |
|---|---|
| Visually specified | Ten original blueprints; desktop/mobile home/collection/PDP schematics. |
| Technically supported | Mixed A–E; feature-level status in CAP ledger. |
| Implemented production portfolio | No. |
| Browser verified | Shopify observations and local research artifact rendering only. |
| Persisted and read back | No LetBuyy catalog/draft/release mutation or live readback. |
| Published | No. |
| Deployed | No. |

Do not collapse those states into “complete themes.” Research delivery is complete as documentation with explicit unverified branches; production delivery must satisfy the phase exits.
''')
write('09_ACCEPTANCE_AND_LIMITATIONS.md','''# Acceptance, limitations and research handoff

## What this study establishes

1. The current official free collection enumerates 23 Shopify entries; all have live route/device evidence and a dossier.
2. Ten entries explicitly identify Horizon collection membership; shared-source ancestry of the other 13 was not established.
3. The demos vary in composition, catalog emphasis, category model, gallery placement, option presentation and information density. They also share many reliable commerce conventions. Polish is not proof of universal usability or conversion outcomes.
4. Current LetBuyy pure catalog bundles share templates/source and render identical main HTML for three primary page types under a common fixture. Source tracing explains the settings-only construction/application paths and identifies the separate unused-in-searched-paths composition APIs.
5. Ten original bounded niche designs are specified, with neutral structural comparisons, palette pair calculations and feature/dependency mapping. They are proposals, not installed products.

## Incomplete observation branches

| Branch | Exact limitation | Impact / next verification |
|---|---|---|
| Persisted LetBuyy catalog/instances/releases | No read-only data payload retrieved; no merchant database touched | Owner-specific live diagnosis remains an inference. Implementation must read back selected artifact/draft/release on an isolated test site. |
| Full merchant editor/published parity | Source trace only; no design switch or publish | Test Phase 1 complete chain before portfolio expansion. |
| Shopify collection for Spotlight | No distinct collection entry observed in inspected navigation | Homepage catalog reviewed; do not claim a separate collection route was tested. |
| Editorial pages | 21 linked pages opened; Horizon/Spotlight lacked relevant separate entry; Pitch link was contact/newsletter | Page opening/content inspection does not validate submitted forms or every editorial route. |
| Cart success/non-empty/checkout | Empty entry only; no add or transaction | No claim about completed cart mutation, order, payment, shipping or fulfillment. |
| Search/filter breadth | Search/filter controls observed; Fabric no-result search exercised; color filter application unsuccessful due hidden locator | No full cross-theme filter/sort journey certification. |
| Interaction states | Menu/available variants sampled; sold-out Spotlight fixture observed | All unavailable combinations, focus/hover, validation errors and loading transitions not systematically exercised. |
| Accessibility | Expert visual/DOM review and proposed palette math | No complete keyboard, screen-reader, reduced-motion, zoom or conformance audit of Shopify. |
| Performance | Geometry and media completion sampled; some first desktop images unloaded | No controlled timings, CWV study, cache or infrastructure inference. |
| Viewport range | Final comparable desktop/mobile measured; early embedded overrides superseded | Tablet, narrow editor and every breakpoint remain incomplete. |
| Fonts | Computed family declarations and LetBuyy source loading integration | Font binary paint/glyph/network behavior not measured in deployed merchant store. |
| User outcomes | No user study/experiment | No conversion/cognitive-load claim; recommendations are design hypotheses. |

A specific blocked/untested branch is not filled with an invented observation. Coverage logs retain superseded attempts and final-pass state distinctions. Hashes demonstrate artifact identity, not interpretation validity.

## Future shared browser acceptance pack

For every implemented design:

- Merchant selects the advertised version; installed document, saved draft, preview and published snapshot read back that version and correct template structure.
- Home/category/product routes remain useful with zero products, one product, missing optional facts, long names and absent media; sample data never appears as real stock.
- Search/query/filter state is genuine, paginated, shareable where appropriate and recoverable through clear-one/all and browser back. Unsupported facets are absent.
- Product selection identifies a valid purchasable variant; invalid/unavailable choices do not submit; stock/price race returns truthful recoverable feedback.
- Cart pending/success/error states reflect server responses. Quantity, price, stock, shipping and payment authority remain server-side; retry/idempotency and tenant scope pass domain suites.
- Keyboard reaches all controls; focus returns from overlays; sticky areas do not obscure focus; input errors have labels/context and status updates.
- Test 320px reflow, desktop/mobile/tablet, 200% text zoom, actual Indian-language content, reduced motion, missing fonts and a screen-reader walkthrough.
- Check semantic-state contrast in rendered components, not just palette values. Targets should meet applicable WCAG 2.2 criteria; aiming for 44px touch areas is a product target, not a claim that WCAG AA universally mandates 44px.
- Product images have stable geometry, deliberate crop/contain rules and meaningful alternatives. Video is optional/paused or avoid autoplay by default. Fonts use justified weights/fallbacks.
- Measure navigation feedback, shell, data, images, interactivity and mutation acknowledgement separately; compare against agreed fixture/device/network budgets.
- Each niche-specific acceptance scenario in its blueprint passes with real canonical contracts. A control with no contract fails even if its screenshot is convincing.

The relevant standard reference is [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/): contrast, keyboard, reflow, visible/unobscured focus, labels/errors/status and target-size criteria guide implementation. Opaque default palette calculations in the blueprints are a partial check, not conformance certification.

## Artifact validation

The research check report in `evidence/research-validation.json` records JSON/XML parsing, relative link targets, expected dossier/blueprint/wireframe counts, palette pair results, privacy marker scan, current experiment invariants and documentation diff checks. The governance result is separate and may report pre-existing repository blockers. A governance pass does not prove UI behavior. Production builds/DB/checkout suites are not appropriate claims for this documentation-only task.

No production application source, database schema/state, account settings, Shopify installation, public release or deployment was changed. Only this research folder and its own derived artifacts/scripts were authored. Existing user/other-chat work was preserved.
''')
# Tiny index, links to the detailed work rather than repeating it.
write('README.md','''# Shopify free themes → ten distinct LetBuyy storefront designs

Research date: **22 October 2026**. Status: **research + proposed designs, no production implementation**.

The owner's concern is reproducible in current source: all ten catalog bundles share the same primary templates, and the same-catalog experiment renders identical main HTML for home, collection and product. Separate composition definitions exist, but the inspected catalog/install/onboarding paths do not apply them as full designs. This is strong source evidence; a particular merchant's persisted release was not inspected.

Shopify's 23 current free demos differ through merchandising, navigation, page composition, gallery/selection patterns and information density while sharing foundations. They are not automatically one industry each or flawless UX examples. Ten explicitly identify Horizon collection membership.

## Review first

- [Findings and root cause](05_DIFFERENTIATION_ROOT_CAUSE_ANALYSIS.md)
- [Ten-niche portfolio, pairwise review and merchant selection journey](06_TEN_NICHE_PORTFOLIO.md)
- [Original visual gallery — all page/device and neutral structures](visuals/design-review.html)
- [Complete phased implementation plan](08_IMPLEMENTATION_PLAN.md)
- [Capability contracts and dependencies](07_COMPONENT_AND_DATA_CAPABILITY_MAP.md)

## Research collection

1. [Scope, method and evidence limits](00_SCOPE_METHOD_AND_EVIDENCE.md)
2. [Current free-theme census and 23 dossiers](01_CURRENT_FREE_THEME_CENSUS.md)
3. [Families, shared foundations and typography](02_THEME_FAMILIES_AND_FOUNDATIONS.md)
4. [Cross-theme design matrix](03_CROSS_THEME_DESIGN_MATRIX.md)
5. [Current ten-preset source/render audit](04_LETBUYY_EXISTING_TEN_AUDIT.md)
6. [Acceptance and incomplete branches](09_ACCEPTANCE_AND_LIMITATIONS.md)
7. [Evidence ledger](evidence/claim-ledger.json), [coverage](evidence/coverage-matrix.json), [manifest](evidence/manifest.json) and [validation](evidence/research-validation.json)

## Ten target designs

| Design | Niche / principal distinction |
|---|---|
| Threadline | Fashion: outfit context and fit/size evaluation. |
| Playfield | Toys: adult age/interest discovery and contents facts. |
| Circuit | Electronics: search, model compatibility and specifications. |
| Pantry | Food: shelf rows, ingredients/allergens and pack quantity. |
| Habitat | Furniture: room context, dimensions and material/finish. |
| Kindred | Gifts: occasion/recipient/budget discovery and box contents. |
| MadeYours | Personalization: specify, validate, review and persist configuration. |
| Dewdrop | Beauty: use/routine, ingredients and named shades. |
| Trailmark | Sports: activity pathways and equipment-specific fit/specs. |
| Marginalia | Books/stationery: title/author/subject retrieval and edition facts. |

Bloom pet→toys and Summit generic→gifts need explicit version/identity decisions; existing merchant designs must be preserved. MadeYours requires end-to-end configuration/order work before launch. The first implementation slice should prove two distinct artifacts through catalog → install → editor → preview → release readback → published storefront before expanding all ten.

This collection contains original schematic proposals, current public-browser evidence and a source-derived synthetic experiment. It does not claim all Shopify interactions, accessibility conformance, conversion outcomes, non-empty carts or live LetBuyy publication were verified. [Exact limitations](09_ACCEPTANCE_AND_LIMITATIONS.md).
''')
write('10_UX_PRINCIPLES_AND_CONTENT_RESILIENCE.md','''# UX principles, tradeoffs and content resilience

This is an expert comparative review. **Observed convention**, **standard criterion**, **design hypothesis** and **user outcome** are different kinds of claim. No measured user outcome is asserted here.

| Principle | Current evidence / tradeoff | LetBuyy proposal / implementation verification |
|---|---|---|
| Stable hierarchy | Origin's featured-product opening and Spotlight's immediate catalog differ from Atelier's large editorial statement | Match hierarchy to shopping intent; test whether representative users can find the relevant category and price. |
| Findability | Studio exposes artist discovery; Tinker exposes workspace task categories; Fabric uses apparel categories | Use typed subject/age/activity/room models where warranted. New facet UI must round-trip to real query results. |
| Density | Trade's quantity rows prioritize repeated operational purchase; Atelier/Vessel leave more space for object presentation | Avoid a universal density default. Check readability, task speed and information loss with the intended catalog. |
| Selection and availability | Named radios, Colorblock native selects and Spotlight sold-out fixture were directly observed | Shared mechanics with niche labels; unavailable means actual server SKU availability, not a decorative badge. |
| Recovery | Fabric's no-result search shows a named no-result message plus a Best Sellers region | Retain the query, separate alternatives from matches, and allow clear/broaden. Do not call alternatives search results. |
| Purchase visibility | Modern demos often place a compact rail beside large media; Trade's table follows supporting detail | Place critical decision facts before commitment. No arbitrary sticky bar that hides options, warnings or focused controls. |
| Honest trust | Demos include assurances/claims and example policies; LetBuyy composition examples include shipping/spec statements | Remove unsupplied promises. Source claims, reviews, warnings and actual shipping policy instead of manufacturing confidence. |
| Keyboard/focus | DOM exposes many labelled controls; the full keyboard path was not exercised | Test focus order, disclosure semantics, Escape, focus return and selected-state announcements in implementation. |
| Mobile reachability | All final narrow captures are actual 390px storefronts; gallery/options stack differently from desktop | Prioritize search/selection/facts and test thumb use; no claim of ergonomic superiority without task observation. |
| Motion | Carousels and media controls are visible; reduced-motion paths were not systematically exercised | Manual media by default, equivalent non-motion content and explicit pause where needed. |
| Reflow/content resilience | Normal demo content inspected; long translated names and empty media were not injected into remote pages | Use local fixtures for missing images/facts, zero products, long titles, 200% text zoom, script expansion and 320px reflow. |
| Loading/performance | Some first desktop captures had blank media that appeared in mobile; no controlled timing measurement | Reserve image geometry, retain usable text and measure shell/data/media/interactivity separately. Do not infer a cache architecture. |

## Standards versus product targets

Accessibility criteria are defined by applicable WCAG requirements, while the proposed larger touch spacing, type defaults and media budgets are product targets. Neither the number of screenshots nor a visually polished demo establishes conformance. The [standards reference](https://www.w3.org/WAI/WCAG22/quickref/) informs the acceptance pack; full assistive-technology and interaction checks remain implementation work.

## Proposed content stress fixtures

| Fixture | Expected resilient behavior |
|---|---|
| 180-character product title in the merchant's actual language | Wrap without covering price/options; full accessible name preserved. |
| No image / failing image / extreme wide or tall media | Stable placeholder and deliberate contain/crop rules; no content shift over purchase controls. |
| Unknown age/ingredients/dimensions/compatibility | Explicit critical absence or omitted optional field; no guessed factual badge. |
| Two variants with same visible color | Named labels and actual SKU identity disambiguate; selected state not color-only. |
| Non-Latin personalization text | Grapheme-aware product-defined validation and readable review; invalid input explained without silent data loss. |
| Two editions sharing title/cover | Author, language and format distinguish entries before purchase. |
| Slow cart / stock race / server price change | Pending acknowledgement, duplicate protection and truthful recovery; no client total authority. |
| Empty category or zero merchant products | Clear scope/empty message, broader navigation and honest sample-data separation. |

Do not inject these stress fixtures into remote Shopify pages or real merchant state as research evidence. Use owned isolated implementation fixtures. Future usability work should recruit actual niche merchants and buyers, test concrete tasks, record errors/time/confidence with consent, and revise the hypotheses; no such study was performed in this task.
''')
# Supplement current per-theme dossier with actually reached information-page scope.
for row in json.loads((E/'editorial-probes.json').read_text()):
 p=R/'shopify-theme-dossiers'/f'{row["theme"]}.md'
 if row['status']=='opened':
  data=json.loads((E/f'{row["theme"]}-editorial-desktop.json').read_text());hs=[h['text'].replace('\n',' ')[:120] for h in data.get('headings',[]) if h.get('width',0)>10 and h.get('height',0)>2][:3]
  add=f'\n## Supplementary information-page observation\n\nOpened the observed [{row.get("entry") or "information-page entry"}]({row["url"]}) at desktop width. Substantial recorded headings: {" / ".join(hs) if hs else "no substantial heading in this capture"}. [Rendered text/geometry](../evidence/{row["theme"]}-editorial-desktop.json), [full-page capture](../evidence/{row["theme"]}-editorial-desktop.jpg). This establishes page entry/content inspection only; form submission, every accordion and all article links were untested. '
  if row['theme']=='pitch':add+='This route is the contact/newsletter form; it is not evidence of a full editorial story.'
 else:add='\n## Supplementary information-page limit\n\nNo relevant separate story/care/article entry was observed in inspected homepage links. Editorial content elsewhere remains unverified.\n'
 p.write_text(p.read_text()+add+'\n')
studio=R/'shopify-theme-dossiers/studio.md';studio.write_text(studio.read_text()+'''\n## Supplementary art-product observation\n\nThe actual [seven vessels art product](https://theme-studio-demo.myshopify.com/products/seven-vessels) was opened on desktop and mobile. Its content includes artist context, dimensions/material/framing and shipping/returns information. This gives a more relevant art evaluation sample than the initial gift-card fixture; those merchant policy statements are demo content, not general Shopify terms. [Desktop evidence](../evidence/studio-art-product-desktop.json), [mobile capture](../evidence/studio-art-product-mobile.jpg).\n''')
# Expand comparison metadata directly from observed route state.
m=R/'03_CROSS_THEME_DESIGN_MATRIX.md';extra='\n## Navigation, option and cart-entry comparison\n\n| Theme | Mobile menu capture | Cart entry presentation | Extra selected option evidence |\n|---|---|---|---|\n'
for pr in profiles:
 slug=pr['slug'];route=json.loads((E/f'{slug}-route-summary.json').read_text());cart=E/f'{slug}-cart-mobile.json';d=json.loads(cart.read_text()) if cart.exists() else {};cartKind='drawer / same product route' if d.get('url') and '/cart' not in d['url'] else ('cart page' if '/cart' in d.get('url','') else 'not captured');sels=list(E.glob(slug+'-variant-selected*jpg'));extra+=f'| {slug.title()} | {"opened capture" if (E/f"{slug}-mobile-menu.jpg").exists() else "affordance only"} | {cartKind}; empty only | {"selected-state capture" if sels else "no additional selection captured; see probe limits"} |\n'
m.write_text(m.read_text()+extra)
read=R/'README.md';s=read.read_text().replace('6. [Acceptance and incomplete branches]', '6. [UX principles and content resilience](10_UX_PRINCIPLES_AND_CONTENT_RESILIENCE.md)\n7. [Acceptance and incomplete branches]').replace('7. [Evidence ledger]','8. [Evidence ledger]');read.write_text(s)
