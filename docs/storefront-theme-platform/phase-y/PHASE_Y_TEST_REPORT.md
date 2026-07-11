# Phase Y — Test Report: Theme App Extensions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Y — Theme App Extensions
**Date:** 2026-07-11
**Status:** ALL PASS

---

## 1. Lane A — theme-engine

**Command:** `pnpm --filter=@letbuyy/theme-engine typecheck test`
**Result:** PASS
**Typecheck:** 0 errors
**Tests:** 1469 total (1442 baseline + 27 new Phase Y) · 1469 pass · 0 fail · 0 cancelled
**All prior tests green.**

### 1.1 New Tests (liquid-y-app-block.test.ts)

| ID | Description | Assertion |
|----|-------------|-----------|
| Y-1 | `<script>` in app-block HTML is sanitized | `<script>` tag stripped; safe text preserved |
| Y-2 | `onerror` event handler in app-block HTML is sanitized | `onerror` attribute stripped |
| Y-3 | `filterAppBlockSettings` strips BLOCKED_APP_BLOCK_SETTING_KEYS and keeps safe keys | `api_key`, `access_token`, `webhook_secret`, `password`, `client_secret`, `__proto__`, `constructor` absent; `title`, `description` present |
| Y-3b | Credential keys in app-block settings do not reach the Liquid section.blocks scope | `api_key`/`webhook_secret` absent from `LiquidRenderedBlock.settings`; raw value absent from HTML |
| Y-4 | One throwing app block is isolated — other app blocks render normally | `good-app-content` present; `lb-app-block-placeholder--error` present; error message absent from HTML |
| Y-5 | App block with no liquidAppBlocks entry renders an honest NOT-CONNECTED placeholder | `data-letbuyy-app-block` present; no fabricated/mock/simulated content; section heading still renders |
| Y-6 | Sections without app blocks render byte-identically with and without liquidAppBlocks | Parallel renders with empty map vs supplied map produce equal `contentForLayout` |
| Y-7 | App-block render is deterministic | Two parallel renders of same input produce equal `contentForLayout` |
| Y-8 | NOT-CONNECTED placeholder carries data-app-block attrs and no fabricated content | `data-letbuyy-app-block=` present; `data-app-block-type=` present; no text content inside placeholder div; `APP_BLOCK_NOT_CONNECTED_REASON` contains 'NOT-CONNECTED' and 'FROZEN' |
| Y-9a | `validateAppBlockReference` accepts valid AppBlockReference objects | `result.valid === true`; `result.ref.appId === 'my-app'`; zero errors |
| Y-9b | Rejects non-slug appId (contains slash) | `result.valid === false`; error mentions `appId` |
| Y-9c | Rejects non-slug extensionId (contains angle bracket) | `result.valid === false`; error mentions `extensionId` |
| Y-9d | Rejects settings with blocked credential keys | `result.valid === false`; error mentions `api_key`/`blocked` |
| Y-9e | Rejects non-object input (null, undefined, string, number, array) | All five inputs return `result.valid === false` |
| Y-9f | Accepts `disabled: true` (block in draft, skipped render) | `result.valid === true`; `result.ref.disabled === true` |
| Y-10a | `validateAppBlockReferences` accepts empty array | `valid === true`; `refs === []` |
| Y-10b | Rejects non-array input | `valid === false`; errors non-empty |
| Y-10c | Enforces MAX_APP_BLOCKS_PER_SLOT (21 refs > 20) | `valid === false`; error mentions 'too many'/'maximum'/'exceed' |
| Y-10d | Accepts exactly MAX_APP_BLOCKS_PER_SLOT entries | `valid === true`; `refs.length === 20` |
| Y-10e | Supports custom maxCount override | `maxCount=1` rejects 2 refs; `maxCount=2` accepts 2 refs |
| Y-11a | `filterAppBlockSettings` strips ALL 13 BLOCKED_APP_BLOCK_SETTING_KEYS | All 13 keys absent as own properties; `safeKey` preserved |
| Y-11b | Strips keys not matching identifier pattern (hyphen, digit-start) | `'valid-key'` stripped; `'2startsWithDigit'` stripped; `valid_key`, `a`, `good123` kept |
| Y-11c | Handles empty input without throwing | `filterAppBlockSettings({}) deepEqual {}` |
| Y-12 | `javascript:` src in app-block HTML blocked by DOMPurify hook | `javascript:` absent from `sanitizeRenderedHtml` output |
| Y-13 | `BLOCKED_APP_BLOCK_SETTING_KEYS` mirrors `BLOCKED_DROP_KEYS` exactly | Sorted arrays `deepEqual` |
| Y-14 | Placeholder is safe with adversarial block.type | `data-letbuyy-app-block` survives sanitiser; `data-app-block-type` survives; no angle brackets inside attribute value |
| Y-15 | Placeholder class constants are non-empty lb-* BEM strings | Both `APP_BLOCK_PLACEHOLDER_CLASS` and `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` are non-empty strings starting with `'lb-'` |

---

## 2. Lane B — merchant-control-plane

