# 14 — HUMAN-REQUIRED ACTIONS

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`), working tree dirty and user-owned
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

Every item here is `[HUMAN-REQUIRED]`: automation cannot perform it, and no amount of repository
work closes it. For each: why automation cannot do it, the exact steps, the artifact that proves
completion, and **what may not be claimed until that artifact exists**.

**No secret value appears anywhere in this package.** Environment variables are named only.

---

## 0. The three that gate everything else

| # | Action | Blocks |
|---|---|---|
| **H-1** | Push `stepup/main` to `origin` and resolve the 291-commit branch lag | Every deploy, every "live" claim, ART-03/DEPLOY-R1 |
| **H-2** | Decide the V1 scope question in §6 (ARB, Class B) | The scope freeze itself |
| **H-3** | Provision the production credential set (§2) | Any staging or production proof |

Nothing in this program's control can move these.

---

## 1. Source control and deployment

### H-1 — Push the integration branch and restore deployability
**Why automation cannot:** this program is forbidden from committing or pushing, and branch
protection/force-push policy is an account-level decision.

**Current state (LOCAL RUNTIME):**
```
git rev-parse HEAD                              bf35062eda22f4d881efd61fb1d36c8fc83baed1
git rev-list --count main..stepup/main          106
git rev-list --count origin/main..stepup/main   291
```
DEPLOY-R1 requires the lag to be **0**. `production-deploy.yml` triggers on `main`, so at 291
commits behind, **nothing in this repository has ever been deployable from `origin`**.

**Steps:** review the 84 files with real content changes in the working tree (the other ~6,700
entries are file-mode flips); commit them in coherent units; merge `stepup/main` forward; push;
enable branch protection; confirm the branch-lag guard is green.

**Artifact:** `git rev-list --count origin/main..stepup/main` = `0`, plus a green CI run on `main`.
**Until then you may not claim:** that any fix in this repository is live, deployed, or in production.

### H-4 — Point CI at the branch people actually work on
**Why automation cannot:** changing CI trigger policy is a workflow-governance decision.
`ci.yml:3-11` triggers only on `develop`/`main`, so **`stepup/main` has no CI at all** — no
typecheck, lint, unit tests, governance gate, or the Flutter merge gate.
**Artifact:** a CI run recorded against `stepup/main` (or an explicit, recorded decision that
`stepup/main` is a throwaway integration branch).

---

## 2. Production credentials and infrastructure

None of these values exist in the repository, and correctly so (SEC-R2, R-21). All are
`[HUMAN-REQUIRED]`. **Names only.**

| # | Track | Variables / assets (names only) | Blocks |
|---|---|---|---|
| H-5 | Production Supabase project + `supabase db push` of 126 migrations | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | All persistence; all live DB probes |
| H-6 | DNS for `letbuyy.com` — apex, wildcard `*.letbuyy.com`, `accounts.`, `bff.`, `api.`, `checkout.`, `connect.` | zone + records | Storefront reachability; mobile app's configured endpoints |
| H-7 | Razorpay live keys + webhook secret | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | All online payment; store review |
| H-8 | Cloudflare Turnstile production keys | `TURNSTILE_SITE_KEY` (public, already present), `TURNSTILE_SECRET_KEY`, mobile `TURNSTILE_TOKEN` | **Login fails closed without it — a store reviewer cannot sign in** |
| H-9 | Resend domain authentication (SPF/DKIM/DMARC) + live mode | `RESEND_API_KEY`, `LETBUYY_EMAIL_MODE` | All buyer/merchant email; OTP delivery |
| H-10 | Step-up / session signing material | `STEP_UP_SIGNING_SECRET`, `CUSTOMER_SESSION_SECRET`, `PAYMENT_CONFIG_ENCRYPTION_KEY`, identity JWK set | Refunds, payouts, customer sessions |
| H-11 | Rate-limit backend | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `wrangler.toml` records this as a founder-approved temporary gap; the limiter fails closed without it |
| H-12 | Crash reporting | `SENTRY_DSN` | Currently the sentinel `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN`; the app keeps reports in a local outbox and calls no provider |
| H-13 | Razorpay Route onboarding (PA split) | merchant onboarding with the aggregator | Merchant payouts (not order capture) |

**Artifact for each:** the credential present in the correct secret store (Cloudflare/Vercel/GitHub
Actions), plus a successful authenticated probe recorded against staging.
**Until then:** `pnpm lcis live adapters` reports these as **NOT CONNECTED**, and this package
records them as NOT CONNECTED. **NOT CONNECTED is not a pass.**

---

## 3. Mobile store accounts and signing

| # | Action | Artifact |
|---|---|---|
| H-14 | Apple Developer Program membership + App Store Connect app record for `com.letbuyy.store` | App record exists |
| H-15 | Apple Distribution certificate + App Store provisioning profile | Signed `.ipa` produced |
| H-16 | Google Play Console account + app record + Play App Signing enrolment | Play app record exists |
| H-17 | Android upload keystore, delivered as `LETBUYY_ANDROID_KEYSTORE_BASE64` plus `LETBUYY_ANDROID_KEYSTORE_PATH`, `LETBUYY_ANDROID_KEY_ALIAS`, `LETBUYY_ANDROID_KEY_PASSWORD`, `LETBUYY_ANDROID_STORE_PASSWORD` | `mobile-merchant-release.yml` produces a signed `.aab` |
| H-18 | Store listing assets: screenshots per device class, icon, feature graphic, description, category, content rating | Listing complete |
| H-19 | Play **Data safety** form incl. data-deletion questions; Apple **App Privacy** answers | Both submitted and consistent with `PrivacyInfo.xcprivacy` |
| H-20 | Demo merchant account for reviewers | Credentials supplied to both stores |
| H-21 | Decide the Android launcher label — it is currently the literal string **`store`** (`AndroidManifest.xml:5`) | A real product name shipped |

> The Android release build correctly **refuses** to run without signing secrets rather than
> silently debug-signing (`build.gradle.kts:81-88`, verified LOCAL RUNTIME). That is the right
> behaviour and must not be "fixed".
>
> This program generated a **throwaway keystore in `/tmp`** purely to verify the release manifest
> merge. It is not in the repository and must never sign a shipped artifact.

---

## 4. Legal and policy content

| # | Action | Artifact | Note |
|---|---|---|---|
| H-22 | Publish a real privacy policy at `https://letbuyy.com/privacy` | Live URL | The mobile app already links it (`help_screen.dart:68`) |
| H-23 | Publish real terms at `https://letbuyy.com/terms` | Live URL | `help_screen.dart:61` |
| H-24 | Publish a support URL and contact | Live URL | |
| H-25 | Publish a **web-based account-deletion resource** | Live URL | Google Play requires a route that does not send the user back into the app |
| H-26 | DPDP posture sign-off (India) | Recorded founder/legal decision | Consent ledger is fail-closed by design (ART-07) |
| H-27 | Pricing truth on the marketing site | Corrected copy | Prior program recorded a ₹20/month contradiction |

