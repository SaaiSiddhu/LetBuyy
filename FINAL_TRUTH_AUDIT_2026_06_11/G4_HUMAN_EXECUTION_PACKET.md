# G4 Human Execution Packet

This packet is the exact human-owned G4 handoff. Codex must not execute these protected actions: remote branch promotion, GitHub branch-protection mutation, provider secret provisioning, production migration/deploy approval, DNS mutation, or live smoke attestation.

## 1. Local preflight

Run from `/Users/saai_sidd/Git/Letbuyy_Store` on the reviewed tree:

```bash
git status --short
git rev-parse --short HEAD
git rev-list --count main..stepup/main
CI=true pnpm install --frozen-lockfile
node --test tests/operations/production-deploy-workflow.test.mjs
node scripts/validators/deployment-safety-validator.mjs
node scripts/validate-governance.mjs --lane=gate
git diff --check
```

Required results: clean status, local branch lag `0`, workflow test pass, deployment-safety validator pass, governance gate pass.

## 2. Protected remote convergence

Push the converged refs in branch-lag-safe order:

```bash
git push origin refs/heads/stepup/main:refs/heads/stepup/main
git push origin refs/heads/main:refs/heads/main
```

Neutralize stale `develop` by deleting it or repointing it to the promoted commit:

```bash
git push origin --delete develop
# or:
git push origin refs/heads/main:refs/heads/develop
```

Verify:

```bash
git ls-remote origin refs/heads/main refs/heads/stepup/main refs/heads/develop
```

Required result: `origin/main` and `origin/stepup/main` resolve to the same promoted commit; `origin/develop` is absent or intentionally equal.

## 3. GitHub protection and required checks

Before production promotion, configure protected `main` so the production deploy `governance-gate`, required release gate, and production smoke result cannot be bypassed. Record the branch-protection snapshot in the operations control plane.

## 4. A4 secret scope

Provision only the production release secrets required for reality promotion. The A4 atom intentionally excludes live provider-money secrets so schema rollback remains clean before B6.

Required A4 release secrets include:

```text
SUPABASE_ACCESS_TOKEN
PRODUCTION_DB_CONNECTION_STRING
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
VERCEL_TOKEN
PRODUCTION_SUPABASE_URL
PRODUCTION_SUPABASE_ANON_KEY
PRODUCTION_SUPABASE_SERVICE_ROLE_KEY
PRODUCTION_AUTH_SECRET
PRODUCTION_CSRF_SECRET
PRODUCTION_CUSTOMER_SESSION_SECRET
PRODUCTION_IDENTITY_PRIVATE_JWK
PRODUCTION_IDENTITY_PUBLIC_JWKS
PRODUCTION_CHECKOUT_SIGNING_SECRET
PRODUCTION_TURNSTILE_SECRET_KEY
PRODUCTION_INTERNAL_API_SECRET
PRODUCTION_QUEUE_TENANT_ENVELOPE_SECRET
PRODUCTION_PLATFORM_CONSOLE_API_TOKEN
PRODUCTION_UPSTASH_REDIS_REST_URL
PRODUCTION_UPSTASH_REDIS_REST_TOKEN
PRODUCTION_RESEND_API_KEY
PRODUCTION_PAYMENT_CONFIG_ENCRYPTION_KEY
PRODUCTION_TURNSTILE_SITE_KEY
VERCEL_ORG_ID
PRODUCTION_MARKETING_PROJECT_ID
PRODUCTION_IDENTITY_PROJECT_ID
PRODUCTION_MERCHANT_PROJECT_ID
PRODUCTION_STOREFRONT_PROJECT_ID
PRODUCTION_PLATFORM_CONSOLE_PROJECT_ID
PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE
STAGING_E2E_IDENTITY_EMAIL
STAGING_E2E_IDENTITY_PASSWORD
PRODUCTION_E2E_IDENTITY_EMAIL
PRODUCTION_E2E_IDENTITY_PASSWORD
```

Do not provision `PRODUCTION_RAZORPAY_*`, `PRODUCTION_STRIPE_*`, Razorpay Route, Cashfree, payout, or AI-credit purchase provider credentials as part of A4. Those remain later money/capability seams.

## 5. Production workflow execution

Run the gated deploy from the promoted `main`:

```bash
gh workflow run production-deploy.yml --ref main
gh run watch
```

The workflow must pass, in order: branch-lag guard, governance gate, release credential preflight, migration preflight, staging E2E, encrypted production backup, untracked migration rejection, production migrations, Worker deploys, app deploys, required-job success gate, and production smoke.

If using the rollout workflow for a controlled execution path, use the real workflow inputs:

```bash
gh workflow run production-rollout.yml --ref main -f environment=production -f target=all -f execute=true
gh run watch
```

## 6. DNS and host attachment

After deploy artifacts are known-good, reconcile and apply DNS for `*.letbuyy.com`, including `checkout.letbuyy.com`, through the approved Cloudflare/Vercel owners. Record live resolution and host-attachment evidence.

## 7. G4 evidence to record

G4 is green only when all evidence exists:

- `origin/main == origin/stepup/main == promoted commit`.
- Production workflow run URL and all required jobs succeeded.
- Encrypted pre-migration backup artifact hash exists.
- Production migrations through `167` applied in order.
- `accounts.letbuyy.com` merchant login issues an identity-signed session.
- `/api/auth/switch` denies an unproven cross-account switch.
- Anonymous `orders` access is denied after migration `163`.
- Commission reads `0`.
- No subsystem with `..._MODE="live"` returns a fabricated success.
- Branch-lag monitor has a first successful scheduled or dispatched run.

If any item fails, stop the promotion, record the failed evidence, and use the rollback report before attempting B or C.
