# Content source discovery — 6 November 2026

Read the complete PagesScreen, PageEditorScreen, BlogScreen and PostEditorScreen, complete CmsService (including all DTO/serializer/calculation helpers), current named/feature route aliases and direct list-to-editor callers while native39 ran on frozen Supporting2. No content app edits, commands, publication, provider calls or content acceptance were performed.

Pages and Blog each have two route aliases sharing one body. Page/Post editors are normal durable MaterialPageRoutes opened by their respective list. Archive/delete prompts are brief consequential confirmations. Blog has Posts/Comments modes and distinct status filters. These are separate tasks/state variants, not additive route counts.

## Existing authority to preserve

The current CmsService uses the canonical Pages/Blog SDK. Pages, posts and comments each request page1/limit50 by default; the service returns only data and drops supplied page metadata. No current UI pagination exists. Preserve server population/query, IDs, body/HTML/SEO fallback rules, serializers, generated slug, date handling, sort values and command bodies. Do not invent total counts or imply the first50rows are the full matching population. Any paged read/presentation adapter needs explicit boundary classification and must leave command/model/API contracts unchanged.

Page editor has title/slug/body, draft/published, page type, display order, navigation switch and SEO fields. Post editor has title/slug/excerpt/body, featured image URL, category ID, reading time, draft/published, comments/feature/pin switches and SEO fields. Both are correctly full-page tasks by complexity; complete them through the existing canonical editor/fields/discard treatment, preserving payload and validation meaning. Page slug/SEO/body fallbacks and post optional/omitted serializer distinctions are protected.

## Source candidates, not reproduced defects

All four owners currently settle on mounted alone; list reads have no actor/store/query generation fence. Status/mode changes during outstanding reads and A-B-A results need held-response tests. Both editors keep passed store/record IDs and final controllers but do not watch the current StoreContext; captured covered/disposed/store-switched Save and return callbacks need tests before correction. Commands have no exposed durable original-key recovery/readback interface; do not add persistence or replay behavior under frontend scope. Explicit uncertain-outcome UI may retain the draft and require existing readback; it cannot assert that the save failed or was cancelled.

Current list errors interpolate exceptions; list cards truncate title/body/meta and have narrow action rows. Comment moderation truncates body to3lines with no separate full reader. Full decision-relevant body/author/post identity, long localized copy, keyboard, short window, both themes and accessible current actions need composed verification. Status enum and publication consequences stay unchanged. Shared cards/chips/fields/editor/progress/feedback should replace duplicated paint/geometry.

Content/SEO values are Merchant controls over public output. Actual API persistence plus storefront readback/render metadata/escaped content remain separate acceptance gates; no search/provider/crawl result is inferred from local source review. Navigation and Media Library are still unread as full owners in this cohort. This source review does not certify the whole Content area or permit theme51 activation.


## Navigation and Media Library full-source review

Also read the complete NavigationScreen, complete MediaLibraryScreen (all upload/metadata/delete/video/model children), complete MediaService/contracts/serializers, shared media picker/cached image and exact named/feature aliases. Navigation/Media each have two route aliases over one body. This is source/caller review during native39, with no media/menu operation or new acceptance.

Navigation has main/footer/mobile locations, menu-name editing, an ordered list of draft items and one replace-navigation command followed by the existing fresh read. Preserve target types(url/page/collection/product/blog), exact reorder/index semantics, parent identity and existing serialization. Menu editing is a complex full-page task; a single item's focused fields/flags belong in the canonical short sheet. Current item result applies a captured numeric index to whichever current list exists after the dialog; location changes, read completion, list reorder/removal and scope retirement require race reproduction. The menu-name TextFormField key depends only on location, so authoritative same-location reload/readback versus visible field content also needs a test. No new draft journal, navigation domain policy or command idempotency semantics are authorized.

Media uses existing all/image/video/document filters, explicit submitted search, page1/limit60 through a reader that drops page metadata. The grid uses fixed2columns below640px and a fixed aspect ratio. Long titles/alt/folders/actions and large text need composed tests and an adaptive canonical record treatment. Missing model size defaults0; admit actual field presence before calling it recorded size without changing model helpers. The image-source action selector was migrated in Supporting2, but this parent upload selector, metadata form, delete confirmation and video details remain unmodified.

Upload is native picker -> existing uploadAndCreate (object upload then media create); delete removes the original keyed object (404 tolerated) then the record. Preserve exact original key/store/operation, MIME/file/size helpers and all command bodies. Do not introduce cleanup, retries, persistence or successful fallback semantics for separate object/record effects. Picker cancellation is silent by the current shared owner. Parent store/route/current-record gating still requires held native-pick/upload/read/metadata tests; shared picker mounted-only lifetime alone does not establish it.

Video card controllers initialize on demand and are disposed on URL changes/disposal; initialization/loop/play continuations have mounted-only settlement and require an old-controller/new-URL generation test. Full video preview auto-plays through the current plugin and direct dialog Close; native plugin/resource, covered-route playback, failure/retry and short-window behavior need explicit verification. The 3D card is a file-kind placeholder, not an interactive renderer; do not claim a supported viewer or activate a new one from the icon.

All6Content owner files have now been read with their current frontend services/contracts/callers. They remain implementation/runtime/integration pending. This does not include theme/editor owners or settle the unique screen denominator.


## Additional source-preservation risk

The complete current navigation editor was traced against NavigationItemInput serialization: editing an existing item constructs a new input without its saved parentItemId. The resulting replacement serializes parent_item_id as null, so an ordinary label edit can flatten a saved child item. This is a concrete dispatched-payload risk from current source, not a reported hosted incident. Reproduce the existing nested-item read/edit/save/readback and preserve its unexposed parent identity through the frontend binding, leaving menu order, serializers and backend policy unchanged. No navigation edit or repair has run during the current native41 freeze.
