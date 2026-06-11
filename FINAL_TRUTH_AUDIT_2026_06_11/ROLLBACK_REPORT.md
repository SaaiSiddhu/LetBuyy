# Rollback Report

## Phase A

| Scope | Forward action | Rollback path | Status |
|---|---|---|---|
| A0 prompt registration | Added the final convergence prompt registry row and tracked the final-truth audit bundle. | Revert the A0 commit. | Ready. |
| A0 local snapshot tags | Created local annotated tags `convergence-cabe148c` and `pre-promotion-origin-41b6ea49`. | Tags are local-only; delete them only if the A0 snapshot is abandoned. | Ready. |
| A1 verification | No runtime/schema change. | No rollback required beyond reverting the evidence-only A1 commit. | Ready. |
| A2 runbook fix | Updated remote promotion instructions and recorded `SKIP-A2-REMOTE-BRANCH-CONVERGENCE`. | Revert the A2 commit. | Ready; Codex changed no remote refs. |
| A3 deploy gate wiring | Added governance-gate prerequisites, untracked migration rejection, production mobile-bff Turnstile secret wiring, and validator/test enforcement. | Revert the A3 commit. | Ready; Codex did not run deployment or mutate GitHub branch protection. |
| A4/A5 G4 human block | Recorded that production promotion, live smoke, and post-promotion audit are skipped-human/blocking seams. | No rollback required for remote work because none was performed. Revert this evidence row if superseded by real G4 evidence. | Ready. |
| A5 branch-lag monitor prep | Added scheduled branch-lag monitor workflow and validator/test enforcement. | Revert the A5 monitor commit. | Ready; Codex did not run or claim a live scheduled GitHub Actions result. |
| A5 ledger freeze backfill | Backfilled stale pre-freeze ledger commit cells to `e1d6fb18`. | Revert the A5 ledger backfill commit. | Ready; docs-only evidence change. |
| A4 G4 atom safety | Required checkout signing in production deploy, removed provider-money secret provisioning from the A4 go-live atom, added validator/test coverage, and wrote the human execution packet. | Revert the A4 atom-safety commit. | Ready; Codex changed no remote refs, provider secrets, DNS, production database, or deployment. |

## Promotion Rollback Requirements

Phase A4 is not executed yet. Before any production promotion, the human operator must hold prior worker/app deployment IDs, an encrypted database backup, and the two snapshot tags. If login or capture smoke fails during the promotion window and cannot be fixed quickly, roll back code to the pinned prior artifacts, apply schema rollbacks `167` down to `160` in reverse order, and restore DNS to the previous records.

## Phase B

| Scope | Forward action | Rollback path | Status |
|---|---|---|---|
| B1/B2 capture/refund ledgering | Migration `168_b1_b2_capture_refund_ledgering.sql` replaces the capture/refund hub RPCs and the money-ledger source resolver so captures and refunds post canonical balanced entries in-transaction. Hosted checkout now reads actual `ledger_transactions` proof before recording `capture_posted_to_ledger`. | Apply `database/supabase/rollback/168_b1_b2_capture_refund_ledgering.rollback.sql` or revert the B1/B2 commit. The rollback restores the prior resolver plus `confirm_order_payment_with_ledger`, `complete_order_refund`, and `record_order_payment_failure_with_ledger` callable bodies. | Ready; Codex did not run production migrations, provider rails, or live smoke. |
| B1/B2 lint tooling | Root `package.json` declares `eslint@9.39.2` so `pnpm run lint` can resolve app ESLint configs under isolated pnpm linking; `AdminShell` overlay uses `@letbuyy/ui` `Button` to satisfy the existing UI lint rule. | Revert the B1/B2 commit. | Ready; tooling-only, no runtime money behavior. |
| B3/B5 reconciliation and operator queue | Added scheduled `refresh_money_ledger_site_reconciliation` execution in `queue-workers` and a read-only platform-console money reconciliation queue. | Revert the B3/B5 commit. | Ready; no production scheduler, operator action, or live provider reconciliation was run by Codex. |
| B3/B5 balance projections | AI-credit visible balances derive from `ai_usage` plus configured grants; AI-credit purchases defer credit grants until canonical provider/ledger wiring exists. Gift-card checkout redemption derives balance from `gift_card_ledger_entries` and no longer mutates `gift_card_accounts.balance` in replayed checkout function bodies. | Revert the B3/B5 commit to restore the previous route and SQL bodies before production deployment. | Ready; no production migration was applied and no live money moved. |
| B3/B5 validator hardening | Canonical-ledger validator now scans gift-card/AI-credit money mutations and requires the explicit `SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY`; commission validator catches arbitrary nonzero commission/GMV fee defaults across migrations. | Revert the B3/B5 commit if the validator behavior itself must be rolled back. | Ready; mutation probes were removed and validators pass cleanly. |

## Phase C

