# S1 / W1 — D2 fresh-database reproduction (pre-fix record)

**Method.** `scripts/liquid-parity/reproduce-d2-fresh-db.mjs`, run against the ephemeral
`letbuyy-executable-pg` Postgres 16 fixture (`scripts/governance/foundation-ephemeral-postgres.mjs`,
docker-exec only — no host TCP port, confirmed not colliding with any other running container/port on
this machine at the time of the run: `quick-db-1`/5432, `edynox-local-db`/55432, `quick-redis-1`/6379,
`edynox-redis`/56379 were all already running and untouched). The script bootstraps the minimal
Supabase-platform primitives no repo migration creates (a stub `auth` schema/table/functions, the
`anon`/`authenticated`/`service_role` roles, and the `pgcrypto`/`pg_trgm` extensions — documented in the
script), then applies all 127 files in `database/supabase/migrations/` in numeric order, then all 3 files
in `database/supabase/seeds/` in order, then queries `public.themes`.

**Run captured below: before migration 199 and the seed closure existed** (i.e. against
`database/supabase/migrations/` at commit `92c7b67e`, HEAD at the start of this phase). This is the
verbatim tool output from that run, not a reconstruction:

```
[bootstrap] resetting letbuyy_executable and applying Supabase-compatibility stub
[migrations] applying 127 files in order
[migrations] all applied cleanly
[seeds] applying 3 files in order
[seeds] all applied cleanly

Fresh-database replay of all 127 migrations + 3 seeds produced 17 theme row(s); NONE carry
rendererEngine='liquid'. D2 is confirmed: nothing renders Liquid on a fresh database.
```

**Verdict:** `D2_REPRODUCED`. All 17 theme rows, including `urban-kicks` and `letbuyy-core`, carried
`default_template->>'rendererEngine'` = `<unset>`:

```
app-startup, bazaar-minimal, case-study-pro, commerce-canvas, creator-grid, cv-focus, event-splash,
launch-landing, lead-magnet, letbuyy-core, market-luxe, portfolio-studio, product-docs, profile-brief,
resume-slate, saas-console, urban-kicks
```

**Root-cause confirmation (read from source, not inferred).** Migrations 171/172/180/181/193 are all
`UPDATE public.themes ... WHERE slug = 'urban-kicks'`, and migrations always apply before seeds in this
repository (confirmed by this script's own successful run order — every migration file applies before any
seed file). `urban-kicks` is created by `database/supabase/seeds/urban-kicks-theme.sql`, which runs last,
so on a genuinely fresh database each of those five `UPDATE`s matches zero rows at the time it runs. Of
the five, only 171/172 (the `liquidBundle` merge) had already been mirrored into the seed itself, as a
trailing `UPDATE` statement appended after the seed's own `INSERT ... ON CONFLICT (slug) DO UPDATE SET
default_template = EXCLUDED.default_template` (confirmed: the seed's own `ON CONFLICT` clause
unconditionally overwrites `default_template`/`settings_schema` with the seed's own literal values, so a
migration-only pre-creation of the row would be silently clobbered when the seed ran afterward — this is
why the fix could not be a migration alone). 180/181/193 (`rendererEngine`, `themeSettings`,
`settings_schema` appearance completion, `theme_schema_manifests` registry sync) were never given the same
seed mirror — exactly the gap 180's own header names and never executes: *"if the theme is (re)created
from seeds/urban-kicks-theme.sql on a fresh DB, mirror these defaults there too."*

**Current state (post-fix).** Migration `199_liquid_activation_fresh_db_closure.sql` (+ paired rollback)
and an appended closure block in `database/supabase/seeds/urban-kicks-theme.sql` close this gap. Re-running
the identical script today shows the fix; see
[`S1-W2-closure-verification-post-fix.json`](S1-W2-closure-verification-post-fix.json) for that run's raw
output (`D2_NOT_REPRODUCED` — exactly one theme row, `urban-kicks`, carries `rendererEngine = 'liquid'`;
`letbuyy-core` and every other theme remain unset, matching the "canary stays off" requirement).
