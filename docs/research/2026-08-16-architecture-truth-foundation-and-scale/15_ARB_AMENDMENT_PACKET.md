# 15 — ARB Amendment Packet

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> ## `PROPOSED — NOT RATIFIED`
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.
>
> Nothing in this document amends anything. Under DOC 01 §14.1 a constitutional amendment requires an ARB act citing a **named, evidenced trigger**. This packet supplies draft text and evidence so that the ARB *can* deliberate; it does not deliberate for them, and it does not recommend that any amendment be taken **now**.

---

## 1. The recommendation this packet leads with

> **No constitutional amendment is required or recommended at this time.**

That is the honest output of the analysis, and it is stated first so it cannot be lost.

`07_CAPACITY_MODEL.md` §4 established that ranks 1–8 of the bottleneck order are Class-C implementation work inside already-canonical systems, and that clearing them plausibly carries the platform to **Band A — roughly 100× its own ratified envelope**. `11_ARCHITECTURE_OPTIONS.md` §1.1 showed that this conclusion survives every weighting tested, including one that discards the Constitution entirely.

An amendment taken now would be taken on **anticipation**, which DOC 01 §14.1 clause 2 and §12.4 expressly exclude: *"Anticipation, elegance, or 'to be ready' are not valid triggers."*

This packet therefore exists in a **pre-armed** state: the triggers, the evidence standard, and the draft text are prepared so that if a trigger genuinely fires, the ARB can act in days rather than months — and so that no engineer can take these decisions unilaterally in the meantime.

---

## 2. The constitutional-conflict matrix

Which constitutional provisions each workload band would engage. Derived from `06` §5 and `02` §5.1.

| Band | Peak origin RPS (model) | Provisions engaged | Amendment class |
|---|---|---|---|
| **G** — governed envelope | ~7–20 | none | **None** |
| **A** — 100k online | ~1,787 | none | **None** — vertical scaling and cache work are Class C |
| **B** — 1M online | ~17,867 | §6 ("no read replica-now"); Never-Build **#4** | **A-1** below |
| **C** — 10M online | ~178,667 | §6 envelope; Never-Build **#3, #4**; possibly **#1** | **A-1 + A-2 + A-3** |
| **D** — 10M active | ~508,000 | §6; Never-Build **#1, #2, #3, #4, #5** | Wholesale re-ratification |
| **E** — hot-SKU skew | modest aggregate | **none** | **None** ⚠️ |
| **F** — webhook storm + checkout peak | modest aggregate | **none** | **None** |

> **The two most important rows are E and F.** The failure modes most likely to occur *first* in practice — a single merchant's flash sale serialising on one inventory row, and a provider's recovery backlog colliding with a checkout peak — require **no amendment at all**. They are admission control, per-tenant fairness caps, and idempotency: ordinary engineering inside canonical systems.
>
> A packet that led with "10M needs multi-region" would have inverted the real risk. The constitutional conversation is genuinely *not* where LetBuyy's near-term danger lies.

---

## 3. Pre-armed amendment A-1 — Read replicas

### 3.1 The conflict

DOC 01 §6 states the constitutional consequence of the scale envelope as: *"No sharding, no partitioning-now, **no read replica-now**, no multi-region, no CQRS, no event sourcing, no service mesh, no Wasm extension runtime is in scope."*

Read replicas are therefore forbidden by name, not by inference.

### 3.2 The named, evidenced trigger

An amendment may be proposed **only** when **all five** conditions hold simultaneously and are evidenced:

1. **Saturation.** PostgreSQL read CPU utilisation ≥ 70% sustained across ≥ 5 consecutive daily peak windows, evidenced by Supabase compute metrics.
2. **Latency harm.** p99 read latency on catalog or storefront routes exceeds the SLO agreed in `13` for the same 5 windows.
3. **Simpler levers exhausted.** Bottleneck-order ranks 1–8 are **completed and measured**, with before/after evidence. Specifically: effective storefront cache hit ratio ≥ 90% on cacheable classes, telemetry writes removed from PostgreSQL, and an index/query campaign completed with `pg_stat_statements` evidence.
4. **Vertical exhausted or uneconomic.** Either the compute ladder is at 12XL+ (where direct connections plateau at 500), or the next tier's cost exceeds the replica cost for equivalent read capacity.
5. **Read/write ratio justifies it.** Measured read share ≥ 85% of query volume — otherwise replicas address the wrong axis.

**Current value of every one of these: `UNKNOWN`.** None can be evaluated, because no telemetry pipeline is connected (`04` §4.3). **Establishing measurement is a precondition of the trigger, not a consequence of it.**

### 3.3 Draft amendment text — `PROPOSED-NOT-RATIFIED`

Proposed change to DOC 01 §6, second paragraph:

