# 11 — Architecture Options (decision alternatives, none approved)

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.
>
> Seven options are compared as **decision alternatives**. None is approved, recommended by this document alone, or authorised. `16_FINAL_RECOMMENDATION.md` states a recommendation; this document supplies the comparison it rests on.

---

## 0. The framing that determines the answer

`07_CAPACITY_MODEL.md` §4 established that the first four ceilings bind **at or below the platform's own ratified envelope**, and that ranks 1–8 of the bottleneck order are all Class-C implementation work requiring no ARB decision.

That reorders the entire options question. The relevant comparison is **not** "which topology reaches 10M?" It is:

> **How much headroom does each option buy, at what cost in complexity, reversibility, and constitutional risk — given that the cheapest option has not yet been exhausted?**

An option that is not yet necessary is not merely premature; it is actively harmful, because it consumes the engineering capacity that would have fixed the ceilings that are actually binding.

---

## Option 0 — Correctness-first current foundation

**Thesis.** Keep the ratified topology exactly as governed — one modular monolith, four satellites, one PostgreSQL, Cloudflare + Vercel, one India region — and close only the defects that source evidence proves.

**Contents.** Bottleneck-order ranks 1–8 from `07` §4: replace the KV rate-limit backend with a sharded Durable Object or Cloudflare's Rate Limiting binding; restore storefront HTML and fetch caching; move telemetry writes off PostgreSQL to the already-bound Analytics Engine dataset; raise outbox relay throughput; add request coalescing to the Worker cache; add hot-SKU admission control; add per-tenant fairness caps to the four claim RPCs; wire the `app_tenant`/GUC tenancy that is currently DDL-real and runtime-dead.

**Ceiling.** Band A (~100k simultaneously online, ≈5M orders/month at base-case conversion) — roughly **100× the governed envelope** — on one Large/XL PostgreSQL. Unproven until the load programme in `13` runs.

**Constitutional status.** **Fully compliant.** Every item is Class C. No amendment, no ARB decision, no new runtime, no reserved service.

**Cost.** Engineering time only. Infrastructure cost *falls*, because telemetry writes and uncached origin traffic both shrink.

**Reversibility.** Each item is independently revertible. No item creates a new system.

**The case against.** It does not, by itself, reach Band C. If the founder's answer to Decision D-1 is genuinely S5/S7, Option 0 is necessary but not sufficient.

---

## Option 1 — Same logical topology, larger managed capacity

**Thesis.** After Option 0, scale by buying capacity and tuning, not by changing shape: larger Supabase compute, provisioned IOPS, index and query-plan work, connection and transaction-duration discipline, higher cache hit ratios, higher queue concurrency, precomputed rollups, higher provider plans.

**The critical constraint, from primary sources.** Supabase direct connections scale **60 → 500 across the entire ladder and plateau at 500 from 12XL upward**, while the price range spans $10 → $3,730/month. Supavisor client slots scale 200 → 12,000 but are hard-coded per tier.

> **Vertical scaling on this platform buys cores, RAM, and IOPS — not concurrency.** Anyone who plans to "just buy a bigger database" must understand what they are and are not buying.

**Ceiling.** The Band A → Band B boundary. Beyond ~500 direct connections, only pooling discipline and shorter transactions remain, and PostgreSQL CPU binds before connections do (Large = 2 dedicated cores; one backend process per connection).

**Constitutional status.** Compliant. Class C, with Class-B review where a tier change materially alters cost.

**Note.** Option 1 should be **exhausted before any topology expansion unless evidence disproves it** — that is the constitutional decision rule (`ART-04`: extraction only at a measured trigger), and the capacity model gives no reason to doubt it.

---

## Option 2 — Read scaling with the single write authority preserved

**Thesis.** Add read replicas; route reads by consistency requirement; keep exactly one write primary.

**What must never route to a replica.** Inventory reservation, checkout, any money path, auth/session verification, and any read-after-write. Replica lag turns each of those into a correctness bug, not a latency bug.

**Interaction with existing caching.** Hyperdrive's query cache **does not invalidate on write**. Layering replica lag on top of an already non-invalidating cache compounds staleness. Any read that must reflect a write needs a `--caching-disabled` Hyperdrive binding *and* primary routing.

**Ceiling.** Band B comfortably; Band C partially, since Band C's constraint is substantially write-side and connection-side.

