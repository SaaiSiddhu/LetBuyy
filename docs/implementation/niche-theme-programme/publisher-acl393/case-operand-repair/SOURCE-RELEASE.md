# ACL393 scalar CASE grouping correction

2026-10-24. Source-only correction following run `bf6e2bc62ce7`. **No SQL/native execution, retry or emission occurred.** The entire original c939/ae513/97eb epoch and both failed native runs remain preserved. Original UP/DOWN files and original c939 manifest are untouched; corrected candidates and manifest live under `case-operand-repair/v2/`.

## Diagnosis and exact SQL delta

Native02 observed only `syntax error at end of input` at the first UP call. Its shared helper did not retain PostgreSQL's full line/context. This release does not claim a native-observed SQL source line.

Source inspection found three bare scalar CASE operands per file, in two IF conditions. PostgreSQL16's [PL/pgSQL grammar](https://raw.githubusercontent.com/postgres/postgres/REL_16_STABLE/src/pl/plpgsql/src/pl_gram.y) routes IF conditions through a THEN-terminated SQL-expression reader (around lines2280/2562). Its depth-zero terminator handling explains why a bare CASE's inner THEN can truncate the expression. This is source-derived diagnosis consistent with the native error; it is not a recovered native trace or proof that no other SQL problem remains.

V2 adds parentheses around each of those six operands, and **nothing else in SQL**. Removing the three added pairs in either direction reproduces its original file byte-for-byte. Compared values/constants, branches, grantor/ACL/role checks, provider/native fence, body/ABI/default/profile pins, ordinary/shared dependency checks, exact single revoke/historical inverse and replay remain unchanged. Original files remain available as immutable negative-control source.

A limited local IF/THEN boundary tripwire reuses the existing governance SQL lexer. It detects two early CASE terminators in each original file and none in V2; regression also requires all three operands per file to be grouped and normalizes the files back to their originals. This is **not a PostgreSQL or complete PL/pgSQL parser**. No full offline PostgreSQL parser was available in the existing project/Python modules, no dependency was installed, and no database was started for this check. Actual PostgreSQL parsing and all security/rollback behavior still require Root admission.

## Dedicated test delta

The same native suite now names the versioned V2 manifest/pair. All seven phases, actual typed own-row parser and every business/profile/permission/security/refusal/CAS/retry/private-draft/rollback assertion remain.

For the six candidate UP/DOWN calls only, a dedicated one-attempt wrapper uses the existing owned `psqlAsync` helper, which preserves PostgreSQL stderr, instead of the same owned helper's `scriptLarge` first-error-line wrapper. It records bounded/redacted failure context and immediately throws; there is no retry, fallback or second execution. This change is confined to the dedicated test. Shared owned support and production transport remain unchanged. Candidate lock/statement timeouts and outer runner timeout still apply. The future context may contain LINE/CONTEXT when PostgreSQL provides them; no SQLSTATE is invented.

Reversing only manifest/candidate references, this diagnostic wrapper and its async call adaptations restores the prior ae513 native source exactly. Assertions were not relaxed. Full-profile-before-assertion and all seven ordered stages remain mandatory.

## Source results and handoff

- [15 pure source/admission checks](source-contracts-01.tap): zero fail/skip/cancel/todo. All previous12 obligations remain, plus exact parentheses-only parity, old-fail/new-pass boundary diagnostics, and bounded diagnostic redaction/one-attempt checks. No owned native module is imported by these checks.
- [Exact native semantic compile](native-semantic.log): exit0; [native lint](native-eslint.json): zero errors/warnings. No new full Gateway/107-test/19-test loop.
- Separate input closure:1077 files,2000 literal edges, zero nonliteral imports. Original pair/manifest are bound as data; V2 pair/manifest and the limited checker are separately bound. Current actual admission still contains the closed ae513/97eb/c939 source grant and cannot admit these V2 references/bytes. Updated pending template is deliberately invalid.
- Original candidate pair/c939 manifest, old failed suite/closure snapshots, both raw runs/provenance, old aa26 suite, old1079 inputs,61 factory pins and production/shared helpers remain exact. Migration source stays321 files/max392; no393/394 emitted. No936e/current clients/Marketplace/retained Threadline action.

Root must review the exact new pair, semantic delta, test-only diagnostic change and closure, then issue an actual new admission/allocation. No native SQL, direct tenant42501, service publish/rollback, unknown-profile refusal, DOWN/re-UP or final security acceptance is established by these source checks.394 remains blocked.
