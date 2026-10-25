# Circuit declared-module data preservation

The actual source-helper/compiler/document suite passes **46 tests, zero failures/skips**. It does not execute browser actions or promote any installed acceptance case.

The fixtures cover44 nonfrozen section types,107 section fields,11 supported flat-block placements with24 effective editable block fields, and all12 global settings. The remaining2 section fields and4 `@app` block fields belong to frozen extension seams. Their definitions remain represented, but no extension instance or execution is introduced. These are required protected-boundary checks, not arbitrary merchant editing or blanket N/A.

For each section, the suite uses the actual editor creation/normalization/save-building functions, the actual registry config projection, the matching engine validator, the canonical existing-bundle Liquid compiler and a real ThemeDocument JSON roundtrip. It checks edited values, hidden/reordered block states, shown state, removal and re-add. Re-add creates new IDs; header/footer section identities stay pinned. All assigned fields, false/zero values, block type/settings/UUID/order/visibility and unrelated templates survive. Twelve global values also survive, including numeric zero and approved alternative font names.

The actual editor and registry source snapshots, extracted helper code, full edited wire inputs, observations for every phase, exact field-set comparison, TAP and source hashes are retained. Wire inputs are written before validation assertions so a failure would not erase its input. No failure occurred in this run.

The test mutates synthetic in-memory state to check serialization. It does **not** prove that real UI callbacks are reachable or permitted, that a database save succeeded, or that undo/redo/recovery/publish works. Synthetic resource UUIDs prove only value retention; ownership/existence/deleted/foreign-resource and actual media behavior remain unrun. The fixtures use the index source context except pinned groups, so they are not all-template rendered context tests. No nested schema is invented; the shared Editor owner retains hierarchy/action/guard work.

`QUALIFICATION.json` records the precise scope and all applicable field IDs. `ARTIFACTS.json` seals the finite actual evidence. The source is the applied private Circuit successor; integration/version/catalogue/runtime admission still needs the allocator. Count02 is not rerun. Original installed counts remain10PASS/5PARTIAL/10NOT_RUN; all288 additive installed requirement rows remain NOT_RUN.
