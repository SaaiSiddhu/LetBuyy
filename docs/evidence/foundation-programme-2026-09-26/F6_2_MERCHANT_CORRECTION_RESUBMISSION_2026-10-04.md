# F6.2 merchant correction and listing resubmission — 4 October 2026

## Outcome

Added an authenticated merchant path to inspect the marketplace state and rejection feedback for a product, describe its corrections, and resubmit the updated product revision. The operation reuses the existing tenant-scoped `channel_listings` API and `transition_channel_listing` state writer. It performs `rejected → draft → pending_review` in one database transaction; the second edge captures the current revision snapshot and reinstates the reviewer queue. A failed second edge rolls the first edge back.

The merchant API list query can now filter by product within its already-resolved store. A same-origin merchant API route resolves store ownership, loads that store's listing, and forwards the resubmission using the merchant session. The product editor shows status and reviewer feedback, requires the product to be saved first, collects a short correction response, disables duplicate submission, retains its idempotency key on retry and refreshes status after success. The database receipt binds the key to site, listing, actor, final transition and response text; a changed request with the same key conflicts.

No review-reason taxonomy was added. The existing reviewer explanation remains visible to the merchant; structured categories/guidance remain a separate decision-dependent slice.

## Verification

- `node --import tsx --test services/api-gateway/src/__tests__/channel-listings.test.ts`: **19/19 passed**, including tenant-scope filter wiring, strict resubmit input validation and request-bound RPC arguments.
- `pnpm --filter @letbuyy/api-gateway typecheck`: passed.
- `pnpm run validate:migrations`: passed with the new migration/rollback pair.
- `node --test tests/executable/marketplace-review-revision-postgres.test.mjs`: **8/8 passed** against the isolated `letbuyy_executable_review_revision` database. It verifies correct-tenant resubmission, cross-tenant denial with the rejected state preserved, revision snapshot capture, same-key replay, changed-payload conflict, atomic rollback when the marketplace category prerequisite fails, successful retry, and the existing revision/assignment/rollback cases.
- `node --check tests/executable/marketplace-review-revision-postgres.test.mjs`: passed.
- `git diff --check`: passed.
- Merchant web typecheck is **not verified**. The worktree lacks its app-local `node_modules`; TypeScript reported missing `next`, `react` and linked workspace packages. Dependencies and lockfiles were not changed.
- Interactive browser, merchant login, hosted database, live listing, deployment, merge and push were not used.

## Remaining acceptance

Run the authenticated Gateway/BFF path in the merchant browser with a real merchant session and verify it reloads the saved listing state. Run the merchant app typecheck when its app dependencies are available. Structured decision reasons still need the owner's policy choice. Source inspection found no listing-specific private document/attachment model or upload route: the console's current “evidence” is seller-provided catalog image URLs from the immutable product snapshot, visible to authorized reviewers. Private applicant evidence is therefore not implemented; if the workflow requires it, define purpose, reviewer scope, retention and download audit before introducing storage or signed URLs. F6.3 concurrency/appeals and the remaining Phase 6 read, purchase, complaint/takedown and capacity acceptance remain open.

## 5 October browser-path investigation

An owned Chromium attempt reached the real Merchant product editor and the
Gateway's real `GET /channel-listings` route, but the route correctly returned
503 because this browser suite binds the owned PostgREST sidecar and does not
provide the Gateway a pooled SQL connection. The channel-listing tenant path
requires `withTenantTx` and fails closed without that connection; the owned
runner intentionally keeps Postgres unpublished and reachable only through its
verified `docker exec` handle. No browser acceptance is claimed from this
attempt, and the disposable runner resources were cleaned. A follow-up needs a
runner-owned way to execute the Gateway inside the owned Postgres network, or a
reviewed loopback-only SQL tunnel that preserves the runner's ownership checks.

## 10 October merchant correction BFF contract coverage

The same-origin merchant status/resubmission route now exposes injectable
dependencies for focused contract tests, and its six-case suite is included in
the merchant-web test command. Tests cover the store-scoped product lookup,
session-required Gateway calls, use of the resolved store ID rather than a
forged body value, malformed IDs and correction inputs, store-ownership denial,
missing listings, and preservation of an upstream 409 conflict. The merchant
web TypeScript check now passes with a temporary symlink to the already-present
matching Commerce dependency tree; the symlink was removed after the command.

Verification on 10 October:

- `TMPDIR=/private/tmp node --import tsx --test tests/marketplace-listing-route.test.ts` from `apps/merchant/web`: **6/6 passed**.
- `pnpm --filter @letbuyy/merchant-web typecheck`: passed after the focused tests. An initial `tsx` CLI test invocation hit the sandbox's IPC-pipe `EPERM`; the direct Node/tsx invocation with `TMPDIR=/private/tmp` passed.
- `git diff --check`: passed after recording this update.

