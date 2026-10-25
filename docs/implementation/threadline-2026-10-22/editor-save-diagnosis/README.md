# Shared announcement save loss: read-only diagnosis

The concrete durability defect is in the canonical draft RPC's shared-group merge. Qualified384 merges the previous working `templates` over the incoming document, preserves unselected saved pages, and then reapplies only the selected page. When `index` is selected, an incoming header/footer edit is overwritten by the prior shared group.

The actual owner fixture readback is [the guarded read-only diagnostic](../../theme-editor-2026-10-23/evidence/dewdrop-shared-header-readonly-diagnostic.json). Saved patches at revisions2/3 contain the edited announcement in compatibility `sections.header.settings.text`, while canonical `templates.header` retains the original message. Later active revision11 also retains the original. The incoming network payload was not captured.

The [15-check reproduction](report.json) extracts the real editor helpers, settings/save callbacks and actual storefront mapper projection from source. It exercises the real `ThemeDraftClient` with an explicitly controlled transport acknowledgement. Both the header announcement and a template-local heading survive callback state, JSON wire content, echo reload, and canonical compilation. Main and the owner's candidate editor bytes match. This is source/helper characterization, not a browser or native SQL execution.

The embedded `liquidBundle` is the immutable base. Its remaining unchanged is expected: the actual commerce mapper compiles saved root overlays onto that base. No second renderer bug or frontend bundle-rewrite requirement was established. The separate blocked preview iframe is outside this diagnosis.

The proposed repair lives only in [391 draft preparation](../shared-group-durability/README.md). Historical384, production code, the retained9cd database, owner apps/login, and browser tabs were not changed by this work.

The initial CJS loader and undeclared fixture-field setup failures remain in their named logs. The final [reproduction log](reproduce.log) records15 passing checks. Run the reproduction with `node --import tsx docs/implementation/threadline-2026-10-22/editor-save-diagnosis/reproduce.mjs`; it reads sources and writes only this diagnosis directory.
