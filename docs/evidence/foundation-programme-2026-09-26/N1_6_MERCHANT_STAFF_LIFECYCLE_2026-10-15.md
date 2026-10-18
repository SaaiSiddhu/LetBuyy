# N1.6 merchant staff lifecycle repair — 15 October 2026

N1.6 remains in progress. Direct verified-account provisioning, limited staff access, role changes and removal now have real-worker/database and normal browser evidence. Canonical invitation/acceptance, operator recovery, current Android device proof, approved provider delivery and hosted proof remain separate incomplete requirements. The full N1–N9 programme and all 63 execution packages, 77 original acceptance mappings and 103 feature dispositions remain preserved.

## Corrected reproduction

The first staff suites (`140702a4e258`, `ad78f54bb083`) reused a globally unique synthetic store name. Their four failing probes stopped during setup and did not prove runtime defects. Those raw runs and the evidence correction are retained. Runtime320 recovery in the mixed first run remains independently valid.

With unique per-case fixture tags and the exact pre-repair source hashes recovered from the 9425-file checkpoint, `37a1e21f52ef` reproduced four actual failures through the complete worker, PostgREST and owned PostgreSQL:

- An unknown canonical subject asserting the owner's email received the owner's employee roster.
- A membership with `status=active` and `is_active=false` entered its store shell.
- A provisioned active staff account could not discover its assigned store in the normal store picker.
- A failed mandatory audit write still returned a successful staff creation and retained the membership.

The positive verified staff creation/profile probe also passed. After the first ID/active/discovery repair, `ee6b68195e23` passed four of five probes, with audit atomicity still failing. These are the valid before/after findings; the earlier fixture collisions are not counted as defects closed.

## Canonical change

The issuer subject resolves only by `users_custom.id`; an asserted email cannot alias another account. Missing subjects are denied, and account storage failures return a sanitized unavailable response. Active staff readers require the actual `employees.user_id`, exact store, active status, `is_active=true` and no deletion. Bound-store credentials cannot navigate or read an employee profile outside their bound store.

Migration321 adds a private read of the existing site ownership and employee membership authorities. It computes accessible store pagination/counts from one database snapshot, deduplicates an owner who is also staff and exposes only shell metadata to staff. Staff UUID and handle navigation retain the same authority. No shadow identity/membership store is activated, and private payment settings are excluded from staff store discovery.

Migration322 implements staff creation, role/grant update and soft removal as one transaction with mandatory lifecycle audit and a retained receipt in the existing `idempotency_keys` table. It rechecks current canonical owner and bound store before effects and receipt replay. The site lock serializes staff seat consumption; the existing billing-core catalog/defaults resolve the cap, with a source hash checked again at mutation time. This is not a new billing policy owner or a claim of globally serializable subscription transitions.

A replay key is bound to actor, store, operation, target, intent and observed version. Updates/removal require the client's observed `updated_at`; stale changes conflict rather than overwrite newer grants. An identical committed retry returns the original response without another lifecycle effect/audit. Role-only changes replace grants with the shared auth-core role defaults, fixing the native client's previous privilege-retaining downgrade. Explicit owner-selected allowlisted store permissions remain supported; platform roles/scopes and wildcards remain denied. A matched account must already be email verified to link immediately; unmatched/unverified records remain unlinked and pending.

The private functions deny ordinary database roles. Clean322/321 rollback/reapply is tested, and322 rollback refuses retained lifecycle receipts instead of discarding their provenance. No hosted migration has been applied.

Unavailable/malformed staff-capacity readback is shown as unavailable and creation stays disabled until a successful reload; a failed policy read never displays unlimited capacity. Web mutators check exact Origin and a caller-supplied stable key before forwarding credentials. They bind the resolved store, forward observed versions and preserve logical retry IDs across ambiguous replies. Browser persistent storage holds only opaque keys and intent hashes. The Flutter service persists pending logical requests through the app's existing encrypted storage before sending, reuses them in a new service instance, serializes its mutations and sends observed versions. The shared Dart transport already preserves caller options and DELETE bodies. UI text now describes saved active/pending records accurately and does not claim an invitation email was sent.

## Current verification