| Scope | Forward action | Rollback path | Status |
|---|---|---|---|
| C0-C3 Liquid rendering and chrome | Storefront composition consumes `layoutHtml`; Liquid resolver reads bundle `header`/`footer` templates; portable bundle includes first-party chrome/commerce sections and `lb-*` CSS. | Revert the C0-C3 commit. | Ready; React remains frozen and available as fallback, and no production canary was enabled. |
| C0-C3 Liquid data and filters | Liquid product/collection planner recognizes Liquid section keys; cart drops use supplied projection or honest browser-hydrated empty state; renderer exposes `t` while keeping `{% render %}` forbidden. | Revert the C0-C3 commit. | Ready; no third-party snippet/runtime surface was added. |
| C0-C3 editor canary writer | Web draft route and mobile theme service can persist `liquidBundle` plus `liquidRenderingCanary` into canonical template config. | Revert the C0-C3 commit. | Ready; no publish, production rollout, ARB flip, or React deletion was executed. |

## Phase D

| Scope | Forward action | Rollback path | Status |
|---|---|---|---|
| D1 DOC-02 and Constitution/Claude authority | Root `AGENTS.md` remains operative DOC-02 under the Constitution; `LETBUYY_AGENTS_V2.md` becomes a pointer; stale ops-console and authority-order text is corrected. | Revert the D1/D2 authority commit. | Ready; docs/validator-only, no runtime behavior changed. |
| D1 reserved service stubs | Six reserved-service `AGENTS.md` files now state manifest-only status and explicitly ban source/tests/package/deploy config. | Revert the D1/D2 authority commit. | Ready; no reserved runtime was activated. |
| D1 root business binary archival | Four root business binaries moved under `docs/archive/root-business-artifacts-2026-06-11/`. | Revert the D1/D2 authority commit or `git mv` the four files back to the repository root. | Ready; archival only. |
| D2 prompt/archive retarget | Prompt perimeter constant retargeted to the final convergence prompt; old foundation prompt marked executed; old masterplan/deletion/auth prompt-class docs moved under prompt-drift archive. | Revert the D1/D2 authority commit or move the archived prompt-class docs back and restore the registry/validator constant together. | Ready; archival only. |
| D2 duplicate SKIP seam merge | Duplicate `SKIP-RAZORPAYX-ENUM-PURGE` rows merged into one seam row; duplicate-ID validator added. | Revert the D1/D2 authority commit if the split rows must be restored. | Ready; docs/validator-only. |
| D3 validator liveness | Wired real orphan validators into the governance gate and added liveness checks for unwired validator modules. | Revert the D3-D5 commit to restore the previous gate list and tooling validator. | Ready; mutation probes were reverted and the 105-validator gate passes. |
| D4 frozen app deploy neutralization | Removed frozen app `vercel.json` files, changed frozen runtime manifests to `frozen-not-deployed`, removed frozen roots from default build/typecheck, and added deploy-matrix enforcement. | Revert the D3-D5 commit to restore the Vercel deploy files/manifests/package scripts. Provider-side project deletion was not performed by Codex. | Ready locally; provider cleanup remains `SKIP-D4-FROZEN-VERCEL-PROJECT-DELETION`. |
| D4 shared queue projection planner | Moved the planner to `packages/event-core/src/queue-projection-plans.ts`, exported it, and updated both service consumers/tests. | Revert the D3-D5 commit to restore the service-local copies and imports, or move the shared file back with matching tests. | Ready. |
| D4 auth legacy shim deletion | Deleted `packages/auth-core/src/legacy.ts`. | Revert the D3-D5 commit to restore the zero-importer shim. | Ready. |
| D4 Firebase/GCS media residue removal | Removed Firebase/GCS media allowlists and the `firebase-storage` storage adapter enum. | Revert the D3-D5 commit to restore the allowlists/enum if a live asset migration transition requires them. | Ready; no live asset migration is claimed. |
| D5 DNS consolidation | Deleted `infrastructure/dns/letbuyy_com.tf` and kept active records in `infrastructure/dns/dns.tf` with checkout. | Revert the D3-D5 commit to restore the overlay, or restore from git before any Terraform apply. | Ready; live Terraform apply remains `SKIP-D5-DNS-TERRAFORM-APPLY`. |
| D5 environment/config honesty | Removed `EMAIL_QUEUE` from API Env, routed order confirmation through `NOTIFICATION_QUEUE`, declared missing worker env keys, removed frozen/reserved secret owners, retargeted staging branch metadata to `stepup/main`, and relabelled placeholder live modes to sandbox/dry-run. | Revert the D3-D5 commit to restore previous env/config behavior. | Ready; no production secrets or provider settings were changed. |

## Phase D6 / E

| Scope | Forward action | Rollback path | Status |
|---|---|---|---|
| D6/E reserved manifest anti-recurrence | Reworded reserved service manifests away from forward-activation language and made whole-repo validation reject `future activation`, `activation-ready`, and incubation wording. | Revert the D6/E certification commit to restore the previous manifest language and validator. | Ready locally; no reserved service was activated. |
| D6/E DNS overlay anti-recurrence | Retargeted active DNS tests to `infrastructure/dns/dns.tf` and made whole-repo validation reject references to the retired `infrastructure/dns/letbuyy_com.tf`. | Revert the D6/E certification commit to restore the previous test references and validator. | Ready locally; live DNS apply remains `SKIP-D5-DNS-TERRAFORM-APPLY`. |
| D6/E completion report | Added repository-side completion report and EG1 human-live seam records. | Revert the D6/E certification commit to remove the report/seam rows. | Ready; no ARB signature, live deployment, or remote certification was fabricated. |
