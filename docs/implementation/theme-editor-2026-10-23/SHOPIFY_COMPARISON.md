# Shopify and LetBuyy editor comparison

Working audit, 23 October 2026, Asia/Kolkata. Evidence, not governance or an
acceptance certificate. Fresh Shopify inspection has begun after marketplace's
explicit browser release. The local merchant entry was inspected, but a new owned
editor store/fixture is still pending. Shopify configuration, content, save and
publication remain untouched.

## Evidence classes and comparison method

- **RECORDED**: the 22 October Horizon 4.3.0 research in
  [the detailed editor reference](../../research/shopify-product-intelligence/identity-onboarding-2026-10-22/11_THEME_EDITOR_DETAILED_REFERENCE.md)
  and its redacted deep-dive-02 captures. This includes actual visual/DOM evidence,
  but is not a fresh inspection by this workstream.
- **DOCUMENTED**: current official pages accessed 23 October 2026, linked below.
- **INFERRED**: an engineering conclusion from source; no Shopify persistence claim.
- **NOT EXERCISED**: direct verification absent or deliberately prohibited.
- **OBSERVED NOW**: fresh inspection below; selection/navigation/catalog browsing
  only, never Shopify settings or document mutations.
- LetBuyy states below refer to this workstream's evidence. Previously recorded
  Threadline acceptance stays attributed to its existing record.

The eventual comparison uses the same tasks: choose template/resource; select
section and block; inspect legal insertion candidates; edit one typed setting;
review dirty/save/publication meaning. Shopify mutations are out of scope. Local
mutations require this workstream's fresh synthetic store. Record package/version,
draft revision, viewport inner dimensions and source snapshot for each local run.

## Task-by-task comparison