**Cost.** Replicas run at the same compute size as the primary and carry ~1.25× the primary's price.

> **Constitutional status: AMENDMENT REQUIRED.** DOC 01 §6 names "no read replica-now" explicitly in the constitutional consequence of the scale envelope. This is the **first** option on the ladder that cannot be taken by engineering judgement. See `15_ARB_AMENDMENT_PACKET.md`.

---

## Option 3 — Targeted single-module extraction

**Thesis.** After a **measured** hot-path trigger, extract exactly one module — never a fleet.

This is not a loophole; it is the Constitution's own named reopen condition for Never-Build item 1: *"a measured hot-path or team boundary forces extraction of a specific module, with ARB sign-off — never a wholesale fleet."*

**Candidate assessment.**

| Candidate | Extract? | Reasoning |
|---|---|---|
| **Search** | **Best candidate** | Read-only, tolerant of staleness, no money or tenancy correctness coupling, and its data is already a projection. Failure degrades to category browse. |
| **Media transformation** | Good candidate | CPU-bound, stateless, no transactional coupling. Cloudflare Images is a *buy* option that avoids extraction entirely. |
| **Analytics ingest** | Good candidate | Already queue-mediated; failure is tolerable; it is the first thing that should be shed under load anyway. |
| **Notification dispatch** | Marginal | Already in `queue-workers`. Extracting it moves a problem rather than solving one. |
| **Checkout** | **No** | Correctness-critical, transactionally coupled to inventory and the ledger. Extraction converts an in-transaction invariant into a distributed one — the exact trade the Constitution rejects. |
| **Identity** | **No** | Already a satellite (`apps/identity-platform`). Further extraction adds nothing. |

**Required proof before any extraction (all five, or it is premature):** the measured bottleneck; why monolith-internal scaling cannot solve it; a clean ownership and data boundary; defined failure semantics; and a rollback path.

**Constitutional status.** ARB review under the named Never-Build item 1 reopen condition. Not an amendment *if* a genuine measured trigger exists and only one module moves.

---

## Option 4 — Cloudflare-native scaled topology

**Thesis.** Lean further into provider-native primitives: sharded Durable Objects for coordination, D1 for per-tenant data, R2 for media, Queues for async, Hyperdrive for pooling.

This option **splits cleanly in two**, and conflating them would be a serious error.

### 4a — Durable Objects for coordination: **strongly recommended, already in-envelope**

Cloudflare's own documented remedy for the KV write-rate problem is a sharded Durable Object (~1,000 rps soft ceiling per object; `Required DOs = total_rps / per-DO capacity`, keyed by `idFromName`). It is the correct backend for rate limiting, and plausibly for hot-SKU admission control.

LetBuyy **already declares an unused Durable Object namespace in production**. This is not new topology; it is using infrastructure already provisioned and already validator-protected.

⚠️ **Do not promote the existing singleton `RUNTIME_COORDINATOR` into a global limiter.** A single DO serialises everything addressed to it. Shard by identity from the first line of code.

### 4b — D1 as a tenant data store: **reject**

| Fact (primary source) | Consequence |
|---|---|
| 10 GB hard cap per database | Forces per-tenant sharding |
| No published write-throughput figure | Cannot be capacity-planned |
| Single primary; read replication still described as beta requiring the Sessions API | Weak durability story for commerce |
| Rows written $1.00/M vs rows read $0.001/M — **1,000× asymmetric** | Write-heavy commerce is the worst fit |
| Cloudflare positions D1 for "per-user, per-tenant or per-entity databases" | Explicitly *not* a shared multi-tenant ledger |

Adopting D1 for business data would create a **second data authority**, violating `R-15` and `ART-04`, and would trade a mature PostgreSQL for an immature SQLite fleet in exchange for nothing the capacity model demands.

**Portability.** Option 4a is portable (a rate limiter is an interface). Option 4b is deep lock-in.

---

## Option 5 — Vercel + Cloudflare + AWS backend

**Thesis.** The reference document's proposal: ALB + ECS/Fargate + RDS/Aurora PostgreSQL + RDS Proxy + ElastiCache/Valkey + SQS.

Evaluated fairly and on its merits, as a genuine alternative — not dismissed because it is unfamiliar and not adopted because it is conventional.

