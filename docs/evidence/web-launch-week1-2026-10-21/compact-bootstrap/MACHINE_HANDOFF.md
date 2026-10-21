# Compact bootstrap — source handoff and local continuation

**21 October source-sync correction:** compact SQL authorization and prepared-protocol/unknown-response local acceptance are now complete at stacked checkpoint5e9c7aaa and integrated into develop. Read `../github-sync/SYNC_2026_10_21.md` and `../hyperdrive-protocol/CONTINUITY.md` for exact limits. The earlier unmerged/local-only warnings below describe previous checkpoints. Managed Hyperdrive freshness and the overall launch remain open.

**Latest local correction:** migration370 repairs the restricted-role public site/release SQL reads. Combined owned SQL/security/native24 cases pass, direct table42501 remains intentional, and canonical114 passes. See sql-repair-progress.json and hyperdrive-follow-up.json. Hyperdrive protocol/freshness and dedicated unknown-response native proof remain open. Develop/GitHub8f415c0f has not advanced. Earlier snapshot descriptions below are dated history.

Owner requested committing all current work and pushing GitHub for a new-machine handoff on 21 October 2026. This supersedes the earlier local-only boundary for source preservation. This branch is deliberately unmerged into develop.

Implementation spans tenant-core projection, Gateway release/site reads and cache identity, typed SDK and Commerce consumption. Existing contract.json defines required acceptance. The seven source/test files in this snapshot were reviewed for accidental private configuration; no environment or credential files are included.

Observed checks before snapshot: tenant-core 12 passed; API client exact-text contracts 3 passed; Gateway and Commerce TypeScript checks exited zero. Gateway package unit invocation did not execute because tsx IPC was denied by the sandbox (EPERM), so it is not a passing test result.

Missing acceptance: real owned PostgreSQL SQL/REST release failure and publication-race controls; native Worker default/compact cache separation and warmed visibility checks; complete production-built browser journey and matching performance profile; final Gateway/package/regression and canonical gate on this implementation. No deployment, shared database write or provider operation occurred.

Resume on this branch only after fetching develop and reconciling bookkeeping. Do not promote this snapshot or treat it as production-ready. Base is the locally verified performance candidate a92763b70f110db1c4d9ed5eb094e48ed40e568a. The four-week programme and Week 1 acceptance remain open.

## Local verification after the saved GitHub snapshot

The continued four-week goal resumed this branch locally. Read verification-progress.json, comparison.json and SQL_AUTHORIZATION_FINDING.md. The full native merchant/buyer/cache journey passes; REST representation and negative/race controls pass, but the actual restricted pooled-SQL no-fallback case remains red with42501. The final repository gate passes114; this does not override that failed integration requirement. New commits remain local; develop/GitHub8f415c0f is unchanged. Do not merge or deploy this candidate before its SQL/public-read authorization acceptance is resolved.
