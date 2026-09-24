# reference/ — preserved donor source

**Class:** REFERENCE (Constitution §16, Amendment 3, 2026-09-24; `referenceAppRoots` in
`scripts/validators/governance-common.mjs`). A donor is source kept for capabilities that will be
re-implemented in a named recipient application. It is not an application of this repository.

The founder, 2026-09-24, verbatim: *"Reference code: Excluded from runtime/workspace/build/deploy
discovery. Not imported by active applications. Still subject to appropriate secret scanning. Retains
provenance and capability-transfer checklists."*

## The donors

| Donor | Came from | Intended recipient | What only it has | Record |
|---|---|---|---|---|
| `reference/apps/marketplace-seller` | System A's seller app, imported 2026-09-20 (`81bb40af`) as `apps/phase_2/seller_app` | the merchant product: `apps/merchant/mobile`, with web halves in `apps/merchant/web` | marketplace-selling surfaces: reels, deals, ad campaigns, KYC wizard, returns, product approval and drafts, HSN/GST helpers, performance tiers | [README](apps/marketplace-seller/README.md) |
| `reference/apps/store-operations` | System B (Agrimore) `apps/store_ops_app` at `20548b89`, copied 2026-09-02 (Phase M) as `apps/phase_2/store_ops_app` | the merchant product's Store Ops mode in `apps/merchant/mobile` | dark-store staff flows: order queue, pick and pack, handoff, inventory counts, store onboarding, offline-first sync | [README](apps/store-operations/README.md) |

Both moved here on 2026-09-24 in APPID-P1 (`19f79bab`, a pure rename). The capability-level port
status lives in `CAPABILITY_BACKLOG.md`, not here: a donor README says what may move and under which
conditions, never that a port has happened.

## Rules, and what enforces each

| Rule | Enforced by |
|---|---|
| Only the approved donor roots exist under `reference/`, and only under `reference/apps/` | `runtime-validator` |
| No pnpm or Dart pub workspace membership; no lockfile importer or path entry | `reference-isolation-validator` |
| Nothing outside `reference/` imports it: relative TS/JS/Dart imports, `package:letbuyy_seller/…` or `package:store_ops_app/…`, pubspec `path:` dependencies, `link:`/`file:` dependencies, tsconfig paths | `reference-isolation-validator` |
| No workflow, runtime manifest, Vercel config or `turbo.json` names a donor, and donors carry no deployment configuration | `reference-isolation-validator` |
| No tracked non-documentation file depends on a donor system's machine path or the out-of-tree history bundles | `reference-isolation-validator` |
| Secret scanning covers donors with no path exemption | `environment-validator`, `committed-secret-placeholder-validator` |
| Each donor keeps a README with Provenance, Intended recipient, Unique capabilities and Transfer gates | `reference-isolation-validator` |

The dependency direction is one-way. A donor may still name active shared packages (store-operations
lists `packages/dart/quickcommerce_*` as path dependencies), because nothing builds a donor. The
reverse, an active application or package reaching into `reference/`, is what the rules forbid.

## How a capability leaves a donor

1. It is in scope: named by an owner decision (for the seller donor, `decisions.md` §2a).
2. It is **re-implemented** in the recipient against `services/api-gateway`, the one backend (D-0 = A).
   Copying a donor's data layer (Firestore, Cloud Functions, a direct Supabase client, the Agrimore
   Workers) is not a port.
3. It signs in through `apps/platform/identity` (D-ONE-IDENTITY). No donor login is carried over.
4. Its tests run in the recipient, including a compiled artefact for mobile, and `CAPABILITY_BACKLOG.md`
   records the port.
5. It ships under the recipient's published identity (`com.letbuyy.store`). Donor application IDs are
   never published.

A donor leaves the tree only when every capability in its README is ported or retired by an owner
decision. Its removal is a phase of its own with a `docs/active/BRANCH_DISPOSITIONS.md` row, and its
history stays reachable in git and in `~/LetBuyy-history-preservation-2026-08-29/`. A donor is never
promoted into an application root.
