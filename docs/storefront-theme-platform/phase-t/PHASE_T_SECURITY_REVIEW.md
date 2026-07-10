# Phase T Security Review — Depth Bound, Sanitizer, Prototype Pollution, and Allowed-Child Proof

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** T — Section Groups and Nested Blocks
**Date:** 2026-07-11
**Branch:** `stepup/main`

---

## 1. Scope

Phase T's security surface is entirely within the theme-engine package (bundle schema, document adapter, Liquid renderer) and the merchant editor UI (SectionTreePanel, BlockChildRow). No gateway routes, database tables, RLS policies, or authentication tokens are modified.

Security review covers:

- Stack-depth attack via crafted nested block JSON.
- Prototype pollution in the bundle parse path (`parseLiquidThemePackageBundle`).
- Block settings bypass of `filterBlockedSettingsKeys` in the renderer.
- Depth-bound proofs: parse-time rejection + render-time cap.
- `allowed_child_types` validation chain.
- RISK-DUAL-N01 enforcement in the editor.
- Architectural invariants (no gateway, no DB, no auth, no frozen apps touched).

---

## 2. Depth-Bound Architecture

### 2.1 Three Independent Guards

Phase T enforces a maximum block nesting depth of **3** at three independent layers:

**Parse-time guard 1 — ThemeDocumentSchema.superRefine** (`theme-document.ts:237`)

```typescript
const depth = maxBlockDepth(section.blocks);
if (depth > MAX_BLOCK_NESTING_DEPTH) {    // MAX_BLOCK_NESTING_DEPTH = 3
    ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `Block nesting depth ${depth} exceeds maximum ${MAX_BLOCK_NESTING_DEPTH}` });
}
```

This guard runs AFTER Zod has parsed the full document. For the document path this is the primary enforcement point. Test: `nested-blocks: (a) parseThemeDocument rejects block tree with depth=4`.

**Parse-time guard 2 — ThemeBundleTemplateSectionSchema.superRefine** (`theme-bundle.ts:349`)

```typescript
const depth = maxBundleBlockDepth(section.blocks);
if (depth > MAX_BUNDLE_BLOCK_NESTING_DEPTH) {    // MAX_BUNDLE_BLOCK_NESTING_DEPTH = 3
    ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `Block nesting depth ${depth} exceeds maximum ${MAX_BUNDLE_BLOCK_NESTING_DEPTH}` });
}
```

This guard runs after Zod parses the bundle. For the bundle path (primary ingest path for nested blocks) this is the enforcement point. Test: `nested-blocks: parseLiquidThemePackageBundle rejects template section with block depth=4`.

**Render-time guard — RENDERER_MAX_BLOCK_DEPTH** (`theme-renderer.ts:785`)

```typescript
const RENDERER_MAX_BLOCK_DEPTH = 3;   // line 950 — private local constant

// In renderLiquidSectionBlocks:
if (depth < RENDERER_MAX_BLOCK_DEPTH && Object.keys(block.blocks ?? {}).length > 0) {
    // recurse into children
}
```

Recursion stops silently at depth 3. No exception is thrown; any block at the depth cap renders with `sub_blocks = []`. This is a defence-in-depth measure for stale data from the DB that might pre-date Phase T's parse-time enforcement. Tests: `nested-blocks: (f) renderer completes without stack overflow on valid depth=3 nested blocks`, `nested-blocks: (f) renderer completes without error on MAX depth=3 nested blocks`.

**Constant sync test:**

```
nested-blocks: (f) RENDERER_MAX_BLOCK_DEPTH === MAX_BLOCK_NESTING_DEPTH (render + parse depth constants in sync)
```

This test asserts that `MAX_BLOCK_NESTING_DEPTH === 3` and `MAX_BUNDLE_BLOCK_NESTING_DEPTH === 3`. **Known gap:** `RENDERER_MAX_BLOCK_DEPTH` is a private non-exported constant in `theme-renderer.ts` and is not directly asserted by the test. If `RENDERER_MAX_BLOCK_DEPTH` were changed without touching the document/bundle constants, this test would pass while the depth parity guarantee broke. This is Finding 5 (LOW) from the code review; the fix (export the constant) is deferred as RISK-T04.

### 2.2 Editor-Side Depth Guard

`BlockChildRow.tsx:139`:

```typescript
const canNestDeeper = depth < MAX_EDITOR_BLOCK_DEPTH   // MAX_EDITOR_BLOCK_DEPTH = 3
```

