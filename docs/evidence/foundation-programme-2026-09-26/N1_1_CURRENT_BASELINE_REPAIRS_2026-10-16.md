# N1.1 current source baseline and rollback safeguards — 16 October 2026

Scope: current phase2 candidate through migration 332, preserving the uncommitted overlay, 63 execution packages, 77 original acceptance packages and 103 feature dispositions. This is engineering evidence; N1 and the overall programme remain open.

The maintained catalog discovered 180 pure-source suites, 62 PostgreSQL suites and 79 Gateway database suites. The initial pure partition executed 1,953 tests: 1,931 passed, seven failed and 15 named human/provider/hosted requirements were skipped. Those skips remain unverified requirements. No database, browser, device or provider proof is inferred from this partition.

Seven failure dispositions:

- Billing checkout used a permissive partial Zod stub that could not load the canonical union schema. The test now imports the real billing owner, shared schemas and Zod through the installed TypeScript loader. Existing checkout assertions are retained; no provider call is added.
- The governance Git helper exceeded its default child-process buffer on the candidate's actual 5,140,018-byte untracked-path listing. It now permits a bounded 256 MiB complete listing and still propagates failures. A real 5,000-file disposable Git fixture exceeds the old limit and asserts the complete count and boundary paths. No cache is deleted or finding suppressed.
- The definer permission parser missed a function when it was second in a grouped ON FUNCTION statement. It now visits every named function for both revocations and subsequent grants. Regression controls prove a grouped late Data API grant still reopens the failure; unchanged migrations are also verified against real database roles.
- The design ratchet exceeded its inline-style baseline by one. The buyer data-access section now uses the canonical border token through its class; the ratchet baseline is unchanged.
- Rollbacks 318, 324, 328 and 329 lacked complete pre-mutation ABI guards. They now compare the exact typed signatures, input parameter names, result ABI and complete overload count before any schema/function mutation. Migration 329 intentionally has two MFA completion overloads; both are guarded, including the refusal-only predecessor. Historical function bodies are retained.
- Magic-link consumption moved into the atomic migration-332 exchange. The table reachability check now follows the actual called exchange RPC and asserts its latest SQL body still accesses the private table. Direct table access is not restored.
- The registration source assertion pinned the earlier signing-helper call. It now requires preparation before account creation, followed by buyer/epoch-bound issuance and cookie setting. Runtime authentication guards are unchanged.

Evidence under `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.1`:

- `current-pure-after332.log` and `.json`: initial complete baseline, retained red.
- `current-baseline-regression-controls-red.log`: the newly added grouped-grant and large-inventory tests fail against the previous helpers, alongside the original definer failure.
- `current-baseline-repairs-focused.log`: 80/80 focused checks, no skips/cancellations/TODOs.
- `current-baseline-db-result.json`, run `e6ad29426761`: 14/14 tests across two owned PostgreSQL suites. All 20 current restored signatures receive overload/type/input-name/result-ABI drift and negative controls. Apply/rollback/reapply compares all public function bodies, owners and ACLs at exact migration snapshots. Actual current definer API-role closure is checked separately. Owned cleanup is recorded in the runner result.
- `current-pure-after-baseline-repairs.log` and `.json`: subsequent full maintained pure partition: 180 suites, 1,962 tests, 1,947 passed, zero failed/cancelled/TODO and the same 15 explicit external skips. Exact tested manifest 10446aa2 is preserved as `current-baseline-tested-source-manifest.json`; the current baseline evidence JSON records the separate verdicts.
- `current-baseline-before`, `current-baseline-source-changes.json`, scoped diff and hashes preserve the repair boundary.

No hosted migration, deployment, real provider message/payment, legacy cutover or release occurred. Current native cart/wishlist, privacy export and canonical operator proofs remain separately recorded. Resend access, privacy erasure/retention policy, live custody/provider and hosted acceptance remain open; this repair does not close those requirements.