- `1cdcfa0b3b13`: normal compiled Identity + Merchant Chromium journey1/1 and expanded real-worker lifecycle18/18, total19/19, zero skips/TODO. Normal password login issues both owner and staff sessions; no positive cookie injection or auth bypass is used. The named database-hop fault loses committed create replies. The UI retries the same key, leaving one employee, lifecycle audit and receipt. The same existing staff session loses writes after a UI role downgrade and loses store access after UI removal. Missing/sibling Origin mutations are refused before membership creation.
- The18 database cases cover canonical subject isolation, disabled staff, store discovery/private-field isolation and bound scope, actual ordinary-role invocation denials, clean rollback/reapply, retained-receipt rollback refusal, create/update/remove audit faults, receipt insertion failure, same-key recovery, concurrent identical retries, conflicting payloads, the last free-plan seat race, stale updates, role-only grant downgrade, removal replay, former-owner denial, malformed JSON and account/discovery outages.
- `85c1fee9ce86`: final web source normal compiled browser1/1, including named staff-policy outage, disabled creation, successful capacity reload and the complete staff journey. `69a991918e81`: final read/DTO polish lifecycle18/18. The subsequently strengthened private SQL grant-array validation and all lifecycle cases pass19/19 in `94d45cd75283`; browser1/1 predates only that private input-guard strengthening, which cannot be reached with malformed grants through the validated browser path. N9 still requires assembled exact-candidate proof.
- `82ff1e24473e`: preserved existing real staff product journey1/1. This older mounted-router/shadow regression is not substituted for the new normal browser/full-worker proof. Its earlier failure in `112b838f5ac1` was a test caller missing the newly required key/version; that mixed run is not reported as wholly green. Its independent lifecycle suite was14/14.
- Flutter: durable retry/version client contracts2/2; existing staff service contract1/1; targeted staff source analysis clean. These are client tests, not current Android device evidence.
- Gateway/auth fast regression:1450 total,1449 passing, zero failing, one pre-existing `LB-BIL-002` billing TODO. The final record includes a further type/source check after the reviewed read-error/DTO polish; see the adjacent verification JSON/logs.
- The first browser run `58f8c2c00a16` observed successful normal owner login but failed because its assertion tried to read a browser response body after navigation. It is retained as a failed harness run, not a passing full journey. The current normal browser run above corrected that assertion.

Evidence root: `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.6`. Source lists, individual raw runs, current guard/type/client logs and the exact safe-source manifest are retained there. Counts from successive runs overlap and must not be added as unique coverage.

## Remaining scope and limits

The retired invite/accept endpoints still return503. A pending record does not yet become an invitation that a newly verified account can accept. The current startup contract requires implementing that complete canonical flow; historical comments about a retired GoTrue path do not waive it. Continue through the existing employee invitation, identity, auth-core and notification owners, without introducing another issuer or enabling the frozen ecosystem.

`ACCESS-RESEND-V1` remains owner-confirmed pending. Official Turnstile test keys prove test widget/Siteverify transport only; no real inbox delivery, production anti-bot protection, hosted readiness or provider certification follows. Operator MFA custody/recovery, other accepted protected-action effects, and the whole N1.6/N1 acceptance remain open. Android has no device verdict for these staff changes yet.

An additional route-ownership heuristic reports two existing routes whose real guards are outside its recognized patterns: operator merchant overview and storefront customer profile. Their current explicit operator permission/session predicates were inspected; the heuristic is not represented as green and is retained for N1.1 reconciliation. The five established domain/issuer/tenant/migration/dev-bypass guards and owned-lane inventory have their own current results.


## Subsequent324 implementation checkpoint — 15 October 2026

The earlier statement that invite/accept return503 and unverified direct records remain pending is superseded by [the canonical invitation implementation](N1_6_CANONICAL_STAFF_INVITATIONS_2026-10-15.md). Invitations now require explicit verified-account consent and durable jobs. Unknown/unverified direct creation returns409 with no dead pending record; verified direct provisioning remains. Normal web/browser20/20 and final invitation/worker/queue recovery26/26 pass. Native client/widget/transport checks pass with clean analysis; actual Android, approved inbox/provider and hosted gates remain open. Earlier reproduction/history is preserved above; N1.6 is not closed.
