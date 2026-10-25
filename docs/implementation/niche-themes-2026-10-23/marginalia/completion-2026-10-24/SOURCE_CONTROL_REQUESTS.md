# Marginalia declared-control source trace

This is a bounded static review and file handoff. It applies no source patch, executes no application module and creates no runtime, browser, database or provider authority. Installed outcomes remain unchanged. Exact source observations and affected case IDs are in `SOURCE_CONTROL_TRACE.json`.

## MG-C-GAP-08 — Order Detail heading is ignored

Canonical `theme-bundle.ts:3085` declares `customer-order-detail.heading` with default `Order`, but line3090 renders `<h1>Order #{{ order.number }}</h1>`. The niche order wrapper adds saved facts inside the line loop and leaves that heading unchanged. A valid custom heading cannot affect this source path.

Shared theme owner proposal: in a newly versioned compatible package, replace the literal `Order` with the escaped `{{ section.settings.heading }}` output. The existing schema default supplies `Order` when absent. Preserve deliberate blank values according to the canonical absent-versus-blank rule; do not introduce `default: 'Order'` that silently restores a cleared field. Keep the order number and all ownership, timeline, price and immutable facts paths unchanged.

Required validation: absent setting retains current default output; a long multilingual edited heading appears on an actual owned titled order; HTML-like text is escaped; explicit clear has the agreed blank-heading behavior; Save/fullreload, private preview and published owned order view agree. Recheck existing order-facts wrapper and ownership denial. This source finding does not close any installed/history case.

## MG-C-GAP-09 — Favicon setting has no theme output

The shared schema at `theme-bundle.ts:2508` advertises `faviconUrl` as a rendered icon link. The actual layout intentionally emits no favicon link. Comments at2547–2560 identify the sanitizer restriction. The ordinary Next store layout chooses `store.logoUrl || '/favicon.ico'`; that is a different input and does not implement this theme field.

Shared head/security owner request: wire the validated theme value through the existing canonical safe metadata boundary, or prepare the appropriately reviewed versioned contract correction. Do not widen the Liquid sanitizer, add `raw` output or bypass the documented THEME-R4/SEC-R11 review requirement from this theme. Do not silently remove the owner's customization requirement.

Required validation: actual tab icon/head uses the acknowledged theme URL; clear restores the supported fallback; unsafe schemes, malformed input and unavailable media preserve safe output and draft intent. Verify private/public separation and browser Save/fullreload/publish behavior. Source inspection alone does not prove the final browser icon or all metadata paths.

## MG-C-GAP-10 — Marginalia control radii ignore the declared radius

The shared schema declares `appearance.borderRadius`. The Liquid root-token builder maps colours and fonts but no radius. Marginalia's own input/select, search container, buttons, variant buttons and CTA rules use literal `border-radius:3px`. The ordinary Next store layout supplies a separate `--radius`, while those selectors never consume it. Thus a radius edit cannot affect those declared theme surfaces on this inspected path. Other inherited surfaces and final computed cascade remain unverified.

Shared token owner and Marginalia leaf owner proposal: first establish one bounded numeric token from the acknowledged theme configuration in both portable Liquid and client preview/public paths. Then let Marginalia's existing controls consume it with the current3px default preserved. Reuse the existing canonical token/model; do not introduce another settings authority or change the approved palette, typography, layout or default visuals. Merely substituting the host's current `--radius` is insufficient until its configuration lineage is reconciled.

Required validation: default3px remains identical; explicit0, an allowed positive radius, invalid/out-of-range input and clear produce canonical validation and computed styles; private preview, fullreload and public publication agree. Exercise inherited and Marginalia-specific controls separately. No CSS patch is applied to immutable2.0.0 or shared Main here.

## Indirect bindings confirmed in source

- `product1`/`product2`/`product3` feed `getProductsForSection` in `data-binding-engine.ts:45–60`; `requireSelection` gates the empty configured selection. They are data-binding inputs rather than required direct Liquid expressions. Collection bindings have their own branch at184–190. Resource clear/missing/tenant/pagination behavior still needs its required execution.
- `theme-renderer.ts:537–590` maps the six colour fields and both font families into CSS variables. Marginalia consumes these variables. This proves an indirect source path, not actual font loading, computed colour parity or publish acceptance.
- `app-block-slot.slot` remains part of the dormant third-party seam. The shared independent decision APP-SEAM-01 excludes activation under NEVER-R3, AGENT-R13 and Constitution R-12. Safe restriction, no execution and truthful editor advertising remain required. No first-party section/block is excluded.

## Handoff boundary

Shared helpers remain awaiting explicit activation; no writer/controller lease exists. These requests are prepared for the existing owners and shared monitor to retrieve from this folder. They are not messages, grants or evidence that repairs were implemented. Use exact candidate bases and one shared writer when admitted. Retain the historical9 PASS /7 NOT_RUN and all unexecuted completion rows.
