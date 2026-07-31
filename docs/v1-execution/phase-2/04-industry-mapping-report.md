# Stream D — Industry → Experience Mapping — Report

**Status:** ✅ DONE (tested) · **File:** `packages/theme-engine/src/industry-experience-map.ts`

## Map
`electronics→forge · fashion→sense · beauty→aura · furniture→craft · food→refresh · sports→ride · books→dawn · pet→bloom · general→summit`

## Resolved discrepancy: "Food → Harvest"
The Phase-2 brief listed `Food → Harvest`, but **Harvest is not one of the 10 experiences**. Per the research grocery preset, **Food → Refresh**. `getExperience('harvest')` is `undefined`; a `harvest` alias also routes to `food→refresh` as a safety net (verified by test).

## Engine
- `resolveExperienceForIndustry(industry, override?)` — precedence: **override → industry → fallback(Summit)**; returns `{ experience, source: 'override'|'industry'|'fallback', industry }`.
- `normalizeIndustry()` — resolves canonical keys, single-word synonyms (`grocery→food`, `tech→electronics`, …), AND compound labels via a token fallback (`"Electronics & Tech" → electronics`).
- `INDUSTRY_OPTIONS` — the 9 merchant-facing picker options (`id`, `label`, `experienceId`), kept in sync with the map (validated by `collectIndustryMapIssues()`).
- **Override support:** a merchant can pick any experience regardless of industry; an invalid override falls through to the industry mapping.
- **Fallback:** unknown/empty industry → Summit (the zero-regression General default).

## Integrity (tests + `collectIndustryMapIssues()`)
Every mapped experience id exists in the registry; options stay in sync with the map; every experience that claims an industry is reachable from the map. Returns `[]` (clean).
