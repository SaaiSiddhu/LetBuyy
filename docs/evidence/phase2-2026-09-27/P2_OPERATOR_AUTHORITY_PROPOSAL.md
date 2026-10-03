# D04 operator authority — concrete owner decision

2026-10-03. PROPOSAL ONLY; not an owner approval. Current role capabilities and support queue access stay as already approved by O1. This answers the still-open D04 bootstrap/assignment/recovery/MFA questions, separately from engineering the canonical identity transition.

| Control | Proposed behavior | Existing authority / what is missing |
| --- | --- | --- |
| Initial bootstrap | Only Saai's explicitly designated canonical account may obtain the initial owner/operator grant; one-time bootstrap, recorded audit, no arbitrary email-to-admin promotion | A real designated account/grant is not inferred or provisioned here |
| Assign/revoke platform roles | Owner only initially. Reviewer/operator/lead scopes stay bounded; staff never inherit platform access | O1 grants capabilities/reachability, not who may provision those roles |
| MFA enrollment | Authenticated eligible operators enroll and verify their own TOTP factor; fresh step-up for rotation and privileged actions; no reusable `mfaVerified` boolean from a shared app secret | Current console uses deploy-config factors and a symmetric envelope; neither is accepted as the permanent design |
| Ordinary lost-factor recovery | Pre-issued one-time recovery codes, stored as hashes, consumed atomically; revoke existing sessions after use/rotation | No reset by matching email or a service-level bearer alone |
| Manual recovery override | Denied until a distinct authorized human recovery approver is designated; no assistant acts as the approver | No person or approval invented |
| High-risk actions | Keep existing stronger maker/checker constraints. Where an additional approval is required, deny execution until a distinct human approver is designated | Owner-only bootstrap does not silently waive dual control |

The owner can approve owner-only initial control while leaving manual override/high-risk approval locked, or designate a second person and their permitted responsibilities now. Their account identifier is required only before provisioning that real grant. All implementation remains local until separately authorized; this decision does not merge, deploy, send real messages or activate a provider.

The answer will be recorded verbatim with its scope. Silence or a preselected tool option is not an answer. Independent customer-session and other dependency-ready work continues while this decision is pending.
