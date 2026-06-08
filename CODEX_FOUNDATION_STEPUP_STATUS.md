# LetBuyy Foundation Step-Up - Status

## Mission Parameters (locked)

1. Domain launch target is `.com`. `letbuyy.com` is the committed canonical default for SEO, canonical, display, and launch-safe surfaces. Realm-sensitive values remain env-driven and flip atomically during the human deploy.
2. Launch market is India/non-EU first. GDPR export/erasure code exists; EU legal sign-off and EU-only controls are human-gated.
3. Scope was P0, P1, and P2 across Workstreams A-F.
4. Execution was code-only. Protected DB applies, secrets, DNS, provider config, app-store submission, and deploys are not run here.
5. Money model is storefront `numeric(_,2)` and platform billing integer minor units. `orders` storefront money columns are widened to `numeric(12,2)`.
6. `CUSTOMER_LEGACY_AUTH` was investigated and deleted as a body-trusted bypass. First-party storefront server flows use signed internal calls and customer sessions instead.
7. Branch/PR target was a new branch from `develop`; dirty-tree collision blocked isolation, so this run stayed on `stream/letbuyy-ui-v2` and branch/PR is human-gated below.

## Current Phase

- Branch: `stream/letbuyy-ui-v2`.
- Isolation status: skipped. The worktree already contained substantial unrelated dirty/untracked work, so no branch switch, stash, reset, or force checkout was performed.
- Code phase: complete for A-F, with live DB/secret/DNS/deploy actions deferred to `SKIP_NEEDS_HUMAN`.
- Dependency note: `pnpm install` was needed once to restore workspace symlinks after generated-artifact cleanup; it required network because the local pnpm store was missing `jose-6.1.3`. Generated workspace artifacts were removed again before final governance.

## Gate State

Final gate results:

- `pnpm turbo typecheck`: PASS, 59/59 tasks.
- `cd services/api-gateway && npx tsc --noEmit`: PASS.
- `pnpm lint`: PASS, warnings only from existing UI lint rules.
- `pnpm run test:unit:gateway`: PASS, 47/47 tests. Reran with escalation because `tsx` needs a local IPC pipe.
- `pnpm run test:behavioral`: PASS, 467/467 tests. Reran with escalation for local test IPC.
- `pnpm run test:contracts`: PASS, 194/194 tests. Reran with escalation for local test IPC.
- `pnpm turbo test`: PASS, 67/67 tasks. Reran with escalation for workspace test IPC.
- `flutter analyze apps/mobile/merchant-app`: PASS, no issues found.
- `flutter test apps/mobile/merchant-app`: PASS, 74/74 tests. Reran with escalation because Flutter writes SDK/cache artifacts outside the workspace.
- `pnpm run validate:governance`: PASS, 172 validators, after generated artifacts were cleaned.

New real safety gates:

- Gateway unit test command wired: `test:unit:gateway` runs `services/api-gateway/src/__tests__/*.test.ts`.
- Full-repo CI merge gate added: unfiltered `pnpm turbo typecheck`, `test:unit:gateway`, `test:behavioral`, and `test:contracts`.
- Route ownership validator: PASS, AST/structural route ownership gate wired into governance.
- Platform domain literal validator: PASS, functional `.store` literals guarded by env/resolvers.
- Cycle budget validator: PASS, current budget `3/3` file-level cycle components.
- API client runtime base validator: PASS, browser storefront calls stay same-origin and path normalization is shared.
- Raw public error sanitizer: PASS, `ANALYTICS_QUEUE_ERROR` is sanitized.

Validator reality:

- `docs/governance/validator-reality.md` records that readiness is no longer represented by raw validator count. Current readiness signal is full-repo typecheck, real gateway tests, behavioral/contracts tests, route ownership, platform-domain literal gate, cycle budget, and final governance.

## Cutover Runbook

1. Add `letbuyy.com` to Cloudflare and capture the zone id:
   `curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data "{\"account\":{\"id\":\"$CLOUDFLARE_ACCOUNT_ID\"},\"name\":\"letbuyy.com\",\"type\":\"full\"}"`
2. Move registrar nameservers to the Cloudflare-assigned nameservers from step 1. Human registrar console action; verify with:
   `dig NS letbuyy.com +short`
