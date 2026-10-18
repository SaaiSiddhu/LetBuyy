# F6.2 operator review workbench — first local slice, 4 October 2026

> **Dated correction, 4 October 2026:** The initial first-slice status below was
> written before reviewer assignment existed. Self-claim, assigned-reviewer
> decisions and lead/admin reassignment are now locally implemented and
> verified. Structured reason codes, merchant corrective response/resubmission
> and cross-applicant evidence authorization remain open. F6.2 is still partial,
> not accepted.

## Implemented

Migration 275 now saves the sanitized submitted product revision at merchant
submission and the approved revision at operator approval. A later submission
retains the previous approved snapshot for comparison. Product material edits
clear only the submitted snapshot and withdraw the listing; inventory changes
remain outside the reviewed revision. The rollback returns active reviews to
draft, records the system event, then removes both snapshot columns and helper
functions.

The operator listing detail response selects these snapshots only for a
permission-gated, single-listing detail request; queue rows do not load the
larger snapshots. The console queue now links into a detail screen. Reviewers
see changed snapshot fields, merchant-provided HTTP(S) product-image references
as links (the console does not fetch them), and the append-only moderation
history. Approve/reject/take-down controls are on the detail screen only.
Decision actions re-check the console session and MFA; missing submitted
revision snapshots fail closed in the UI and are still guarded by the database
transition.

## Verification

- Owned disposable Postgres revision/rollback suite: **6/6 passed**, including
  refusal of direct saved-snapshot tampering.
- Focused gateway moderation and console screen contracts: **18/18 passed**,
  including nested revision additions/removals/edits and rejection of unsafe URL
  schemes in evidence references.
- Migration safety validator and `git diff --check`: passed.
- Console and Gateway TypeScript typecheck attempted. It could not execute
  meaningfully because this Phase 2 worktree has no linked app dependencies;
  TypeScript reported missing `next`, `react`, `@letbuyy/ui` and related type
  declarations. No dependency install or source change was made to work around
  the incomplete local dependency tree.
- No hosted database, reviewer identity, merchant account or live listing was
  used. No merge, push or deployment occurred.

## Remaining F6.2 and Phase 6 work

This is a first workbench slice, not F6.2 acceptance. Structured reason codes,
authenticated merchant-facing listing status
and corrective response/resubmission UI, and evidence authorization across
different applicants still need implementation and role-path proof. F6.3
concurrency/appeals, remaining discovery/deep-link enforcement, purchase-time
eligibility, complaints/takedown propagation, and capacity rehearsal also
remain open. Next: connect structured decision reasons to merchant correction
guidance without repurposing the separate app/theme review queue.

## Assignment progress correction — 4 October 2026

Migration 275 adds self-claim assignment fields and an append-only
`reviewer_assignment` event. A service-role-only, idempotent claim RPC uses the
displayed listing version as a compare-and-swap guard, rejects tenant context and
competing reviewers, and writes assignment plus event atomically. A database
guard prevents direct assignment writes. The gateway revalidates the signed
console-session operator against active platform membership and live
`review:decide` permission; decisions require that same assigned operator. The
console binds identity from its server session and shows claim/decision actions
according to assignment state.

- `pnpm --filter @letbuyy/api-gateway typecheck`: passed.
- `node --import tsx --test services/api-gateway/src/__tests__/operator-moderation-auth-chain.test.ts services/api-gateway/src/__tests__/marketplace-listings-operations.test.ts tests/contracts/admin-listing-decision-body.test.ts tests/contracts/marketplace-moderation-screen.test.ts`: **33/33 passed**.
- `node --test tests/executable/marketplace-review-revision-postgres.test.mjs`: **6/6 passed** against the owned disposable local Postgres container, including claim idempotency, competing-reviewer denial and rollback.
- `pnpm run validate:migrations` and `git diff --check`: passed.
- The console app typecheck remains unavailable in this Phase 2 worktree because its linked app dependencies (`next`, `react`, and workspace UI packages) are missing. No dependency reinstall was attempted.
- Hosted DB, hosted identity, merchant account, live listing, deployment, merge and push were not used.

This verification is local only. Migration 275 remains a local untracked migration and is not applied to a hosted/shared database. The exact checkout HEAD at verification was `0862687a5008d604d0df23357b2eb511293139fa`; the working tree contains extensive owner changes, all preserved.

## Atomic stale-reviewer decision guard — 4 October 2026

Source tracing found a time-of-check/time-of-use gap: the gateway compared the
signed-in operator with the assigned reviewer before calling
`transition_channel_listing`, but the database transition did not repeat that
check while holding its listing-row lock. A listing reassigned between those
operations could still be approved or rejected by the former assignee.

Migration 275's revision guard now requires `reviewed_by` to match the locked
listing's current `assigned_reviewer_id` for pending-review approval and
rejection. This retains the existing row-locking transition RPC as the canonical
writer and closes both decision edges at the database boundary. The regression
models a committed reassignment between the gateway pre-check and transition;
it proves the former assignee's approve and reject write nothing, then proves
the currently assigned reviewer can approve.