**Command:** `pnpm --filter @letbuyy/merchant-control-plane typecheck test`
**Result:** PASS
**Typecheck:** 0 errors
**Tests (theme-editor suite):** 447/447 pass (baseline 378 + 69 new Phase Y) · 0 fail

### 2.1 New Tests (theme-editor-y.test.mjs) — 69 tests

**Proxy route (`stores/[store]/themes/app-blocks/route.ts`):**

| # | Contract |
|---|----------|
| 1 | route.ts exists at the expected path |
| 2 | Imports `resolveOwnedStoreId` (tenancy) |
| 3 | Imports `merchantApiFetch` (no direct DB) |
| 4 | Does NOT import `createMerchantApiClient` (no api-client WIP edit) |
| 5 | Uses `requireSession: true` |
| 6 | Forwards to `/themes/app-blocks` on gateway |
| 7 | Passes `store_id` from resolved store (not raw browser param) |
| 8 | Documents NOT-CONNECTED contract in JSDoc |
| 9 | Returns `{ data: [], not_connected: true }` on gateway 404 |
| 10 | No import from page.tsx |
| 11 | No globals.css import |
| 12 | No Supabase / direct DB |
| 13 | No raw `rounded-[Npx]` classes |
| 14 | RISK-DUAL-N01 documented (read-only) |

**AppBlockSlotPanel.tsx:**

| # | Contract |
|---|----------|
| 15 | File exists at expected path |
| 16 | Imports from `@letbuyy/ui` |
| 17 | Does NOT import from `@letbuyy/api-client` |
| 18 | Does NOT import `page.tsx` |
| 19 | Does NOT import `globals.css` |
| 20 | Accepts `storeName`, `sectionId`, `section` props |
| 21 | Accepts `onAddBlock` callback |
| 22 | Accepts `onUpdateBlockSettings` callback |
| 23 | Accepts `onRemoveBlock` callback |
| 24 | Accepts `onMoveBlock` callback |
| 25 | Has loading state (`aria-busy` / loading message) |
| 26 | Has error state (`role="alert"`) |
| 27 | Has NOT-CONNECTED state (NOT-CONNECTED text in source) |
| 28 | Has "No apps installed" / empty state |
| 29 | Has "Add app block" affordance (`appBlockAddSection` / `appBlockAddBtn`) |
| 30 | Has configure / settings affordance (`Settings` / `BlockSettingsForm`) |
| 31 | Has remove affordance (`onRemoveBlock`) |
| 32 | Has reorder affordance (`onMoveBlock`, `ChevronUp`/`ChevronDown`) |
| 33 | Zero `dangerouslySetInnerHTML` in source (SANDBOX LAW) |
| 34 | RISK-DUAL-N01: never mutates `section_definitions` |
| 35 | RISK-DUAL-N01: never mutates `block_definitions` |
| 36 | Zero `innerHTML` assignment |
| 37 | Block type stays `'@app'` — not overridden by extension_id |
| 38 | Uses same-origin `fetch` to `/api/stores/` proxy (not typed api-client) |
| 39 | No direct Supabase / createClient |
| 40 | No raw `rounded-[Npx]` Tailwind classes |
| 41 | RISK-DUAL-N01 documented in comments |
| 42 | `isAppBlockEntry` / `'@app'` type check present |
| 43 | All interactive elements have `aria-label` |
| 44 | Configure button has `aria-expanded` |
| 45 | Slot wrapper has `aria-label` |
| 46 | No fixed px widths (mobile-first) |

**controls.module.css — Phase Y additions:**

| # | Contract |
|---|----------|
| 47 | Has `appBlockSlotWrapper` class |
| 48 | Has `appBlockItem` class |
| 49 | Has `appBlockItemSelected` class |
| 50 | Has `appBlockItemActions` class |
| 51 | Has `appBlockNotConnected` class |
| 52 | Has `appBlockEmpty` class |
| 53 | Has `appBlockSettingsForm` class |
| 54 | Has `appBlockAddSection` class |
| 55 | Has `appBlockAddBtn` class |
| 56 | All Phase Y CSS uses `--lb-*` tokens |
| 57 | No raw `rounded-[Npx]` values in Phase Y CSS |

**package.json:**

| # | Contract |
|---|----------|
| 58 | `theme-editor-y.test.mjs` is included in the test command |

**Additional SANDBOX / ISOLATION / RISK-DUAL-N01 checks (11 tests):**

| # | Contract |
|---|----------|
| 59–69 | Deep cross-cutting assertions: CORS path never bypassed; extension_id sourced from gateway registry only; NOT-CONNECTED text honest; no fabricated app content; proxy route and panel source both independently free of all forbidden patterns |

---

## 3. Unchanged Suites

| Suite | Status |
|-------|--------|
| api-gateway | 519 pass / 522 total (3 pre-existing fail unchanged) |
| storefront-runtime | 795/795 |
| All typechecks | clean |
| validate-governance.mjs | EXIT=1 (pre-existing tenant-registry drift; unchanged) |

---

## 4. Baseline Continuity

All 1442 pre-Phase-Y theme-engine tests continue to pass. All 378 pre-Phase-Y theme-editor tests continue to pass. No prior test was modified or removed to accommodate Phase Y.
