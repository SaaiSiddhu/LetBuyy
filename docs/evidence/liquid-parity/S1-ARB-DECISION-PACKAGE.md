# S1 — Liquid Activation Foundation: ARB decision package

**Phase.** S1 — fresh-database correctness, canonical bundle attachment, and render-parity / security /
performance evidence. **This phase does not flip the renderer.** `letbuyy-core.default_template` carries
no `rendererEngine` key and no `liquidRenderingCanary` after this phase; every store still renders React.

**Status.** Foundation complete, evidence recorded, gate **NOT MET**. The flip is a separate, later,
human ARB act.

---

## What is proven (with citing evidence)

| Claim | Evidence |
|---|---|
| D2 (nothing renders Liquid on a fresh DB) is real, not inferred | `docs/evidence/liquid-parity/S1-W1-d2-reproduction.md` — full 127-migration + 3-seed replay against a bootstrapped Postgres 16 fixture |
| D2 is fixed, on both a fresh DB and an already-migrated DB | `docs/evidence/liquid-parity/S1-W2-closure-verification-post-fix.json` (fresh-DB re-run, post-fix: exactly 1 theme row — `urban-kicks` — carries `rendererEngine='liquid'`) + `tests/executable/theme-liquid-activation-postgres.test.mjs` (9/9, behavioral, covers the already-migrated-DB repair path + idempotency + rollback) |
| The `letbuyy-core` Liquid bundle is attached and structurally valid | `database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json` (44 sections, 23 templates), `packages/theme-engine/test/liquid-s1-w3-letbuyy-core-attach.test.ts` (schema-parse test) |
| The `letbuyy-core` bundle attachment does NOT flip the renderer | `liquid-s1-w3-letbuyy-core-attach.test.ts` SAFETY test — a bundle-present/canary-off store resolves `rendererEngine !== 'liquid'`, with a control case proving the same input WOULD flip given an explicit canary |
| SSTI (settings values are never re-evaluated as Liquid) | `packages/theme-engine/test/qi-security.test.ts` (SEC-3a/3b, pre-existing) + `liquid-s1-w5-adversarial-security.test.ts` (W5-block-ssti, new) |
| XSS is neutralized across every real declared field type, block settings, and the `@app` block handle path | `qi-security.test.ts` (17 tests, pre-existing) + `liquid-s1-w5-adversarial-security.test.ts` (10 new adversarial tests, real-DOM-parsed assertions) |
| Render-limit contention does not drop/starve sections under concurrent renders | `packages/theme-engine/test/liquid-render-limit-contention.test.ts` (3/3, pre-existing, re-run fresh this phase) |
| Single-process render latency, THIS machine | `packages/theme-engine/test/liquid-render-benchmark.test.ts`, re-measured fresh: production steady-state 11ms/render, N=25 total 277ms, on Apple M4 Pro / 12-core / 24GB RAM / Node v26.5.1 |
| The demo/reference route is unreachable in production | `apps/storefront-runtime/src/app/demo/urban-kicks/page.tsx` + `page.test.ts` (6/6) — fail-closed on `NODE_ENV`/`VERCEL_ENV` |

## What is explicitly NOT proven (honest gaps, not silently omitted)

1. **Render parity is 5/20, not 20/20.** `docs/evidence/liquid-parity/S1-render-parity.json` — 15 of the
   20 sections in `THEME_LIQUID_PORTABLE_SECTION_PARITY` FAIL semantic parity today, each with a recorded
   reason. Two classes of failure:
   - **Real content/architecture gaps** (11 sections): a declared setting renders on one side and not the
     other (e.g. `hero.tsx`'s Liquid counterpart has an `eyebrow` field the React component does not
     read; `testimonials.tsx`/`category-grid.tsx`/`newsletter.tsx`/`featured-products.tsx`/
     `product-grid.tsx`/`marquee.tsx`/`app-block-slot.tsx` similarly), or a heading-structure mismatch
     (`brand-marquee.tsx`, `skills-section.tsx`, `trust-badges.tsx`), or a block-field gap
     (`experience-timeline.tsx`, `portfolio-grid.tsx`).
   - **A structural contract mismatch** (`banner-carousel.tsx`): the React component takes a bespoke
     `{ banners: BannerSlide[], autoplay, interval, ... }` prop shape, not the standard
     `{ section: SectionModel, theme }` every other section (and its own Liquid counterpart) uses. It is
     invoked internally by `hero.tsx` with translated props, not rendered standalone — a like-for-like
     parity comparison is not structurally applicable to it as it exists today.
   Closing this gap is real engineering work in the React section components and/or the Liquid section
   sources, section by section — not a harness or governance fix. **This is the primary reason the ARB
   flip gate is not met.**
2. **Production concurrent-request throughput is NOT_PROVEN.** No test — before or after this phase —
   exercises real HTTP load against a running storefront-runtime instance. See
   `docs/evidence/liquid-parity/S1-W5-security-performance-evidence.md` for the full reasoning. Building an
   HTTP load-test harness is materially different, larger work than this phase's in-process test authoring
   and was out of scope.
