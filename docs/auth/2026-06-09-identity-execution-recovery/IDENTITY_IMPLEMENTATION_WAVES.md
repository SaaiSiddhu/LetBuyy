# IDENTITY IMPLEMENTATION WAVES
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY · architecture FROZEN
### Wave 0 → 8 · each with Goals · Files · Dependencies · Risks · Rollback · Effort

> Wave numbering follows the Phase-3 brief. Effort scale: **S** = days · **M** = 1–2 weeks · **L** = 3–6 weeks (one focused squad). Principle (frozen): no big-bang; dual-accept old+new; shadow-compare before enforce; flag-gated + cohorted; metrics-as-gates; `node scripts/validate-governance.mjs` + the identity CI gates at every boundary.

---

## Wave 0 — Emergency Security
- **Goals:** eliminate the 3 live S0s + cheap S1s, with zero architecture change. Close SEC-C1/C2/C3, SEC-H2/H3/H7. Stand up the Wave-0 CI gates (secret-literal grep, `/switch` regression test).
- **Files:** `apps/identity-platform/src/app/api/auth/switch/route.ts` (require auth + accounts-cookie membership; add rate-limit/Turnstile); `apps/platform-console/src/lib/console-session.ts:23-31` (delete literal, unify gate); `services/api-gateway/src/lib/crypto.ts:146,180` (mandatory non-mock in prod); `services/api-gateway/src/middleware/auth.ts:224-226` (scope console token); `apps/identity-platform/src/lib/auth/cookies.ts:11-19` (4-var gate); `apps/identity-platform/src/app/api/auth/lookup/route.ts` (non-enumerating + bot-check).
- **Dependencies:** none (independent of the build). KMS provisioning (SEC-C3) needs HR-KMS-LIVE — interim: hard-fail prod on `mock`.
- **Risks:** account-switch UX regression; over-tight lookup breaks signup detection.
- **Rollback:** per-fix feature flag; one-commit revert; **no schema change**.
- **Effort: S.**

## Wave 1 — Foundation Cleanup
- **Goals:** collapse duplicate primitives to one each; add the tenant query-guard (SEC-H1 step 1); remove in-memory auth maps; retire `lb_csrf`; single `COOKIE_DOMAIN` config before any `.com` move. Close CD-S0-3, CD-S1-3/4/5, SEC-H6, SEC-M2/M7.
- **Files:** `apps/identity-platform/src/lib/turnstile.ts` + `services/api-gateway/src/middleware/security.ts:219-249` → one verifier; `src/lib/dev-auth-bypass.ts` + 5 forks → one prod-detection helper; `src/lib/auth/csrf.ts` + `src/lib/csrf-client.ts` + `src/proxy.ts:43-58` → one CSRF module; `src/lib/auth/cookies.ts:54` + `apps/merchant-control-plane/.../auth/logout/route.ts:33` → shared config; `services/api-gateway/src/routes/auth.ts:82-85` (remove local Maps); shared base64url/timingSafeEqual util; a tenant query-builder wrapper / lint.
- **Dependencies:** Wave 0.
- **Risks:** touching shared auth code paths across runtimes.
- **Rollback:** keep both old names/validators accepted during a dual-window; module-level revert.
- **Effort: M.**

## Wave 2 — Design System Recovery
- **Goals:** identity UI becomes the DS reference; raise DS compliance ~45% → ≥95%; delete the shadow stylesheet; fix a11y; flip lint to `error` + add CI gates. Close CD-S0-1/2, CD-S1-1, UI-1/3, DS-1/2, TH-1/2.
- **Files:** `src/app/globals.css` (shrink 1,986 → ~300); `src/app/{login,lookup,signup,onboarding,select}/page.tsx` (convert; merge login+lookup); new `AuthShell` component; `src/app/layout.tsx:102`; `eslint.config.mjs:14-22` (promote rules + new `unstyled` rule); stylelint config; the 4 DS-native pages as the pattern.
- **Dependencies:** none for conversion (parallel to backend); CI-gate flip waits until existing warns are cleared.
- **Risks:** visual regression across auth surfaces.
- **Rollback:** per-page conversion revert; visual-diff (screenshot) gate; `globals.css` line-count gate prevents regrowth.
- **Effort: M–L.**

## Wave 3 — Session Consolidation
- **Goals:** one session service across realms; add idle + absolute timeout, rotation, refresh chain + reuse detection; build session-management UI. Enable `FEATURE_NEW_SESSION_ENGINE` in shadow → compare → enforce. Close SESS-1, SEC-L4; UI-2 (session surface).
- **Files:** `apps/identity-platform/src/lib/auth/session.ts`; `services/api-gateway/src/routes/auth.ts` (session mint/validate/destroy); `services/api-gateway/src/identity-foundation/session-services.ts` (promote dormant); `packages/session-core` (complete); new session-management surface (DS-native).
- **Dependencies:** Wave 1.
- **Risks:** session breakage / mass logout.
- **Rollback:** flag off → legacy opaque sessions; dual-read during transition.
- **Effort: M.**

