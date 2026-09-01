# 04 — Application Survivor Scorecard

**The `UNIFIED_MIGRATION_AUDIT` referenced in older briefs does not exist.** I searched the whole home directory tree to depth 6 for it; nothing matched. It is not cited anywhere below. Every judgement in this document is derived from source I read directly during this session (paths and line numbers are given) or is explicitly marked **UNKNOWN**. No prior audit or certification document was treated as truth — where one existed on disk (e.g. inside `legacy_archive_v2/certification_theater/`), it was not read for this scorecard; a self-certifying document is not evidence of function.

**Weighting used:** production status and release identity outrank file count, per instruction. Concretely: System A's `marketplace` app wins the `customer_app` slot on production status alone (confirmed shipped, `com.letbuyy.letbuyy`), even though System C has no competing mobile customer app to compare it against yet.

**What "production status" actually means below:** I did not check any App Store listing, Play Store console, Vercel/Cloudflare deployment dashboard, or DNS record — all explicitly out of scope ("Any deploy, or any command touching live Firebase, Supabase, Cloudflare, Vercel, Razorpay, DNS or Play Store" is banned). The **one** production fact in this document is the one the owner stated directly in the task brief: the shipped Play Store app is `com.letbuyy.letbuyy`. Every other app's live/production status is marked **UNKNOWN** — "most recently and heavily engineered" (which I *can* measure, from commit dates and validator coverage) is not the same claim as "is live," and this document does not conflate them.

## The six target personas (product decision closed by the owner — not relitigated here)

`customer_app`, `customer_web`, `merchant_app`, `merchant_web`, `admin_app`, `admin_web`.

---

### `customer_app` (buyer-facing mobile)

| Candidate | System | Identity | Files (`lib/`) | Last commit | Production status | Notes |
|---|---|---|---|---|---|---|
| `apps/marketplace` | A | `com.letbuyy.letbuyy` (per `build.gradle`, the file that governs the build — see doc 01 anomaly) | 354 (180) | 2026-01-14 | **CONFIRMED shipped Play Store app** (stated fact, corroborated by matching `applicationId`) | Strongest possible survivor signal: it is the one app in this entire inventory with confirmed production identity |
| `Agrimore/apps/customer_app` | B | `com.agrimore.customer_app` | 115 | 2026-06-04 | UNKNOWN | Real business logic, but no evidence of any release; last real commit predates the current uncommitted work by System B |
| — | C | none — `apps/mobile/shopper-app` is RESERVED (manifest-only, 2 files) | — | 2026-06-11 (manifest added) | N/A | Constitution keeps this reserved until a named trigger + human approval |

**Read:** A's `marketplace` is the only candidate with confirmed release identity. If the owner's six-app model wants `apps/customer_app` to *be* this app, that's a rename/re-home of proven production code, not new development. Whether the shipped binary is actually signed by the rescued `apps/marketplace/android/app/key.jks` (`5db2ebe8…bc`) or the root `key.jks`/`key-1.jks` (`94a4eea1…61c`) was **not verified** — `keytool` was not run.

### `customer_web` (buyer-facing storefront)

| Candidate | System | Files | Last commit | Production status | Notes |
|---|---|---|---|---|---|
| `apps/storefront-runtime` | C | 204 | 2026-08-26 | UNKNOWN, but this is the Constitution's designated canonical renderer (`checkout.letbuyy.com` origin per CLAUDE.md) and the most recently active of the three candidates | Liquid-first per governance; heaviest validator coverage of the three |
| `Ecommerce/LetBuyy/apps/store/storefront` | A | 65, has a live `.vercel/` directory (was deployed via Vercel at some point) | 2026-01-14 | UNKNOWN — `.vercel/` proves a *past* deployment attempt existed, not that it is currently live | Smallest of the three by file count |
| `Agrimore/apps/marketplace_web` | B | 41 | 2026-06-04 | UNKNOWN | Also `Agrimore/legacy_archive_v2/apps/marketplace-web` exists as an explicitly archived older version — not a live candidate |

**Read:** C's `storefront-runtime` is the only one the governing Constitution already names as canonical, and it has the most recent commit activity. A's `store/storefront` has the only *evidence* of a real deployment target (`.vercel/`) among the three, but evidence of a past deploy is not evidence of current production traffic — marked UNKNOWN, not assumed live.

### `merchant_app` (seller-facing mobile)

| Candidate | System | Identity | Files (`lib/`) | Last commit | Production status | Notes |
|---|---|---|---|---|---|---|
| `apps/mobile/merchant-app` | C | Flutter, no `package.json` (see `android/build.gradle.kts` lineage note below) | 307 | 2026-08-24 | UNKNOWN, but this is the Constitution's named canonical mobile runtime and the most recently and heavily engineered of the three | Only mobile app under active development in the governed repo |
| `apps/seller` | A | `com.letbuyy.seller` (per `build.gradle`) | 341 (174) | 2026-01-14 | UNKNOWN | Comparable size to C's candidate |
| `Agrimore/apps/seller_app` | B | `com.agrimore.seller_app` | 82 | 2026-06-04 | UNKNOWN | Smallest of the three |

