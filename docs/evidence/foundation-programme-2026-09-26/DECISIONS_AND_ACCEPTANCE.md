# Decisions, dependencies and acceptance

> **Superseded in part by the owner on 26 September 2026:** no real marketplace users require migration; remove Firebase from the marketplace runtime and use direct canonical LetBuyy sign-in. Do not request Firebase credentials or preserve the legacy login gate. Read [Phase 1R revised plan](PHASE_1R_FIREBASE_FREE_MARKETPLACE_PLAN.md) before using this historical plan/prompt. Other preservation and no-deployment constraints remain.

Date: 26 September 2026. Companion to the [77-package programme](FOUNDATION_PROGRAMME.md). This is a proposed acceptance register, not a sign-off. No feature implementation occurred during creation of these planning artifacts.

## Status vocabulary

- **PLANNED:** intended outcome; may reuse substantial existing code.
- **IMPLEMENTED:** required code/config is present and reviewed, with gaps stated.
- **LOCAL VERIFIED:** specified flow passed against owned local runtime.
- **DEVICE VERIFIED:** normal native flow passed on a named device/build; emulator and physical hardware distinguished.
- **SANDBOX VERIFIED:** actual provider test environment confirms the intended behavior.
- **HOSTED VERIFIED:** named deployed artifact/environment passed relevant checks.
- **CLOSED:** every mandatory acceptance item for the declared boundary has sufficient evidence.
- **BLOCKED:** an identified dependency prevents a specific required item; other feasible work can continue.

Do not turn these into an artificial numeric completion percentage. A mock can verify contract handling; it cannot stand in for a normal user login, provider settlement or deployed association file.

## Phase baseline and acceptance gate

| Phase | Starting status | Mandatory closure evidence | Known external gate |
|---|---|---|---|
| 1 Runtime/Android | PARTIAL LOCAL VERIFICATION; OPEN | Reproduction, isolated restore, normal Android profile/address/switch flow, meaningful gates and honest association verdict | Legitimate test sign-in; hosted association correction authorization/access |
| 2 Identity | PLANNED EXPANSION; existing buyer/security work | Buyer cross-channel ownership, limited staff/operator flows, actual-role RLS/pool denial and migration reconciliation | Operator recovery/MFA and staff transition policy where unresolved |
| 3 Specification | RESEARCH/POLICY INPUTS PRESENT | Consistent commercial rules, category/legal matrix, provider eligibility and cloud ownership register | Owner values, correct provider accounts and professional review |
| 4 Merchant readiness | PLANNED; canonical systems exist | Storefront-only and marketplace onboarding, correction, entitlements, private evidence and theme publication | Approved KYC/provider behavior; supported custom-domain setup |
| 5 Catalog | PLANNED; existing products/listings | One catalog across channels, variants/labels/stock, browse/filter/serviceability and migration parity | Launch categories and applicable declarations |
| 6 Review | PLANNED; revision approval primitives exist | Real reviewer workflow and no ineligible discovery/purchase bypass | Review staffing, policy and escalation responsibilities |
| 7 Reels | PLANNED; legacy UI exists | Private upload → approval → Android playback/cart; replacement/takedown and verified migration | Managed media selection/access, rights/policy and limits |
| 8 Checkout | PLANNED; substantial canonical foundations | Normal channel purchases, provider test proof, retries, late capture, fulfillment and partial refunds | Approved marketplace provider sandbox and seller mapping |
| 9 Settlement | PLANNED; canonical ledger exists | Balanced snapshots, weekly eligibility, provider batch/reconciliation and statements | Provider schedule/report support and tax/accounting decisions |
| 10 Ads | PLANNED; credit/campaign foundations exist | CPC/CPM/purchase charge, validity, caps, attribution, refund reversal and reporting | Billable-event/attribution definitions and funding provider proof |
| 11 Release | PLANNED | Exact-candidate cross-role flows, recovery, security/performance/accessibility, operations and release packet | Separate hosted/release authority, provider approval and operating owners |

