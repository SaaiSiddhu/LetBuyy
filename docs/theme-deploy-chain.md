# The theme deploy chain — why editing `theme-bundle.ts` doesn't change what a store renders

Six sessions (T2b through T3-fix) mis-diagnosed "my theme change didn't appear on the
storefront" as a caching bug. It usually isn't caching. It's that a **published store renders
from a frozen snapshot**, and editing the source generator changes nothing for a store that
already published.

## The chain

```
packages/theme-engine/src/theme-bundle.ts / theme-bundle-core.ts
  (the TypeScript fixture generator — the only thing a code change actually edits)
        │
        ├─▶ packages/theme-engine/examples/generate-examples.mjs
        │     regenerates the committed golden example bundles under
        │     packages/theme-engine/examples/{urban-kicks,letbuyy-core}-liquid/
        │     (drift-detected by theme-examples.test.ts — this is what "run the tests" verifies)
        │
        └─▶ scripts/liquid-parity/build-letbuyy-core-bundle.mjs
              (and its urban-kicks sibling)
              writes THREE files:
                database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json
                database/supabase/migrations/200_letbuyy_core_liquid_bundle_attach.sql
                database/supabase/rollback/200_letbuyy_core_liquid_bundle_attach.rollback.sql
              the migration UPSERTs the bundle JSON into:
                    themes.default_template -> 'liquidBundle'   (the CATALOG row, keyed by theme slug)
                            │
                            │   a store does NOT read this row directly at render time.
                            │   it is the source a NEW release is built from.
                            ▼
                    sites.current_theme_release_id
                            │  points at exactly one row in:
                            ▼
                    theme_releases  (one row per PUBLISHED version, immutable once published)
                        .template_snapshot -> 'liquidBundle'   ◀── what a store ACTUALLY renders
                        .release_manifest  -> 'liquidBundle'   ◀── a secondary copy, lower priority
                        .release_config    -> 'liquidBundle'   ◀── legacy fallback, lowest priority
```

## The two traps

**Trap 1 — `node` vs `npx tsx`.** `build-letbuyy-core-bundle.mjs` imports
`theme-bundle-core.ts` directly (a `.ts` file, and — transitively, through `theme-bundle.ts` —
an extensionless import chain). Running it under bare `node scripts/liquid-parity/
build-letbuyy-core-bundle.mjs` fails with `ERR_MODULE_NOT_FOUND`. It is not broken; it needs a
TypeScript loader. **Always run it as `npx tsx scripts/liquid-parity/build-letbuyy-core-bundle.mjs`**
(same for the `urban-kicks` sibling).

**Trap 2 — the release is a frozen snapshot, and `template_snapshot` wins.**
`apps/storefront-runtime/src/lib/store-service.ts` (`mapSupabaseToStore`) resolves the store's
effective `templateConfig` with this exact priority:

```ts
const releaseConfig = asRecord(release?.template_snapshot || release?.release_config);
// ... only falls through to release_manifest.templateConfig if releaseConfig is EMPTY
```

and `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` (`resolveLiquidBundle`)
picks the first of these that parses:

```ts
store.templateConfig.liquidBundle       // = template_snapshot.liquidBundle, priority 1
releaseManifest.liquidBundle            // priority 2 — only reached if #1 is absent/invalid
releaseManifest.themeBundle             // priority 3
releaseManifest.bundle                  // priority 4
```

**`template_snapshot.liquidBundle` wins over everything else, unconditionally, whenever it is
present** — which it is, for any already-published store. Updating `themes.default_template`
(the catalog row) or even `release_manifest` on an existing release changes **nothing** for
that store, because `template_snapshot` was captured once, at publish time, and is never
re-derived from the catalog afterward. This is by design — a release is meant to be an
immutable, auditable "what shipped" record — not a bug, but it means **there is no code change
that retroactively updates an already-published store**. Only publishing a new release does.

## How a release is actually published (the existing, supported path — do not build a new one)

1. **Merchant editor** (`apps/merchant-control-plane`): Online Store → Themes → Edit theme →
   **Publish**. This calls `POST /v1/themes/:slug/update`
   (`services/api-gateway/src/routes/themes/theme-update-route.ts`), whose final step invokes
   `TenantThemeExecutionAdapter.publishReleaseSnapshot`
   (`services/api-gateway/src/execution/theme-execution.adapter.ts`), which calls the
   `publish_theme_release` Postgres RPC (`SECURITY DEFINER`, confirmed present in this DB via
   `select proname from pg_proc where proname='publish_theme_release'`) and then
   `enrichPublishedReleaseSnapshot` (a follow-up `UPDATE theme_releases SET release_manifest =
   ...` for the derived, lower-priority manifest copy).
2. **No scripted path exists for local dev.** `scripts/` has no publish-a-release script. If a
   session needs to refresh an already-published store's rendered content from an updated
   source (theme-bundle.ts, section templates, etc.) without walking the merchant editor
   (typically because, as in T3-fix, the store has no owned merchant account locally), the only
   way to reflect the change is a direct, surgical `jsonb_set` UPDATE of
   `theme_releases.template_snapshot -> 'liquidBundle'` (and, for consistency, the same key in
   `release_config` if present and `release_manifest`) for that store's current release row —
   **not** a new migration, **not** a new mechanism, just a manual re-application of what
   `publish_theme_release` would have written, scoped to the `liquidBundle` key so no other
   release field (`themeSettings`, `config`, block instance data, etc.) is touched.
3. **After any of the above, clear BOTH the gateway's response cache
   (`services/api-gateway/.wrangler/state/v3/cache`) AND the storefront-runtime app's fetch
   cache (`apps/storefront-runtime/.next/cache`), then restart both processes.** The gateway's
   `GET /storefront/:subdomain` response (which embeds `current_theme_release`) is itself
   cached (`cachedJson`/Miniflare Cache API) independently of the DB row being correct — a
   database update alone is not sufficient to see the change; both server processes must be
   restarted with their caches cleared, in that order (gateway first, then storefront-runtime,
   since the storefront's own cache is downstream of the gateway's response).

## What to check when "my change didn't appear"

1. Is the change even in the fixture generator (`theme-bundle.ts`)? Confirm via `npx tsx` (not
   `node`), print the specific field you changed.
2. Is it in the regenerated examples (`generate-examples.mjs`)? `theme-examples.test.ts` proves this.
3. Is the STORE'S OWN `theme_releases.template_snapshot -> 'liquidBundle'` current? This is the
   one that matters — query it directly, don't infer from the catalog row.
4. Have BOTH the gateway's and storefront-runtime's caches been cleared and BOTH processes
   restarted since the DB was last correct?

Only after all four are confirmed is "still stale" actually a caching bug worth chasing further.
