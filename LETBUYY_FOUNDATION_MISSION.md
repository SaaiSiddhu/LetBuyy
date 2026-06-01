# LETBUYY — FOUNDATION SETUP MISSION
> Single agent. `/goal` mode. Non-stop until every phase is complete and green.
> Domain: `letbuyy.store` | Cloudflare Account: `c399939d2521d1b4bc581112b6c6c57f`

---

## PRIME DIRECTIVE

You are a senior platform engineer. Your mission is to transform LetBuyy's codebase into a
production-grade SaaS with a world-class CI/CD pipeline, proper branch strategy, and complete
GitHub Actions automation — exactly how a billion-dollar company would run it.

**This is the FOUNDATION phase. Get this right and everything else builds on top of it.**

If any step requires human credentials or manual approval that you cannot automate, mark it
clearly in `FOUNDATION_STATUS.md` as `[SKIP — NEEDS HUMAN]` and continue immediately.
Do NOT stop. Do NOT wait. Keep moving to the next task.

---

## READ THESE FILES FIRST (mandatory before touching anything)

```
AGENTS.md
memory/lessons.md
tasks/todo.md
LETBUYY_STATE.md
```

---

## PHASE 0 — ENVIRONMENT AUDIT (30 min)

### Task 0.1 — Verify current state
```bash
git status
git branch -a
git log --oneline -10
pnpm --version
node --version
ls -la .github/workflows/ 2>/dev/null || echo "No workflows yet"
```

### Task 0.2 — Run current validation (document what's failing)
```bash
pnpm run typecheck 2>&1 | tail -30 || true
pnpm run validate:governance 2>&1 | tail -20 || true
```

Write findings to `FOUNDATION_STATUS.md`. Do not fix yet — just document.

### Task 0.3 — Map the domain architecture
Document in `FOUNDATION_STATUS.md`:
```
letbuyy.store          → apps/marketing-site
admin.letbuyy.store    → apps/merchant-control-plane
accounts.letbuyy.store → apps/identity-platform
themes.letbuyy.store   → apps/theme-marketplace
apps.letbuyy.store     → apps/app-marketplace
[workers]              → services/api-gateway (api.letbuyy.store)
[workers]              → services/webhook-service (webhooks.letbuyy.store)
[workers]              → services/queue-workers (internal)
```

---

## PHASE 1 — FIX TYPECHECK AND GOVERNANCE (must be green before anything else)

### Task 1.1 — Fix @cloudflare/workers-types resolution

The error is in `services/webhook-service` and `services/queue-workers`.
These packages cannot resolve `@cloudflare/workers-types`.

Check `tsconfig.json` in each service:
```bash
cat services/webhook-service/tsconfig.json
cat services/queue-workers/tsconfig.json
cat services/api-gateway/tsconfig.json
```

Fix: ensure each worker service has in its `tsconfig.json`:
```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "lib": ["ES2022"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

AND in each worker `package.json`:
```json
{
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260524.1"
  }
}
```

After fixing: `pnpm --filter @letbuyy/webhook-service typecheck`
After fixing: `pnpm --filter @letbuyy/queue-workers typecheck`

### Task 1.2 — Fix governance stale artifacts

The governance validator fails because of stale `.turbo`, `dist`, and Flutter `build` artifacts.

Option A: Add to `.gitignore` and clean:
```bash
# Add to root .gitignore if not already there:
.turbo/
apps/*/dist/
services/*/dist/
packages/*/dist/
mobile/*/build/
*.tsbuildinfo
```

Option B: If `validate:governance` checks for specific generated files, regenerate them:
```bash
node scripts/generate-repository-intelligence.mjs 2>/dev/null || true
```

Run validation after: `pnpm run validate:governance`

### Task 1.3 — Run full typecheck, record results
```bash
pnpm turbo typecheck 2>&1 | tee /tmp/typecheck-output.txt
grep -E "error TS|Found [0-9]+ error" /tmp/typecheck-output.txt | head -20
```

Write a summary of remaining errors (if any) to `FOUNDATION_STATUS.md`.
If all errors are in non-critical paths that don't block CI, note which ones can be bypassed.

---

## PHASE 2 — BRANCH STRATEGY SETUP

### Task 2.1 — Clean old worktree branches locally

```bash
# List all branches
git branch -a

# Delete old codex worktree branches locally (DO NOT delete main)
git branch -d codex/worktree-purification 2>/dev/null || true
git branch -D codex/worktree-purification 2>/dev/null || true
```

[SKIP — NEEDS HUMAN] Delete remote branches — run this yourself:
```bash
git push origin --delete codex/worktree-purification
git push origin --delete backup-worktree-snapshot-20260524...  # (full name)
```

### Task 2.2 — Create develop branch off current main

```bash
# Ensure we're on main and up to date
git checkout main
git pull origin main

# Create develop branch
git checkout -b develop
git push -u origin develop
echo "develop branch created and pushed"
```

### Task 2.3 — Create branch protection documentation

Create file `.github/BRANCH_STRATEGY.md`:

```markdown
# LetBuyy Branch Strategy