**What it would genuinely buy.** A larger connection ceiling than Supabase's 500-plateau; Aurora's storage architecture; mature autoscaling; a very large operational ecosystem; and freedom from Supabase's disk-full read-only cliff.

**What it costs.**

| Cost class | Detail |
|---|---|
| **Floor cost** | ALB hours + NAT Gateway hours (hourly **and** per-GB processed) + RDS instance hours + ElastiCache node hours + a support plan **all bill regardless of traffic**. This is the decisive economic fact: a Cloudflare + Supabase stack at Band G costs on the order of a few tens of dollars per month; the AWS floor is structurally higher before a single request arrives. Exact figures in `10_VENDOR_LIMITS_AND_COSTS.md` §C. |
| **Cross-cloud latency and egress** | Vercel/Cloudflare → AWS adds a network hop on every dynamic request and reintroduces egress charges that R2 and Workers currently avoid |
| **Lost Hyperdrive benefit** | Hyperdrive's ~100 origin connections independent of isolate count is precisely what makes the current Workers tier a non-bottleneck. RDS Proxy is the analogue, but the integration is no longer free or automatic |
| **Operational obligation** | VPC, subnets, security groups, IAM, patching, failover testing, capacity planning — `DEPLOY-R4` currently forbids non-Cloudflare/Vercel infrastructure precisely to avoid this |
| **Team** | `HUMAN-REQUIRED`. This option requires an on-call team that, on current evidence, does not exist |

**The measured trigger that would justify it.** Sustained saturation of the Supabase ladder at 12XL–16XL **with** proven query optimisation, **with** the connection plateau genuinely binding, **and** with the read-replica amendment already taken and insufficient. On the capacity model that is somewhere past Band B. Nothing in the current evidence approaches it.

> **Verdict.** Option 5 is a *coherent* destination and a *premature* one. Adopting it now would spend the platform's entire engineering capacity relocating a system whose actual ceilings are a KV write limit, a missing cache, and a telemetry insert. It should be reconsidered only at its named trigger — and the reference document's own stated principle, *measurement-driven scaling*, is the argument against adopting its own conclusion today.

---

## Option 6 — Distributed / sharded / multi-region end-state

**Boundary study only. Constitutionally forbidden today** (Never-Build items 1, 2, 3, 4, 5).

Relevant only to Band D (10M concurrently active), which `06` §1.2 shows implies LetBuyy being larger at peak than the current Indian e-commerce market combined. If ever modelled seriously it would require: a partition key (almost certainly `site_id`, which is fortunate — the tenant model already provides a natural shard key); explicit hot-tenant handling, since `site_id` sharding fails exactly when one merchant dominates; a global identity and session strategy; cross-shard money and ledger consistency; cross-region failure semantics; a large operations organisation; and a multi-year migration.

**It should not be designed now.** The one thing worth preserving today is the *option*: keep `site_id` as a clean, universal tenant key and avoid cross-tenant joins. That is free, and it is already the governed design.

---

## 1. Scorecard

Scored 1 (poor) – 5 (excellent). Options 0 and 1 are cumulative; 2–5 assume 0 and 1 are done first.

| Dimension | Wt | **O0** Fix current | **O1** Bigger managed | **O2** Read replicas | **O3** One extraction | **O4a** DO coordination | **O4b** D1 tenant DB | **O5** AWS backend | **O6** Sharded/multi-region |
|---|---|---|---|---|---|---|---|---|---|
| Security | 3 | 5 | 5 | 4 | 3 | 5 | 2 | 3 | 2 |
| Tenant isolation | 3 | 5 | 5 | 4 | 3 | 4 | 2 | 3 | 2 |
| Money correctness | 3 | 5 | 5 | 3 | 3 | 4 | 1 | 3 | 1 |
| Checkout/inventory correctness | 3 | 5 | 4 | 3 | 3 | 5 | 1 | 3 | 1 |
| Capacity headroom | 2 | 3 | 4 | 4 | 4 | 4 | 3 | 5 | 5 |
| Latency in India | 2 | 5 | 5 | 5 | 4 | 5 | 4 | 3 | 4 |
| Availability | 2 | 4 | 4 | 4 | 3 | 4 | 2 | 4 | 4 |
| Recovery / DR | 2 | 3 | 4 | 4 | 3 | 3 | 1 | 4 | 3 |
| Operational simplicity | 3 | 5 | 5 | 4 | 3 | 4 | 2 | 2 | 1 |
| Team fit | 3 | 5 | 5 | 4 | 3 | 4 | 2 | 1 | 1 |
| Implementation risk | 3 | 4 | 5 | 3 | 3 | 4 | 1 | 2 | 1 |
| Reversibility | 3 | 5 | 5 | 4 | 3 | 5 | 1 | 2 | 1 |
| Provider portability | 1 | 4 | 4 | 4 | 4 | 4 | 1 | 3 | 3 |
| Cost at current scale | 2 | 5 | 4 | 3 | 3 | 5 | 3 | 1 | 1 |
| Cost at target scale | 2 | 4 | 3 | 3 | 4 | 4 | 3 | 3 | 3 |
| Time to value | 2 | 5 | 5 | 3 | 2 | 4 | 1 | 1 | 1 |
| Constitutional compatibility | 3 | 5 | 5 | 2 | 3 | 5 | 1 | 2 | 1 |
| Proof burden (low = better) | 2 | 5 | 4 | 3 | 2 | 4 | 1 | 1 | 1 |

