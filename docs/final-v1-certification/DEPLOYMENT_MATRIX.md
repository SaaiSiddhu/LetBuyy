# Phase I — Deployment Matrix

**HEAD `ae383bb8`. ✅ ready · ⚠️ configured-not-provisioned · ❌ blocked.**

| Component | Config | Provisioned | Status |
|---|---|---|---|
| GitHub Actions — staging | ✅ `deploy-staging.yml` | ⚠️ staging secrets unknown | ⚠️ can run, soft-skips |
| GitHub Actions — production | ✅ `production-deploy.yml` | ❌ branch-lag self-block + secrets | ❌ |
| Cloudflare Workers (gateway/webhook/queues) | ✅ `wrangler.toml` (Hyperdrive, 5 queues, R2, KV) | ❌ prod IDs/secrets | ⚠️ |
| Supabase (Postgres, 103 migrations) | ✅ gated migrate job + backup | ❌ no prod project | ❌ |
| Vercel (5 Next apps) | ✅ matrix deploy | ❌ project IDs/tokens | ⚠️ |
| DNS + wildcard `*.letbuyy.com` | ✅ proxy.ts host resolution | ❌ zone/wildcard | ❌ |
| Secrets (~40) | ✅ `staging-production-secret-matrix.json` | ❌ all `SKIP_NEEDS_HUMAN_*` | ❌ |
| Razorpay live + webhook | ✅ adapter | ❌ `HR-MERCHANT-PSP-LIVE` | ❌ |
| Razorpay Route (payouts) | ✅ rail code | ❌ `HR-PA-SPLIT-LIVE` | ❌ |
| Resend (email) | ✅ adapter, fail-closed | ❌ `HR-ESP-LIVE` (SPF/DKIM) | ❌ |
| Turnstile | ✅ fail-closed verify | ❌ `HR-TURNSTILE-LIVE` | ❌ |
| Identity ES256 JWK | ✅ issuer/verifier | ❌ keypair | ❌ |
| Migration flow | ✅ gated + backup | n/a | ✅ |
| Rollback flow | ✅ encrypted backup | ⚠️ never drilled | ⚠️ |

**Required human acts (gating):** HR-B1A push · DNS/wildcard · prod Supabase · ~40 secrets · Razorpay live + Route · Resend domain auth · Turnstile · identity keypair. None can be automated.
