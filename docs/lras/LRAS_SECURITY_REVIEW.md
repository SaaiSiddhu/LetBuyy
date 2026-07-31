# LRAS Security Review — Root Cause Analysis System (Phase 12)

**Package:** `packages/lcis-rootcause` (`@letbuyy/lcis-rootcause`)
**Date:** 2026-07-04 · Source-grounded; all claims verified against real files.
**Verdict: PASS**

---

## 1. Scope

This review covers the read-only security posture of `@letbuyy/lcis-rootcause`: the threat model,
scan rules, per-category findings, dependency allowlist, and honest limitations. The authoritative
enforcement mechanism is `test/security.test.ts`, a mandatory per-file recursive source scan that
runs as part of `pnpm test --filter=@letbuyy/lcis-rootcause`.

---

## 2. Threat Model

LRAS is a pure-computation diagnosis layer. It accepts a symptom text string and returns a ranked
`Diagnosis` struct. The package makes no outbound network calls, performs no filesystem mutations,
and executes no shell commands. Despite this narrow footprint, four integrity threats require
explicit coverage:

### 2.1 Hallucination — the primary integrity threat

**Definition:** emitting a `CauseHypothesis` without grounding evidence, or returning a confident
verdict when live signals are absent.

**Why it matters for security:** a fabricated hypothesis can cause an incident responder to roll
back the wrong deployment, revoke the wrong credentials, or ignore the real fault. In a commerce
platform where every 60 seconds of checkout downtime is direct revenue loss, a false diagnosis is
materially harmful.

**Mitigations in source:**
- `CauseHypothesis.evidence` is typed `readonly Evidence[]` and is never empty on emission
  (`src/shared/types.ts : 47` — the JSDoc explicitly states "NEVER empty").
- `HypothesisService.evaluate()` (`src/hypothesis/HypothesisService.ts`) only appends to `results`
  after constructing a non-empty `ev: Evidence[]` array. Rules with no matching structural signal
  (e.g. RC01 finds no money-path migration, RC04 finds no SPOFs) produce zero hypotheses, not a
  zero-evidence hypothesis.
- `diagnose()` (`src/engine.ts : 131`) maps zero surviving hypotheses directly to verdict `UNKNOWN`
  — it never invents a fallback cause.
- The `UNKNOWN` verdict path populates `missingSignals` with the exact signal names and adapter/env
  var sources — it states *what is missing*, not a guess about what might be wrong.
- The `summary` string for `UNKNOWN` verdicts contains the phrase `"nothing is guessed"` (engine.ts
  line 161).
- Confidence is always `min(0.85, base + 0.05 * min(3, extra))` — the hard ceiling of 0.85 means
  LRAS never claims certainty even with maximum structural evidence.

**Enforcement:** the hallucination contract is asserted in the test suite (anti-hallucination tests,
UNKNOWN honesty tests, determinism tests — 482/482 green on gate pass).

### 2.2 Code execution

**Threat:** an attacker-controlled symptom string or artifact value triggers shell injection,
`eval`, dynamic `Function` construction, or spawning a child process.

**Mitigations:** no execution primitive is imported or used. The scan rule enforces this (see §3).

### 2.3 Filesystem mutation

**Threat:** LRAS writes, renames, or deletes files — corrupting the artifact store read by other
LCIS packages, or staging malicious changes.

**Mitigations:** no filesystem-write primitive is imported or used. The scan rule enforces this.

### 2.4 Outbound network calls

**Threat:** LRAS makes undocumented outbound HTTP/WebSocket calls — leaking symptom content,
bypassing the NOT_CONNECTED honesty contract, or introducing a latency/failure dependency.

**Mitigations:** no network primitive is imported or used. All signals documented as `NOT_CONNECTED`
are structurally absent — the package cannot silently reach out to fill them in.

### 2.5 DB mutation

**Threat:** LRAS writes to the Supabase database via the `@supabase/supabase-js` client.

**Mitigations:** `@supabase/supabase-js` is not in the dependency allowlist (see §5). Even if it
were imported transitively, the scan rule catches `.insert(`, `.update(`, `.upsert(`, `.rpc(`, and
`.from(` in non-comment source. DB writes are structurally unreachable.

### 2.6 AI / LLM injection

**Threat:** a symptom string manipulates a hidden LLM prompt — causing the engine to emit
fabricated hypotheses that bypass the evidence requirement.

**Mitigations:** no AI client is used anywhere in the package. The corpus-level AI scan (see §3.6)
forbids `openai`, `anthropic`, `embedding`, `qdrant`, `langchain`, `llm(`, `LLM(`. LRAS is
deterministic keyword + rule evaluation — there is no prompt surface.