A planned label never means “nothing exists.” Phase discovery must inspect and complete canonical code before proposing new implementations.

## Decision register

The accepted storefront/reel scope, zero storefront commission, category marketplace commission, provider-managed weekly eligible settlement, progressive verification and three ad models are already decisions. Do not ask the owner to reapprove them. The following are missing specifics or authority boundaries; collect them when their package needs them, not as a giant questionnaire before any work.

| ID | Decision or missing evidence | Earliest dependent work | Proposed handling; never silently assume approval |
|---|---|---|---|
| D01 | Legitimate Firebase-backed test login available for normal Android flow | F1.4 | User signs in interactively or supplies an approved test-account path without placing secrets in reports. No bypass/token injection. |
| D02 | Whether/how a platform-wide public storefront directory should be exposed | F1.5/F5.6 | Preserve deliberate fail-closed tenant boundary; implement graceful unavailable behavior first. Public exposure requires a scoped public-read design and resolved product decision. |
| D03 | Employee/staff migration to declared identity organization target | F2.5 | Map current permissions/site ownership, reconcile IDs and rehearse rollback. Do not blindly enable dormant model flags. |
| D04 | Operator bootstrap, recovery, MFA and high-risk separation of duties | F2.6 | Use existing console hardening; propose a documented limited-access policy and real non-owner test accounts. No unsupported authentication assurance certification. |
| D05 | Data purpose, retention, deletion exceptions and incident responsibilities | F2.7/F3.5 | Minimize new collection; version applicable policies; resolve required accounting/legal retention before deletion implementation. |
| D06 | Exact launch categories and seller entity/tax/geography combinations | F3.4/F5.3 | Start with a reviewed allowlist. Unsupported categories stay unavailable; no universal regulatory claim. |
| D07 | Category rates, subscription/founding commitments, fee bases and rounding | F3.2/F9.2 | Preserve accepted direction; model explicit effective-dated values and reviewed worked examples. |
| D08 | Eligible marketplace payment provider and contracting entity | F3.3 | Seek written current eligibility and supported seller/fund-flow matrix; do not select by API convenience alone. |
| D09 | Whether every marketplace listing requires a reel, or only reel-feed listings | F5.4/F7.3 | Keep all reel-feed entries gated by approved matching media; do not silently ban valid browse-only listings without a decision. |
| D10 | Upload duration/size/retention, review staffing and response commitments | F6.7/F7.2 | Recommend limits after device/provider and workload measurements. State quotas/SLAs as proposals until adopted. |
| D11 | Correct Cloudflare/Vercel/Supabase account/project/domain ownership | F3.6; hosted F1.5 | Read-only identity/resource mapping first. Current accessible unmatched Supabase projects remain untouched. |
| D12 | Weekly cutoff, holds, refund window, negative balance and COD remittance | F3.2/F9.4 | Version timezone/boundaries and provider-supported transitions; disclose estimated versus final settlement. |
| D13 | Qualified click/impression/purchase, attribution window and refund charging | F10.3–F10.5 | Define deterministic fixtures and ledger treatment before billing; never infer “purchase” from a client event. |
| D14 | Recovery objectives, cost envelope and initial device/load matrix | F3.6/F11.3–F11.4 | Propose against business impact and measured restoration/workload, not unverified topology limits. |
| D15 | Initial merchant cohort, support coverage and release stop conditions | F11.5–F11.7 | Prepare reviewed operating packet; no onboarding messages, rollout or deployment in this planning scope. |

## Mandatory complete journeys

