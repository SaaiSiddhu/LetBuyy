# Merchant account inbox — 22 October 2026

Implemented the owner's requested merchant communications feature on `develop` at `118209b4fde1b5a15313f4741bcac454690d15c8`. Console authoring, merchant web and native mobile are connected to the canonical per-account notifications inbox. Owned database/browser acceptance and both web production builds pass. **The owner separately approved migration372; it is installed and verified locally.** The normal signed-in Console workspace loads. Source is uncommitted; no actual merchant message has been published.

## Delivered behavior

- **Console → Merchant messages (`/merchant-messages`):** a super admin creates a draft for ad campaigns, offers, regulations or platform updates. The editor supports title, full plain-text content, an optional public HTTPS details link, optional expiry and all/selected eligible merchant accounts. Directory and recipient search paginate. A required internal reason accompanies changes. The saved-content review shows the recipient count and sample before an explicit publish action. Published content becomes immutable; corrections use another message. Publication history shows delivered and marked-read counts, with recorded observation time.
- **Merchant web → Account inbox:** available from All Stores before selecting a store, the notification panel and each store's sidebar. The same account sees one message across stores. The inbox provides category/read-state filters, pagination, a full selectable plain-text message, sender, expiry, safe link and explicit persistent mark-read. Loading, unavailable, retry and honest empty states remain distinct. Stale responses cannot replace the current filter or account view.
- **Merchant mobile → Account inbox:** the existing notification screen now renders the complete platform notice, category, expiry and safe explicit details action. It loads without a selected store, paginates and keeps the global unread count independent of the loaded page. Concurrent repeated read/delete completions cannot decrement the same visible unread item twice. Store preference loading is optional and cannot block the account inbox. Existing order notifications and preference controls remain on their canonical path.

The recipient population uses active merchant identity or ownership of an undeleted canonical site and excludes locked/disabled/deleted merchant identities. Buyer-only and admin-only accounts are excluded. Selected accounts are validated again at publication. An account with several stores receives one notification, not one per store. Published audience/read history is based on actual recipient notifications, rather than a newly calculated eligibility population.

## Authority and storage

Migration372 adds private announcement draft metadata and durable command receipts. It writes recipient copies into the existing `notifications` table; no parallel delivery engine, runtime, external broadcast or money capability was introduced. Both new tables have RLS and FORCE RLS with untrusted direct access revoked. The restricted service RPC checks the current canonical Console session, live permission witness and super-admin status; publication additionally requires fresh step-up. App BFFs keep cookie authentication and same-origin mutation checks. Revocation is rechecked before replay/recovery.

Save uses optimistic revisions. Publish serializes per announcement, locks/freezes eligible recipient IDs, checks the reviewed audience hash and expiry, then commits notification copies, announcement state, audit and receipt in one transaction. Duplicate concurrent commands have one effect. A changed payload with the same key is refused, and a lost committed response can recover the original receipt. Audit failure rolls the transaction back. Notification content is protected against later edits or hard deletion; read-state updates and soft dismissal preserve publication evidence. The paired DOWN refuses to erase a used publication history and is verified for an empty installation.

The existing outer idempotency cache assumed notification state changes were store-bound. Account-level mark-read/read-all/dismiss operations now have a narrowly matched intrinsic-idempotency exemption. Provider sends, device commands and webhook mutations retain their existing guards. A negative control confirms outbound send still demands its key.

## Verification

| Evidence | Result |
|---|---|
| Final owned API/database and connected browser run `a90926de22bf` | 8/8: seven API/database cases and one complete browser journey; zero skips/cancellations |
| Console unit/session/transport suites | 50/50 |
| Existing notification and idempotency contracts | 8/8 |
| Tenant-core reserved account route regression | 11/11 |
| Complete native Flutter suite | 365/365; final concurrency regression included |
| Native strict analysis | No issues |
| Console and Merchant production builds | Both pass in a separate source copy |
| Console, Merchant, Gateway and shared-types type checks | Pass |
| Scoped Console/Merchant ESLint, CSS stylelint and whitespace | Exit0; one existing AllStoresClient theme-effect warning, no errors |
| Domain, tenant, migration-safety and design-system gates | Pass:227 app routes,317 registered tenant tables; no ratchet weakened |