---

## 3. Scan Rules

All rules below mirror the refinements in `test/security.test.ts` exactly. The test runs against
comment-stripped source (block comments + single-line comments removed before token matching) to
prevent evasion via commented-out imports.

### 3.1 Execution / shell primitives — FORBIDDEN (per file)

```
child_process   spawn(     spawnSync   execSync    execFile
 exec(          .exec(     eval(       new Function(
```

No match in any stripped `.ts` file under `src/`. Verified by the `NO EXEC` per-file test.

### 3.2 Filesystem mutation primitives — FORBIDDEN (per file)

```
writeFile   appendFile   unlink      rmSync      rmdir
mkdir       renameSync   rename(     copyFile    chmod
chown       truncate     createWriteStream
```

No match. Verified by the `NO WRITE` per-file test.

**Refinement note:** `.delete(` is intentionally absent from this scan. In-memory `Set.delete()`
and `Map.delete()` are legitimate (used in union/dedup logic). DB deletes are structurally
unreachable: the only DB client entry points are `.from(` and `.rpc(`, which are caught by the DB
mutation scan (§3.5) and are absent because `@supabase/supabase-js` is not in the dependency
allowlist.

### 3.3 Network primitives — FORBIDDEN (per file)

```
fetch(          XMLHttpRequest    new WebSocket    http.request
https.request   net.connect       net.createServer dgram.
```

No match. Verified by the `NO NETWORK` per-file test.

### 3.4 IO-enabling imports — FORBIDDEN (per file)

```
from 'node:child_process'    from 'child_process'
from 'node:fs'               from 'fs'
from 'node:fs/promises'      from 'node:http'
from 'node:https'            from 'node:net'
from 'node:dgram'            from 'node:worker_threads'
from 'node:cluster'          require(
```

No match. Verified by the `NO IO IMPORTS` per-file test.

### 3.5 DB mutation tokens — FORBIDDEN (per file)

```
.insert(    .update(    .upsert(    .rpc(    .from(
```

No match. Note: `.delete(` is excluded per Refinement 1 above. Verified by the `NO DB MUTATION`
per-file test.

### 3.6 Wall-clock injection — restricted to one boundary

**Rule (Refinement 2):** `Date.now()` is forbidden everywhere including `shared/envelope.ts`.
Argless `new Date()` is forbidden everywhere *except* `shared/envelope.ts`.

**Rationale:** an injectable clock (`now: () => string`) is the only permissible timestamp source
in production service code. `shared/envelope.ts` defines `defaultNow = () => new Date().toISOString()`
— the single sanctioned clock boundary. All service constructors accept and propagate `now` rather
than calling `defaultNow()` directly (also enforced: `defaultNow()` invocations outside
`envelope.ts` are forbidden).

Verified by the `NO WALL CLOCK` per-file test and the `NO defaultNow CALL` corpus test.

### 3.7 AI token scan — FORBIDDEN (corpus-level)

```
openai    anthropic    embedding    qdrant    Qdrant    langchain    llm(    LLM(
```

Applied across all stripped source files joined as a single string. No match. Verified by the
`NO AI` corpus test.

---

## 4. Coverage Gate

The security test opens with a coverage assertion (`test/security.test.ts : 106`):

- `SRC_FILES.length >= 4` — at least four source files were scanned (guard against an empty walk).
- All seven expected subdirectory subtrees are present in the scan:
  `shared`, `affected`, `attribution`, `correlation`, `hypothesis`, `remediation`, `symptom`.
- `src/engine.ts` is confirmed present in the scan (it lives at the `src/` root, not in a
  subdirectory).

Additionally, individual file-presence tests confirm that the frozen contract files
(`shared/types.ts`, `shared/envelope.ts`, `shared/taxonomy.ts`, `shared/rules.ts`,
`shared/index.ts`) exist and were scanned.

---

## 5. Dependency Allowlist

**Source:** `test/security.test.ts : 225–237`, `package.json`

The test asserts `deepEqual` against exactly this sorted list of production dependencies:

| Package | Role in LRAS |
|---------|-------------|
| `@letbuyy/lcis-core` | `LcisEngine`, `evidence()`, `notConnected()`, `getEngine()` |
| `@letbuyy/lcis-engineering` | EINS rollback + verification plan delegation (`RemediationService`) |
| `@letbuyy/lcis-governance` | Domain + CODEOWNERS owner lookup (`AttributionService`) |
| `@letbuyy/lcis-operations` | _(declared; operations context available to future services)_ |
| `@letbuyy/lcis-tracking` | LCTS timeline correlation (`ChangeCorrelationService`) |
| `@letbuyy/lcis-twin` | Impact radius, cycles, SPOF (`AffectedService`) |
| `zod` | Schema validation utility (shared LCIS convention) |

