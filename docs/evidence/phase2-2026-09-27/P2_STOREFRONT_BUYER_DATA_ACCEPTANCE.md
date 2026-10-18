# P2 storefront buyer data audience connection — local acceptance

3 October 2026. Exact source candidate `266604857485ee76a4ed055c292efe86118800cd`, branch `letbuyy/phase2-shared-buyer-identity`. This is one bounded part of Phase 2 and the active eleven-phase goal.

## Implemented and verified

The six commerce profile/address handlers previously sent identity-issued storefront tokens under the platform buyer header without a site. The actual worker regression reproduced 401 for a valid storefront profile request. These handlers now independently resolve the host, compare its site with the cookie wrapper, forward the distinct storefront header and authoritative site, and require same-origin writes. Only the gateway's own profile/address routes accept both channels, using their existing separate verifier and live account/epoch checks. All records remain keyed by the verified canonical buyer account. Orders, claims, linking and session revocation retain their existing authority. Ambiguous platform/storefront credentials are refused; malformed platform cookie encoding returns 401.

| Verification | Result |
| --- | --- |
| Real worker + owned PostgREST/Postgres | 5/5, run `94cb8ea42939`, no skips; cleanup empty |
| Real Next proxy handlers with synthetic fetch responses | 32/32; six methods, host mismatch/unavailable, cookie parsing, cross-origin refusal, encoding, sanitized errors and no-store |
| Full commerce test script | 1046/1046 across three stages (60 + 41 + 945); no failures/skips/TODO |
| Gateway unit tests | 1324 passes, zero failures/skips, one existing `LB-BIL-002` TODO |
| Gateway contracts | Actual command `pnpm exec tsx --test tests/contracts/*.test.ts`: 322/322; an earlier nonexistent script ran no tests and is excluded |
| Gateway and commerce typecheck | Both passed |
| Commerce lint | Zero errors, 883 existing warnings; not claimed warning-free |
| Owned lane guard | 12/12; new fourteenth suite explicitly registered |
| Exact source governance | 114/114 pass, zero fail/blocked/skip, one report-only not-applicable; task-owned disposable clone |

Database tests prove sharing, account field allowlists, two-buyer isolation, correct site/audience/header, fresh revocation/disablement and account-read failure. Global rate-limit RPCs precede authentication; the fault test checks no buyer writes rather than claiming absolutely no database bookkeeping. The actual issuer/verifier function probe is separately recorded in `P2_STOREFRONT_AUDIENCE_PROBE.json`; the owned suite signs synthetic tokens. Service-role queries are not tenant RLS proof. Proxy tests use fake gateway responses and do not prove browser navigation or a live identity redirect. No hosted provider, deployment, independent review or whole Phase 2 acceptance is claimed.

## Next defect, already being reproduced

Existing canonical address wiring clears the previous default in one HTTP transaction before saving the new address in another. A failed save or a foreign-address update can therefore clear the caller's selection; concurrent creates can leave multiple defaults. This is a separate pre-existing transactional defect, not resolved by the audience fix. Add real-worker failure/concurrency controls, then move the ownership check and default switch into one backend-only transaction using the existing tables. Wider legacy signer retirement and normal UI integration remain open. D04/D05 remain unanswered; dependent work stays gated while customer engineering continues.
