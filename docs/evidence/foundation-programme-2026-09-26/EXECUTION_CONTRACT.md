# Execution contract and future Claude Code prompts

> **Superseded in part by the owner on 26 September 2026:** no real marketplace users require migration; remove Firebase from the marketplace runtime and use direct canonical LetBuyy sign-in. Do not request Firebase credentials or preserve the legacy login gate. Read [Phase 1R revised plan](PHASE_1R_FIREBASE_FREE_MARKETPLACE_PLAN.md) before using this historical plan/prompt. Other preservation and no-deployment constraints remain.

Date: 26 September 2026. Applies to the proposed [LetBuyy foundation programme](FOUNDATION_PROGRAMME.md). This is the delivery method, not an instruction to execute all phases now.

## Reference and adaptation

The referenced Codex task **EDYNOX foundation programme** (`01a0ce85-8694-70a3-bb93-862badecccfa`, local) was read through `read_thread`. The earlier comparison inspected its B3.4 full-functional-closure prompt and preceding review. Their useful pattern was a full bounded phase, dependency-aware implementation, actual persona workflows, negative controls, exact evidence and critical review. Test totals did not justify closure when required capabilities were missing.

Reuse that discipline, not EDYNOX's domain model, hierarchy, migrations, working directory, database rules or historical commands. LetBuyy's own user instructions and governance govern this repository. No claim is made about EDYNOX's latest code or completion status.

The previously saved [phase execution standard](../../../../NewMacSetup/PHASE_EXECUTION_STANDARD.md) remains relevant. This document gives it programme-level outputs and handoff rules.

## One phase, complete delivery

1. **Re-establish reality.** Read current owner instructions, Constitution, AGENTS/local rules, canonical registry, phase scope and prior evidence. Inspect HEAD, uncommitted/untracked work, runtime/data ownership, migration state and affected consumers. Never reset to a historical checkpoint.
2. **Close discovery.** Find the existing canonical implementation and actual missing behavior. Trace requests through UI, transport, permission/tenant enforcement, domain code, persistence, jobs and provider boundary. Reuse existing primitives. Investigate required pre-existing defects rather than labeling them out of scope automatically.
3. **Resolve material decisions.** Use accepted decisions already in context. For an unresolved commercial/access/authority issue, identify the exact dependent package and prepare concrete choices; continue independent work. An unanswered question is not approval.
4. **Implement dependency-ready packages.** Make reviewable changes within the current phase. Complete all relevant consumers, UI states, migrations/configuration and compatibility behavior. Avoid parallel sources of truth, scaffolds presented as features, dormant target flags enabled without migration, and destructive cleanup.
5. **Exercise real workflows.** Use supported UI entrypoints and actual limited roles. Test positive, denied, stale, concurrent and retry behavior appropriate to the phase. Use actual provider sandbox/device evidence where the requirement demands it.
6. **Fix and retest.** Repair failures within the necessary phase scope. Preserve the failure history and identify the corrected artifact. Rerun affected checks; do not use broad repeated suites as a substitute for the missing user journey.
7. **Produce the closure packet.** Record every requirement, exact tested artifacts, commands, outcomes, failures/skips and external blockers. Include migration/rollback evidence and precise next work.
8. **CTO review.** Compare claims with code and evidence; independently rerun material checks where useful. Give separate implementation/local/device/provider/hosted verdicts. If mandatory acceptance fails, issue a corrective continuation with the completed work preserved.

One implementation agent; no subagents. When Claude implements and Codex reviews, avoid concurrent edits to the same files. Review independence means a separate evidence assessment, not a claim that an unseen second person or agent certified the result.

## What every ready-to-paste prompt must contain

