# FOUNDATION_STEPUP_SKIPPED

## SKIP-W0-PITR-TIER · Wave 0 · Supabase PITR paid-tier activation · CLASS-A

BLOCKED BY: Human-owned Supabase project tier/credential decision and provider console action.

GATED AT: `config/runtime/database-recovery-policy.json` keeps `pointInTimeRecovery.defaultEnabledByCodex` false and marks shared restore execution as human `SKIP-DEPLOY`.

TO RESUME: Enable provider PITR on the intended non-production/shared project, record RPO/RTO evidence, then run `scripts/foundation/restore-drill.mjs --execute` against a non-production local/clone target and attach the restore report.

## SKIP-W1-PA-PAYOUT-PROVIDER · Wave 1 · RazorpayX Route payout execution · CLASS-A

BLOCKED BY: Human-owned PA/RazorpayX Route credentials, fund-account setup, and provider approval.

GATED AT: `services/api-gateway/src/routes/payouts.ts` returns `PAYOUT_PROVIDER_UNAVAILABLE` unless `RAZORPAY_ROUTE_PROVIDER_ENABLED=true` and the required PA credentials are configured; `packages/infrastructure/payout-transfer-adapter/index.ts` throws `PayoutProviderUnavailable` instead of fabricating a UTR or release state.

TO RESUME: Configure PA/RazorpayX Route credentials in the target non-production provider secret store, wire the approved provider client, run a non-production payout verification with provider evidence, and record apply/verify/rollback steps before enabling the flag.

## SKIP-W3-SENTRY-DSN · Wave 3 · Sentry/telemetry project DSN provisioning · CLASS-A

BLOCKED BY: Human-owned observability account/project decision, DSN provisioning, and provider secret-store action.

GATED AT: `config/runtime/production-safety-preflight.json` requires `RUNTIME_TELEMETRY_READY=true` before any shared-env apply, and `docs/runbooks/foundation-wave3-shared-env-apply.md` records `SKIP-DEPLOY` apply/verify/rollback steps for the human operator. Codex did not configure live telemetry or fake a DSN.

TO RESUME: Provision the approved Sentry or telemetry provider project, place the DSN in the target provider secret store, prove redaction and request correlation in non-production, then set `RUNTIME_TELEMETRY_READY=true` only after evidence is attached.

## SKIP-W3-DNS-CUTOVER · Wave 3 · Public .store DNS and custom-hostname cutover · CLASS-A

BLOCKED BY: Human-owned Cloudflare/Vercel DNS credentials, domain ownership approval, and live custom-hostname cutover authority.

GATED AT: public URL helpers default to `letbuyy.store` without performing DNS mutation, and `docs/runbooks/foundation-wave3-shared-env-apply.md` records `SKIP-DEPLOY` DNS/custom-hostname apply, verify, and rollback steps. Codex did not mutate Cloudflare, Vercel, or registrar state.

TO RESUME: Verify zone ownership and target records, run the human DNS/custom-hostname apply in the approved provider consoles or IaC path, confirm TLS and takeover-prevention checks, then attach rollback evidence before promoting traffic.

## SKIP-W4-LIVE-SECRET-ROTATION · Wave 4 · Live internal/TOTP/session secret rotation · CLASS-A

BLOCKED BY: Human-owned Vercel/Cloudflare/Supabase secret stores, live session invalidation policy, and operator approval for shared-env rotation.

GATED AT: code now supports dedicated `LETBUYY_INTERNAL_API_SECRET`, previous-secret dual accept, dedicated `TOTP_ENCRYPTION_KEY`, JTI replay protection, session rotation/revocation, and `scripts/foundation/production-safety-preflight.mjs` requires Wave 4 shared-env values before any shared apply. Codex did not mutate provider secrets or invalidate live sessions.

TO RESUME: Use `docs/runbooks/foundation-wave4-session-security-apply.md` in the approved operator shell, set new and previous secrets in the provider secret stores, verify dual-accept and session rotation in non-production, then remove previous secrets after the agreed TTL.

## SKIP-W4-MTLS-CF-ACCESS · Wave 4 · mTLS or Cloudflare Access internal perimeter · CLASS-A

BLOCKED BY: Human-owned Cloudflare Access/mTLS configuration, certificate issuance, DNS/provider credentials, and live ingress policy authority.