3. Plan and apply DNS records for the `.com` zone after inserting the zone id:
   `terraform -chdir=infrastructure/dns plan -var="letbuyy_com_zone_id=$CLOUDFLARE_LETBUYY_COM_ZONE_ID"`
   `terraform -chdir=infrastructure/dns apply -var="letbuyy_com_zone_id=$CLOUDFLARE_LETBUYY_COM_ZONE_ID"`
4. Attach Vercel hosts and wildcard hosts:
   `npx vercel domains add letbuyy.com --scope "$VERCEL_TEAM_SLUG"`
   `npx vercel domains add accounts.letbuyy.com --scope "$VERCEL_TEAM_SLUG"`
   `npx vercel domains add merchant.letbuyy.com --scope "$VERCEL_TEAM_SLUG"`
   `npx vercel domains add storefront.letbuyy.com --scope "$VERCEL_TEAM_SLUG"`
   `npx vercel domains add "*.letbuyy.com" --scope "$VERCEL_TEAM_SLUG"`
5. Provision Worker secrets for `.com` production before deploy:
   `printf '%s' "$INTERNAL_API_SECRET" | npx wrangler secret put INTERNAL_API_SECRET --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$AUTH_SECRET" | npx wrangler secret put AUTH_SECRET --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY --config services/queue-workers/wrangler.toml --env production`
6. Flip realm envs in the same release:
   `printf 'letbuyy.com' | npx vercel env add LETBUYY_PLATFORM_DOMAIN production --scope "$VERCEL_TEAM_SLUG"`
   `printf 'letbuyy.com' | npx vercel env add NEXT_PUBLIC_PLATFORM_DOMAIN production --scope "$VERCEL_TEAM_SLUG"`
   `printf '.letbuyy.com' | npx vercel env add COOKIE_DOMAIN production --scope "$VERCEL_TEAM_SLUG"`
   `printf 'https://accounts.letbuyy.com,https://merchant.letbuyy.com,https://console.letbuyy.com,https://operations.letbuyy.com' | npx vercel env add CORS_CREDENTIAL_ORIGINS production --scope "$VERCEL_TEAM_SLUG"`
7. Deploy Workers after secrets and route config are in place:
   `npx wrangler deploy --config services/api-gateway/wrangler.toml --env production`
   `npx wrangler deploy --config services/mobile-bff/wrangler.toml --env production`
   `npx wrangler deploy --config services/webhook-service/wrangler.toml --env production`
   `npx wrangler deploy --config services/queue-workers/wrangler.toml --env production`
8. Deploy Vercel apps with the same realm release:
   `npx vercel deploy --prod --scope "$VERCEL_TEAM_SLUG"`
9. Verify `.com` SSO, storefront, and checkout:
   `curl -fsS https://accounts.letbuyy.com`
   `curl -fsS https://api.letbuyy.com/v1/health`
   `curl -fsS https://storefront.letbuyy.com`
10. Add `.store` to `.com` 301 redirects only after `.com` health and checkout verification:
    `terraform -chdir=infrastructure/dns apply -var="redirect_letbuyy_store_to_com=true" -var="letbuyy_com_zone_id=$CLOUDFLARE_LETBUYY_COM_ZONE_ID"`
11. Build and submit the `.com` mobile release:
    `flutter build appbundle --release --dart-define=LETBUYY_API_BASE_URL=https://api.letbuyy.com/v1 --dart-define=LETBUYY_ACCOUNTS_URL=https://accounts.letbuyy.com --dart-define=LETBUYY_MERCHANT_URL=https://merchant.letbuyy.com -t apps/mobile/merchant-app/lib/main.dart`

## SKIPPED - NEEDS HUMAN

1. Apply protected Supabase migrations `107` through `111` to staging:
   `supabase db push --db-url "$SUPABASE_STAGING_DB_URL"`
2. Apply protected Supabase migrations `107` through `111` to production after staging verification:
   `supabase db push --db-url "$SUPABASE_PRODUCTION_DB_URL"`
3. Rotate Supabase anon key if pre-107 exposure is confirmed:
   `supabase projects api-keys rotate --project-ref "$SUPABASE_PROJECT_REF" --key anon`