| Merchant task | Shopify evidence | LetBuyy evidence / state | Next executable acceptance |
| --- | --- | --- | --- |
| Enter focused workspace; identify theme/status; exit | RECORDED dedicated toolbar and exit; DOCUMENTED theme identity/status [S1] | IMPLEMENTED_UNVERIFIED: editor route, return link and theme controls exist | Enter from owned theme library; verify correct instance/version, return context and unsaved exit |
| Choose template | RECORDED separate Pages, Blogs and Blog posts | PARTIAL: API/bundles distinguish page/blog/article, but fallback label says Blog post for blog; page key normalizer rejects canonical alternate/customer keys | Select page, blog, article and alternate; route/resource remains distinct after reload |
| Choose preview resource without reassigning content | RECORDED template navigation; assignments not changed | IMPLEMENTED_UNVERIFIED: resource controls and preview-session paths exist | Preview two pages/articles sharing a template; no assignment write; no content leakage |
| Understand header/body/footer | RECORDED three outline groups | IMPLEMENTED_UNVERIFIED: `SectionTreePanel` pinned header/footer and template list | Tree order equals rendered document and saved order |
| Expand/collapse section and block tree | RECORDED nested outline | PARTIAL: tree rows and nested component exist; section comment explicitly says no collapse implemented; page block model is flat | Collapse/expand preserves selection/focus and announced hierarchy; nested instances round-trip |
| Select exact section from preview | RECORDED inspector selection; DOCUMENTED [S2] | IMPLEMENTED_UNVERIFIED: Liquid inspector selects registered section IDs; existing DOM test passes | Preview click ↔ tree ↔ settings all identify same duplicate-type instance |
| Select exact block from preview | RECORDED Heading controls; DOCUMENTED [S2, S7] | PARTIAL: Liquid inspector/CenterPanel protocol carries section identity only | Duplicate same-type blocks; select second exact ID and edit only its settings |
| Hover/selected outline and contextual actions | RECORDED Hero actions | PARTIAL: section hover/selected chip exists, block context absent | Hover differs from selection; scaled/offscreen targets align; no message/scroll loop |
| Inspector on/off, keyboard and touch | RECORDED toggle/shortcuts; DOCUMENTED [S2] | PARTIAL: Liquid binding intercepts selection while installed; explicit on/off path needs completion | On blocks commerce activation; off permits ordinary browsing; keyboard/touch equivalents |
| Add a permitted section at a specific position | RECORDED categorized catalog with preview; DOCUMENTED theme/version-dependent options [S3, S5] | PARTIAL: section catalog and add intent exist; schema/preset legality and insertion require behavioral check | Search, insert before/after/empty group; service denies invalid parent/max |
| Add permitted block; understand limits | RECORDED block categories; DOCUMENTED schema constraints [S5, S6] | PARTIAL: per-section allowlist filter exists; type catalog alone does not prove count/nesting legality | Add block at legal location, reject wrong parent/depth/count, preserve IDs/order |
| Duplicate, reorder, hide and remove | RECORDED contextual controls; DOCUMENTED [S2, S3] | IMPLEMENTED_UNVERIFIED: callbacks and undo/history exist | Fresh recursive IDs, pointer+keyboard reorder, truthful hide, remove+undo+focus return |
| Edit global/section/block typed fields | RECORDED Hero/Heading and 19 global groups; DOCUMENTED [S4] | PARTIAL: renderer handles extensions, global normalizer silently maps several to text and drops metadata | Every declared type round-trips declaration→API→widget→save→preview→published render |
| Unsupported future field | No universal behavior inferred | BROKEN_REPRODUCED at pure helper: unknown type becomes editable text; object default retained until widget String coercion | Value preserved; clearly unsupported/read-only; no text mutation callback |
| Select/radio option labels | DOCUMENTED settings schema [S4] | PARTIAL: global normalizer reduces option descriptors to IDs, losing labels | Label differs from stable value; saves stable ID, displays correct label |
| Inheritance/default/reset | RECORDED color/typography scopes | IMPLEMENTED_UNVERIFIED: default helpers/global values exist; no complete override/reset trace | Reset local override restores declared inherited value and documents scope |
| Global groups/styles | RECORDED 19 Horizon groups, not a universal requirement | PARTIAL: generated bundles declare four global groups; available global fields use older supported types | Show only supported controls with actual consumption; style mode preserves content |
| Media selection/upload/replace | RECORDED selection affordances, upload NOT EXERCISED | IMPLEMENTED_UNVERIFIED: image/video/media-library controls and authorized routes exist | Tenant-owned upload progress/retry; safe type/size, alt and stable reference readback |
| Content/menu/resource binding | RECORDED control availability; DOCUMENTED compatible dynamic sources [S3, S4] | PARTIAL: live search returns products/collections/pages/posts/menus, `blog` currently means post; pagination absent in picker | Search/page through authorized results; stable typed reference; missing/foreign reference behavior |
| Page vs blog listing vs article detail | RECORDED distinct chooser groups | IMPLEMENTED_UNVERIFIED: bundles have all three; public routes resolve distinct contexts | About/FAQ/Contact, listing and two distinct article bodies via real navigation in each theme |
| Desktop/tablet/phone storefront preview | RECORDED device modes; preview parity NOT EXERCISED | IMPLEMENTED_UNVERIFIED: explicit 1440/834/390 fitting helper and test exist | Measure iframe inner width, avoid thumbnail-width claims, verify chosen section through scaling |
| Narrow editor | RECORDED stacked controls and mobile sheets | IMPLEMENTED_UNVERIFIED: workspace module/CSS exists | 390/320 and enlarged text; primary actions reachable; panel focus and scrolling usable |
| Dirty/saving/saved/error/offline | RECORDED clean disabled Save; failure NOT EXERCISED | IMPLEMENTED_UNVERIFIED: canonical draft client; 96 baseline tests pass including transport tests | Last edit acknowledged/read back; failure preserves input and disables publish |
| Undo/redo, shortcuts, dismiss/back | RECORDED shortcut help; mutation undo NOT EXERCISED | IMPLEMENTED_UNVERIFIED: page history and key handlers | Grouping, redo invalidation, text-input native undo, unsaved navigation recovery |
| Concurrent conflict/reapply | NOT EXERCISED on Shopify | IMPLEMENTED_UNVERIFIED: `ThemeDraftClient`/ConflictDialog with reviewed revision replacement | Two real sessions; stale writes denied; neither saved draft silently erased |
| Save draft vs publish | Shopify mutation/persistence NOT EXERCISED | IMPLEMENTED_UNVERIFIED: separate saved-draft/publish endpoints and immutable releases | Intended saved revision becomes public; newer private input stays private; failed publish keeps old release |
| Versions/restore/rollback | NOT EXERCISED on Shopify | IMPLEMENTED_UNVERIFIED: release history/recovery routes and owned tests recorded elsewhere | Public rollback vs private restore distinguished; newer draft retained; exact retry idempotent |
| Theme library entry/style/return | RECORDED theme/workbench contexts | IMPLEMENTED_UNVERIFIED; marketplace owner handles discovery/install/handoff | Selected installed package version opens editor with return context; no second catalog |
| Third-party app blocks/embeds | RECORDED separate unavailable states in inspected Shopify section | DEFERRED_BY_GOVERNANCE: Constitution ART-16/22/23, AGENTS NEVER-R3 and AGENT-R13 | Do not activate third-party execution; present honest capability absence |
| General executable merchant code workbench | RECORDED separate code workbench composition; no files edited | DEFERRED_BY_GOVERNANCE for new arbitrary execution: THEME-R4, SEC-R11, ART-16 | Inventory safe existing surfaces; preserve data-only sandbox and sanitization |

