# 16 — CHANGELOG AND EVIDENCE INDEX

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

---

## 1. Repository changes — all uncommitted

**Nothing was committed, pushed, merged, branched, deployed, or deleted.** Every change below sits
in the working tree awaiting the user's review. No pre-existing user modification was reverted,
stashed, or overwritten; every file was inspected with `git diff` before being edited.

### 1.1 Modified files

| File | Δ | Change | Verified by |
|---|---|---|---|
| `services/api-gateway/src/tenant/tenant-tables.registry.ts` | +59 −5 | Regenerated the stale generated registry (261 → 265). Four tenant tables from **already-merged** migrations 176/185 — `site_domains`, `site_domain_verifications`, `founding_merchant_allocations`, `subscription_coupon_redemptions` — were unregistered, so the isolation validator was not checking them. | `validate:tenant-isolation` 1 → 0: "265 tenant tables registered; 0 direct service-role bypasses found" |
| `tests/executable/foundation-wave1-money-postgres.test.mjs` | +8 −0 | Added the missing `public.store_customers` fixture. Migration `142_executable_payment_sessions.sql:28` foreign-keys to it; the fixture created only `customers`, so the money gate failed deterministically. | `test:foundation:wave1` 1 → 0, with real double-release and derived-balance assertions firing |
| `tests/governance/foundation-wave3-production-safety.test.ts` | +6 −1 | Corrected an assertion that demanded the constitutionally **forbidden** `letbuyy.store` literal while the test's own name said `letbuyy.com` (ANTI-R3 governance theater; DEPLOY-R3). | `test:foundation:wave3` 1 → 0 (**4/4**) |
| `apps/identity-platform/src/lib/config/urls.ts` | +24 −0 | Added `getPlatformRootDomain()`, `getStorefrontHost()`, `getStorefrontUrl()`. | `tsc --noEmit` exit 0 |
| `apps/identity-platform/src/app/api/auth/create-store/route.ts` | +2 −2 | Removed a live `letbuyy.store` literal from the store-creation email payload. | ditto |
| `apps/identity-platform/src/app/onboarding/page.tsx` | +4 −4 | Removed 3 live `letbuyy.store` literals shown during onboarding. | ditto |
| `apps/identity-platform/src/app/select/page.tsx` | +2 −2 | Removed a live `letbuyy.store` literal in the store list. | ditto |
| `apps/mobile/merchant-app/lib/screens/settings/taxes_screen.dart` | +20 −15 | `Material` ancestor for `SwitchListTile`. | `flutter test` |
| `.../settings/notifications_screen.dart` | +22 −17 | ditto (via the shared `_toggle` helper — fixes every call site) | ditto |
| `.../content/page_editor_screen.dart` | +16 −11 | ditto | ditto |
| `.../content/post_editor_screen.dart` | +10 −5 | ditto (via `_switchRow`) | ditto |
| `services/api-gateway/src/routes/stores.ts` | +12 (mine) | Both publish paths now write the `sites.published` boolean in lockstep with `status`. | `tsc --noEmit` 0; `published` is **not** client-settable (absent from the PATCH allowlist), so it stays server-authoritative |
| `apps/mobile/merchant-app/android/app/src/main/AndroidManifest.xml` | +8 −0 | Declared `INTERNET` explicitly rather than inheriting it transitively. **Hardening, not an S0 fix** — see §3. | release manifest-merge diff before/after; `flutter build apk --release` exit 0 |
| `apps/mobile/merchant-app/lib/app/routes.dart` | +33 −1 | V1 capability policy enforced in `generateRoute`, covering primary **and** `/features/*` alias paths. A gated route never constructs its screen. | `flutter analyze` clean; 8 new tests |

> `stores.ts` shows +73 −19 in `git diff`; **+61 −19 of that is the user's own in-flight PostgREST
> filter-injection hardening**, which was already present and was not modified. Only +12 lines are
> this program's.

