# Application index

> **An index, not an authority.** Every fact below is copied from the authority named for it and loses
> to that authority on any disagreement. Rewritten 2026-09-24 (APPID-P2) for the grouped layout of
> Constitution §16 Amendment 3; first written 2026-09-02 (Phase M). `runtime-validator` fails when a
> governed application root is missing from the table below or a row names a path that is not one.

## Where each fact comes from

| Field | Authority |
|---|---|
| Path and lifecycle class | `scripts/validators/governance-common.mjs` (`canonicalAppRoots`, `frozenAppRoots`, `reservedMobileRuntimeRoots`, `deferredAppRoots`, `referenceAppRoots`), under the Constitution and `CLAUDE.md`'s Canonical Runtime Map |
| Product role and future role | the founder's decisions of 2026-09-24 (`.claude/skills/letbuyy/references/decisions.md` §2g) and `docs/architecture/PRODUCT_CHANNEL_MODEL.md` |
| Package names | each root's `package.json` or `pubspec.yaml` |
| Android and iOS identities | `config/governance/android-identity-registry.json` and each app's Gradle script |
| Web deploy target | `config/vercel/projects.json` (its project IDs are placeholder strings, so no deployment is verifiable from here; D-DEPLOY) |
| Review routing | `.github/CODEOWNERS` (one entry per container) |
| Donor provenance | `reference/README.md` and each donor's `README.md` |

"Verified in repository" means measured in this repository at the date given. "Deployment state" is
UNKNOWN unless a deployment is evidenced; nothing in this repository proves a live deployment.

## Application roots

