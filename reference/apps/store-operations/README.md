# reference/apps/store-operations

Quick-commerce dark-store operations mobile app. Donor: System B (Agrimore),
no equivalent capability anywhere in System A or System C. REFERENCE class
(Constitution §16, Amendment 3, 2026-09-24): never built, deployed, installed as
a workspace member or imported. Its capabilities are re-implemented in the
merchant product's Store Ops mode.

## Readiness status

**NOT production-ready. Never represent as such.** Copied from its donor
system unmodified except for cosmetic de-branding (this README, the
`pubspec.yaml` description). It still talks to System B's own backend: a
`supabase_flutter` client and a Workers base URL that defaults to
`http://localhost:8787` (`lib/src/app/bootstrap/store_environment.dart`).
When it was copied that target was `D0_DEPENDENT`
(`docs/migration/repository_consolidation/07_final_path_mapping.md`). D-0 was
decided on 2026-09-04 (**A**, the canonical commerce OS), so the target of every
port is `services/api-gateway`; the donor's own data layer is never ported.

- **Owner:** unassigned — flagged for the founder/CTO to name an owner.
- **Package identity, not renamed:** `applicationId`/`namespace`
  `com.agrimore.store_ops_app` — an external, potentially-already-deployed
  identifier. It is never published from this repository: the capabilities
  ship inside the merchant app's `com.letbuyy.store`.
- **Internal package imports, de-branded (Phase N):** this app imports
  the shared packages from this repository's `packages/dart/quickcommerce_*`
  (moved and renamed from System B's `packages/agrimore_*` — see
  `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`
  Stage 4). Internal class names, display strings, and local storage/file
  labels were renamed `Agrimore` → `Quickcommerce` to match; the Android
  `applicationId`/`namespace` above was deliberately left unchanged and is
  tracked as PENDING EXTERNAL in the journal.

## Provenance

- **Source system:** System B, `Ecommerce/LetBuyy/Agrimore` (`github.com/SiddhuSaai/Agrimore.git`)
- **Source path:** `apps/store_ops_app`
- **Source HEAD at copy time:** `20548b8938e2baa9c85b1e8f4ecc1f701999e331`
- **Copied:** 2026-09-02 (Phase M, Stage 4) as `apps/phase_2/store_ops_app`; moved to this path on
  2026-09-24 by APPID-P1 (`19f79bab`, a pure rename). APPID-P2 untracked two Flutter-generated iOS
  files that carried the donor machine's absolute paths; `flutter pub get` regenerates them.
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle` (SHA-256 `2ed6cb3a845f24f719211729e4e94cd9c2cea99b96c4159aaaa22b02ce204b66`), outside the repository; nothing in CI depends on it.

## Intended recipient

The merchant product's Store Ops mode in `apps/merchant/mobile` (`letbuyy_store`,
`com.letbuyy.store`), with supervisor views in `apps/merchant/web` where needed. The founder,
2026-09-24 (D-ONE-PRODUCT): *"There is one merchant product delivered through web and mobile: …
Supermarket operations. Store Ops/picking/packing workflows. Future approved dark-store operations."*
There is no separate store-ops app.

## Unique capabilities

What the donor source contains (`lib/src/features/*`). This is not a claim that any of it is ported;
port status is in `CAPABILITY_BACKLOG.md`.

| In the donor | Where |
|---|---|
| Store onboarding for a dark store | `features/onboarding` |
| Live order queue for store staff | `features/queue` |
| Pick and pack, item by item | `features/pick_pack` |
| Handoff of a packed order to a delivery partner | `features/handoff` |
| Inventory view and stock counts | `features/inventory` |
| Offline-first local store with replay (`drift`, `sqlite3`), realtime updates, error reporting | `core/data`, via `quickcommerce_offline`, `quickcommerce_realtime`, `quickcommerce_observability` |

## Transfer gates

A capability moves only when every gate holds for it:

1. **Backend.** The canonical endpoints exist in `services/api-gateway` and are the only data path.
   The donor's `supabase_flutter` client and Workers URL are not carried over (D-0 = A).
2. **Identity.** Store staff sign in through `apps/platform/identity` in the merchant realm
   (D-ONE-IDENTITY). No store-ops login exists.
3. **Authorisation fails closed.** The staff-permission path a Store Ops screen relies on denies on
   missing context, on a lookup error and on an absent grant, with denial tests, before any picker or
   packer role is exposed (founder, 2026-09-24, §8 of the restructuring brief). A shared merchant app
   grants nothing by itself.
4. **Who may pick.** Only the merchant's own staff until D-PARTNER-CUSTODY decides what a partner-node
   picker is and may read.
5. **Inventory.** Stock changes go through the canonical inventory RPCs, one stock authority; the
   donor's local counts are never a second one.
6. **Offline replay.** Every mutation the offline queue replays is idempotent at the gateway
   (Constitution: every externally retryable mutation requires idempotency).
7. **Handoff.** Waits for the delivery client, which is deferred (`apps/deferred/delivery/mobile`) and
   needs its own activation amendment. Quick dispatch and dark-store custody are not built.
8. **Evidence.** Tests live in the recipient, a debug APK is built and badged, and
   `CAPABILITY_BACKLOG.md` records the port. The capability ships inside `com.letbuyy.store`.

This donor is deleted when every row of the capability table is ported or retired by an owner
decision, in a phase with its own disposition row.