The nested children container is only rendered when `canNestDeeper && hasChildren`. This prevents the React component tree from recursing past depth 3 even for malformed in-memory data. `MAX_EDITOR_BLOCK_DEPTH` is exported from `BlockChildRow.tsx` and asserted in `theme-editor-t.test.mjs`.

---

## 3. Pre-Zod Stack Depth Attack (Finding 1 — MEDIUM, Deferred)

### 3.1 Threat

`ThemeBundleTemplateBlockSchema` uses `z.lazy()` recursion. Zod's `_parse` method recurses into the block tree before `superRefine` fires. A crafted bundle JSON with extreme nesting depth (e.g., 100 levels, achievable within request body size limits) submitted to the `/themes/packages/upload` endpoint would overflow the V8 call stack during Zod parsing, producing a `RangeError: Maximum call stack size exceeded` rather than a clean ZodError.

`parseLiquidThemePackageBundle` (`theme-bundle.ts:1420`) calls `LiquidThemePackageBundleSchema.parse(input)` directly without a structural depth pre-check.

`ThemeDocumentBlockSchema` in `theme-document.ts` has the same gap. `assertNoBlockedKeysInRaw` (which runs pre-Zod at `parseThemeDocument:493`) is bounded at depth-128 for key scanning but does not bound structural depth.

### 3.2 Current Mitigations

- `superRefine` depth checks provide clean rejection for valid, non-overflowing inputs with depth 4+.
- Cloudflare Workers have per-request CPU time limits and memory limits that would terminate an overflowing request before it could affect other requests.
- The Hono gateway has a default body-size limit applied globally.
- Theme package uploads are merchant-authenticated operations requiring a valid ES256 token; the attack surface is authenticated merchants, not anonymous callers.

### 3.3 Disposition

Registered as **RISK-T01** (MEDIUM). Full closure requires adding a fast iterative pre-Zod structural depth check to `parseLiquidThemePackageBundle` and `parseThemeDocument` that counts nesting depth and throws a `ZodError` (or equivalent safe error) before Zod recurses. Separately, a `bodyLimit` middleware on the theme package upload route would reduce blast radius. Neither change was made in Phase T to avoid touching production parse paths without the full test matrix for the pre-check logic. Target: earliest phase that revisits the parse entry points.

---

## 4. Prototype Pollution — Bundle Parse Path (Finding 2 — MEDIUM, Deferred)

### 4.1 Threat

`parseThemeDocument` (`theme-document.ts:493`) calls `assertNoBlockedKeysInRaw(input)` before calling `ThemeDocumentSchema.parse(input)`. This pre-parse scan intercepts `__proto__`, `constructor`, and `prototype` keys before Zod processes them.

`parseLiquidThemePackageBundle` (`theme-bundle.ts:1420`) does NOT call `assertNoBlockedKeysInRaw`. Phase T introduced nested block settings (`block.blocks[id].settings`) parsed via `ThemeBundleTemplateBlockSchema`, a `z.record(z.string(), ThemeBundleJsonSchema)` chain. When Zod processes an input key `"__proto__"` in a `z.record()`, it executes `output["__proto__"] = value` using bracket notation on the output object. In V8 this invokes the prototype setter on the output object, silently changing its `[[Prototype]]`. After Zod completes, `Object.keys` and `Object.getOwnPropertyNames` do not return `__proto__` on the output; the downstream `filterBlockedSettingsKeys` check in the renderer never sees it.

### 4.2 Practical Impact

- `block.settings.__proto__` would equal the attacker-supplied value rather than `Object.prototype`, potentially exposing attacker-controlled inherited properties via `{{ block.settings.admin }}` in a Liquid template.
- The effect is limited to the merchant's own theme and their own storefront rendering — there is no cross-tenant blast radius from this attack in isolation.
- DOMPurify sanitizes the rendered HTML output, providing a second containment layer for any Liquid output that embeds attacker-controlled values.

### 4.3 Disposition

Registered as **RISK-T02** (MEDIUM). Fix: call `assertNoBlockedKeysInRaw` (already exported from `theme-document.ts`) at the top of `parseLiquidThemePackageBundle`, identical to how `parseThemeDocument` does it. Alternatively, centralise the guard into a shared utility in the package. The fix is a one-line call site change with no schema-level side effects. Deferred from Phase T to avoid touching the production parse path without dedicated test coverage for the pre-check in the bundle context. Target: earliest phase touching `parseLiquidThemePackageBundle`.