---

## 5. ARB / governance decisions

| # | Decision | Class | Why it is human |
|---|---|---|---|
| H-28 | **Ratify or reject the merchant-app-first V1 scope** in doc 05 | **Class B (Operative)** | The merchant app is *not* frozen — `LETBUYY_CANONICAL_SYSTEMS.md:99,261` names it the canonical Mobile winner and `config/runtime/production-topology.json:139-148` already marks it `environment: production, status: active`. So re-sequencing it into V1 is a roadmap choice needing ARB review, **not** a constitutional amendment. It would become **Class A** only if it activated a reserved mobile root, minted tokens outside `identity-platform`, added a runtime, or flipped the Liquid default — none of which this scope does. |
| H-29 | **Decide the App Bridge / app-marketplace surface** (see doc 07) | **Class A adjacent** | ART-22 and ART-16/NEVER-R3 forbid a live third-party app surface. It exists and is functional in both the gateway and the Flutter app. Removing, hard-gating, or waiving it is an ARB call. |
| H-30 | Resolve the retired root `supabase/config.toml` | Class B | `migration-safety-validator` demands it be archived, but `supabase/.temp/linked-project.json` shows a **linked Supabase project rooted there**; archiving it naively breaks local dev. Needs a migration plan, not a `git mv`. |
| H-31 | Complete or revert the in-flight PostgREST `.or()` hardening | Class C, but user-owned | `stores.ts` is fully converted; ~10 other gateway files still use the unquoted pattern; 7 gateway tests pin the old string. See doc 07. |
| H-32 | Accept or reject the design-system ratchet regressions | Class B | 9 ratchet regressions and 2 HARD violations from uncommitted work in `apps/developer-portal` (a **frozen** app) and `apps/marketing-site`. UI-R7 forbids baselining them with `--update`. |

---

## 6. The one question that must be answered before implementation continues

Doc 05 freezes a scope on evidence. Two rows in it are genuinely the ARB's to decide, and this
program deliberately did not decide them:

1. **Is the merchant mobile app V1, or does V1 remain web-first?**
   The evidence is that the mobile app is broad (91 routes, 151 Dart files, `flutter analyze`
   clean, 164/164 unit and widget tests green) but **unproven** (its only integration test never
   executes) and **unshippable today** (no iOS pipeline, no privacy manifest, no account deletion,
   no crash reporting, no push). The prior scope lock's V2 classification is *confirmed on the
   evidence*, for reasons that are mostly **provisioning and verification**, not missing code.

2. **What happens to the App Bridge?** It cannot ship as-is under ART-16/NEVER-R3.

Everything else in this program proceeded without waiting on these.

---

## 7. What may never be claimed without the artifact

| Claim | Requires |
|---|---|
| "Live" / "deployed" / "in production" | H-1 + H-5 + H-6 + a recorded successful deploy |
| "Payments work" | H-7 + a real sandbox-to-live transaction with a ledger entry |
| "Merchants can log in" | H-8 (Turnstile fails closed) |
| "Emails are delivered" | H-9 |
| "The app is on the App Store / Play Store" | H-14…H-19 + the doc 13 gates |
| "Refunds work" | H-10 + the refund UI (absent) + step-up challenge UI (absent) |
| "We have crash reporting" | H-12 |
| "The gate is green" | The design-system drift resolved *and* the 102 unreached validators actually run |

A mock or sandbox provider **must never be reported as live** (AGENT-R11/R12, PAY-R10). The
`SKIP_NEEDS_HUMAN_*` sentinels in `dart-defines/*.json` are correct engineering precisely because
they make the gap visible instead of faking success.
