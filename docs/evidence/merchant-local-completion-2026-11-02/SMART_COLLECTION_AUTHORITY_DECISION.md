# Smart collection authority — concrete source/local decision

## Owner approval receipt

At 2026-11-03T02:17:21.460Z, the owner selected **"Approve one collection authority (Recommended)"** in [Merchant Mobile Backend](codex://threads/01a188ea-66d5-7141-ae2a-832ccdec4603), answering the question linked to this concrete proposal. The original reply was checked during the 9 November recovery integration. This records the existing source/local approval; it does not claim a signature, completed cutover, hosted migration, deployment, or release acceptance. The proposal and its original pending-state wording below are retained as historical context.

## Observed source contract

Existing `collections` is the buyer-visible collection owner, with `title`, `conditions`, active state and `collection_products` manual membership. Existing `smart_collections` separately stores Merchant-only `name`, `slug`, conditions, all/any matching and version. Its mounted route only provides private management and a bounded saved-rule preview. No canonical public collection query currently reads that separate rule table. The registry names canonical catalog/mobile/storefront owners but does not select between this exact schema pair.

Thus completing dynamic buyer-facing collections by permanently maintaining both tables as independent authorities would preserve the dual-system problem. Generic links or a second mobile evaluator would not establish one rule truth. This is a real authority choice under AGENTS WIN-R2/5 and PRIME-R1, not a migration-number question. The already approved414–434 numbering and saved-trial policy are unchanged.

## Recommended owner decision: one collection authority

Use the existing buyer-visible `collections` owner for both manual and smart collections. Keep manual membership unchanged. Add only the required canonical typed rule/match/version/slug metadata to that existing owner through a legitimate paired next migration after fresh sequence inspection; no new runtime, service, public issuer, projection infrastructure or generic rule engine. `smart_collections` becomes a temporary compatibility source during a finite expand/backfill/verify/contract cutover, with an explicit gated retirement.

Preserve each retained smart record ID/slug, exact description and rule meaning. Validate old rule vocabulary before mapping; refuse ambiguous collisions, unknown fields/operators or invalid values with a concrete reconciliation report rather than silently dropping rules. Demonstrate per-row equality and derived matching-product parity, including nonzero manual/smart fixtures, duplicates, empty rules, all/any, variant/inventory changes and foreign tenants. Do not drop either old source or compatibility transport until required exact read/write/public/browser/native, concurrency, recovery, permission, rollback and deletion gates pass. Current clients continue through deliberate compatibility contracts over the one authority; there is no permanent dual writer.

Use the canonical backend/database rule evaluation for the actual published product population and read/preview counts, with typed bounded pagination and exact/partial meaning. Mobile and web manage the same canonical records, versions and original command receipts. Finish actor/origin/current-view protections, ordinary navigation, restart/uncertain-save recovery, and both-direction/public readback. Update the canonical winner registry only to record this human decision; do not auto-generate architecture law.

This authorizes source/local synthetic work only. No hosted data query, retained private export, deployment, migration execution, provider operation, push or merge is included.

## Alternative bounded disposition

Hold dynamic public smart-collection activation pending a later owner decision. Repair and verify the existing private management/preview and its mobile parity, preserving the public gap explicitly. This leaves the complete feature26 acceptance open; do not represent a saved private preview as buyer-visible smart collections.

While this decision is pending, continue the approved trial/source qualification and independent current private API input, pagination, error, version and preview-honesty corrections. Do not allocate a new competing smart rule authority or perform a destructive cutover.