---

## 5. Block Settings Bypass of `filterBlockedSettingsKeys` (Finding 3 — LOW, Deferred)

### 5.1 Threat

At the section-level scope construction (`theme-renderer.ts:883`) the global `settings` drop is filtered via `filterBlockedSettingsKeys`. The `BLOCKED_DROP_KEYS` set includes `api_key`, `webhook_secret`, `signing_secret`, and related credential-adjacent key names.

Block-level settings are inserted raw into the Liquid scope. At line 818 `settings: block.settings` and at line 824 `settings: child.settings` (in `sub_blocks[]`) are spread without calling `filterBlockedSettingsKeys`. This is consistent with the pre-Phase-T flat block handling (not a Phase T regression), but Phase T's `sub_blocks` threading adds a second position in the Liquid scope where unfiltered merchant settings appear.

### 5.2 Practical Impact

In practice block settings are merchant-controlled content (not server credentials). The concern is credential-named keys (e.g., `api_key`) in `block.settings` being accessible via `{{ block.settings.api_key }}` without the `BLOCKED_DROP_KEYS` guard that the global `settings` drop enforces. All rendered HTML passes through DOMPurify; any secret value that ended up in Liquid output would be sanitized before reaching the browser if it contained HTML-dangerous patterns, but non-HTML-encoded secrets (e.g., a plain string API key) would not be stripped by DOMPurify.

### 5.3 Disposition

Registered as **RISK-T03** (LOW). Fix: apply `filterBlockedSettingsKeys` to `block.settings` at lines 818 and 824 in `theme-renderer.ts`. This is a defence-in-depth measure. No functional change is required for legitimate themes. Deferred from Phase T to avoid a test-matrix regression for the renderer without dedicated test coverage. Target: Phase U (settings control renderer).

---

## 6. `allowed_child_types` Validation Chain

### 6.1 Schema Layer (`ThemeLiquidReusableBlockSchema`)

`allowed_child_types?: z.array(z.string().min(1).max(120)).max(50).optional()` at `theme-bundle.ts:227` adds the field to the block-type catalog entry. The field is optional so all existing block definitions without it continue to parse without error (backward-compatible).

### 6.2 Document Parse Layer (`validateBlockChildTypes`)

`ThemeDocumentSchema.superRefine` (§5 of the section loop) calls `validateBlockChildTypes` for each section's block tree. For each block that has a `block_definitions[block.type]?.schema.allowed_child_types` defined:

```typescript
const allowedSet = new Set(allowedChildTypes);
for each child of block.children:
    if (!allowedSet.has(child.type)):
        ctx.addIssue({ code: ZodIssueCode.custom,
            path: [...basePath, bi, 'children', ci, 'type'],
            message: `Child block type "${child.type}" is not in allowed_child_types for parent type "${block.type}"` });
```

Recursion: after validating all direct children, `validateBlockChildTypes` recurses into each child's own children so that grandchild type violations at any depth are caught.

When `allowed_child_types` is undefined the check is skipped entirely (backward-compatible: a block type without restrictions accepts any child type).

Tests: `nested-blocks: (e) parseThemeDocument rejects child type not in allowed_child_types`, `nested-blocks: (e) parseThemeDocument accepts child type listed in allowed_child_types`.

### 6.3 Editor UI Layer (Dead Wiring — Finding 4 — MEDIUM, Deferred)

`BlockChildRow.tsx:143–146` computes:

```typescript
const canAddChildren =
    depth < MAX_EDITOR_BLOCK_DEPTH &&
    Array.isArray(allowedChildTypes) &&
    allowedChildTypes.length > 0
```

The add-child affordance renders only when `canAddChildren && onAddChildBlock` is truthy. However, `allowedChildTypes` is never passed to `BlockChildRow` at the depth-1 call site in `SectionTreePanel.tsx` (lines 267–279). The prop receives `undefined` from `TreeSectionRow`, making `canAddChildren` always `false`. The add-child button is permanently non-functional in the current wiring.

**Disposition:** Registered as **RISK-T05** (MEDIUM, functional gap, not a security concern). Fix: at the `BlockChildRow` call site in `SectionTreePanel.tsx`, resolve `allowedChildTypes` from `schema?.blocks_schema?.[block.type]?.allowed_child_types ?? undefined`. The `schema` and `blocks_schema` lookup are already available at that call site for `blockLabel` resolution.

