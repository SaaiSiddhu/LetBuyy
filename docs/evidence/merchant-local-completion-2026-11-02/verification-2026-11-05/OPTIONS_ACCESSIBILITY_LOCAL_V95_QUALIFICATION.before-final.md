# Source95 local qualification: product options and private-upload accessibility

Status: implementation and local gates pass; Android129 bounded option/web and private KYC recovery pass; iOS130 building. Whole-feature acceptance remains open.

## Source and implementation

Frozen source SHA `6a9dffa117db5c1be62f26f57d8f031910f3e599fc966a1eb0cfc87392519a18`, 8,519 core inputs; branch `codex/merchant-mobile-parity`, HEAD `ab32485092cae0ac19145abf7b5a101fa3ea338e`. The nine changed/new paths relative to source93 are retained in `verification-2026-11-05/options-accessibility-v95-source93-delta.json`.

The existing Product form now supports product-owned option names, values, axis additions/removals/order, value additions/removals and sparse-row edits. Existing UUIDs, explicit zero quantities, optional price intent, SKU/barcode and unaffected rows are preserved. New combinations begin without an ID and with zero quantity; the canonical server allocates IDs. Operations that would merge rows or exceed 100 variants are rejected without replacing the draft. New row editors require existing dimensions and reject duplicate combinations. Removing a row/value requires explicit confirmation and only changes the draft until product save. Existing server history/reference constraints remain authoritative.

The same versioned product command, permissions, tenant checks and idempotency protocol remain in use. A retry replays the exact earlier body/key and preserves a newer option draft. Conflict requires explicit latest-version reload; store/service retirement removes editable private fields. No application backend, schema, identity, money or provider policy changed.

The original iOS modal reproduction showed a 32-point painted/accessibility discrepancy at normal text scale after nested saved-file recovery. Failed semantic-container, render-invalidation and dialog candidates are retained and removed from implementation. The original shared short-form source and installed Flutter SDK remain unchanged. Complex private verification upload/recovery now uses the existing canonical full-page editor with a fixed footer, busy/dirty dismissal, original locked reference/type/key, retained-file review and existing private transport. The KYC FAB does not participate in a duplicate default Hero flight. Full-page component geometry passes at iOS scales1 and2; native normal-accessibility action verification remains pending. Other dynamically resizing modal accessibility surfaces are not certified by this repair.

## Completed local gates

- Flutter: 1,772 passed, 0 failed, 0 skipped; source bytes unchanged.
- Flutter analysis: 0 issues.
- Owned product API/Postgres: 92 passed, 0 failed, current436 plus separately owned historical346 rollback controls. New cases prove rename/extension/reorder/safe axis removal preserve UUID/stock/customer reservations and new zero-stock variant creation/replay has one effect. Owned containers/networks/volumes cleaned up.
- Actual governance in a disposable byte-equal validation capsule: 114 passed, 1 not applicable, 0 failed/blocked/skipped. Original core source, raw Git index and staged path/mode/blob entries unchanged during this gate.

Counts overlap and must not be added. Source94's five obsolete confirmation-expectation failures and the early driver/test-label failures remain retained. Source95 preserves the capability and no-request assertions and exercises the explicit confirmations.

## Native verification: Android passes; iOS in progress

Android129 root `/private/tmp/letbuyy-merchant-local-20261108-f7a3c2efea`; iOS130 root `/private/tmp/letbuyy-ios-ui-20261108-41bbfcc398`. Both require normal synthetic sign-in, current normal builds, compiled API/BFF, actual Merchant browser and owned PostgreSQL/PostgREST/R2. The planned option roundtrip changes Colour to Finish, Green to Emerald, adds Pack/Single, reorders Finish first, reads on web, renames Finish to Material on web, then reads Material/Emerald/Pack on native. The private upload must actually commit before a deliberately lost reply, survive process restart and replay the original file/type/reference/key to one private object/document and matching web/native pending state. iOS requires a normal accessibility Upload tap, not the previous physical-coordinate workaround.

## Remaining acceptance

No whole feature is accepted by this cohort. Feature22 still needs complete new-product/new-variant/retirement, current-role/revocation and actual buyer Liquid/cart outcomes. Private KYC still needs remaining native format/role/store/provider boundaries. Full122, other native media/current-source regression, physical devices, real provider approvals, hosted operations and signed releases remain open. Preserve51frozen,120/121outsideMerchant,122paused. Host9002 is never contacted/probed/bound/stopped; Android's emulator-only reverse9002-to-host54351 is the approved isolated transport.

Android129 final bounded proof: `verification-2026-11-05/native129-final-local-readback.json`, run `a3beeda494a0`. Installed APK SHA `5abfaf520a43089ff9142c4aa5e0f71dbf84dbc40f50277422c883cec05894c1`;4,894 runtime inputs equal the frozen core and8 generated diagnostic images match separate manifest custody. One retained leaf-element truthiness driver failure; readback-only continuation passes without repeating acknowledged saves. Both native option roundtrips and original private KYC replay passed; owned cleanup and ADB restoration pass.
