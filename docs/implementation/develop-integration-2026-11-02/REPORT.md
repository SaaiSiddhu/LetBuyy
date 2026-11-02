# Local develop integration — 2 November 2026

Status: source candidate assembled; final gate results and actual merge commit are recorded in VALIDATION.json and the execution/branch ledgers.

## Authority and scope

The owner requested that all LetBuyy work be merged properly into develop. This is local integration authority. It does not promote staging/main, push GitHub, deploy, apply hosted migrations, provision the Mumbai stack, enable KYC intake or conduct provider/payment operations. AUTH-R1, ARCH-R1/R18, WIN-R4, MIG-R2/R3 and TEST-R3/R4/R5/R6 remain applicable. The primary checkout is the final merge location per D-MERGE-LOCATION.

## Preserved inputs

- Primary develop: e4105581e3346041d71694d3db093eb713773e07, 173 dirty paths captured in snapshot commit 409ace5f055e829440f57d659412f7209505e94c. Original index, bytes and patch are backed up outside the repository.
- codex/general-business-kyc: 4e6df6546de288288a1b2a6c0b52c9ba8dd6657e plus 86 stable dirty paths, captured in b9f05f02e2e3dc8c70f87a0ffea020f20bcd58ef. Seven later staged stack/policy file versions were independently captured, with exact hashes in SUPPLEMENTAL_SNAPSHOT.json. The source worktree remains intact.
- codex/merchant-mobile-parity: ab32485092cae0ac19145abf7b5a101fa3ea338e.
- codex/accounts-csrf-renewal: 5ddf8e167fdb309176d09f221a027ca25be8bdfb, including its remaining release documentation.
- The private 14-path Theme Editor insertion slice was applied and repaired. Its original archive at /private/tmp/letbuyy-theme-editor-slice-20261030-02 remains intact.
- Other existing local topic tips were already ancestors of the starting develop. Existing remote-only historical refs and temporary qualification clones are preserved; superseded dirty qualification output is not replayed over newer source. The prior owner stash remains a backup.

## Integration repairs

1. Composed route-owned idempotency receipts, queue scheduling, KYC scan jobs, warehouse commands, durable CSV imports, tenant registry and test inventories from both branches. No independent implementation was silently selected over the other.
2. Preserved native authentication epoch/ordered storage/session recovery while adding hosted Accounts handoff and browser cancellation. Session reads use the canonical bearer contract; browser cookies remain supported. Unavailable/protected/malformed reads retain the sealed credential; only authenticated denial revokes it. Staging names remain separate from production. The registered staging host matches accounts-staging.letbuyy.com.
3. Composed managed sandbox payment connections and merchant-owned Razorpay webhook setup. A webhook can only attach to own-account mode. Managed secret material cannot be projected publicly or relabelled as merchant-owned. The webhook rollback restores the immediately preceding managed-capable function.
4. Kept the existing 414 gift-card migration exactly once. All new UP/DOWN pairs are sequential 415–432. MIGRATION_PATH_MAP.json records every branch collision. Journal ownership and active tests were updated; dated evidence remains historical. A deployed estate must be inspected before any migration application: this local renumbering never authorizes replaying previously executed migration files.
5. Theme insertion validates trusted server placement in both legacy and portable projections, preserves exact owned older instances across representation changes, caps legacy page sections at 50 and rejects duplicate rendered identities. Forged candidate bundle metadata grants no placement authority. The selected template key reaches the save validator. Three original counterexamples were reproduced red and repaired green.
6. Historical theme package factories retain original bytes and pinned hashes. Group metadata belongs to the explicit 2.1.0 successor. Its new content-addressed proposal is dc38dedf132efb1d57adb40855982fc6e3f5d5f8fcb2c513920da40ad5a5b018; the earlier proposal remains archived. No hosted catalogue version was changed.
7. Narrow governance recognizers have negative mutation controls: exact native callback schemes cannot become HTTPS-host exemptions; the reviewed warehouse ACL block cannot hide privilege grants; the managed-payment pre-use guard cannot hide effects. Five synthetic test values have finite file/value hash exceptions, with no credential values recorded. The secret scanner remains enabled.
8. Updated old source-shape smoke contracts to exercise the actual canonical routes, scopes, import worker and cookie resolver. Behavioral/owned checks remain the acceptance evidence; string presence alone does not establish runtime readiness.

## Active work outside the snapshot

The General/Business KYC chat continues independently. After the qualified snapshot it began implementing pending-document retention (its worktree migration name is 429_kyc_india_pending_retention). That unqualified in-flight runtime change is preserved in the original worktree, not swept into this merge. Its later integration must rebase onto the final canonical chain and allocate a new migration after 432. The approved retention policy and qualified stack alarms are included; the policy explicitly distinguishes source work from provider/legal/hosted acceptance.

## Recovery and limits

The isolated assembly and original-byte backups live at /private/tmp/letbuyy-integrate-20261102. Original dirty worktrees, secrets, environment files and signing assets were not reset or overwritten. The final merge is a normal no-fast-forward merge in the primary checkout, with a retained stash backup if needed to clear its original dirty state. No stash is reapplied on top of already-integrated bytes.

Web/mobile builds, local owned databases and synthetic browser fixtures do not certify real AWS scans, delivery of alert mail, Cashfree KYC, hosted migrations, device deep links, live payments or payouts. Existing release gates remain open.
