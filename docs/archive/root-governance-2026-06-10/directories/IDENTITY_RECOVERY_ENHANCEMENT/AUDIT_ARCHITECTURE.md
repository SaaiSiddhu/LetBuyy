# AUDIT ARCHITECTURE (enhancement)
### 2026-06-09 · ANALYSIS-ONLY · enhancement-delta over `docs/auth/2026-06-08-identity-platform-transformation/AUDIT_LOG_ARCHITECTURE.md`

> **Relationship to the corpus.** `AUDIT_LOG_ARCHITECTURE.md` already defines the append-only ledger, the 15-category taxonomy, the canonical envelope, ingestion pipeline, hot/warm/cold storage tiers, the hash-chain principle, retention table, compliance mapping, and IR flow. **Strong; not rebuilt.** This document designs the six operability gaps that make the difference between "we have audit logs" and "our tamper-evidence is provable to an enterprise auditor": **chain-verification cadence, cross-partition ordering, volume budget/sampling, tenant-export service, audit-of-the-audit (loss prevention), and correlation/residency contracts.**

---

## 1. Event taxonomy (reaffirm corpus) + per-event retention & severity
Keep the corpus's `<category>.<resource>.<action>` taxonomy and envelope. The white space is that retention/severity are stated per *class*, not per *event*; this table makes the load-bearing events explicit (severity drives SIEM streaming + WORM routing):

| Event family | Examples | Severity | Tier / retention |
|---|---|:--:|---|
| Login / logout / session | `auth.session.created/destroyed`, `auth.login.failed` | med (high on anomaly) | warm 1–2y |
| Credential | `cred.password.changed`, `cred.reset.completed` | high | WORM 7y |
| Passkey / MFA | `mfa.factor.enrolled/removed`, `mfa.stepup.satisfied` | high | WORM 7y |
| Permission / role | `authz.role.assigned`, `authz.permission.denied` | high | WORM 7y |
| Organization / store transfer | `org.merged`, `store.ownership.transferred` | **critical** | WORM 7y + legal-hold-eligible |
| Consent / OAuth / token | `consent.granted/revoked`, `token.refresh.reused` (reuse-detection!) | high→critical | WORM 7y |
| Admin / impersonation | `admin.impersonation.started/ended`, `admin.break_glass.used` | **critical** | WORM 7y, double-attributed |
| Security | `security.key.rotated`, `security.chain.verification_failed` | **critical** | WORM 7y + page on-call |

---

## 2. Cross-partition chain ordering (NEW — resolves the parallel-chains problem)
The corpus hash-chains "within a partition/stream" (monthly × 15 categories = many concurrent chains) but never says how a *single* tamper-evident order exists across them, nor how `seq` is assigned under async at-least-once ingestion. Design:
- **Single-writer-per-partition** ingest worker assigns `seq` monotonically per `(stream)` where `stream = category` (not category×month — month is a storage detail, the chain spans month boundaries via `prev_hash` carry-over).
- **Periodic cross-stream anchor:** every `T_anchor` (default **hourly**), the anchor job reads the latest `hash` of every stream, builds a **Merkle root** over them, signs it with the audit-anchor key (`KEY_ROTATION_AND_CRYPTOGRAPHY §3`), and writes the signed root to WORM + (optionally) an external transparency log. This gives one provable global order across all per-stream chains without serializing ingestion.
- **Gap detection:** `seq` gaps within a stream are alarmed (at-least-once ⇒ dupes are idempotent on `event_id`, but a *missing* seq = dropped event = `security.chain.verification_failed`).

## 3. Chain-verification cadence (NEW — the load-bearing control)
The corpus names anchoring but no cadence. Define:
- **Continuous:** ingest worker verifies `prev_hash` linkage on every append (O(1)).
- **Incremental:** the anchor job (hourly) re-verifies each stream since the last anchor.
- **Full sweep:** a daily job re-verifies the complete chain of the hot tier and a **weekly** job samples-and-verifies warm/cold (full cold re-verify is monthly, since WORM Object-Lock is the primary cold guarantee).
- **On broken chain:** emit `security.chain.verification_failed` (critical) → page on-call → freeze the affected stream's writer → IR runbook (`§10` corpus) → the signed anchors bound the tamper window (you know the last-good root).

## 4. Volume budget & sampling (NEW — closes G-11)
The corpus says "sample high-volume successes" with no rate/budget. Define an explicit budget so audit cannot bankrupt storage or drop silently:
- **Fidelity tiers:** *security/admin/impersonation/consent/role/org* = **100% retained, never sampled**. *auth.session.created/refresh success* at millions/day = retain **100% for 30d hot**, then **roll up to hourly aggregates** in warm (individual rows summarized, not dropped). *Read-only query events* (if ever audited) = sampled 1:N with N documented.
- **Budget target:** size for peak **~5k audit events/sec** (100k merchants × staff + millions of customer sessions) with a documented $/month ceiling per tier; back-pressure behavior in §5.

## 5. Audit-of-the-audit — loss prevention (NEW — the gap nobody designs)
The corpus pipeline is async/non-blocking, so a backed-up queue can **lose** events silently. Design the failure modes:
- **Durable queue with bounded backlog + spill-to-disk;** if the queue is unavailable, **security/critical events block the request path** (fail-closed for the events that matter), while low-severity events degrade to local spill + replay.
- **Dropped-event detection:** per-stream `seq` gap alarm (§2) + a heartbeat counter reconciled against request volume; divergence pages on-call.
- **Pipeline self-audit:** the ingest worker emits its own `audit.pipeline.*` events (lag, spill, replay) into a separate low-volume stream.

## 6. Tenant export, residency, correlation, legal hold (NEW)
- **Tenant export service:** self-serve export is an **async job** (not a synchronous query) with per-org rate limits and signed download URLs; reuses `audit_export_cursors`. Prevents a 100k-merchant export stampede.
- **Residency:** cold WORM must be **region-pinned** (DPDP/India, EU) — add `region` to the storage routing; an org's audit PII is stored in its residency region (consistent with `KEY_ROTATION_AND_CRYPTOGRAPHY §3` region keys).
- **Correlation contract:** `correlation_id` is generated at the edge, propagated via a standard header across every Identity↔Commerce hop, and is mandatory in the envelope (reject events without it in non-legacy paths).
- **Legal-hold scope query:** "all events touching org X over 3y across hot+warm+cold" is a defined async operation that freezes matching partitions across tiers and records the hold in an auditable `legal_holds` register.

---

## 7. Compliance & monitoring (reaffirm + extend)
Keep the corpus SOC2/ISO/GDPR/PCI mapping. Add: the **signed Merkle anchors** are the SOC2 CC7 evidence artifact; **chain-verification job results** (pass/fail history) are the auditable control record; the **fail-closed-on-critical** rule is the GDPR Art.30 completeness guarantee. Operational monitoring: dashboards for ingest lag, queue depth, chain-verification status, per-category volume vs budget, and export-job backlog.
