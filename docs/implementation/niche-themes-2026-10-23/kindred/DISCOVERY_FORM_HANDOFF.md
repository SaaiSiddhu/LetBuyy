# Kindred collection/search query slice

23 October 2026. **Owned source is complete and released for central integration.** The original Circuit report's missing fields, search controls and independent clears were reproduced through actual rendered forms before this fix (`discovery-forms-before.log`).

Kindred now preserves unedited fields from canonical `collection.discovery_query_fields`, including limit, country, category, search, collection scope, cross-niche keys and repeated connector values. It excludes page so new searches/filter/sort actions reset to1. Visible edited fields are excluded from hidden state, preventing duplicate scalar submissions. The homepage finder and search form use the same canonical preservation.

Collection and search expose only supplied occasion/recipient choices. A valid selected value absent from supplied choices remains hidden and independently removable; it is never fabricated as an option. Empty matches keep valid state and recovery controls. Search now includes the coherent search-box, gift-filter and results sections; the existing placeholder field is declared and rendered.

Every active selection uses its supplied `active_filters[].clear_url`, including each connector and each independent minimum/maximum budget bound. Clear-all uses `collection.clear_filters_url`, retaining the canonical search/sort/limit and fixed collection scope. Pagination keeps its canonical URLs. No product contents, media roles, prices, stock, delivery promises or fulfillment guarantees were invented.

Verification:

- **11/11** actual Liquid→DOM FormData→URLSearchParams→canonical parser cases pass. They cover both routes, apply/sort/search edits, blank selections, all populated canonical keys, repeated connectors, every supplied active-filter clear, pagination, fixed collection, empty matches, unavailable selections, missing capability and escaping. The suite invokes the real backend response reader and frontend validator/projection; no local filter algorithm replaces them. Network calls:0.
- **8/8** Kindred engine tests pass; package typecheck and focused cross-package form-test typecheck pass.
- The actual builder/editor/manifest source and JSON-wire regression still passes **21/21** editable template flows. Unsupported inherited subtitle remains rejected by its negative control; the fresh-factory removal is retained.
- Artifact install/validation passes: deterministic74 files,115,024 bytes, content hash `8d7007ee36b74ce6e7aa48d5d9b9b1d34846af5f21b95b3ad5b08a0e52a9cd28`, same20 inherited warnings and zero new warnings.
- All91 frozen M1 files are unchanged. No build, database, server or browser resource was started. Shared schema/writer/SQL/index/registry/normalizer files were not edited.

The initial extra harness assumption that a literal closing-script-tag query survives attributes was rejected by the renderer's existing DOMPurify SAFE_FOR_XML policy. That witness is retained in `discovery-form-sanitizer-control.log`. The final explicit negative control verifies that policy stays fail closed; quoted/Unicode/ampersand/ordinary angle-bracket queries preserve exactly and malicious supplied labels remain inert. No sanitizer workaround or relaxation was introduced.

| Current changed source | SHA-256 |
| --- | --- |
| `packages/theme-engine/src/kindred-theme.ts` | `3a47dc979dbdf5dce395fd44a858e007567820f4fac569fade603ff6da4fd551` |
| `packages/theme-engine/src/kindred-discovery.ts` | `14dd29777737158a61287bf54e98571c6b3abf1e07ec542d2e7f678180ad473f` |
| `packages/theme-engine/test/kindred.test.ts` | `480cb8c88df9c690bb8f1e1eb31b3e7cb4e08e34d2c50466ad31c64b57236b84` |
| Owned cross-package form test | `c21c00c96ad3c98f1e2280b204ec1dc28a495b3e5570dc2c93be5b8036ed444e` |

`discovery-form-release.json` records source hashes, evidence links and limits; `discovery-form-observations.json` pins canonical producer/projection/parser sources and actual observations.

```sh
node --import tsx --test docs/implementation/niche-themes-2026-10-23/kindred/kindred-discovery-form.test.ts
pnpm exec tsc --project docs/implementation/niche-themes-2026-10-23/kindred/tsconfig.discovery-forms.json
node --import tsx --test packages/theme-engine/test/kindred.test.ts
pnpm --filter @letbuyy/theme-engine typecheck
node --import tsx docs/implementation/niche-themes-2026-10-23/kindred/kindred-editor-source-roundtrip.mjs
```

These are in-process/source contract results, not installed browser, SQL/filter correctness, persistent merchant lifecycle or commerce acceptance. The central all-theme54 rerun and regenerated389 remain with their assigned owners. The prior18/18 variant-bound snapshot checkpoint and original388 review are preserved; the388 follow-up still awaits MadeYours' repin.