```diff
- **The constitutional consequence:** **everything is sized to this envelope.** No sharding,
- no partitioning-now, no read replica-now, no multi-region, no CQRS, no event sourcing,
- no service mesh, no Wasm extension runtime is in scope.
+ **The constitutional consequence:** **everything is sized to this envelope.** No sharding,
+ no partitioning-now, no multi-region, no CQRS, no event sourcing, no service mesh,
+ no Wasm extension runtime is in scope.
+
+ **Read replicas (amended <DATE>, ARB ratification <REF>).** One or more PostgreSQL read
+ replicas MAY be provisioned once the five conditions of the read-replica trigger are
+ simultaneously evidenced. The single write authority is UNCHANGED: there remains exactly
+ one write primary, and R-15's "one canonical system per domain" is not disturbed.
+ The following reads MUST NOT be routed to a replica under any circumstance:
+   (a) inventory reservation and commit;
+   (b) any checkout-session state read;
+   (c) any money path, including ledger reads used to derive a balance;
+   (d) authentication and session verification;
+   (e) any read-after-write within a single user-visible operation.
+ A replica-lag budget MUST be defined, monitored, and alerted before any read is routed,
+ and exceeding it MUST fail closed to the primary rather than serve stale data.
```

Corresponding change to the Never-Build List (§10) — **item 4 is narrowed, not deleted**:

```diff
- 4. **Sharding / partitioning now.** *(Reopen: sustained table growth makes vacuum/query
-    latency bite near ~1k–10k merchants; the partition helper seam exists, disabled.)*
+ 4. **Sharding / partitioning now.** *(Reopen: sustained table growth makes vacuum/query
+    latency bite near ~1k–10k merchants; the partition helper seam exists, disabled.)*
+    *Note (amended <DATE>): read replicas are no longer covered by this item; see §6.*
```

### 3.4 Risks the ARB must weigh

| Risk | Mitigation in the draft text |
|---|---|
| Stale reads on the money path | Clause (c) forbids it outright |
| Read-after-write anomalies | Clause (e) forbids it outright |
| Silent lag growth | Mandatory lag budget with fail-closed-to-primary |
| Cost surprise | Replicas run at the primary's compute size and ~1.25× its price |
| Interaction with Hyperdrive's non-invalidating query cache | Requires `--caching-disabled` bindings on primary-routed reads; must be stated in the implementation plan |
| Scope creep into "we now do distributed systems" | The amendment changes **one** sentence and preserves the single write authority |

### 3.5 Decision questions for the ARB

1. Do you accept the five-condition trigger, or require a sixth?
2. Is the forbidden-reads list (a)–(e) complete? Should merchant dashboard reads be added?
3. What replica-lag budget is acceptable, in milliseconds?
4. Who owns the lag alert, given `09` establishes there is currently **no alert delivery channel at all**?

---

## 4. Pre-armed amendment A-2 — Table partitioning

### 4.1 The conflict

Never-Build item 4 forbids "partitioning now." The Constitution also requires the partition shadow/mirror to remain **disabled** (`ART-23`).

### 4.2 A live constitutional breach the ARB must resolve **now**, independent of any amendment

This was raised as an ambiguity to settle. It has been settled, and the answer is a breach. `03_CURRENT_ARCHITECTURE_AS_BUILT.md` §D.6 resolves it in three legs:

| Leg | Finding | Verdict |
|---|---|---|
| **The scheduled workflow** | `.github/workflows/hot-table-partition-maintenance.yml` touches only **shadow parents** (`079_*.sql:178-184, :293-297`) | ✅ **Not** the breach — this is the disabled seam behaving as designed |
| **The mirror triggers** | Migration `131:112-141` installs **five mirror triggers that are ENABLED**. The kill switch at `131:58` has **zero callers**. Migration `179`'s own header records live execution — it states the shadow write *"broke EVERY outbox write"* | ❌ **This IS the breach.** DOC 01 `ART-23` requires the partition-shadow seam be *"kept, mirror disabled."* The mirror is **on** |
| **The validator** | `scripts/validators/migration-safety-validator.mjs:132-141` **mandates** the partition-maintenance workflow | ❌ Violates DOC 01 §5.3 / `R-18`: a validator may not certify a capability the Constitution forbids |

> **`ART-23` is violated at this SHA, and the validator suite is enforcing the violation.** This needs no amendment — it needs remediation, because the Constitution already says the mirror stays disabled. The ARB's Class-B decision is only *how*: disable the five triggers and wire the existing kill switch, or ratify the mirror as intended behaviour and amend `ART-23` accordingly.
>
> **The second-order finding is the more serious one.** A validator that *requires* a forbidden capability is the precise failure `ART-02` was written to end — the third instance this study found, alongside `ARCH-RESEARCH-111` (whitelisting an RLS policy by its **name**) and `ARCH-RESEARCH-112` (scanning only `apps/` for a violation that lives in `services/`). Three purpose-built validators, three structural blindnesses, all in the load-bearing invariants. **`13_TEST_AND_LOAD_VALIDATION.md` §A should be read as the primary governance finding of this study, not a secondary one.**

### 4.3 The named trigger