Any package not on this list — `@supabase/supabase-js`, `axios`, `node-fetch`, `openai`, etc. —
fails the allowlist test immediately. No third-party HTTP client, no AI SDK, no DB client is
permitted.

**Scripts mutation gate:** `package.json` scripts must not contain the verbs `deploy`, `push`,
`publish`, or `migrate` (test line 239). The current scripts are `build`, `typecheck`, `test` —
all pass.

---

## 6. Read-Only Enforcement Summary

| Property | Mechanism |
|----------|-----------|
| No execution | Import ban + token scan per file |
| No filesystem write | Import ban + token scan per file |
| No network calls | Import ban + token scan per file |
| No DB mutation | Token scan per file + dependency allowlist (no Supabase client) |
| No AI | Corpus token scan + dependency allowlist |
| Injectable clock only | Wall-clock scan + `defaultNow()` call ban outside envelope |
| Evidence-mandatory hypotheses | Type contract + test assertions |
| Honest UNKNOWN verdict | `diagnose()` logic + anti-hallucination test suite |

---

## 7. Honest Limitations

The following limitations are structural — they do not indicate a defect but are named explicitly
so reviewers and operators are not surprised.

**7.1 Taxonomy is fixed English keywords.** `SYMPTOM_TAXONOMY` matches on lowercase substring
terms declared in `src/shared/taxonomy.ts`. Paraphrases, non-English text, or novel symptom
wordings that do not contain a declared term will produce `kind: 'unknown'` and verdict `UNKNOWN`.
This is intentional — the system refuses to guess rather than match fuzzily. Extending the taxonomy
is a deterministic, reviewed change to that file.

**7.2 Live signals are absent until adapters are credentialed.** Every signal listed in
`KIND_SIGNALS` (e.g. `money.razorpay-status`, `edge.queue-backlog`) is `NOT_CONNECTED` in the
current structural configuration. LRAS names the exact environment variable(s) required for each
adapter. No signal value is fabricated — absent signals produce RC06 hypotheses at the configured
`NOT_CONNECTED` confidence (0.45 base) and appear in `Diagnosis.missingSignals`. Hypotheses from
live signals would carry `CONNECTED` status and higher confidence once adapters are wired.

**7.3 Hypotheses are structural, not telemetric.** RC01–RC08 fire on structural facts: graph
topology, change-tracking records, and taxonomy classification. They do not consume live error
rates, queue depths, or provider status pages. A hypothesis that fires on structure (e.g. RC04 for
a SPOF) may not be the real current cause; it names what *could* explain the symptom given the
topology. Live signals would confirm or eliminate it.

**7.4 Rollback guidance inherits EINS degradation.** `RemediationService.rollbackFor()` returns
`null` when `@letbuyy/lcis-engineering` cannot produce a plan (e.g. artifact store is unpopulated).
`null` is propagated to `Diagnosis.recommendedRollback` — it is not replaced with fabricated steps.

**7.5 Post-only Cloudflare signals are structurally unreachable.** Three signals in `KIND_SIGNALS`
are marked "POST-only — structurally unreachable via the GET boundary":
`edge.queue-backlog` (GraphQL Analytics API), `edge.ae-values` (Analytics Engine SQL), and
`edge.cron-runs` (Workers logs). These are named in `missingSignals` as `NOT_CONNECTED` even when
the Cloudflare adapter is credentialed, because the GET-boundary constraint that applies to the
LCIS live-adapter layer prevents their retrieval. This is an honest architectural fact, not a gap
to be silently elided.

---

## 8. Verdict

**PASS.** The security scan (482/482 tests green) confirmed:

- Zero execution, network, filesystem-write, or DB-mutation primitives in any source file.
- Zero AI/LLM imports or tokens in the corpus.
- Clock boundary correctly enforced to `shared/envelope.ts` alone.
- Dependency allowlist matches the approved 6 LCIS packages + `zod` exactly.
- Anti-hallucination law holds: every emitted hypothesis carries evidence; verdict `UNKNOWN` is
  reached deterministically on missing signals; confidence is bounded at 0.85.
- Package scripts contain no mutation verbs.
- ESM-only (`"type": "module"`), name matches `@letbuyy/lcis-rootcause`.