GATED AT: `services/api-gateway/src/middleware/internal-perimeter.ts` enforces a default production IP allowlist and internal credential presence for `/internal/*`; shared-env templates require `INTERNAL_GATEWAY_IP_ALLOWLIST`. Codex did not configure Cloudflare Access, mTLS, certificates, or provider network policy.

TO RESUME: Configure the approved Cloudflare Access or mTLS policy, set the internal gateway allowlist to the verified ingress ranges, run perimeter probes from allowed and denied sources, and attach rollback evidence before shared traffic promotion.

## SKIP-W5-TOKEN-MIGRATION-PRODUCT-CALL · Wave 5 · Marketing/mobile token migration and Dart theme-file retirement · CLASS-A

BLOCKED BY: Product-owned design migration decision for the exiled marketing-site token system and the active Flutter theme hub retirement plan. The five legacy Dart theme files under `apps/mobile/merchant-app/lib/theme/` are still imported across the merchant app, so deleting them without a product migration would be broad UI behavior work rather than foundation enforcement.

GATED AT: `scripts/validators/validate-design-system.mjs` excludes `apps/marketing-site` from the scored themable-surface baseline, fails any increase in scored raw hex/inline-style/arbitrary-radius drift, and hard-fails local workspace shell implementations. `scripts/generators/generate-mobile-tokens.mjs --check` remains green and is wired through `scripts/validators/mobile-token-validator.mjs` in the governance gate.

TO RESUME: Approve a product migration for marketing-site tokens and Flutter theme accessors, replace legacy Dart imports with generated-token-backed theme APIs using the quarantine protocol, run Flutter visual/regression checks, then lower the Wave 5 ratchet baseline after verified deletion.

## SKIP-W6-LIQUID-PRODUCT-DECISION · Wave 6 · Liquid rendering and app-block runtime enablement · CLASS-A

BLOCKED BY: Product/security approval for Liquid rendering semantics, app-block runtime support, sandbox policy, and merchant-facing compatibility promises. The foundation can validate saved theme sections and render fallbacks, but it cannot honestly enable a template language/runtime without an approved product and security decision.

GATED AT: `packages/theme-engine/src/theme-governance.ts` keeps `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` false by default, and `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` resolves Liquid bundles only when an explicit runtime option enables them. Unknown or unapproved section types are audited through the renderer registry and render a fallback placeholder rather than disappearing.

TO RESUME: Approve the Liquid/app-block product scope, sandbox and migration policy, enable the runtime explicitly in a non-production storefront path, run renderer/schema migration tests against saved stores, then record apply/verify/rollback evidence before allowing shared traffic.

## SKIP-W7-MOBILE-TURNSTILE-SECRET · Wave 7 · Mobile Cloudflare Turnstile secret provisioning · CLASS-A

BLOCKED BY: Human-owned Cloudflare Turnstile project/site-secret provisioning and provider secret-store mutation for the mobile BFF worker.

GATED AT: `services/mobile-bff/src/index.ts` verifies mobile Turnstile tokens through Cloudflare siteverify only when `TURNSTILE_SECRET_KEY` is configured; unset or `SKIP_NEEDS_HUMAN_*` values fail closed with `TURNSTILE_NOT_CONFIGURED`. `services/mobile-bff/wrangler.toml` and `config/env/templates/worker.env.example` document the secret as human-owned. Codex did not provision or rotate provider secrets.

TO RESUME: Create the approved mobile Turnstile site in Cloudflare, store the secret in the target Worker environment with `wrangler secret put TURNSTILE_SECRET_KEY`, run a non-production mobile login challenge against the BFF verifier, and attach apply/verify/rollback evidence before enabling production mobile login traffic.

## SKIP-W7-WHATSAPP-LIVE-CREDS · Wave 7 · Live WhatsApp/Twilio COD lifecycle credentials · CLASS-A

BLOCKED BY: Human-owned WABA/BSP or Twilio WhatsApp credentials, approved HSM templates, webhook secret setup, and provider compliance approval.

GATED AT: COD confirmation requests use the honest `letbuyy_sandbox` provider and `mode: 'sandbox'`; live WhatsApp rails remain gated by the existing `HR-WHATSAPP-LIVE` marker and the worker env template keeps Twilio credentials as `SKIP_NEEDS_HUMAN_*`. Codex did not send live WhatsApp traffic or configure provider credentials.

TO RESUME: Provision approved WABA/BSP or Twilio credentials, configure templates and webhook secret in a non-production Worker environment, run COD confirmation and order lifecycle notification probes with provider evidence, then record apply/verify/rollback steps before enabling live WhatsApp delivery.