3. **The theme_schema_manifests registry sync (migration 193's part 1, mirrored by 199) has not been
   proven against a live, previously-mis-shaped production manifest** — only against the synthetic
   pre-closure shape reproduced in `tests/executable/theme-liquid-activation-postgres.test.mjs`. There is
   no production database to check this against (LetBuyy has zero production merchants per the Constitution).

## The exact one-line change that would flip `letbuyy-core` to Liquid — NOT MADE

A single field write in a migration (or, for one store at a time, in the `themes`/store row directly)
would flip the canonical theme onto the Liquid renderer:

```sql
UPDATE public.themes
SET default_template = default_template || jsonb_build_object('rendererEngine', 'liquid')
WHERE slug = 'letbuyy-core';
```

`resolveThemeLiquidRenderingEnabled()` (`packages/theme-engine/src/theme-governance.ts:144-160`) treats
`default_template.rendererEngine === 'liquid'` as the explicit, unconditional activation switch — the
same one-key mechanism migration 180 already uses for `urban-kicks`. **This migration does not exist.**
No file in this phase's diff sets `rendererEngine` on `letbuyy-core`, in a migration, in application code,
or behind a flag. This is stated here only so the ARB has the exact, minimal mechanical act to review —
not as a recommendation to execute it now, given the render-parity gap above.

## Recommended gate verdict

**NO-GO for the platform-wide (or even single-canonical-theme) Liquid flip**, on render-parity grounds
alone (5/20). Security and single-process performance evidence support a GO on THOSE two dimensions in
isolation, but `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` requires render-parity, security, SSTI/XSS, AND
performance evidence together — one red dimension is a gate failure for the whole decision.

**Recommended next phase (not started here):** close the render-parity gap section-by-section — for the
11 content-gap sections, either add the missing settings binding to the React component or accept and
document the gap as a Liquid-only enhancement; for `banner-carousel.tsx`, an ARB/product decision on
whether to give it a standard `SectionModel` contract (making it comparable) or to explicitly exempt it
from the parity matrix as a non-standalone, hero-composed component. Re-run
`apps/storefront-runtime/scripts/liquid-parity-harness.mjs` after each fix; do not tune the harness itself
to reach a false green.

---

## S6 ADDENDUM (2026-08-24) — concurrent-load evidence now exists; this section supersedes the
## "recommended gate verdict" above on the performance dimension only. Everything above this line is
## S1's original evidence, preserved unmodified — not overwritten, not rewritten in place.

Since this document was written: render-parity closed further (S3/S3-FIX: **8/20 text-matrix, ZERO
React-only gaps, 10/10 behavioural** — the 11 content gaps referenced above are closed; the remaining
12 matrix FAILs are accepted "Liquid renders more than React" diffs, not defects — see
`docs/evidence/liquid-parity/S3-render-parity-summary.md`). The Core home page was composed to spec
(S5: 10 sections, carousel/video/social proof). And — closing the ONE gap this document's own §2 named
as "out of scope, materially larger work" — **an HTTP concurrent-load harness now exists and has been
run head-to-head**: `apps/storefront-runtime/scripts/liquid-load-harness.mjs`, full results and
reasoning in `docs/evidence/liquid-load/S6-load-summary.md` (+ `S6-workload-definition.md`,
`S6-load-results-peak.json`, `S6-load-results-steady.json`).

**Headline finding, stated plainly because a red result is a successful phase outcome, not a failure to
hide:** at a realistic, constitution-derived peak request rate (~10 req/s, 3 trials, home/collection/
product), Liquid vs React latency deltas are within noise (GREEN). But at a LOWER, off-peak request rate
(2 req/s), Liquid's p95 is **10–14× React's** (reproducibly, ~530ms vs ~30–50ms) on every surface — the
opposite shape of what "load degrades Liquid" would predict, and root cause is **NOT fully diagnosed**
(ruled out: LiquidJS render cost itself, which measured 4–13ms internally throughout; caching artifacts;
one-time cold start. NOT ruled out: a lazy-import, GC, or idle-timeout-driven cost specific to the Liquid
code path — needs CPU profiling, out of this phase's scope).

**Updated gate verdict:** render-parity and security/SSTI/XSS remain GREEN (unchanged from above).
Performance is now **PARTIALLY MEASURED, not GREEN**: peak-load GREEN, steady-rate RED
(unexplained anomaly). **Still NO-GO for the flip** — not on render-parity anymore, but on the
steady-rate performance anomaly, which is exactly the class of evidence this gate exists to catch before
a flip, not after. See `S6-load-summary.md` §9 for the full recommendation (profile and root-cause the
steady-rate anomaly, then re-run this same harness — it needs no code changes to re-run — before
revisiting the flip decision). `letbuyy-core` remains DARK; no migration, seed, or committed config
enables Liquid anywhere in this repository as of this addendum.