## Current official references

All accessed **23 October 2026**. Documentation describes public contracts; it does
not establish the behavior of this particular account, version or save workflow.

- [S1 — Theme editor features overview](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview)
- [S2 — Preview inspector](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/preview-inspector)
- [S3 — Sections and blocks](https://help.shopify.com/en/manual/online-store/themes/theme-structure/sections-and-blocks)
- [S4 — Settings](https://shopify.dev/docs/storefronts/themes/architecture/settings)
- [S5 — Section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema)
- [S6 — Block schema](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema)
- [S7 — Editor integration](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks)

## Direct comparison still required

Capture fresh Shopify/local visuals and accessible structure after browser lease
release. No claim of complete visual audit, Shopify mutations, accessibility
certification, local store creation, persistence or publication is made here.

### Fresh browser checkpoint

Fresh task-owned tabs, 23 October; previous user/Threadline/marketplace tabs were
not claimed. Shopify Horizon loads with Active status, clean disabled Save/Save as
and disabled undo/redo. Selecting Hero expands its Heading and Button children and
shows Hero media/layout controls. Selecting Heading changes the property heading
to Heading with its own text/layout/typography/padding controls and a tighter
preview outline. No field value changed.

The current template chooser directly exposes separate **Pages**, **Blogs** and
**Blog posts** entries. Add block → Blocks directly exposes Basic (Button, Heading,
Logo, Text), Decorative (Jumbo text, Marquee), Layout (Group, Spacer) and Show all
for this inspected Hero context. The initial Generate tab was observed but never
submitted. These are context-specific available items, not persistence tests.

Evidence: `evidence/shopify-{hero,heading,template,block-catalog}-current.jpg` and
redacted template AX text. Initial measured viewport: **1280 × 720**. A later
requested 390 × 844 override actually measured **931 × 1034**; the attempted
capture is not accepted as mobile evidence. The requested/actual record is
`evidence/shopify-narrow-measurement.json`; the override was reset afterward.

Local `http://localhost:9001/stores` directly loads the Local Demo Merchant's two
existing stores. Those stores were not opened or changed. Create store received
one AX activation and, after unchanged state/error-log inspection, one semantic
locator activation; neither navigated in this session. No JS dialog or captured
page error explained it. Source points to the canonical identity onboarding
handoff. This is an observed development-session obstacle, not a production-build
defect certificate. New synthetic-store creation remains unverified; no existing
site has been substituted. The merchant process changed during discovery; its new
PID/cwd and local-dev container labels were inspected read-only. No restart here.

Recorded visuals independently opened during this audit:

- `identity-onboarding-2026-10-22/evidence/deep-dive-02/editor-outline-1440.jpg`:
  compact, separated Header/Template/Footer groups with insertion controls at each
  group. This is a cropped outline, not a fresh whole-workspace measurement.
- `threadline-2026-10-22/screenshots/clean-editor-published.jpg`: the captured state
  has a blank phone preview, an unloaded campaign thumbnail and overlapping style
  copy in the upper left. Its filename does not establish a ready preview. Fresh
  stable-state reproduction is required before attributing a current visual defect;
  later CSS/asset work is already dirty in the checkout and must be preserved.

The older June theme-editor page is retained as dated context. Its generic native
admin shell recommendations do not override the October dedicated editor evidence.