## Branches
- `main` — production. Protected. No direct push. PR from develop only.
- `develop` — staging. Protected. No direct push. PR from feature/* branches.
- `feature/*` — short-lived. Branch off develop. Merge back to develop via PR.
- `hotfix/*` — branch off main. PR to main AND back-port PR to develop.

## Rules
- Every PR to `develop` or `main` must pass all CI gates before merge.
- PRs to `main` require: all CI gates + E2E on staging + 1 approver.
- Squash merge only on `main`. Merge commits allowed on `develop`.
- Never push directly to `main` or `develop`.

## GitHub Branch Protection Settings (configure manually in GitHub UI)
### For `develop`:
- [x] Require a pull request before merging
- [x] Require status checks to pass before merging
  - Required checks: `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

### For `main`:
- [x] Require a pull request before merging
- [x] Require at least 1 approving review
- [x] Require status checks to pass before merging
  - Required checks: `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`, `staging-e2e / playwright`
- [x] Require branches to be up to date before merging
- [x] Restrict who can push to matching branches (add your GitHub username)
- [x] Do not allow bypassing the above settings
```

---

## PHASE 3 — ENVIRONMENT VARIABLE TEMPLATES

### Task 3.1 — Create staging env template

Create `config/env/staging.env.template` with every variable needed for staging:

```bash
cat > config/env/staging.env.template << 'EOF'
# LetBuyy Staging Environment Variables
# Copy to .env.staging.local and fill in values
# NEVER commit actual values — this is a template only

# ========== SUPABASE (Letbuyy-Store-Staging) ==========
NEXT_PUBLIC_SUPABASE_URL=https://[STAGING_PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[STAGING_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[STAGING_SERVICE_ROLE_KEY]
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# ========== UPSTASH REDIS (Letbuyy-Store-Staging) ==========
UPSTASH_REDIS_REST_URL=https://[STAGING_REDIS_HOST].upstash.io
UPSTASH_REDIS_REST_TOKEN=[STAGING_REDIS_TOKEN]

# ========== CLOUDFLARE ==========
CLOUDFLARE_API_TOKEN=[CF_API_TOKEN]
CLOUDFLARE_ACCOUNT_ID=c399939d2521d1b4bc581112b6c6c57f

# ========== RAZORPAY TEST MODE ==========
RAZORPAY_KEY_ID=rzp_test_[KEY]
RAZORPAY_KEY_SECRET=[TEST_SECRET]
RAZORPAY_WEBHOOK_SECRET=[TEST_WEBHOOK_SECRET]

# ========== STRIPE TEST MODE ==========
STRIPE_SECRET_KEY=sk_test_[KEY]
STRIPE_WEBHOOK_SECRET=whsec_[TEST_WEBHOOK_SECRET]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_[KEY]

# ========== PAYPAL SANDBOX ==========
PAYPAL_CLIENT_ID=[SANDBOX_CLIENT_ID]
PAYPAL_CLIENT_SECRET=[SANDBOX_SECRET]
PAYPAL_WEBHOOK_ID=[SANDBOX_WEBHOOK_ID]

# ========== RESEND (EMAIL) ==========
RESEND_API_KEY=re_[STAGING_KEY]
EMAIL_FROM=noreply@staging.letbuyy.store

# ========== CLOUDFLARE TURNSTILE ==========
NEXT_PUBLIC_TURNSTILE_SITE_KEY=[STAGING_SITE_KEY]
TURNSTILE_SECRET_KEY=[STAGING_SECRET_KEY]

# ========== SESSION / AUTH SECRETS ==========
SESSION_SECRET=[64_char_random_hex]
COOKIE_DOMAIN=.staging.letbuyy.store
ADMIN_ORIGIN=https://admin.staging.letbuyy.store

# ========== INTERNAL SERVICE AUTH ==========
INTERNAL_API_SECRET=[32_char_random_hex]
WORKER_INTERNAL_SECRET=[32_char_random_hex]

# ========== APP URLS (STAGING) ==========
NEXT_PUBLIC_APP_URL=https://staging.letbuyy.store
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.staging.letbuyy.store
NEXT_PUBLIC_ADMIN_URL=https://admin.staging.letbuyy.store
NEXT_PUBLIC_API_URL=https://api.staging.letbuyy.store
WORKER_API_BASE_URL=https://api.staging.letbuyy.store

# ========== ENVIRONMENT LABEL ==========
NODE_ENV=production
NEXT_PUBLIC_ENV=staging
EOF
```

### Task 3.2 — Create production env template

Create `config/env/production.env.template`:

```bash
cat > config/env/production.env.template << 'EOF'
# LetBuyy Production Environment Variables
# NEVER commit actual values — use GitHub Secrets + Vercel/Cloudflare dashboards

# ========== SUPABASE (Letbuyy-Store-Production) ==========
NEXT_PUBLIC_SUPABASE_URL=https://qtrzgnnqnvboifoqntfi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[PROD_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[PROD_SERVICE_ROLE_KEY]
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# ========== UPSTASH REDIS (Leetbuyy-Store-Production) ==========
UPSTASH_REDIS_REST_URL=https://[PROD_REDIS_HOST].upstash.io
UPSTASH_REDIS_REST_TOKEN=[PROD_REDIS_TOKEN]

# ========== CLOUDFLARE ==========
CLOUDFLARE_API_TOKEN=[CF_API_TOKEN]
CLOUDFLARE_ACCOUNT_ID=c399939d2521d1b4bc581112b6c6c57f

# ========== RAZORPAY LIVE MODE ==========
RAZORPAY_KEY_ID=rzp_live_[KEY]
RAZORPAY_KEY_SECRET=[LIVE_SECRET]
RAZORPAY_WEBHOOK_SECRET=[LIVE_WEBHOOK_SECRET]

# ========== STRIPE LIVE MODE ==========
STRIPE_SECRET_KEY=sk_live_[KEY]
STRIPE_WEBHOOK_SECRET=whsec_[LIVE_WEBHOOK_SECRET]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_[KEY]

# ========== PAYPAL LIVE ==========
PAYPAL_CLIENT_ID=[LIVE_CLIENT_ID]
PAYPAL_CLIENT_SECRET=[LIVE_SECRET]
PAYPAL_WEBHOOK_ID=[LIVE_WEBHOOK_ID]

# ========== RESEND (EMAIL) ==========
RESEND_API_KEY=re_[PROD_KEY]
EMAIL_FROM=noreply@letbuyy.store

# ========== CLOUDFLARE TURNSTILE ==========
NEXT_PUBLIC_TURNSTILE_SITE_KEY=[PROD_SITE_KEY]
TURNSTILE_SECRET_KEY=[PROD_SECRET_KEY]

# ========== SESSION / AUTH SECRETS ==========
SESSION_SECRET=[64_char_random_hex_DIFFERENT_FROM_STAGING]
COOKIE_DOMAIN=.letbuyy.store
ADMIN_ORIGIN=https://admin.letbuyy.store

# ========== INTERNAL SERVICE AUTH ==========
INTERNAL_API_SECRET=[32_char_random_hex_DIFFERENT_FROM_STAGING]
WORKER_INTERNAL_SECRET=[32_char_random_hex_DIFFERENT_FROM_STAGING]

# ========== APP URLS (PRODUCTION) ==========
NEXT_PUBLIC_APP_URL=https://letbuyy.store
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.store
NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store
NEXT_PUBLIC_API_URL=https://api.letbuyy.store
WORKER_API_BASE_URL=https://api.letbuyy.store

# ========== ENVIRONMENT LABEL ==========
NODE_ENV=production
NEXT_PUBLIC_ENV=production
EOF
```

---

## PHASE 4 — WRANGLER CONFIGS (Staging + Production per worker)

### Task 4.1 — api-gateway wrangler.toml

Read existing: `cat services/api-gateway/wrangler.toml`

Ensure it has BOTH `[env.staging]` and `[env.production]` blocks. If they exist but have
placeholder IDs, that's fine — mark for human to fill. If blocks are missing, add them:

```toml
name = "letbuyy-api-gateway"
main = "src/index.ts"
compatibility_date = "2025-10-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "pnpm build"

# ========== STAGING ==========
[env.staging]
name = "letbuyy-api-gateway-staging"
routes = [{ pattern = "api.staging.letbuyy.store/*", custom_domain = true }]

[env.staging.vars]
NODE_ENV = "production"
NEXT_PUBLIC_ENV = "staging"
WORKER_ENV = "staging"

[[env.staging.kv_namespaces]]
binding = "SESSIONS_KV"
id = "[STAGING_KV_ID]"

[[env.staging.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "letbuyy-media-staging"

[[env.staging.queues.producers]]
binding = "MAIN_QUEUE"
queue = "letbuyy-main-queue-staging"

[[env.staging.queues.consumers]]
queue = "letbuyy-main-queue-staging"
max_batch_size = 10
max_retries = 3
dead_letter_queue = "letbuyy-dlq-staging"

[env.staging.durable_objects]
bindings = [{ name = "LETBUYY_RUNTIME", class_name = "LetbuyyRuntimeDurableObject" }]

[[env.staging.migrations]]
tag = "v1"
new_classes = ["LetbuyyRuntimeDurableObject"]

# ========== PRODUCTION ==========
[env.production]
name = "letbuyy-api-gateway"
routes = [{ pattern = "api.letbuyy.store/*", custom_domain = true }]

[env.production.vars]
NODE_ENV = "production"
NEXT_PUBLIC_ENV = "production"
WORKER_ENV = "production"

[[env.production.kv_namespaces]]
binding = "SESSIONS_KV"
id = "[PROD_KV_ID]"

[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "letbuyy-media-production"

[[env.production.queues.producers]]
binding = "MAIN_QUEUE"
queue = "letbuyy-main-queue-production"

[[env.production.queues.consumers]]
queue = "letbuyy-main-queue-production"
max_batch_size = 10
max_retries = 3
dead_letter_queue = "letbuyy-dlq-production"

[env.production.durable_objects]
bindings = [{ name = "LETBUYY_RUNTIME", class_name = "LetbuyyRuntimeDurableObject" }]

[[env.production.migrations]]
tag = "v1"
new_classes = ["LetbuyyRuntimeDurableObject"]
```

### Task 4.2 — webhook-service wrangler.toml

Read existing: `cat services/webhook-service/wrangler.toml`

Ensure staging and production blocks with routes:
- Staging: `webhooks.staging.letbuyy.store/*`
- Production: `webhooks.letbuyy.store/*`

### Task 4.3 — queue-workers wrangler.toml

Read existing: `cat services/queue-workers/wrangler.toml`

Ensure staging and production queue consumer bindings match the api-gateway queue names.

---

## PHASE 5 — GITHUB ACTIONS CI/CD WORKFLOWS

This is the most critical phase. Create 3 workflow files.

### Task 5.1 — Create `.github/workflows/ci.yml`

This runs on EVERY PR to develop or main. ALL jobs must pass or the PR is blocked.

```yaml
name: CI

on:
  pull_request:
    branches:
      - develop
      - main
  push:
    branches:
      - develop
      - main

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10.6.2'
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run typecheck
        run: pnpm turbo typecheck --filter="...[HEAD^1]"

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run lint
        run: pnpm turbo lint --filter="...[HEAD^1]"

  unit-tests:
    name: Unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm turbo test --filter="...[HEAD^1]"
        env:
          CI: true

  governance:
    name: Governance
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Validate governance
        run: pnpm run validate:governance

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all apps and packages
        run: pnpm turbo build --filter="...[HEAD^1]"
        env:
          # Dummy env values for build-time — real secrets only at deploy time
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder_anon_key
          NEXT_PUBLIC_APP_URL: https://letbuyy.store
          NEXT_PUBLIC_ACCOUNTS_URL: https://accounts.letbuyy.store
          NEXT_PUBLIC_ADMIN_URL: https://admin.letbuyy.store
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: placeholder
          NODE_ENV: production
```

### Task 5.2 — Create `.github/workflows/staging-deploy.yml`

This runs ONLY on merge to develop. Deploys to staging environment.

```yaml
name: Staging deploy

on:
  push:
    branches:
      - develop

concurrency:
  group: staging-deploy
  cancel-in-progress: false

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10.6.2'

jobs:
  migrate-staging:
    name: Migrate staging DB
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install Supabase CLI
        run: npm install -g supabase

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run migrations on staging DB
        run: |
          supabase db push \
            --db-url "${{ secrets.SUPABASE_DB_URL }}" \
            --include-all
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-workers-staging:
    name: Deploy workers to staging
    needs: migrate-staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build workers
        run: pnpm turbo build --filter="@letbuyy/api-gateway" --filter="@letbuyy/webhook-service" --filter="@letbuyy/queue-workers"

      - name: Deploy api-gateway to staging
        run: npx wrangler deploy --env staging
        working-directory: services/api-gateway
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Set api-gateway staging secrets
        run: |
          echo "${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
          echo "${{ secrets.UPSTASH_REDIS_REST_URL }}" | npx wrangler secret put UPSTASH_REDIS_REST_URL --env staging
          echo "${{ secrets.UPSTASH_REDIS_REST_TOKEN }}" | npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --env staging
          echo "${{ secrets.RAZORPAY_KEY_SECRET }}" | npx wrangler secret put RAZORPAY_KEY_SECRET --env staging
          echo "${{ secrets.RAZORPAY_WEBHOOK_SECRET }}" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET --env staging
          echo "${{ secrets.INTERNAL_API_SECRET }}" | npx wrangler secret put INTERNAL_API_SECRET --env staging
          echo "${{ secrets.SESSION_SECRET }}" | npx wrangler secret put SESSION_SECRET --env staging
        working-directory: services/api-gateway
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy webhook-service to staging
        run: npx wrangler deploy --env staging
        working-directory: services/webhook-service
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Set webhook-service staging secrets
        run: |
          echo "${{ secrets.RAZORPAY_WEBHOOK_SECRET }}" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET --env staging
          echo "${{ secrets.STRIPE_WEBHOOK_SECRET }}" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
        working-directory: services/webhook-service
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy queue-workers to staging
        run: npx wrangler deploy --env staging
        working-directory: services/queue-workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-apps-staging:
    name: Deploy Next apps to staging
    needs: deploy-workers-staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Deploy marketing-site to staging
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }} --scope ${{ secrets.VERCEL_ORG_ID }}
        working-directory: apps/marketing-site
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_MARKETING_PROJECT_ID }}
          NEXT_PUBLIC_APP_URL: https://staging.letbuyy.store
          NEXT_PUBLIC_ACCOUNTS_URL: https://accounts.staging.letbuyy.store
          NEXT_PUBLIC_API_URL: https://api.staging.letbuyy.store
          NODE_ENV: production

      - name: Deploy identity-platform to staging (accounts.staging.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/identity-platform
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_IDENTITY_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ secrets.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}
          NEXT_PUBLIC_APP_URL: https://staging.letbuyy.store
          NEXT_PUBLIC_ADMIN_URL: https://admin.staging.letbuyy.store
          NEXT_PUBLIC_API_URL: https://api.staging.letbuyy.store
          WORKER_API_BASE_URL: https://api.staging.letbuyy.store
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          COOKIE_DOMAIN: .staging.letbuyy.store
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}

      - name: Deploy merchant-control-plane to staging (admin.staging.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/merchant-control-plane
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_MERCHANT_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.staging.letbuyy.store
          NEXT_PUBLIC_ACCOUNTS_URL: https://accounts.staging.letbuyy.store
          WORKER_API_BASE_URL: https://api.staging.letbuyy.store
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          INTERNAL_API_SECRET: ${{ secrets.INTERNAL_API_SECRET }}

      - name: Deploy storefront-runtime to staging (*.staging.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/storefront-runtime
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_STOREFRONT_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.staging.letbuyy.store
          WORKER_API_BASE_URL: https://api.staging.letbuyy.store
          NEXT_PUBLIC_RAZORPAY_KEY_ID: ${{ secrets.RAZORPAY_KEY_ID }}

      - name: Deploy theme-marketplace to staging (themes.staging.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/theme-marketplace
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_THEMES_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.staging.letbuyy.store

      - name: Deploy app-marketplace to staging (apps.staging.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/app-marketplace
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_APPS_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.staging.letbuyy.store

  smoke-test-staging:
    name: Smoke test staging
    needs: deploy-apps-staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run smoke tests against staging
        run: npx playwright test --project=chromium tests/e2e/smoke/
        env:
          BASE_URL: https://staging.letbuyy.store
          ACCOUNTS_URL: https://accounts.staging.letbuyy.store
          ADMIN_URL: https://admin.staging.letbuyy.store
          API_URL: https://api.staging.letbuyy.store
          CI: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: staging-smoke-test-results
          path: playwright-report/
          retention-days: 7
```

### Task 5.3 — Create `.github/workflows/production-deploy.yml`

This runs ONLY on merge to main. Requires manual approval via GitHub Environment protection.

```yaml
name: Production deploy

on:
  push:
    branches:
      - main

concurrency:
  group: production-deploy
  cancel-in-progress: false

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10.6.2'

jobs:
  staging-e2e:
    name: E2E tests on staging (production gate)
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run full E2E suite against staging
        run: npx playwright test --project=chromium tests/e2e/
        env:
          BASE_URL: https://staging.letbuyy.store
          ACCOUNTS_URL: https://accounts.staging.letbuyy.store
          ADMIN_URL: https://admin.staging.letbuyy.store
          API_URL: https://api.staging.letbuyy.store
          CI: true

      - name: Upload E2E results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: production-gate-e2e-results
          path: playwright-report/
          retention-days: 14

  migrate-production:
    name: Migrate production DB
    needs: staging-e2e
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Install Supabase CLI
        run: npm install -g supabase

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run migrations on production DB
        run: |
          supabase db push \
            --db-url "${{ secrets.SUPABASE_DB_URL }}" \
            --include-all
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-workers-production:
    name: Deploy workers to production
    needs: migrate-production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build workers
        run: pnpm turbo build --filter="@letbuyy/api-gateway" --filter="@letbuyy/webhook-service" --filter="@letbuyy/queue-workers"

      - name: Deploy api-gateway to production
        run: npx wrangler deploy --env production
        working-directory: services/api-gateway
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Set api-gateway production secrets
        run: |
          echo "${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
          echo "${{ secrets.UPSTASH_REDIS_REST_URL }}" | npx wrangler secret put UPSTASH_REDIS_REST_URL --env production
          echo "${{ secrets.UPSTASH_REDIS_REST_TOKEN }}" | npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --env production
          echo "${{ secrets.RAZORPAY_KEY_SECRET }}" | npx wrangler secret put RAZORPAY_KEY_SECRET --env production
          echo "${{ secrets.RAZORPAY_WEBHOOK_SECRET }}" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production
          echo "${{ secrets.INTERNAL_API_SECRET }}" | npx wrangler secret put INTERNAL_API_SECRET --env production
          echo "${{ secrets.SESSION_SECRET }}" | npx wrangler secret put SESSION_SECRET --env production
        working-directory: services/api-gateway
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy webhook-service to production
        run: npx wrangler deploy --env production
        working-directory: services/webhook-service
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Set webhook-service production secrets
        run: |
          echo "${{ secrets.RAZORPAY_WEBHOOK_SECRET }}" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production
          echo "${{ secrets.STRIPE_WEBHOOK_SECRET }}" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
        working-directory: services/webhook-service
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy queue-workers to production
        run: npx wrangler deploy --env production
        working-directory: services/queue-workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-apps-production:
    name: Deploy Next apps to production
    needs: deploy-workers-production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Deploy marketing-site to production (letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/marketing-site
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_MARKETING_PROJECT_ID }}
          NEXT_PUBLIC_APP_URL: https://letbuyy.store
          NEXT_PUBLIC_ACCOUNTS_URL: https://accounts.letbuyy.store
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store
          NODE_ENV: production

      - name: Deploy identity-platform to production (accounts.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/identity-platform
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_IDENTITY_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ secrets.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}
          NEXT_PUBLIC_APP_URL: https://letbuyy.store
          NEXT_PUBLIC_ADMIN_URL: https://admin.letbuyy.store
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store
          WORKER_API_BASE_URL: https://api.letbuyy.store
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          COOKIE_DOMAIN: .letbuyy.store
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}

      - name: Deploy merchant-control-plane to production (admin.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/merchant-control-plane
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_MERCHANT_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store
          NEXT_PUBLIC_ACCOUNTS_URL: https://accounts.letbuyy.store
          WORKER_API_BASE_URL: https://api.letbuyy.store
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          INTERNAL_API_SECRET: ${{ secrets.INTERNAL_API_SECRET }}

      - name: Deploy storefront-runtime to production (*.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/storefront-runtime
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_STOREFRONT_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store
          WORKER_API_BASE_URL: https://api.letbuyy.store
          NEXT_PUBLIC_RAZORPAY_KEY_ID: ${{ secrets.RAZORPAY_KEY_ID }}

      - name: Deploy theme-marketplace to production (themes.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/theme-marketplace
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_THEMES_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store

      - name: Deploy app-marketplace to production (apps.letbuyy.store)
        run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/app-marketplace
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_APPS_PROJECT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_API_URL: https://api.letbuyy.store

  smoke-test-production:
    name: Smoke test production
    needs: deploy-apps-production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run smoke tests against production
        run: npx playwright test --project=chromium tests/e2e/smoke/
        env:
          BASE_URL: https://letbuyy.store
          ACCOUNTS_URL: https://accounts.letbuyy.store
          ADMIN_URL: https://admin.letbuyy.store
          API_URL: https://api.letbuyy.store
          CI: true

      - name: Upload smoke test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: production-smoke-test-results
          path: playwright-report/
          retention-days: 30
```

---

## PHASE 6 — PLAYWRIGHT E2E SMOKE TESTS

Create the minimum smoke tests so the CI smoke test jobs don't fail with "no test files found".

### Task 6.1 — Create Playwright config

```bash
cat > playwright.config.ts << 'EOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
EOF
```

### Task 6.2 — Create smoke test files

```bash
mkdir -p tests/e2e/smoke

cat > tests/e2e/smoke/homepage.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://letbuyy.store';

test.describe('Smoke tests — homepage', () => {
  test('marketing site loads', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).not.toHaveTitle(/error|404|500/i);
    const status = page.url();
    expect(status).not.toContain('error');
  });

  test('accounts page loads', async ({ page }) => {
    const accountsUrl = process.env.ACCOUNTS_URL || 'https://accounts.letbuyy.store';
    await page.goto(accountsUrl);
    await expect(page).not.toHaveTitle(/error|500/i);
  });

  test('admin page redirects unauthenticated', async ({ page }) => {
    const adminUrl = process.env.ADMIN_URL || 'https://admin.letbuyy.store';
    await page.goto(adminUrl);
    // Should redirect to login, not show error
    await expect(page).not.toHaveTitle(/500|server error/i);
  });

  test('API worker health check', async ({ page }) => {
    const apiUrl = process.env.API_URL || 'https://api.letbuyy.store';
    const response = await page.request.get(`${apiUrl}/health`);
    expect(response.status()).toBeLessThan(500);
  });
});
EOF
```

---

## PHASE 7 — TURBO.JSON PIPELINE UPDATES

### Task 7.1 — Ensure turbo.json has correct pipeline for CI

Read current: `cat turbo.json`

Ensure these pipeline entries exist (add if missing, do not overwrite if they exist):

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "lint": {
      "dependsOn": [],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["CI"]
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## PHASE 8 — PACKAGE.JSON SCRIPTS AUDIT

### Task 8.1 — Ensure root package.json has all CI-required scripts

Read: `cat package.json`

Ensure these scripts exist at the root level:
```json
{
  "scripts": {
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "test": "turbo test",
    "build": "turbo build",
    "validate:governance": "node scripts/validate-governance.mjs"
  }
}
```

If `scripts/validate-governance.mjs` doesn't exist but `validate:governance` is referenced,
check what script actually runs it and fix the reference.

### Task 8.2 — Add test script to apps that have no test runner

For each app/service that has no `test` script in its `package.json`, add:
```json
{
  "scripts": {
    "test": "echo 'No tests yet' && exit 0"
  }
}
```

This prevents `turbo test` from failing CI because a package has no test runner defined.

---

## PHASE 9 — CODEOWNERS FILE

### Task 9.1 — Create .github/CODEOWNERS

```bash
cat > .github/CODEOWNERS << 'EOF'
# LetBuyy CODEOWNERS
# All paths require review from the repo owner for now

* @[YOUR_GITHUB_USERNAME]

# Critical paths — always require review
/.github/workflows/ @[YOUR_GITHUB_USERNAME]
/database/supabase/migrations/ @[YOUR_GITHUB_USERNAME]
/config/env/ @[YOUR_GITHUB_USERNAME]
/services/api-gateway/src/routes/payments.ts @[YOUR_GITHUB_USERNAME]
/services/webhook-service/ @[YOUR_GITHUB_USERNAME]
EOF
```

Replace `[YOUR_GITHUB_USERNAME]` with `SaaiSidd` or whatever the actual GitHub username is.
Check with: `git log --format='%ae' | head -1` to find the commit email for reference.

---

## PHASE 10 — GITHUB SECRETS DOCUMENTATION

### Task 10.1 — Create secrets checklist for human to fill

Create `FOUNDATION_STATUS.md` with complete status:

```markdown
# LETBUYY FOUNDATION STATUS
Generated by Codex Foundation Mission

## Phase Completion

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Audit | ✅ DONE | |
| 1 — Fix typecheck | ✅ DONE | |
| 1 — Fix governance | ✅ DONE | |
| 2 — Branch setup | ✅ DONE | develop branch created |
| 3 — Env templates | ✅ DONE | |
| 4 — Wrangler configs | ✅ DONE | |
| 5 — GitHub Actions CI | ✅ DONE | |
| 5 — Staging deploy workflow | ✅ DONE | |
| 5 — Production deploy workflow | ✅ DONE | |
| 6 — Playwright smoke tests | ✅ DONE | |
| 7 — Turbo pipeline | ✅ DONE | |
| 8 — Package.json scripts | ✅ DONE | |
| 9 — CODEOWNERS | ✅ DONE | |

## [SKIP — NEEDS HUMAN] — Actions Required Before First Deploy

### 1. Delete remote branches (run in terminal)
```bash
git push origin --delete codex/worktree-purification
git push origin --delete backup-worktree-snapshot-20260524...
```

### 2. GitHub Branch Protection Rules (do in GitHub UI)
Go to: repo → Settings → Branches → Add rule

**For `develop` branch:**
- [x] Require status checks: `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`
- [x] Require branches to be up to date

**For `main` branch:**
- [x] Require status checks: all of above + `staging-e2e / playwright`
- [x] Require 1 approving review
- [x] Restrict push to: [your GitHub username only]

### 3. GitHub Environments (repo → Settings → Environments)
Create `staging` environment — no protection rules needed
Create `production` environment — add "Required reviewers" = [your username]

### 4. GitHub Secrets — `staging` environment
Go to: repo → Settings → Environments → staging → Add secret

| Secret Name | Where to get it |
|---|---|
| SUPABASE_ACCESS_TOKEN | supabase.com → Account → Access Tokens |
| SUPABASE_DB_URL | Supabase staging project → Settings → Database → Connection string |
| NEXT_PUBLIC_SUPABASE_URL | Supabase staging → Settings → API → URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase staging → Settings → API → anon key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase staging → Settings → API → service_role key |
| UPSTASH_REDIS_REST_URL | Upstash → Letbuyy-Store-Staging → REST URL |
| UPSTASH_REDIS_REST_TOKEN | Upstash → Letbuyy-Store-Staging → REST Token |
| CLOUDFLARE_API_TOKEN | Cloudflare → My Profile → API Tokens → Create Token |
| CLOUDFLARE_ACCOUNT_ID | c399939d2521d1b4bc581112b6c6c57f |
| RAZORPAY_KEY_ID | Razorpay dashboard → test mode |
| RAZORPAY_KEY_SECRET | Razorpay dashboard → test mode |
| RAZORPAY_WEBHOOK_SECRET | Razorpay → Webhooks → create webhook for staging |
| STRIPE_SECRET_KEY | Stripe dashboard → test mode |
| STRIPE_WEBHOOK_SECRET | Stripe → Webhooks → create for staging |
| RESEND_API_KEY | resend.com → API Keys |
| SESSION_SECRET | Run: `openssl rand -hex 32` |
| INTERNAL_API_SECRET | Run: `openssl rand -hex 32` |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Cloudflare → Turnstile → create widget |
| TURNSTILE_SECRET_KEY | Cloudflare → Turnstile → widget secret |
| VERCEL_TOKEN | vercel.com → Settings → Tokens |
| VERCEL_ORG_ID | vercel.com → Settings → General → Team ID |
| VERCEL_MARKETING_PROJECT_ID | vercel project for marketing-site |
| VERCEL_IDENTITY_PROJECT_ID | vercel project for identity-platform |
| VERCEL_MERCHANT_PROJECT_ID | vercel project for merchant-control-plane |
| VERCEL_STOREFRONT_PROJECT_ID | vercel project for storefront-runtime |
| VERCEL_THEMES_PROJECT_ID | vercel project for theme-marketplace |
| VERCEL_APPS_PROJECT_ID | vercel project for app-marketplace |

### 5. GitHub Secrets — `production` environment
Same as staging but with PRODUCTION values from:
- Supabase: Letbuyy-Store-Production (ref: qtrzgnnqnvboifoqntfi)
- Upstash: Leetbuyy-Store-Production
- Razorpay: LIVE mode (after you have real users)
- Different SESSION_SECRET and INTERNAL_API_SECRET (run openssl again)

### 6. Cloudflare KV / R2 / Queue IDs
After creating resources in Cloudflare dashboard, update wrangler.toml with real IDs:
- `[STAGING_KV_ID]` → replace with actual KV namespace ID
- `[PROD_KV_ID]` → replace with actual KV namespace ID
- R2 buckets: `letbuyy-media-staging` and `letbuyy-media-production`
- Queues: `letbuyy-main-queue-staging` and `letbuyy-main-queue-production`

### 7. Vercel Projects
Create 5 Vercel projects manually (or via CLI):
- `letbuyy-marketing` → domain: letbuyy.store
- `letbuyy-identity` → domain: accounts.letbuyy.store
- `letbuyy-merchant` → domain: admin.letbuyy.store
- `letbuyy-storefront` → domain: *.letbuyy.store
- `letbuyy-themes` → domain: themes.letbuyy.store
- `letbuyy-apps` → domain: apps.letbuyy.store
```

---

## PHASE 11 — FINAL COMMIT

### Task 11.1 — Commit everything to develop

```bash
# Stage all new files
git add .github/workflows/
git add .github/BRANCH_STRATEGY.md
git add .github/CODEOWNERS
git add config/env/staging.env.template
git add config/env/production.env.template
git add playwright.config.ts
git add tests/e2e/
git add FOUNDATION_STATUS.md
git add turbo.json
git add services/*/wrangler.toml
git add services/*/tsconfig.json

# Commit
git commit -m "foundation: CI/CD workflows, branch strategy, env templates, E2E smoke tests

- Add GitHub Actions: ci.yml, staging-deploy.yml, production-deploy.yml
- Add branch protection documentation and CODEOWNERS
- Add staging and production env templates with all required variables
- Add wrangler.toml staging/production blocks for all 3 workers
- Fix @cloudflare/workers-types typecheck failures
- Fix governance validation stale artifacts
- Add Playwright config and smoke tests
- Update turbo.json pipeline with correct task definitions
- Add FOUNDATION_STATUS.md with human action checklist

[FOUNDATION PHASE COMPLETE]"

# Push to develop
git push origin develop
```

---

## PHASE 12 — VERIFICATION

### Task 12.1 — Final checks

Run these and record results in `FOUNDATION_STATUS.md`:

```bash
# Typecheck must pass
pnpm turbo typecheck
echo "Typecheck exit code: $?"

# Governance must pass
pnpm run validate:governance
echo "Governance exit code: $?"

# Build must pass
pnpm turbo build --dry-run
echo "Build dry run exit code: $?"

# Workflow files must exist
ls -la .github/workflows/
echo "Workflows exist: $?"

# Develop branch must exist on remote
git ls-remote --heads origin develop
echo "Develop branch on remote: $?"
```

### Task 12.2 — Write completion summary

Append to `FOUNDATION_STATUS.md`:

```markdown
## Final Validation Results

| Check | Result |
|-------|--------|
| pnpm typecheck | [PASS/FAIL] |
| pnpm validate:governance | [PASS/FAIL] |
| pnpm build --dry-run | [PASS/FAIL] |
| ci.yml created | ✅ |
| staging-deploy.yml created | ✅ |
| production-deploy.yml created | ✅ |
| develop branch pushed | ✅ |
| FOUNDATION_STATUS.md written | ✅ |

## Foundation Phase: COMPLETE
Next step: Human fills GitHub Secrets, then push to develop triggers first staging deploy.
```

---

## HARD RULES

- Read `AGENTS.md` before every edit session
- Never push directly to `main`
- Never commit real secrets — templates only
- If a step needs credentials you don't have, write `[SKIP — NEEDS HUMAN: description]` and continue
- Run typecheck after every file change
- Commit after every phase with a clear message
- If `pnpm install` fails due to network, skip and continue with what's installed
- Write `FOUNDATION_STATUS.md` updates after every phase

---

## HOW TO START THIS IN CODEX WITH /GOAL

### Enable /goal mode first:
Add to your Codex `config.toml`:
```toml
[features]
goals = true
```

### Then paste this single prompt into Codex:

```
/goal Complete the LetBuyy Foundation Mission

Read LETBUYY_FOUNDATION_MISSION.md at the repo root.
Execute all 12 phases in order.
Mark anything requiring credentials as [SKIP — NEEDS HUMAN] and continue.
Write FOUNDATION_STATUS.md progress after each phase.
Stop condition: FOUNDATION_STATUS.md shows all phases complete and pnpm typecheck passes.
Do not stop until the stop condition is met.
```