### 1.2 New files

| File | Purpose |
|---|---|
| `apps/mobile/merchant-app/lib/config/v1_capability_policy.dart` | The single source of truth for V1 scope in the app. Separates **forbidden** (ART-16/ART-22 — closed, not deferred) from **deferred** (unfinished work) and **desktop-only**. Defaults to `available`, so adding a screen never silently gates it. |
| `apps/mobile/merchant-app/test/v1_capability_policy_test.dart` | 8 tests asserting scenarios 19 and 20 at `AppRoutes.generateRoute` — the layer a deep link actually traverses. |
| `LAUNCH_READINESS_2026_06_12/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/**` | This package. |

**No file was deleted. No migration was added.** The gated screens' source is preserved intact
(DEL-R1: nothing is deleted without a green deletion-validation gate) — only the route is closed.
The pre-existing `AppsScreen renders marketplace apps` test still passes, confirming the screen code
is untouched.

## 2. Test and gate results

| Command | Before | After |
|---|---|---|
| `pnpm validate:tenant-isolation` | exit 1 | **exit 0** |
| `pnpm test:foundation:wave1` | exit 1 (deterministic) | **exit 0** |
| `pnpm test:foundation:wave3` | exit 1 | **exit 0 (4/4)** |
| `flutter analyze` | clean | **clean** |
| `flutter test` | 159 tests, **5 failing** | **172 tests, 0 failing** |
| `flutter build apk --release` | n/a | **exit 0** (throwaway `/tmp` key, for manifest verification only) |
| `pnpm validate:governance` | exit 1 | **exit 1** — design-system drift, user-owned (§4) |
| `npx tsx --test services/api-gateway/src/__tests__/*.test.ts` | 7 failing | **7 failing** — user's in-flight refactor (§4) |
| `node --test tests/executable/*.mjs` | 3/4 (wave1 broken) | **4/4** |

## 3. Corrections issued during this program

Recorded because they are the most instructive part of the work.

| # | Correction |
|---|---|
| C-1 | **`MOB-BLK-01` (claimed S0) is false.** An auditor reported that the release Android build shipped without `INTERNET`, so every network call would fail. The citation was accurate — `src/main/AndroidManifest.xml` declared only `CAMERA` — and this orchestrator initially agreed. A **release manifest-merge diff** disproved it: `INTERNET` reaches the merged release manifest transitively from an Android library manifest. The manifest edit was kept as **hardening** and is labelled as such. **Reading is not verification.** |
| C-2 | **"The 5 failing Flutter tests were breaking the CI merge gate" is false.** `ci.yml` triggers only on `develop`/`main`; the working branch `stepup/main` has **no CI at all**. They would break a PR to `main`, but nothing runs on the branch itself. |
| C-3 | **`SF-S0-01` "refuted" is an artifact.** The verifier ran against the working tree and cited *this program's own fix* (`stores.ts:834-838`), noting the claim "reproduces only against the committed HEAD blob". The defect was **real at HEAD** and is now fixed. It is carried as FIXED, not deleted. |
| C-4 | **`LCIS-B2` genuinely refuted.** The ledger tables *do* have ENABLE+FORCE and a per-tenant policy; the auditor's literal-string grep missed a `DO $$` block in `164_d4_tenant_role_guc.sql:34-77` that applies them dynamically. This also **casts doubt on the "326 tables without FORCE" claim**, which used the same method. |
| C-5 | Three of ten claimed S0s did not survive adversarial verification; severities were re-graded to **5 verified S0**. |

## 4. Work deliberately not done