This verifies the merchant BFF contract, not a signed-in browser session, real
Gateway/Postgres resubmission, or hosted behavior. The prior owned browser
attempt remains blocked before Gateway tests because Docker is unavailable in
this environment. Structured decision categories still await the owner's
policy choice; private applicant evidence remains unmodeled and requires a
purpose, authorization scope, retention and download-audit decision before
storage is introduced. F6.2 and Phase 6 remain partial.

## 10 October merchant review panel presentation coverage

The rejected-listing review panel was extracted into a focused component while
the product editor retains responsibility for loading the store-scoped status,
maintaining the correction text and submission idempotency key, and reloading
the listing after success. Rendered-markup tests assert that reviewer feedback
is visible, the resubmit control is disabled for unsaved product edits, short
correction text and an in-flight request, and enabled for a saved correction
with sufficient text. They also cover status-read failure, a failed resubmit,
and pending/approved states without correction controls. The assertions inspect
the rendered button's native `disabled` attribute rather than matching the
component's always-present CSS class names.

Verification on 10 October:

- `pnpm --filter @letbuyy/merchant-web test`: **771/771 passed**. Its focused
  Node/tsx run passed 13/13 (the 6 BFF cases, 3 review-panel rendering cases,
  and 4 existing SettingsPane cases); the package's shared contract/editor
  suites passed 758/758.
- `pnpm --filter @letbuyy/merchant-web typecheck`: passed using the matching
  already-installed Commerce dependency tree through a temporary symlink,
  removed after verification.
- `git diff --check` and merchant package JSON parsing: passed.

These are rendered-markup and BFF contract tests, not a browser session or a
real Gateway/Postgres correction journey. Docker is still unavailable in this
environment, so owned-browser/database acceptance remains blocked. Structured
decision-category policy awaits the owner's choice; private applicant evidence
is unmodeled and needs purpose, authorization scope, retention and download
audit decisions before adding storage. F6.2, Phase 6 and the full programme
remain partial.

## 10 October cross-applicant status lookup guard

The merchant BFF's GET path now has explicit denial coverage in addition to the
existing POST denial case: when store ownership resolution rejects the
requesting merchant, status lookup returns the resolver's 403 and makes no
Gateway request for another store's listing. The test checks that denial occurs
before any listing metadata is read. This covers only the merchant status BFF
boundary; it does not establish live session or database isolation, operator
evidence access, or a private-document boundary (no private applicant evidence
model exists).

Verification on 10 October:

- BFF and rendered review-panel tests: **10/10 passed**.
- `pnpm --filter @letbuyy/merchant-web test`: package-local Node/tsx tests
  passed **14/14** (7 BFF, 3 review-panel and 4 existing SettingsPane tests);
  the separately invoked shared contract/editor suites passed **771/771**.
- `pnpm --filter @letbuyy/merchant-web typecheck`: passed using the matching
  installed Commerce dependencies through a temporary symlink, removed after
  verification. `git diff --check` passed.

The merchant browser/owned-Postgres route remains unverified because Docker is
unavailable. Structured reviewer-reason categories still await the owner's
policy choice. F6.2, Phase 6 and the full programme remain incomplete.

## 10 October retry-idempotency correction

Source review found that changing the correction text cleared the browser's
resubmission key unconditionally, so an unchanged correction retried after a
network/upstream failure did not reliably reuse its original key. The editor
now associates the key with the trimmed correction payload: a retry with the
same normalized text reuses the key, whitespace-only edits retain it, and a
material text edit clears it so the next request receives a fresh key. This
matches the server receipt's request binding and preserves safe retry behavior.

Verification on 10 October:

- Idempotency-key behavior tests: **3/3 passed**, covering same-payload retry,
  changed-payload replacement and whitespace normalization.
- Merchant BFF, review-panel rendering, idempotency and SettingsPane tests:
  **17/17 passed** with direct Node/tsx loading.
- `pnpm --filter @letbuyy/merchant-web test`: package-local **17/17** and
  shared contract/editor suites **771/771** passed.
- `pnpm --filter @letbuyy/merchant-web typecheck` and `git diff --check`:
  passed using the matching installed Commerce dependencies through a temporary
  symlink; the symlink was removed after verification.

This fixes local browser retry-key state and its unit contract; it does not
establish a signed-in browser/Gateway/Postgres journey. Docker remains
unavailable, structured review-reason policy still awaits the owner's choice,
private applicant evidence remains unmodeled, and F6.2/Phase 6 remain partial.