The browser journey uses normal merchant password sign-in and normal Console magic-proof/TOTP sign-in, mounted Next pages/BFF, Gateway, PostgREST and owned disposable PostgreSQL. It creates a selected-account draft, reviews exact saved content, publishes, loses the committed reply and recovers it, opens the merchant's full message, verifies literal script content remains inert, persists read state after reload, exercises offline recovery and filters, and confirms the same single item from account and store routes. It verifies the admin read count and390px layout. Console and merchant screenshots were inspected. The Console browser uses its development runtime; Merchant/Identity use their production-built fixture runtime, with separate Console production-build proof.

Database coverage includes RLS/grants, empty DOWN/reapply, private drafts, buyer/admin/locked recipient exclusion, canonical site owners without a principal, audience changes, stale revisions, concurrent duplicates, changed-key payload, durable recovery, notification immutability, foreign read/update refusal, persistent read/count, soft dismissal, mandatory-audit fault rollback/retry, live session/permission revocation, super-admin/step-up requirements, unsafe payload/link refusal, outage503 and nonempty-DOWN refusal. All four recorded owned runs report terminal cleanup with no remaining containers, networks or volumes.

Earlier failures remain recorded. They exposed the site-scoped idempotency assumption and missing site-owner eligibility. Test fixes waited for Next navigation before asserting the new draft ID and corrected an overlong synthetic tenant label. Native tests were updated for the renamed heading and now scroll to the existing lazy preference section; no toggle assertion was removed. One stale-copy native run is retained but excluded from acceptance; the final absolute-path source copy and365/365 run are authoritative. No application guard, rate limit or assertion was relaxed.

Runtime and test sources in both verification snapshots match delivery. Source fingerprints and the232-file dirty baseline are recorded;221 pre-existing dirty files were byte-unchanged before continuity updates,11 were intentionally extended and none were deleted. The migration sequence gate remains **red** for untracked370/371/372. This task does not authorize staging or committing; that gate remains intact.

## Approved local installation

Read-only local preflight found migration head371, no announcement/receipt tables, migration owner `postgres` non-superuser and every event trigger enabled. After the owner's explicit reply, “Approve local inbox installation,” the exact reviewed372 maintenance transaction committed successfully. It checked the predecessor and source hash, used bounded timeouts and a migration advisory lock, temporarily elevated the migration owner within one transaction, installed schema and its migration-ledger record, and restored the original non-superuser profile before commit. No guard was disabled and no business-row DML was performed.

Postflight proves migration head372, exact migration-ledger source SHA256 `c7b6d0f51304b4f7c96981d11a906f625a6e64d830e54e4151ef03c743c1f44d`, `postgres.rolsuper=false`, non-superuser application roles, every event trigger and all ten subscription-tax row guards enabled, RLS+FORCE on both message tables, untrusted direct table access denied, service-only main RPC execution and private helpers denied. Announcement, command-receipt and platform-message counts are all zero.

The actual local Console `/merchant-messages` page loaded through the existing normal signed-in operator session. Its directory finished loading with the honest empty state, and the authoring form is visible. No draft/save/publication, factor provisioning, account change or permission grant occurred. A stale prior tab reached a browser error wrapper; a fresh tab loaded the approved localhost page normally without changing the server environment or any protection. The working page is left open. Its local screenshot remains private; repository screenshots contain synthetic fixtures only.

The initial delivery checkpoint recorded372 approval as pending; the explicit owner approval and this successful installation supersede that checkpoint. The source/test checks were not repeated because installation changed no runtime/test source. The owner can now author and review content through Console → Merchant messages; publishing real content remains an explicit content/audience action.

Native365 host tests and strict analysis do not claim APK, physical-device or hosted acceptance. Global operational search, merchant-attention triage and a unified merchant timeline remain separate backlog items. There is no external email/SMS/WhatsApp/push delivery, provider transaction, new permission authority, merge/push/deploy or parent-programme acceptance change.

[Structured receipt](MERCHANT_ACCOUNT_INBOX_2026-10-22.json) · [Synthetic screenshots, source identity and sanitized evidence](../docs/evidence/merchant-account-inbox-2026-10-22/).