## Wave 4 — Security Hardening
- **Goals:** refresh rotation+reuse live; hash `verification_tokens`; **account-recovery/lockout flow (must precede MFA enforce)**; merchant MFA + passkey enroll/verify; device-revoke UI; `__Host-` cookies; per-account rate-limit; password policy. Close SEC-M1/M6/M8, SEC-L2/L3, ID-1 (partial), AUD-1 (partial).
- **Files:** `src/lib/auth/tokens.ts` (hash); `src/lib/auth/cookies.ts` (`__Host-`); `src/lib/auth/password.ts`; new MFA/recovery/device surfaces; `services/api-gateway` token + 2FA routes; `merchant_2fa_factors` reuse.
- **Dependencies:** Wave 3 (session service for rotation); Wave 2 (DS for new surfaces).
- **Risks:** lockout of legitimate users (recovery flow must land first).
- **Rollback:** per-feature flags; MFA enforcement behind a soft-launch.
- **Effort: L.**

## Wave 5 — OIDC Foundation
- **Goals:** **replace the mock key service with a real per-realm ES256 key service + JWKS**; implement `/authorize` (PKCE+state+nonce), `/token`, `/userinfo`, consent endpoint + consent UI; passkey auth. Lift SEC-H5 only when real keys verified. Close OIDC-1, KEY-1 (single-region deferred to W8), ID-1 (consent/passkey).
- **Files:** `src/app/oauth2/{authorize,token,userinfo,consent,logout,callback}/route.ts` (replace skeleton wrappers); `src/lib/identity-foundation/oidc-disabled.ts` → real provider; `services/api-gateway/src/identity-foundation/mock-key-service.ts` → real; `.well-known/*`; new consent UI surface.
- **Dependencies:** Waves 3/4; **HR-KMS-LIVE + Hydra provisioning** (operational gate); Operational readiness ≥75.
- **Risks:** publishing an unusable issuer; key cutover.
- **Rollback:** `FEATURE_IDENTITY_PROVIDER`/`FEATURE_NEW_KEY_SERVICE` stay off until a test proves non-mock JWKS in prod; pilot one client only.
- **Effort: L (largest build).**

## Wave 6 — SSO Foundation
- **Goals:** org switcher, invitations + team-management UI, federation/single-use handoff, silent SSO (`prompt=none`); org-model GA-prep + backfill dry-run. Requires A-1 ratified. Close UI-2 (org/team), parts of GAP org/agency models.
- **Files:** new org-switcher / invitations / team-mgmt surfaces; `packages/organization-core` (complete); federation endpoints (generalize `createCustomerFederationToken` `auth-core:806`); `src/app/select/page.tsx` → org/account switcher.
- **Dependencies:** Wave 5; **A-1 sign-off** (membership graph → Identity).
- **Risks:** org backfill correctness (A-3); SSO loops.
- **Rollback:** per-client SSO flag; backfill is additive/reversible.
- **Effort: L.**

## Wave 7 — Client Migration
- **Goals:** migrate RPs onto OIDC with gateway **dual-accept** (IdP token + legacy header), shadow-compare authz before enforce; order: merchant CP → console → marketplaces → customer/checkout → mobile. Execute the **joint `.store`→`.com` + cookie-domain cutover**. Delete legacy Supabase + app-asserted identity + dual CSRF. Close CD-S1-2, SEC-M5, OPS-3.
- **Files:** `services/api-gateway/src/middleware/auth.ts` (dual-accept then drop header path); `services/api-gateway/src/routes/auth.ts:1214-1372` (delete legacy); `src/lib/auth/cookies.ts` (host-only `__Host-`, `.com` domain); RP client configs.
- **Dependencies:** Waves 5/6; SEO `.store`→`.com` runbook (`docs/seo/`).
- **Risks:** SSO/logout break at cutover; installed-app long dual-run.
- **Rollback:** dual-accept stays until zero legacy traffic N days; per-merchant/per-cohort flags; dark-ship one release before hard delete.
- **Effort: L.**

## Wave 8 — Production Rollout
- **Goals:** mTLS workload identity (retire shared HMAC, SEC-H4 complete); decompose `service_role` → least-privilege DB principals + RLS as real second layer (SEC-H1 complete); enforce merchant MFA + step-up + privilege-change rotation + device-revoke; **KMS-backed keys + JWKS HA + offline-validation window inside the one-region topology**; audit chain-verification + Merkle anchoring live; org-model GA (`org` claim populated); SOC2 evidence window. Close SEC-H4, TEN-1, KEY-1, AUD-1.
- **Files:** `services/api-gateway/src/lib/internal-auth.ts` (retire); `supabase-adapter` (per-domain principals); key service (KMS-backed in the approved India region); audit pipeline; enforcement middleware.
- **Dependencies:** all prior waves.
- **Risks:** broad blast radius (mTLS, DB principals).
- **Rollback:** per-control flags; staged by service/cohort.
- **Effort: L.**

---

## Critical path & parallelism
**Serial spine:** Wave 0 → 1 → 3 → 4 → 5 → 6 → 7 → 8. **Parallel:** Wave 2 (design system) runs alongside Waves 1–4 (front-end squad independent of backend). **Hard gate:** Wave 5 cannot start until Operational readiness ≥75 + HR-KMS-LIVE + Hydra provisioned (OPS-1/OPS-2). **Single highest-leverage unblock:** ratify A-1 (gates Wave 6) and provision KMS/Hydra (gates Wave 5) early, in parallel with Waves 0–2.

## Effort roll-up (one focused identity squad + a front-end squad)
Wave 0 **S** · Wave 1 **M** · Wave 2 **M–L** (parallel) · Wave 3 **M** · Wave 4 **L** · Wave 5 **L** · Wave 6 **L** · Wave 7 **L** · Wave 8 **L**. Realistic critical-path ≈ **2–3 quarters** to a federated SSOT, consistent with the recovery plan — *gated on operational provisioning, not code*.