**Read:** C's `apps/mobile/merchant-app` is the Constitution's declared canonical mobile runtime and has the most recent commit of any mobile app inventoried (2026-08-24, three days before this session's canonical HEAD). If it survives as `merchant_app`, that is continuation of already-designated work, not a new pick.

### `merchant_web` (seller-facing web dashboard)

| Candidate | System | Files | Last commit | Production status | Notes |
|---|---|---|---|---|---|
| `apps/merchant-control-plane` | C | 347 | **2026-08-27** — the single most recently touched app-directory in this entire inventory, matching the canonical repo's current HEAD commit | UNKNOWN, but this is the Constitution's named "merchant web operating system" and clearly the most active development target in the whole workspace right now | Also the largest file count among all `merchant_web` candidates |
| `apps/store-builder-web` | A | 117 | 2026-01-13 | UNKNOWN | A merchant storefront-configuration tool, not a full operations dashboard — narrower scope than `merchant-control-plane` |
| — | B | no dedicated merchant web app found; `Agrimore/apps/store_ops_app` is mobile (Flutter, `com.agrimore.store_ops_app`), not web | 85 (mobile) | 2026-06-04 | UNKNOWN | Not a like-for-like `merchant_web` candidate — flagged as UNKNOWN whether B has a web equivalent at all |

**Read:** not a close call on current evidence. `merchant-control-plane` is both the largest candidate and the single most recently committed directory anywhere in this three-repository inventory.

### `admin_app` (platform-operator mobile)

| Candidate | System | Identity | Files (`lib/`) | Last commit | Production status | Notes |
|---|---|---|---|---|---|---|
| `apps/admin` | A | `com.letbuyy.admin` (per `build.gradle`) — **but `key.properties` points `storeFile` at `debug.keystore`, not a production key** (doc 00a) | 266 (126) | 2026-01-14 | UNKNOWN, and the signing config itself suggests this app has never produced a properly-signed release build | Real business logic, weakest production-readiness signal of any app in this inventory |
| `Agrimore/apps/admin_app` | B | `com.agrimore.admin_app` | 90 | 2026-06-04 | UNKNOWN | — |
| — | C | none — `apps/mobile/operator-app` is RESERVED (manifest-only) | — | 2026-06-11 | N/A | — |

**Read:** neither real candidate has any confirmed production signal; A's is actively disqualified from "release-ready" by its own signing config (release build points at the debug keystore).

### `admin_web` (platform-operator web console)

| Candidate | System | Files | Last commit | Production status | Notes |
|---|---|---|---|---|---|
| `apps/platform-console` | C | 65 | 2026-08-15 | UNKNOWN, but Constitution-designated as the operator console | — |
| `apps/admin-web` | A | 82 | 2025-12-27 | UNKNOWN | Slightly more files than C's candidate, but oldest last-commit of any web candidate inventoried |
| — | B | no dedicated admin web app found | — | — | N/A | Flagged UNKNOWN whether one exists elsewhere in B not covered by this inventory's target list |

**Read:** close on file count; C's candidate is the Constitution's designated one, A's is the least recently touched web app found anywhere in this inventory.

---

## The `com.agrimate.agrimate` lineage — what it implies

`Ecommerce/LetBuyy/apps/marketplace/android/app/build.gradle.kts.backup:12` reads `namespace = "com.agrimate.agrimate"`. This file is **byte-identical** (hash `9312de6b…3e`) across all three of System A's `marketplace`/`admin`/`seller` app directories — i.e., it is one template snapshot, copied three times, never individually customized. Combined with doc 02's finding that the **project-level** `android/build.gradle.kts` is byte-identical across 11 apps spanning all three systems including System C's currently-active `apps/mobile/merchant-app`, the evidence supports one specific, narrow claim: **every Flutter app in this entire three-repository workspace, including the one currently under active canonical development, was scaffolded from the same original Flutter project template, and that template's working name at some point was "Agrimate."**

What this does **not** imply, and what I am not claiming: that System C's `merchant-app` shares business logic with System A or System B beyond this one scaffold file; that "Agrimate" is a fourth undiscovered codebase (the brief's item 9 already names three); or that this creates any functional conflict today. It is lineage evidence for whoever eventually reconciles the mobile app family, not an active defect.

## Summary table

| Persona | Strongest candidate (evidence-based) | Why |
|---|---|---|
| `customer_app` | System A `marketplace` | Only confirmed production release identity in the entire inventory |
| `customer_web` | System C `storefront-runtime` | Constitution-designated canonical, most recent commit among the three |
| `merchant_app` | System C `apps/mobile/merchant-app` | Constitution-designated canonical, most recent commit among mobile candidates |
| `merchant_web` | System C `merchant-control-plane` | Largest file count AND most recently committed directory in the whole inventory |
| `admin_app` | No strong candidate | Neither real candidate has a production signal; System A's is actively weakened by its own signing config |
| `admin_web` | System C `platform-console` | Constitution-designated; System A's alternative is the least recently touched web app found |

This table is an evidence summary, not a recommendation to act — D-0 (which backend is canonical) is still open, and no directory was created, renamed, or moved in this phase.