| Journey | Required persona/surface | Positive proof | Negative or recovery proof | Owners |
|---|---|---|---|---|
| Buyer identity | Two real test buyers, Android + trusted web | Sign-in/callback/profile/address/default/restart/logout; same canonical ownership | Cross-buyer denial, stale UI on switch, replay/revocation | F1/F2 |
| Merchant staff | Owner and restricted staff using separate credentials | Invite, permitted site tasks, revoke | Other-site denial; staff cannot act as owner | F2/F4 |
| Operator | Limited reviewer and appropriate privileged operator | Review/correction and controlled sensitive action | Self-approval, stale review and privilege escalation denied | F2/F6/F9 |
| Storefront merchant | Merchant web and required mobile tasks | Basic onboarding → product → Liquid draft/preview/publish → checkout handoff | Subscription restriction preserves orders/refunds; draft content private | F4/F5/F8 |
| Marketplace seller | Merchant and operator | Additional verification → product submission → approval | Paid plan/sandbox KYC cannot bypass approval | F4/F6 |
| Reel commerce | Seller/reviewer/buyer Android | Upload/process/match approval → playback → current detail/cart | Asset replacement, false match and takedown enforcement | F7 |
| Purchase recovery | Buyer + provider sandbox + merchant staff | Storefront and multi-seller order → fulfillment | Duplicate callback, timeout after capture, late capture, stock race | F8 |
| Refund and settlement | Buyer/merchant/operator/provider sandbox | Partial refund → weekly eligible batch → statement | Refund retry, hold, negative adjustment, partial provider failure | F8/F9 |
| Advertising | Merchant, eligible buyer traffic, operator | Top-up → each billing model → report | Invalid/replayed event, budget race, refund/attribution conflict | F10 |
| Recovery/operations | Named operator, owned environment | Restore DB/assets/key material and recover stuck job/incident | Missing asset, expired key, unmatched money entry and rollback drill | F11 |

A full web pass is not an Android pass. A native route opened through adb is not a verified domain association. A privileged DB query is not a tenant isolation test. A provider mock is not a settlement test. A 200 from deployment protection is not an app smoke pass.

## Evidence record template

For each requirement retain: package/requirement ID; exact intended behavior; code/config/schema/client artifact; environment and actual role; command or UI procedure; expected and observed results; timestamp; safe logs/screenshots/DB assertions/provider identifiers; failures/skips; source/version for research decisions; recovery procedure; reviewer verdict. Keep secrets and personal documents outside public artifacts.

Record the implementation checkpoint and the checkpoint actually tested. With uncommitted work, use a safe source/config manifest; SHA alone cannot identify the whole working tree. Describe inspected historical logs as inspected evidence, not independently rerun results. If later fixes change the measured behavior, rerun the affected checks.

## Risk register and controls

| Risk | Control and owner |
|---|---|
| Successful local backend masks unfinished buyer experience | F1 normal Android flow remains an explicit open gate. |
| Public-directory “fix” weakens tenancy | F1.5 preserves guard; D02 resolves public read authority separately. |
| Stale governance invalidates correct implementation or certifies drift | F1.6/F3.1 align tests with authorized rules, preserving failures/history. |
| Staff migration combines identity and privilege | F2.5 explicit data mapping and independently tested authorization; no automatic privilege merge. |
| Provider eligibility discovered after months of integration | F3.3 early written capability/eligibility confirmation. |
| Generated topology mistaken for a deployed system | F3.6 requires real account/resource/artifact evidence. |
| Video/ads overwhelm old order-based capacity assumptions | F7/F10 instrument actual media/event demand; F11 tests the approved mix. |
| Approved product/reel mutated after review | F6/F7 immutable revision binding and revocation on material replacement. |
| At-least-once events duplicate money | F8/F9/F10 durable idempotency, transaction boundaries and reconciliation. |
| Database restore omits media or encryption capability | F1/F11 restore data, object bytes and necessary key/config material as separately measured components. |
| “Massive prompt” produces scaffolds and an overconfident report | Execution contract mandates complete journeys, fix/retest and evidence-based CTO review. |

## Explicit exclusions and preservation

No deployment, staging/main promotion, force-push, production payment activation, backup deletion or fresh clone replacing the restored repository. No new service fleet, second buyer password system, second catalog/ledger, quick-commerce expansion, premature analytics/fraud ML platform, reserved runtime activation or speculative million-merchant design.

Keep old Mac and T7 backups until required new-machine runtime verification succeeds. Any later legacy retirement must meet consumer/data/recovery gates; this programme does not authorize deleting backups or signing assets.
