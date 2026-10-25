# Runtime07 recovery review — 25 October 2026

The recovery source and private inputs have passed preflight and independent review. **The restore has not run.** The existing database, original volume, saved drafts, releases, orders and backups remain preserved.

## The next executable step

One additional isolated restore qualification, with one attempt and a 600-second whole-process limit. The exact frozen command is [RESTORE_REHEARSAL_COMMAND01.json](RESTORE_REHEARSAL_COMMAND01.json).

It creates a fresh protected PostgreSQL test resource, its PostgREST sidecar and a local REST proxy. It restores the verified full backup into the empty test database. It then checks the retained application identity, populated orders and theme instances, complete row and metadata hashes, logical sequences, foreign-key enforcement and role settings.

The canonical runner must create and verify a durable safety archive and private global-role profile before removing the new copy. If that safety checkpoint cannot complete, the protected resources remain retained. The original database and volume are never cleanup targets.

This step does not build or start the buyer, merchant or identity apps; retire old listeners; generate QA keys; change the public callback; or make a payment. No migrations or already-applied theme patches are replayed into the restored data.

## Evidence already accepted

- Exact original-theme source with the capture, preview and editor fixes; 17 scoped source changes. [Source handoff](HANDOFF.json).
- Actual preserved-database reader qualification: 20 roles, eight memberships and eight orders matched, using read-only queries.
- Exact candidate TSX launcher version and harmless TypeScript smoke, both successful. [CLI result](SELECTED_CLI_PREFLIGHT01.json).
- Full private source, archive, fence, role and witness binding checks. [Redacted preflight](PRIVATE_CAPSULE_FINAL_PREFLIGHT01.json).
- Independent review of the source, bounded supervisor and exact command. [Command review](../themes-shared-review-20261025-01/ORIGINAL210_RESTORE_COMMAND_SOURCE_REVIEW_02.json).

The source review corrected the local fixture's unnecessary `supabase_admin` requirement. No role was invented or added; all six required local roles and the complete original role profiles remain checked. The launcher now fails before provisioning if its actual selected executable is missing or invalid.

## Why another execution approval is pending

The earlier human approval allowed at most three isolated database cohorts. Capture RED, capture GREEN and the apparel launcher failure consumed all three. The pending request authorizes exactly one additional restore qualification; it does not expand the previous allowance silently.

The four-hour public HTTPS callback approval is already recorded. Its clock has **not started**: actual recovered receiver health and signature checks must pass first.

## Completion remains open

Six intended theme Razorpay Test Mode purchases are already verified. Marginalia, Kindred, MadeYours and Playfield still need their intended purchases. Theme-specific case matrices and independent certification remain open; there are no full theme or production-release certificates yet.

After restore parity passes, the next delivery step is reviewed application staging and a controlled return to the same application identity and origins, followed by the existing single browser queue. Completed evidence is reused where its source and runtime dependencies remain applicable.