| | **O0** | **O1** | **O2** | **O3** | **O4a** | **O4b** | **O5** | **O6** |
|---|---|---|---|---|---|---|---|---|
| **Unweighted total** (max 90) | **82** | **81** | **64** | **56** | **73** | **31** | **46** | **35** |
| **Weighted total** (max 220) | **203** | **200** | **154** | **135** | **179** | **70** | **107** | **78** |

### 1.1 Sensitivity to the weights

The ranking is stated with weights that favour correctness and operational simplicity. It is only honest to test whether a different value system reverses it.

| Weighting scheme | Winner | Runner-up | Does the ranking change? |
|---|---|---|---|
| As above (correctness + simplicity weighted 3) | **O0** | O1 | — |
| **Capacity-maximalist** (headroom & target-scale cost → 5; correctness → 2) | **O1** | O0 / O4a | O5 rises to ~135, still well behind. **No reversal.** |
| **Cost-minimalist** (both cost dims → 5) | **O0** | O4a | O5 falls further. **No reversal.** |
| **Ignore the Constitution entirely** (constitutional compatibility → 0) | **O0** | O1 | O2 gains most; O5 still trails. **No reversal.** |
| **Assume Band C is a confirmed requirement today** | O1 + O2 | O4a | O0 remains a *prerequisite* for all of them. **No reversal of sequence.** |

> **The ranking is robust.** Under every weighting tested — including one that discards the Constitution and one that assumes the 10M target is confirmed — Option 0 remains first or a required precondition. That is not an artefact of the scoring; it is a consequence of the four binding ceilings sitting below the governed envelope.

---

## 2. Constitutional status summary

| Option | Class | Authority needed |
|---|---|---|
| **O0** Fix current foundation | C | **None** — agent/engineer may proceed |
| **O1** Larger managed capacity | C (B for material cost change) | None / ordinary review |
| **O4a** Durable Objects for coordination | C | **None** — uses already-provisioned infrastructure |
| **O3** One targeted extraction | B/A | ARB sign-off under the Never-Build 1 reopen condition, with a measured trigger |
| **O2** Read replicas | **A** | **Constitutional amendment** (§6 "no read replica-now") |
| **O4b** D1 as tenant data store | **A** | Amendment — and it would violate `R-15`; recommend rejection |
| **O5** AWS backend | **A** | Amendment (`DEPLOY-R4`) + a named measured trigger + `HUMAN-REQUIRED` team decision |
| **O6** Sharded / multi-region | **A** | Wholesale re-ratification — effectively a new Constitution |

---

## 3. What this comparison does not settle

- **Whether Band C is a requirement at all.** That is Decision D-1 (`06` §1.1, `17` §A). Without it, Options 2 and beyond are answers to an unasked question.
- **Whether Option 0's ceiling is really Band A.** That requires the load programme in `13_TEST_AND_LOAD_VALIDATION.md`. Every ceiling in this document is `INFERRED` over documented vendor limits and counted implementation costs.
- **Whether the team could operate Option 5.** `HUMAN-REQUIRED` (`17` §A). Team capacity constrains architecture more tightly than any technical limit in this packet, and no diagram changes that.
