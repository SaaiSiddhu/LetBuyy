# 08 — Collections

**~62% — NOT changed in Phase 4.75.** Carries Phase-4/4.5 status.

## Real (prior phases)
Manual collections: list/create/assign real; the **edit/delete proxy exists** (Phase 4 — `collections/[collectionId]` PATCH/DELETE, ownership-checked + contract-tested).

## Not built this phase (and why)
- **Edit/delete UI buttons** — the proxy + api-client methods exist, but the page buttons that call them weren't added (UI; needs visual verification).
- **Smart collections / rule builder / automation rules** — a substantial feature: a conditions/rule engine (backend evaluation of product attributes → membership) + a rule-builder UI. Not started; large, and the UI half can't be flow-verified here.

## Path
On a running stack: add the edit/delete buttons (wire to the existing proxy) → design + build the smart-collection rule engine (backend) + rule-builder UI with visual verification. Wire `products:write` RBAC on the collection write proxy/routes.

**Verdict:** manual collections work end-to-end at the API layer; edit/delete buttons are a small UI add, smart collections are a real V1.1-scale feature — neither faked this phase.
