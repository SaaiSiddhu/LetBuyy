# Repository structure

> A map, not law. `LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md` → `CLAUDE.md`
> remain supreme. Rewritten 2026-09-24 (APPID-P2) for the grouped application layout (Constitution §16,
> Amendment 3; executed by APPID-P1); first written 2026-09-02 (Phase M). Per-application facts are in
> `docs/architecture/APPLICATION_OWNERSHIP.md`.

## One repository

This is the single LetBuyy repository. The two formerly separate repositories (System A, the Firebase
LetBuyy app; System B, Agrimore) were folded in during Phase M. Their full histories are bundled
outside the tree in `~/LetBuyy-history-preservation-2026-08-29/`; see
`docs/migration/repository_consolidation/14_recovery_and_rollback.md`.

## Top level

```
apps/            application roots, grouped by product area (below)
reference/       preserved donor source; never built, deployed or imported (REFERENCE class)
services/        the canonical Worker services, the RESERVED service roots, services/compatibility (inert
                 bridges) and services/lcis-api (TOOLING)
packages/        shared TypeScript and Dart packages, packages/lcis-* (TOOLING)
database/        Supabase/Postgres schema, migrations with rollback pairs, RLS policies
infrastructure/  deployment and observability configuration
config/          runtime topology, environment schemas, governance registries
scripts/         the governance gate (scripts/validators, scripts/validate-governance.mjs) and operations
docs/            architecture, governance, dated evidence and archives
tests/           cross-runtime contract, federation, launch and security suites
tools/           the Central Intelligence System (LCIS), TOOLING
```

## apps/ and reference/

Directories in the tree below are either **containers**, which only group, or **roots**, which are
applications or donors. A container never holds an application of its own.

```
apps/
  marketplace/
    mobile/                  buyer Marketplace app (Ecommerce and Quick modes)       core product app
  merchant/                  (container only; a runtime at apps/merchant stays prohibited)
    web/                     merchant web                                            ACTIVE
    mobile/                  merchant app                                            SUPPORTING
  commerce/
    web/                     storefronts, custom domains, hosted checkout            ACTIVE
  platform/
    identity/                LetBuyy accounts, the sole token issuer                 ACTIVE
  internal/                  (container only; a runtime at apps/internal stays prohibited)
    console/                 internal console                                        SUPPORTING
  marketing/
    web/                     marketing and pricing site                              ACTIVE
  deferred/
    delivery/
      mobile/                delivery partner app                                    DEFERRED
  frozen/
    app-store/  theme-store/  developer-portal/  operations-portal/                  FROZEN
  reserved/
    operator-mobile/  legacy-shopper-mobile/  legacy-operator-mobile/                RESERVED
reference/
  apps/
    marketplace-seller/      System A seller app, donor to the merchant product      REFERENCE
    store-operations/        Agrimore store-ops app, donor to Store Ops              REFERENCE
```

Paths before 2026-09-24 (`apps/customer_app`, `apps/customer_web`, `apps/merchant_web`,
`apps/merchant_app`, `apps/identity-platform`, `apps/admin_web`, `apps/marketing-site`,
`apps/phase_2/*`, `apps/app-marketplace`, `apps/theme-marketplace`, `apps/developer-portal`,
`apps/platform-operations-portal`, `apps/admin_app`, `apps/mobile/*`) are history. The full mapping is
in `.claude/skills/letbuyy/references/decisions.md` §2g, and `git log --follow` crosses the move.

## The classes and what they mean

| Class | Meaning | Where it is enforced |
|---|---|---|
| ACTIVE | one of the eight canonical runtimes, the entire deployable topology | Constitution; `canonicalAppRoots`, `canonicalServiceRoots` |
| SUPPORTING | rides the canonical topology; authorises no further backend service | Constitution; `CLAUDE.md` Canonical Runtime Map |
| DEFERRED | real source kept for a capability that needs its own activation amendment | `deferredAppRoots`; not started by `pnpm dev` |
| FROZEN | not a deploy target; changed only under the freeze rules | `frozenAppRoots`; started only by `pnpm dev:frozen` |
| RESERVED | manifest-only placeholder that must stay empty | `reservedMobileRuntimeRoots`, `reservedServiceRoots`; `runtime-validator` |
| REFERENCE | donor source; never built, deployed, installed or imported | `referenceAppRoots`; `reference-isolation-validator` |
| TOOLING | the Central Intelligence System's own development tooling | `toolingRoots` |

`services/compatibility/*` holds inert, non-deployed bridges, and no canonical runtime is wired to
them. Services did not move in the 2026-09-24 restructuring; only application roots did.

## Starting things locally

`pnpm dev` starts the five maintained web applications plus the gateway and shared UI (see
`scripts/dev/ports.mjs`). Frozen applications start only with `pnpm dev:frozen`, and
`scripts/utilities/local-stack-up.mjs` includes them only with `--include-frozen`. Deferred and
reference apps are never started by a default command. Details in `docs/LOCAL_DEV.md`.