- `node --test tests/executable/marketplace-review-revision-postgres.test.mjs`: **7/7 passed** against owned disposable Postgres, including rollback/reapply and stale-reviewer approve/reject denial.
- `node --import tsx --test services/api-gateway/src/__tests__/operator-moderation-auth-chain.test.ts services/api-gateway/src/__tests__/marketplace-listings-operations.test.ts tests/contracts/admin-listing-decision-body.test.ts tests/contracts/marketplace-moderation-screen.test.ts`: **33/33 passed**.
- `pnpm --filter @letbuyy/api-gateway typecheck`, `pnpm run validate:migrations` and `git diff --check`: passed.
- Migration 275 remains local/untracked and unapplied to hosted/shared DB. The console app typecheck remains unavailable because this worktree has no linked app dependencies.

Next F6.2 slice: connect structured decision reasons to authenticated merchant correction guidance and resubmission, then prove the evidence-authorization boundary across separate applicants.

## 10 October 2026 merchant-correction progress correction

The next-slice note above was written before the merchant correction work was
implemented. A store-owned same-origin BFF now exposes listing status and
transactional correction/resubmission; its focused contract tests prove
verified-store scoping, session-required Gateway calls, input validation,
ownership denial, not-found behavior and conflict propagation. The merchant
product editor's review panel now presents the rejection feedback and enforces
saved-product, minimum-correction and in-flight guards. Six BFF tests, three
rendered-markup tests, the complete merchant-web test command (**771/771**) and
merchant-web typecheck pass locally. Detailed evidence is in
[merchant correction/resubmission](F6_2_MERCHANT_CORRECTION_RESUBMISSION_2026-10-04.md).

This supersedes only the claim that merchant correction UI is unimplemented.
The required review-reason categories still await the owner's policy choice;
private applicant evidence remains unmodeled; the correction path has not been
accepted in a real browser session with Gateway and owned Postgres because
Docker is unavailable here. Cross-applicant evidence authorization, F6.3
concurrency/appeals and the broader Phase 6 criteria remain open.

## Lead/admin reviewer reassignment — 4 October 2026

Migration 275 adds `review:assign` to the lead tier (and therefore admin tier),
an atomic reassignment RPC, and `previous_assigned_reviewer_id` in the append-only
moderation event. The RPC locks the listing, requires `pending_review`, checks
the UI's expected version, refuses reassignment to the current reviewer, applies
an idempotency key, and writes assignment plus history in one transaction. The
gateway validates the authenticated session identity and live assignment
permission, restricts targets to active platform reviewers using the database's
actual `operations`, `manager` and `admin` roles, and calls only the RPC. The
router's explicit active-platform tier gate is mounted before the broader
incident-command operations gate.

The MFA-gated console loads the eligible reviewer list server-side, excludes the
current reviewer and signed-in operator, requires a reason and displayed listing
version, then revalidates the session in its server action. The detail history
shows previous/new reviewer IDs. The owned PostgreSQL test executes the real
reassignment RPC, retries the same idempotency key, proves the former reviewer
cannot approve or reject after the change, and proves the current reviewer can
approve.

- Focused API/auth-chain/console contracts: **35/35 passed**.
- Owned PostgreSQL revision/rollback suite: **7/7 passed**, including actual reassignment, idempotent replay and stale-reviewer denial.
- Gateway typecheck, migration safety validator and `git diff --check`: passed.
- Admin-web typecheck cannot resolve dependencies in this worktree (`next`, React, Node types and workspace UI packages are missing); no installation was attempted.
- No hosted database, identity or live listing was used; migration 275 remains local and unapplied to shared/hosted DB.

## 7 October review-workbench UI revalidation

The current console listing-detail page and its pure review helpers were
revalidated. The first submission had no approved baseline, but the diff helper
flattened a synthetic empty object and rendered a blank-name comparison row;
it now treats the absent baseline as no prior fields. Evidence-link filtering
also rejects HTTP(S) URLs that embed username/password credentials while
continuing to allow unique, credential-free HTTP(S) image references. Added
tests cover first-submission diffs, unsafe/duplicate evidence links, and
authenticated-operator decision payloads and reason validation.

Verification on 7 October:

- New review-helper tests: **3/3 passed**.
- Admin-web TypeScript typecheck: passed using the already installed Commerce
  web dependency tree via a temporary package-local symlink; the symlink was
  removed after the check. No dependency install or lockfile change occurred.
- Admin-web test set: **31/31 passed** using direct Node/tsx loading with the
  app tsconfig. The ordinary `pnpm` launcher first hit sandbox `EPERM` while
  creating tsx's IPC pipe; direct loading passed the same listed files.
- Root admin-web/session contracts: **12/12 passed**; `git diff --check` passed.

This is helper and source type verification, not a browser login or a live
operator review. Structured decision-reason policy, merchant correction
resubmission acceptance, cross-applicant evidence authorization, F6.3
concurrency/appeals, hosted identity and the rest of Phase 6 remain open.