4. Provision API gateway secrets:
   `printf '%s' "$INTERNAL_API_SECRET" | npx wrangler secret put INTERNAL_API_SECRET --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$AUTH_SECRET" | npx wrangler secret put AUTH_SECRET --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$RAZORPAY_KEY_ID" | npx wrangler secret put RAZORPAY_KEY_ID --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$RAZORPAY_KEY_SECRET" | npx wrangler secret put RAZORPAY_KEY_SECRET --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$STRIPE_SECRET_KEY" | npx wrangler secret put STRIPE_SECRET_KEY --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$UPSTASH_REDIS_REST_URL" | npx wrangler secret put UPSTASH_REDIS_REST_URL --config services/api-gateway/wrangler.toml --env production`
   `printf '%s' "$UPSTASH_REDIS_REST_TOKEN" | npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --config services/api-gateway/wrangler.toml --env production`
5. Provision mobile-bff internal secret:
   `printf '%s' "$INTERNAL_API_SECRET" | npx wrangler secret put INTERNAL_API_SECRET --config services/mobile-bff/wrangler.toml --env production`
6. Provision webhook-service secrets:
   `printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config services/webhook-service/wrangler.toml --env production`
   `printf '%s' "$RAZORPAY_WEBHOOK_SECRET" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET --config services/webhook-service/wrangler.toml --env production`
   `printf '%s' "$STRIPE_WEBHOOK_SECRET" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --config services/webhook-service/wrangler.toml --env production`
7. Provision queue-workers email/push/cache secrets:
   `printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY --config services/queue-workers/wrangler.toml --env production`
   `printf '%s' "$FCM_SERVER_KEY" | npx wrangler secret put FCM_SERVER_KEY --config services/queue-workers/wrangler.toml --env production`
   `printf '%s' "$APNS_KEY_ID" | npx wrangler secret put APNS_KEY_ID --config services/queue-workers/wrangler.toml --env production`
   `printf '%s' "$APNS_TEAM_ID" | npx wrangler secret put APNS_TEAM_ID --config services/queue-workers/wrangler.toml --env production`
   `printf '%s' "$APNS_PRIVATE_KEY" | npx wrangler secret put APNS_PRIVATE_KEY --config services/queue-workers/wrangler.toml --env production`
   `printf '%s' "$UPSTASH_REDIS_REST_URL" | npx wrangler secret put UPSTASH_REDIS_REST_URL --config services/queue-workers/wrangler.toml --env production`
   `printf '%s' "$UPSTASH_REDIS_REST_TOKEN" | npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --config services/queue-workers/wrangler.toml --env production`
8. Execute the `.com` DNS, cert, Vercel, Worker-route, env, verification, and `.store` redirect runbook in the order above.
9. Submit the `.com` mobile build to app stores:
   `flutter build appbundle --release --dart-define=LETBUYY_API_BASE_URL=https://api.letbuyy.com/v1 --dart-define=LETBUYY_ACCOUNTS_URL=https://accounts.letbuyy.com --dart-define=LETBUYY_MERCHANT_URL=https://merchant.letbuyy.com -t apps/mobile/merchant-app/lib/main.dart`
10. EU GDPR legal sign-off and EU-only consent/control activation:
    `gh issue create --title "Legal sign-off: GDPR export/erasure EU controls" --body "Review implemented customer export/erasure endpoints, retention model, and EU-only UX controls before EU launch."`
11. Retire relational/JSONB reconciliation scheduler after human queue/cron deploy:
    `npx wrangler deploy --config services/queue-workers/wrangler.toml --env production`
12. Create isolated branch and PR after preserving current dirty work:
    `git diff > /tmp/letbuyy-foundation-stepup.patch`
    `git fetch origin develop`
    `git switch -c codex/foundation-stepup origin/develop`
    `git apply /tmp/letbuyy-foundation-stepup.patch`
    `git add CODEX_FOUNDATION_STEPUP_STATUS.md CODEX_FOUNDATION_STEPUP_LEDGER.md .github/workflows/ci.yml apps services packages config database docs scripts tests`
    `git commit -m "fix(foundation): harden launch readiness"`
    `gh pr create --base develop --head codex/foundation-stepup --title "fix(foundation): harden launch readiness" --body-file CODEX_FOUNDATION_STEPUP_STATUS.md`
