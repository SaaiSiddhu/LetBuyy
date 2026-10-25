# ACL393 HTTP request-effect assertion correction

Source ready for Root review. Native04 has not run; SQLV2 and production remain frozen.

Preserved native03 `fff117a317a5` passed phases1–3. Its first mounted save retry returned200/replayedtrue; the complete487-table comparison then found7 changed auth/log/metric hashes and480 exact hashes. Changed row contents were not captured, so that run does not qualify this new assertion.

## Correction

Only dedicated phase4 and test-only support changed. Each of six retry/CAS/denial requests captures its own complete table hashes, projected auth rows, full log/metric rows and real partition tree/physical-table evidence. All commerce, site, release, audit, draft, receipt and outbox hashes must remain exact.

Exactly one matching identity claim, one attributed request log and one request-count metric may be added. Request/trace IDs, route, actor/source, method/status, client, dimensions, count and microsecond timestamps are checked. Existing rows remain exact, except migration307’s exact bounded oldest-expired claim cleanup. Parent/selected leaf copies must match each base row; other actual leaves and hashes cannot change. No table is removed from full snapshots.

The existing signer/Gateway remains in use, signed credentials are preserved, background writes settle, and only SHA256(JTI) is retained. Complete HTTP evidence is written before assertions. Error-code input is pinned null because the outer sanitizer runs after observability; no response fallback is accepted. Case1–3/5–7 bodies and eight full-state/direct-SQL/security functions remain byte-exact to native03.

## Verification

- **27/27 pure tests pass**: original15 +9 attribution groups +3 source/wiring tests. Commerce/outbox/draft or unrelated log/metric mutations, invalid claims, changed existing rows, bad mirrors and missing hashes fail.
- Dedicated native semantic compilation: **pass**. ESLint: **0 errors, 0 warnings**, exit0. Its pages-directory config advisory is retained separately.
- Suite SHA256: `e71b15856e4868d28f249d8debf7f758de31cf61715bd10c0844ce79c2bc66b2`.
- Closure SHA256: `2851f65451c43154e5f896d6bb0a7964a521307471baac90947c528a6ef42e16`; **1080 files, 2003 literal edges, 0 nonliteral imports**. Exactly3 old test/collector inputs changed and3 test/data inputs were added; all old production inputs remain exact.
- V2 manifest remains `e5db28e52ef55bb7da76d42a547a9d5b48c4969a138ea0ccfd24f201555d597d`; UP/DOWN bytes unchanged.

Initial pure-test CJS loader failure is preserved in `source-contracts-attempt01.tap`; createRequire corrected that test-only loader. Successful TAP, type log, lint, semantic conservation and closure delta are beside this file.

## Next gate

The consumed native03 actual admission remains unchanged and cannot match this suite hash. Only the pending template was updated. Root must review this exact source epoch and grant one fresh isolated native04 slot before execution. Prior native03 TAP,19 provenance files and cleanup evidence remain intact. Migration scan is still321 files through392;393/394 have not been emitted.

Threadline preview, merchant login and tabs, stable936 and persistent Marketplace were untouched. No database/container/browser operation or external message occurred during this correction.

Exact machine-readable evidence: `source-release.json`, `closure-delta.json`, `semantic-conservation.json`.