1. A single table exceeds 100 GB **or** 500 million rows, evidenced by `pg_total_relation_size`.
2. Autovacuum on that table cannot keep up: sustained dead-tuple ratio > 20%, evidenced by `pg_stat_user_tables`.
3. p99 latency on queries against that table exceeds SLO for ≥ 5 consecutive peak windows.
4. Index-only scans and partial indexes have been attempted and measured insufficient.
5. Retention/archival has been evaluated first — **deleting old rows is cheaper than partitioning them**, and for `worker_request_logs` and `runtime_telemetry_metrics` (which `07` §3.5 identifies as the dominant write load) the correct answer is almost certainly to stop writing them to PostgreSQL at all.

**Current value: `UNKNOWN`** — requires live database introspection (`04` §4.2 L-11/L-13).

### 4.4 Draft text — `PROPOSED-NOT-RATIFIED`

```diff
  4. **Sharding / partitioning now.** *(Reopen: sustained table growth makes vacuum/query
     latency bite near ~1k–10k merchants; the partition helper seam exists, disabled.)*
+    **Amended <DATE>, ARB ratification <REF>:** declarative RANGE partitioning MAY be applied
+    to a NAMED individual table once the five conditions of the partitioning trigger are
+    evidenced for THAT table. This authorises partitioning table-by-table on evidence; it does
+    NOT authorise sharding, a partitioned-by-default schema policy, or any change to the single
+    data authority. Each table requires its own evidence and its own ARB record. Every
+    partitioning migration MUST ship a paired rollback (R-23) and MUST be applied
+    expand→backfill→verify→contract (MIG-R4).
```

---

## 5. Pre-armed amendment A-3 — Multi-region

**Not drafted, deliberately.**

Never-Build item 3 names two reopen triggers: *a data-residency mandate*, or *10,000+ merchants with genuinely global merchants.* Neither is evidenced. Two further facts bear on it:

- **The residency trigger is a legal question, not an engineering one.** `08_SECURITY_PRIVACY_COMPLIANCE.md` addresses whether any current Indian mandate requires data to be stored in India, distinguishing the RBI payment-data localisation directive (specific) from any general mandate. That determination is `LEGAL-REVIEW-REQUIRED` and would be the trigger — not capacity.
- **A relevant provider constraint exists.** Cloudflare's Customer Metadata Boundary can be set only to the United States or the European Union; **there is no India metadata boundary at any price.** If a strict residency mandate were to arrive, it would constrain provider choice before it constrained topology. The ARB should know this before assuming multi-region is the answer to a residency requirement.

Drafting amendment text for a trigger that is legal rather than technical would be speculative. If residency counsel returns a mandate, this section should be written then, against the actual obligation.

---

## 6. What must NOT be amended, on current evidence

| Provision | Why it must hold |
|---|---|
| `R-7` never custody | The regulatory foundation of the platform and of the 0% fee. Not a technical trade-off. |
| `R-15` one canonical system per domain | Would legitimise Option 4b (D1 as a second data authority) and every "two of everything" defect this Constitution exists to end. |
| `R-5`/`R-6` append-only derived-balance ledger | Mutable-balance-as-truth is the root-cause class of the money P0s. |
| `R-11` server-authoritative checkout behind a cart-bound signed handoff | `03` reports the live path's conformance; the correct response to a gap is to **close it**, not to amend the rule to match the gap. |
| `R-14` sole issuer | `05` reports a live conflict in the customer realm. Same principle: fix the code, or amend only after an explicit ARB finding that the realm split is intended — never silently. |
| §6 India-only | Nothing in this study suggests otherwise, and it materially bounds the compliance surface. |
| Never-Build **#6** self-custody payout | Licensing exposure. Not negotiable at this scale. |
| Never-Build **#12** any transaction fee | A strategic commitment, reversible only by business re-ratification. |

> **A standing warning.** The most dangerous amendment is not the one that expands the envelope. It is the one that **relaxes an invariant to match a defect the code already has.** Where `03` and `05` report a rule violated, the default action is remediation. Amending `R-11` or `R-14` to legalise current behaviour would convert a bug into architecture.

---

## 7. Summary for the ARB

| Amendment | Status | Trigger evidenced? | Recommended now? |
|---|---|---|---|
| **A-1** Read replicas | Drafted, pre-armed | **No** — all five conditions `UNKNOWN` | **No** |
| **A-2** Table partitioning | Drafted, pre-armed | **No** — all five conditions `UNKNOWN` | **No.** But resolve the partition-maintenance-workflow ambiguity as a Class-B matter regardless |
| **A-3** Multi-region | Not drafted | No; trigger is legal, not technical | **No** |
| Envelope expansion beyond 10,000 merchants | Not drafted | No | **No** |

**Two Class-B questions the ARB should take now, independent of any amendment:**

1. **Classify `services/lcis-api`** — delete, relocate to `tools/`, or adopt as a ninth runtime with an amendment. It is currently an undeclared root outside every manifest and topology validator (`03` §A, corrected severity S2).
2. **Rule on the partition-maintenance workflow** — disabled seam or live maintenance (§4.2 above).

**The precondition for every trigger in this packet is measurement**, and no telemetry pipeline is currently connected. Until it is, none of these triggers can fire — which is itself the strongest argument that instrumentation, not amendment, is the next constitutional-adjacent priority.