| Not done | Why |
|---|---|
| `validate-design-system.mjs --update` | UI-R7 requires the ratchet to **block** new drift, never baseline it. Running it would convert a real regression into a green gate — the exact governance theater ART-02 forbids. The drift (9 regressions, 2 HARD) is uncommitted user work in `apps/developer-portal` (a **frozen** app) and `apps/marketing-site`. |
| Updating the 7 failing gateway tests | They pin the old string shape of the user's **half-applied** PostgREST hardening: `stores.ts` is fully converted, ~10 other gateway files are not. Updating them would bless a partial security change. |
| Archiving root `supabase/config.toml` | `validate:migrations` demands it, but `supabase/.temp/linked-project.json` shows a **linked Supabase project rooted there**; a naive `git mv` breaks the user's local stack. |
| Removing the gateway-side App Bridge | ART-22/ART-16 violation, but deleting a live surface is an ARB act (Class A adjacent), not an agent's. The **mobile** half was closed by gating, which is reversible and deletes nothing. |
| Booting the full application stack | Requires a Supabase local instance that is not running; starting it risked disturbing the user's linked project. The DB layer was proven instead, and the HTTP gap is stated plainly. |
| Any commit, push, branch switch, or deploy | Outside authority. |

## 5. Evidence locations

| Evidence | Location |
|---|---|
| Raw LCIS output (18 commands, JSON + markdown) | `/tmp/letbuyy-v1-run-2026-08-09/lcis/` |
| Validator gate output | `/tmp/letbuyy-v1-run-2026-08-09/gates/` |
| Test output (foundation waves, executable Postgres, gateway) | `/tmp/letbuyy-v1-run-2026-08-09/tests/` |
| Flutter analyze/test/release-build output | `/tmp/letbuyy-v1-run-2026-08-09/flutter/` |
| Wave A structured findings (188 capabilities, 138 blockers) | `/tmp/letbuyy-v1-run-2026-08-09/waveA/` |
| Wave B adversarial verdicts (65 verified claims) | `/tmp/letbuyy-v1-run-2026-08-09/waveB-blockers.json` |
| Orchestrator's own verification notes | `/tmp/letbuyy-v1-run-2026-08-09/ORCHESTRATOR_VERIFIED_FINDINGS.md` |
| Throwaway verification keystore (never a release key) | `/tmp/letbuyy-v1-run-2026-08-09/verify-keystore/` |

> These are **local run artifacts under `/tmp`**, deliberately outside the repository. They are not
> committed and are not included in the ZIP, which contains **only the Markdown of this package**.

## 6. Known limitations of this package

1. **No staging or production evidence exists.** Every result is local.
2. **The HTTP layer was never exercised** — the merchant→buyer journey has not been run end to end.
3. **102 of 108 validators never executed**, so the true gate state is unknown, not green.
4. **The LCIS code graph is 77 commits stale**, so no LCIS structural claim was accepted without
   independent source verification.
5. **RLS FORCE coverage beyond the red-teamed tables is unmeasured**; the disputed "326 tables"
   figure came from a grep method later shown unreliable and must be re-measured against a live
   database.
6. **S2/S3 blockers were not adversarially verified** — only S0/S1 (65 of 138) received that
   treatment. S2/S3 rows carry their original auditor confidence.
7. **This package changes nothing about deployment.** Nothing here is live.

## 7. Registration

- Linked from `LAUNCH_READINESS_2026_06_12/000_LAUNCH_READINESS_INDEX.md`.
- **No `PROMPTS.md` row required** — no basename in this package matches the prompt-class regex
  `(MISSION|PROMPT|BLUEPRINT|MASTERPLAN|DELETION)`; same report-class reasoning as
  `LETBUYY_V1_SCOPE_LOCK.md:6`.
- `EXECUTION_LEDGER.md` row appended in the established 8-column format, with `Commit` recorded as
  the uncommitted working tree.
- Per-file SHA-256 and the ZIP checksum are in [`ZIP_MANIFEST.md`](ZIP_MANIFEST.md).

## 8. No secrets

Verified before packaging: no credential, key, token, password, connection string or provider secret
appears in any document. Environment variables are named only. The scan covered provider key
prefixes, JWT shapes, PEM blocks and assignment-shaped literals, and returned nothing.
