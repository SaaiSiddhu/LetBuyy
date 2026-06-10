# LetBuyy Domain Phase Finalization Status

## Current Phase

- Current phase: DF-9 domain finalization implemented; live provider steps remain human-gated.
- Required branch: `stream/domain-split-foundation`.
- Actual branch state: worktree remains on `stream/letbuyy-ui-v2`; switching/isolating remains blocked by the existing dirty branch collision. No stash, reset, force checkout, or destructive cleanup was performed.
- Current typecheck state: `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped` -> 59/59 PASS after generated `.next` cleanup.
- Current lint state: `pnpm lint` -> 9/9 PASS with warnings only.
- Current workspace test state: `pnpm turbo test --output-logs=errors-only --log-order=grouped` -> 67/67 PASS after TSX IPC escalation.
- Current contract state: `pnpm run test:contracts` -> 193/193 PASS after TSX IPC escalation.
- Current behavioral state: `pnpm run test:behavioral` -> 462/462 PASS.
- Current Flutter state: `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models` -> PASS; `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` -> PASS after SDK-cache escalation.
- Current governance state: `pnpm run validate:governance` -> 169/169 PASS after archive cleanup, intelligence-count update, and raw-provider-error sanitization.

## Gate State

- Required baseline governance count: at least 163 validators, all PASS.
- Final governance count: 169 validators, all PASS.
- New validators wired:
  - `custom-domain-target-validator.mjs`
  - `vercel-domain-automation-validator.mjs`
  - `custom-domain-abuse-screening-validator.mjs`
  - `custom-domain-reconciler-validator.mjs`
  - `shopper-identity-seam-validator.mjs`
  - `registrar-provider-validator.mjs`
- Contract tests added:
  - `tests/contracts/custom-domain-target.test.ts`
  - `tests/contracts/vercel-domain-attach.test.ts`
  - `tests/contracts/apex-mx-warning.test.ts`
  - `tests/contracts/store-password-lockout.test.ts`
  - `tests/contracts/custom-domain-abuse-screening.test.ts`
  - `tests/contracts/custom-domain-reconciler.test.ts`
  - `tests/contracts/shopper-identity-seam.test.ts`
  - `tests/contracts/buy-a-domain.test.ts`

## SKIPPED -- NEEDS HUMAN

1. Add `letbuyy.com` to Cloudflare, move registrar nameservers, and supply `cloudflare_zone_id_com`.
   - Future proof command: `terraform plan -var="cloudflare_zone_id_com=<zone-id>" && terraform apply -var="cloudflare_zone_id_com=<zone-id>"`
2. Attach `*.letbuyy.com` production hosts to their Vercel projects from `config/vercel/projects.json`; confirm certificates.
   - Future proof command: `vercel domains add <host> --project <project-name> && vercel certs ls <host>`
3. Cut over platform env values in Vercel/CI in the same release as the `.com` host move; storefront `COOKIE_DOMAIN` stays unset.
   - Future proof command: `vercel env add COOKIE_DOMAIN production` with value `.letbuyy.com`, then redeploy and verify SSO on `.com`.
4. 301 old control-plane hosts and apex from `letbuyy.store` to `letbuyy.com`; move Worker routes to `.com` in `wrangler.toml` and `config/runtime/cloudflare-topology.json`.
   - Future proof command: update route config, then `pnpm run validate:governance` and deploy Cloudflare Workers with approved credentials.
5. Run migration `090_custom_domains_and_store_access.sql` against staging and production.
   - Future proof command: `supabase db push --db-url <protected-connection-string>` or protected GitHub migration workflow dispatch.
6. Create `connect.letbuyy.store` live DNS record and run the chained-CNAME smoke test with one real domain.
   - Future proof command: `terraform -chdir=infrastructure/dns apply && curl -I https://www.<test-domain>`
7. Create Vercel Domains API team token and set `VERCEL_API_TOKEN` plus `VERCEL_STOREFRONT_PROJECT_ID` as gateway secrets.
   - Future proof command: `wrangler secret put VERCEL_API_TOKEN --config services/api-gateway/wrangler.toml && wrangler secret put VERCEL_STOREFRONT_PROJECT_ID --config services/api-gateway/wrangler.toml`
8. Set abuse reputation provider credentials and staff the `site_domain_reviews` review queue.
   - Future proof command: `wrangler secret put ABUSE_REPUTATION_API_KEY --config services/api-gateway/wrangler.toml && curl -sS -X POST "$API_BASE_URL/v1/custom/domains" -d '{"site_id":"<site-id>","domain":"known-bad-example.test"}'`
9. Create registrar reseller account, decide markup policy, and set `REGISTRAR_*` secrets.
   - Future proof command: `wrangler secret put REGISTRAR_API_KEY --config services/api-gateway/wrangler.toml && curl -sS "$API_BASE_URL/v1/domains/search?query=<sandbox-domain>"`
10. Complete branch isolation and PR creation for `stream/domain-split-foundation`.
   - Future proof command: `git switch stream/domain-split-foundation && git status --short && git push -u origin stream/domain-split-foundation && gh pr create --base develop --head stream/domain-split-foundation --title "feat(domain): finalize domain hardening and buy-a-domain" --body-file CODEX_DOMAIN_FINALIZATION_STATUS.md`
