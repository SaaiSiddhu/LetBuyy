# N1.6 independent approver eligibility — owner decision

On 15 October 2026, the owner answered the active Goal's R02/D04 question:

> Active platform super admins only

For V1 protected platform actions, the independent approver must therefore be a currently active platform super admin. The requester cannot approve their own request. A merchant/staff role string or a typed actor ID is not an independent approver session or consent.

This resolves approver eligibility. The implementation must still bind the second person's authenticated consent to the exact action and payload, check live eligibility and revocation before effects, enforce expiry, and preserve the audit. The accepted action matrix, step-up/recovery behavior and any unresolved policy details must be reconciled before the corresponding high-risk effects can be accepted. No production action, payout, deployment or other standing consequential-action boundary is authorized by this eligibility decision.

Evidence: direct owner reply in native Goal chat `01a13a26-2c7f-7672-80e1-a0d0861e4a44`, in response to the question asking who may approve protected V1 platform actions. Earlier unanswered R02/D04 records are superseded for this eligibility choice; other programme requirements remain intact.