---

## 7. RISK-DUAL-N01 Enforcement

Phase T adds three new mutation surfaces in the editor (the child callbacks). RISK-DUAL-N01 is preserved if and only if these callbacks operate exclusively on the instance tree.

**Verified:** The three callbacks are typed as:
- `onAddChildBlock(sectionId: string, parentBlockId: string, childType: string): void`
- `onRemoveChildBlock(sectionId: string, parentBlockId: string, childId: string): void`
- `onMoveChildBlock(sectionId: string, parentBlockId: string, childId: string, direction: -1|1): void`

None of these signatures allow a `block_definitions` object or `section_definitions` object to be passed. The `childType` argument is a plain string (the block type key) — it is used to look up the catalog entry in `block_definitions` by the caller (future implementation in `page.tsx`) but is never used to write to `block_definitions`.

`BlockChildRow.tsx` has no import of `page.tsx` and no access to `baseConfig`. The component receives `block: BlockEntry` (instance state) and the three callbacks. It never references `block_definitions` or `section_definitions`.

**Contract tests in `theme-editor-t.test.mjs`:** `phase-t: BlockChildRow does not import page.tsx`, `phase-t: BlockChildRow has no direct Supabase or gateway import`, `phase-t: onAddChildBlock/onRemoveChildBlock/onMoveChildBlock are optional on BlockChildRowProps`.

---

## 8. Sanitizer Proof (DOMPurify, Block-Level Output)

Phase T's renderer threads child block HTML into the parent block's Liquid drop via `sub_blocks`. Each child block's HTML is produced by `sanitizeRenderedHtml` (which applies DOMPurify with `USE_PROFILES: { html: true }`) before being threaded. The parent block's Liquid template receives already-sanitized child HTML; the parent's own rendered output is also passed through `sanitizeRenderedHtml`.

Two sanitization passes therefore apply to every rendered block in a nested block tree:
1. Children are sanitized before they enter `sub_blocks`.
2. The parent block's rendered output (which may include `{{ sub_blocks[0].content }}`) is sanitized after Liquid rendering.

Test: `nested-blocks: nested block content flows through sanitizer (event handlers stripped)` — creates a nested bundle with an `<img src=x onerror='alert(1)'>` vector in child block Liquid source (which passes the bundle source validator) and asserts that the rendered output does not contain `onerror` after the full `renderLiquidTheme` call.

---

## 9. Architectural Invariants Maintained

| Constraint | Status |
|---|---|
| No `USING (true)` on tenant tables | MAINTAINED — no DB changes |
| Canonical ledger (`canonical-ledger-only-validator`) | MAINTAINED — no money table mutations |
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| `publish_theme_release` SECURITY DEFINER RPC unchanged | MAINTAINED |
| DOMPurify sanitizer config unchanged | MAINTAINED |
| Frozen apps (app-marketplace, developer-portal, theme-marketplace) unchanged | MAINTAINED |
| No client-side realtime subscription over `theme_editor_drafts` | MAINTAINED (RISK-SEC-P01 remains open) |
| RISK-DUAL-N01: child callbacks mutate instance tree only | CONFIRMED |
| No new gateway routes | CONFIRMED |
| No new database migrations | CONFIRMED |
| No new authentication paths | CONFIRMED |
| No `'*'` postMessage wildcard (bridge unchanged) | CONFIRMED |

---

## 10. Open Residuals

| Finding | Severity | Risk ID | Status |
|---|---|---|---|
| Pre-Zod stack-depth attack via crafted bundle JSON | MEDIUM | RISK-T01 | OPEN — deferred |
| No `assertNoBlockedKeysInRaw` in `parseLiquidThemePackageBundle` (prototype pollution) | MEDIUM | RISK-T02 | OPEN — deferred |
| Block settings bypass `filterBlockedSettingsKeys` in renderer | LOW | RISK-T03 | OPEN — deferred |
| `allowedChildTypes` never passed from `SectionTreePanel` → `BlockChildRow` (add-child button dead) | MEDIUM | RISK-T05 | OPEN — functional gap deferred |
| `RENDERER_MAX_BLOCK_DEPTH` private/unexported — depth parity test is behavioral not direct | LOW | RISK-T04 | OPEN — deferred |
