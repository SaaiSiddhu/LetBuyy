# LetBuyy Domain Split Foundation Status

## Current Phase

- Current phase: DS-11 complete.
- Required branch: `stream/domain-split-foundation`.
- Actual branch state: worktree remains on `stream/letbuyy-ui-v2`; switching to existing `stream/domain-split-foundation` was blocked because Git would overwrite user-owned dirty files. No reset/stash/force update was performed.
- Baseline gate state: `validate:governance -> 57 validators passed, then FAILED at environment-honesty`.
- Baseline contract state: `test:contracts -> 157/157 PASS`.
- Baseline behavioral state: `test:behavioral -> 453/459 PASS, 6 FAIL` due existing hardcoded `.com` active source defaults.
- Current contract state: `test:contracts -> 181/181 PASS`.
- Current behavioral state: `test:behavioral -> 462/462 PASS`.
- Current typecheck state: `pnpm turbo typecheck -> 59/59 PASS`.
- Current lint state: `pnpm lint -> 9/9 PASS` with warnings only.
- Current workspace test state: `pnpm turbo test -> 67/67 PASS`.
- Current Flutter state: `flutter analyze -> PASS`; `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart -> PASS`.
- Current governance state: `validate:governance -> 163/163 PASS`.

## Gate State

- Target for final `validate:governance`: all validators PASS and total validator count must be at least the baseline total after adding new validators.
- Fixed baseline defect: active app/package/service source no longer hardcodes `.com` URL/email defaults; public URLs are env-driven.
- Final `validate:governance`: `163/163 PASS`.
- PR state: blocked until the user resolves or approves handling of the dirty branch collision.

## SKIPPED — NEEDS HUMAN

1. Add `letbuyy.com` to Cloudflare, move registrar nameservers, and supply `cloudflare_zone_id_com`.
   - Future proof command: `terraform plan -var="cloudflare_zone_id_com=<zone-id>" && terraform apply -var="cloudflare_zone_id_com=<zone-id>"`
2. Attach `*.letbuyy.com` production hosts to their Vercel projects from `config/vercel/projects.json`; confirm certificates.
   - Future proof command: `vercel domains add <host> --project <project-name> && vercel certs ls <host>`
3. Cut over platform env values in Vercel/CI in the same release as the `.com` host move; storefront `COOKIE_DOMAIN` stays unset.
   - Future proof command: `vercel env add COOKIE_DOMAIN production` with value `.letbuyy.com`, then redeploy and verify SSO on `.com`.
4. 301 old control-plane hosts and apex from `letbuyy.store` to `letbuyy.com`; move Worker routes to `.com` in `wrangler.toml` and `config/runtime/cloudflare-topology.json`.
   - Future proof command: update route config, then `pnpm run validate:governance` and deploy Cloudflare Workers with approved credentials.
5. Run the custom-domain/store-access migration against staging and production.
   - Future proof command: `supabase db push --db-url <protected-connection-string>` or protected GitHub migration workflow dispatch.
6. Attach merchant custom domains to the storefront Vercel project when merchants bring domains, until this is automated through a Vercel Domains API mission.
   - Future proof command: `vercel domains add <merchant-domain> --project storefront-runtime`
7. Create/push the requested PR from `stream/domain-split-foundation` after resolving the dirty branch collision.
   - Future proof command: `git switch stream/domain-split-foundation && git status --short && git push -u origin stream/domain-split-foundation && gh pr create --base develop --head stream/domain-split-foundation --title "feat(domain): split platform and storefront domains" --body-file CODEX_DOMAIN_SPLIT_STATUS.md`