| Path | Lifecycle | Product / display name | Package and published identity | Future role (decision) | Verified in repository | Deployment state |
|---|---|---|---|---|---|---|
| `apps/marketplace/mobile` | core product app (six-app model) | LetBuyy Marketplace, the buyer app | `letbuyy_marketplace`; Android `com.letbuyy.letbuyy` | the one buyer app, with Ecommerce and Quick modes (D-ONE-PRODUCT); signs in through identity (D-ONE-IDENTITY); leaves Firebase (FB-2…FB-5) | analyze and tests green, debug APK badged `com.letbuyy.letbuyy` versionCode 4013, 1.0.10 (APPID-P1, 2026-09-24) | a Play Store listing exists per the identity registry (`shipped: true`); which build is live is UNKNOWN |
| `apps/commerce/web` | ACTIVE runtime | storefronts, custom domains, hosted checkout, buyer account pages | `@letbuyy/customer-web`; Vercel `letbuyy-customer-web` | unchanged role; buyer account pages serve the one buyer account (D-ONE-BUYER); no separate Marketplace web app | `next build` green (APPID-P1) | UNKNOWN |
| `apps/merchant/web` | ACTIVE runtime | merchant web operating system | `@letbuyy/merchant-web`; Vercel `letbuyy-merchant-web` | web client of the one merchant product | `next build` green (APPID-P1) | UNKNOWN |
| `apps/merchant/mobile` | SUPPORTING | merchant app | `letbuyy_store`; Android `com.letbuyy.store` | mobile client of the one merchant product, including marketplace selling and Store Ops from the two donors | analyze and tests green, debug APK badged `com.letbuyy.store` 1, 1.0.0 (APPID-P1) | UNKNOWN (registry: `shipped: unknown`) |
| `apps/platform/identity` | ACTIVE runtime | LetBuyy accounts | `@letbuyy/identity-platform`; Vercel `letbuyy-identity-platform` | sole issuer for every client (D-ONE-IDENTITY) | `next build` green (APPID-P1) | UNKNOWN |
| `apps/internal/console` | SUPPORTING | LetBuyy internal console | `@letbuyy/admin-web`; Vercel `letbuyy-admin-web` | the one internal console, restricted workspaces plus organisation-wide administration; operators sign in through identity | `next build` green (APPID-P1) | UNKNOWN |
| `apps/marketing/web` | ACTIVE runtime | public marketing and pricing site | `@letbuyy/marketing-site`; Vercel `letbuyy-marketing-site` | unchanged | `next build` green (APPID-P1) | UNKNOWN |
| `apps/deferred/delivery/mobile` | DEFERRED | delivery partner app | `rider_app`; Android `com.agrimore.rider_app` (donor identity, never published from here) | a separate client once activated by its own amendment; signs in through identity, no fourth realm | pub workspace member; not built or tested by the gate | never deployed from this repository |
| `apps/frozen/app-store` | FROZEN | app marketplace | `@letbuyy/app-marketplace` | stays frozen (R-11); not started by `pnpm dev` | builds only on demand (`pnpm dev:frozen`) | UNKNOWN; the legacy plan records it as deployed and to be de-deployed (LEG-020) |
| `apps/frozen/theme-store` | FROZEN | theme marketplace | `@letbuyy/theme-marketplace` | stays frozen | on demand only | UNKNOWN |
| `apps/frozen/developer-portal` | FROZEN | developer portal | `@letbuyy/developer-portal` | stays frozen | on demand only | UNKNOWN; recorded as deployed and to be de-deployed (LEG-021) |
| `apps/frozen/operations-portal` | FROZEN | employee operations portal | `@letbuyy/platform-operations-portal` | folded into `apps/internal/console` under ART-24, then deleted after its transfer and deletion gates | on demand only | UNKNOWN |
| `apps/reserved/operator-mobile` | RESERVED (manifest only) | none | `com.letbuyy.admin` is a retired applicationId | none until ARB activation (Amendment 2) | root holds governance files only | never deployed |
| `apps/reserved/legacy-shopper-mobile` | RESERVED (manifest only) | none | none | none | root holds governance files only | never deployed |
| `apps/reserved/legacy-operator-mobile` | RESERVED (manifest only) | none | none | none | root holds governance files only | never deployed |
| `reference/apps/marketplace-seller` | REFERENCE donor | none (was the System A seller app) | `letbuyy_seller`; `com.letbuyy.seller`, never published | donor to the merchant product (`decisions.md` §2a) | not built; isolation enforced by `reference-isolation-validator` | never deployed from this repository |
| `reference/apps/store-operations` | REFERENCE donor | none (was Agrimore's store-ops app) | `store_ops_app`; `com.agrimore.store_ops_app`, never published from here | donor to the merchant product's Store Ops | not built; isolation enforced by `reference-isolation-validator` | never deployed from this repository |

Every application root has the same review route (`@saai-sidd` in `.github/CODEOWNERS`), and **no
human owner is named for any of them**. That is a disclosed organisational gap, not a decision.

## Grouping containers

`apps/marketplace`, `apps/merchant`, `apps/commerce`, `apps/platform`, `apps/internal`,
`apps/marketing`, `apps/deferred`, `apps/deferred/delivery`, `apps/frozen` and `apps/reserved` group
application roots (`appGroupContainers`), and `reference/apps` groups the donors (`referenceRoot`).
None of them is an application root. `apps/merchant` and `apps/internal` are also the historical alias
names that stay prohibited as runtime roots; Amendment 3 permits them only as containers of their
approved roots.

## Donor apps outside this repository (backlog, not deleted)

These paths name locations **in the donor systems**, not in this repository. System B is Agrimore;
System A is the old Firebase LetBuyy repository.

| Candidate (path in its own system) | System | Donor for | Status |
|---|---|---|---|
| `apps/customer_app` (Agrimore) | B | the Marketplace app's Quick mode | Not integrated; bundled, recoverable |
| `apps/seller` | A | the merchant product | **Preserved in this repository** since 2026-09-20 as `reference/apps/marketplace-seller` |
| `apps/seller_app` (Agrimore) | B | the merchant product | Not integrated; bundled, recoverable |
| `apps/admin_app` (Agrimore) | B | the internal console | Not integrated; bundled, recoverable. Its old destination, `apps/reserved/operator-mobile`, is RESERVED; the console is the recipient |
| `apps/store-builder-web` | A | `apps/merchant/web` (narrow scope) | Not integrated; bundled, recoverable |
| `apps/admin-web` | A | `apps/internal/console` | Not integrated; bundled, recoverable |
| `apps/store/storefront`, `Agrimore/apps/marketplace_web` | A, B | `apps/commerce/web` | Not integrated; bundled, recoverable |

Full disposition and evidence: `docs/migration/repository_consolidation/04_application_survivor_scorecard.md`,
`07_final_path_mapping.md` and `17_remaining_migration_backlog.md`. The bundles live at
`~/LetBuyy-history-preservation-2026-08-29/`, outside the repository; nothing in CI depends on them.