| Section | Required content |
|---|---|
| Model and effort | Recommend a verified currently available Claude Code model and supported effort setting appropriate to the phase. High-risk identity/money/migration work merits deeper reasoning; bounded corrections can use a lighter option. Verify names/settings when the prompt is requested rather than freeze an invented future recommendation here. |
| Role and outcome | LetBuyy engineering partner; exact parent phase and packages; continue through implementation, integration, fixes and evidence. |
| Measured baseline | Working path, current HEAD/branch/change state, actual runtime/toolchain, prior measured behavior and limitations. |
| Authority and preservation | Current user constraints, applicable governance, accepted product decisions, unpublished/untracked/env/signing/data preservation. No deployment, promotion, force-push, payment activation or backup deletion. |
| Canonical owners | Real paths and public contracts discovered for this phase; identify legacy compatibility boundaries and migration requirements. |
| Defect/requirement inventory | Concrete before/after behavior and package IDs; distinguish code findings from runtime failures and historical claims. |
| Ordered implementation | Full dependency-ready work packages and affected web/mobile/operator consumers; necessary pre-existing blockers included. |
| Data and compatibility | Schema sequencing, migration preconditions, old/new client behavior, idempotency, recovery and rollback. Never replay all migrations over restored schema. |
| User journeys | Exact persona, normal entrypoint, required environment and expected backend evidence; include loading/error/empty/denied states. |
| Adversarial cases | Cross-buyer/tenant, restricted staff, revoked/stale session, replay, concurrency, partial failure, replacement and refund cases as applicable. |
| Evidence matrix | Requirement → implementation → test/runtime proof → result; separate mocks, local, device, sandbox and hosted checks. |
| Persistence and stop rules | Finish authorized feasible work. Stop dependent work only for real access/authority blockers; never fabricate success or broaden the whole programme to avoid a hard gate. |
| Final handoff | Changed paths, exact Git state, test/build/runtime outcomes, remaining defects/blockers, rollback and precise next task. |

Prompts must be complete instructions with current facts, not a template saying “insert the phase here.” Length serves completeness; a very long prompt cannot guarantee a provider credential, device or full closure. Do not ask Claude to simulate unavailable verification and call it done.

## Phase completion packet

Recommended files under a dated phase evidence directory, created only when executing that phase:

- `BASELINE.md`: actual source/runtime/data state and preserved work.
- `REQUIREMENTS.md`: package and acceptance inventory, decisions and canonical owners.
- `IMPLEMENTATION.md`: final behavior, affected consumers and migration/configuration details.
- `VERIFICATION.md`: executed commands and normal journeys, expected/actual outcomes, named device/provider/environment and redacted evidence links.
- `CLOSURE.md`: per-requirement verdict, exact measured artifact, remaining failures/blockers and next task.

Use fewer files if a bounded correction is clearer in one report. Do not generate ceremonial documents that repeat the same assertions. Never put credentials, raw identity tokens, personal KYC files or unredacted account logs in committed evidence.

## Closure review rules

A phase is not closed because the agent ran for a long time, a large diff exists, the build succeeds, all newly written tests pass, or a report says “no new failures.” Review required behavior, existing mandatory failures and skipped checks.

For each important claim ask: which actual source/config was tested; which user/role; which runtime/provider; what observation proves the behavior; what negative control would have caught a false pass? Missing evidence stays missing. A source manifest identifies the artifact but does not itself prove functionality.

If an external blocker remains, deliver all feasible work and a precise unblocking packet: affected requirement, missing credential/device/ownership/action, prepared changes or procedure, and the exact verification to run afterward. Keep the parent phase open when the missing item is mandatory. Do not repeatedly ask permission for already authorized reversible work.

## First prompt boundary

When the owner requests the next Claude implementation prompt, generate **Phase 1 closure**, refreshed against then-current evidence. It should address ordinary Android profile/address/account switching, local runtime reproducibility, deliberate directory failure handling, home-banner diagnosis, relevant validator drift and local port exposure. Separate hosted association repair from local app routing and honor the no-deployment instruction.

Do not start Phase 2 identity migration or marketplace payment implementation inside that prompt. Phase 3 provider/cloud research can be prepared without enabling any service or moving money.
