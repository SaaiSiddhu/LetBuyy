# 16 — Final Recommendation

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `f52abca7ef6b2ddfc39f03b38206779cbe543e46` · branch `stepup/main` · 2026-08-16.
>
> This is decision support for the founder and the ARB. It recommends; it does not authorise. No code, migration, governance document, or provider state was changed by this study.

---

## 1. The verdict, in one sentence

**LetBuyy's architecture is correct and its scale envelope is not the problem — but the system as configured cannot yet serve its own ratified 10,000-merchant envelope, because four ceilings bind below it, and all four are configuration or application defects that need no new topology, no new service, and no constitutional amendment.**

---

## 2. What LetBuyy is today

The three states are kept strictly separate, because merging them is the failure mode the Constitution names *governance theater*.

| State | What it is |
|---|---|
| **GOVERNED** | One modular monolith (`api-gateway`) + four satellites + three Next apps + a thin ops console and a Flutter app, over **one** RLS + FORCE + per-transaction-GUC PostgreSQL, on Cloudflare + Vercel in one India region. Canonical append-only double-entry ledger, bigint paise, derived balances, never custody, 0% fee. `identity-platform` as sole asymmetric issuer. Server-authoritative commerce behind a cart-bound signed handoff. Liquid canonical, React frozen. Six reserved services empty. Multi-region, sharding, partitioning-now, read-replica-now, CQRS, sagas, service mesh, Wasm runtime and headless tier all forbidden. |
| **CONFIGURED** | The topology genuinely matches. The six reserved services and two reserved mobile roots are **verifiably empty** — two files each, zero source. All seven rejected CQRS/saga/projection packages are **absent with zero importers**. The four frozen apps are genuinely de-deployed. `PRIMARY_REGION = ap-south-1`. `FEATURE_GRAPHQL`, `FEATURE_EXTENSIONS`, `FEATURE_LIQUID` all `false` in production. Provider modes declared `sandbox` with honest `SKIP_NEEDS_HUMAN_*` placeholders. **`main` and `stepup/main` are identical — the ART-03 deploy meta-blocker is closed.** D1 and Durable Objects are declared but hold **no business data**, so the one-PostgreSQL invariant holds. |
| **LIVE** | **UNKNOWN.** No authorised provider or database access was available. Nothing in this packet establishes what production is running. |

> **This is a genuinely well-governed repository.** The structural discipline is real and unusual: the never-build list is honoured, the reserved seams are empty, the rejected architecture is gone, and the provider-honesty conventions are followed. The defects found are **not** architectural drift. They are unfinished wiring and wrong settings inside a correct design.

---

## 3. Can it support "10 million concurrent users"?

**The question cannot be answered as asked, and the honest answer to what it probably means is: NOT PROVEN, and premature by two orders of magnitude.**

### 3.1 First, the phrase must be resolved

"10 million concurrent users" spans **ten distinct engineering targets differing by four orders of magnitude** (`06` §1). Three plausible readings:

| Reading | Peak origin RPS (modelled) | vs governed envelope |
|---|---|---|
| **S3** — 10M daily active users | ~10³ | ~50× |
| **S5** — 10M simultaneously online | ~1.8 × 10⁵ | ~9,000× |
| **S7** — 10M concurrently *active* | ~5 × 10⁵ | ~25,000× |

**`HUMAN-REQUIRED` — Decision D-1.** No architecture recommendation is valid until the founder picks one. A market check worth stating plainly: under S7, 10M concurrently active shoppers is roughly **1.1% of every internet user in India shopping on LetBuyy at the same instant** — which would make LetBuyy larger at peak than the current Indian e-commerce market combined. That is a market-share hypothesis, not an infrastructure requirement.

### 3.2 Then, the answer

| Band | Verdict as configured | Verdict after the P0/P1 fixes |
|---|---|---|
| **G** — governed envelope (10k merchants, 30k orders/mo, ~20 peak origin RPS) | ❌ **NOT SERVED** | ✅ Comfortable, with large headroom |
| **A** — 100k online (~100× envelope, ≈5M orders/mo) | ❌ | ✅ **Likely served** on one PostgreSQL — needs a load test to confirm |
| **B** — 1M online | ❌ | ⚠️ Boundary. Read replicas — **a constitutional amendment** — become the first real topology question |
| **C** — 10M online (S5) | ❌ | ❌ Needs read replicas **and** partitioning. **Amendment required** |
| **D** — 10M active (S7) | ❌ | ❌ Exceeds single-PostgreSQL feasibility under any tuning |

**So: no, not today — and the reason is not the ambition. The reason is that the system does not currently serve Band G.**

---

## 4. The first bottleneck, and why

It is **not** the database. It is the rate limiter.

```
Production runs RATE_LIMIT_KV_FALLBACK="on" (wrangler.toml env.production.vars).
Each rate-limited request does one KV get + one KV put (rateLimit.ts:321-325, 618-623).

Cloudflare documents:  1 write per second per key  →  HTTP 429.
Cloudflare states KV "is not ideal for applications where you need support for atomic
operations", and is unsuited to write-heavy same-key workloads.

The code then converts that vendor 429 into an ISOLATE-GLOBAL backoff of 60 s to 10 min,
returning 503 RATE_LIMIT_UNAVAILABLE on every non-exempt /v1 route (rateLimit.ts:42, 577-583, 1078-1088).

⇒ Binds at roughly TWO concurrent requests sharing a rate-limit key.
⇒ A busy tenant triggers a platform-wide 503 window. This is a self-inflicted denial of service.
```

Two further points make this the right thing to lead with:

- The read-modify-write is **non-atomic**, so the limiter also **under-counts during exactly the bursts it exists to stop** — a security weakness, not only a capacity one.
- The team's own committed comment anticipates a *daily quota* problem and says "REPLACE WITH UPSTASH before scale." That comment is honest and correct as far as it goes, but **the per-key-per-second limit is sharper and more immediate, and it is not mentioned.**

**The remaining three ceilings, all binding at or below Band G:** the storefront serves no cached HTML and no cached fetches (three small causes make the effective hit ratio ≈ 0); every API request writes 1–2 PostgreSQL rows of telemetry, so database write load scales with *request* volume rather than *commerce* volume; and the outbox relay is capped at 4,800 events/day against ~6,000–8,000/day at the envelope top — while the underlying RPC already permits double the configured rate.

---

## 5. What to do now

Full detail in `14_FOUNDATION_ACTION_REGISTER.md`. In sequence:

| # | Action | Class | Why now |
|---|---|---|---|
| **1** | **Kill-switch `/v1/checkout/:cartId/confirm`** | Implementation, **hours** | The **one CONFIRMED S0**: it accepts any string as `provider_payment_id` with no signature check, no replay check, and no provider fetch, then marks the order paid, commits inventory, credits `merchant_payable`, and writes a webhook-event row asserting `signature_valid = TRUE`. **Free goods with a falsified money trail that reconciliation will not flag.** No first-party client calls it, so a fail-closed kill switch removes the surface with zero functional regression |
| **2** | **Wire an alert delivery channel** | Implementation | Incident paging is hardcoded `dry_run` and terminates in database rows. **No human is notified of any production failure.** Mean time to detection for a total checkout outage currently equals *the time until a merchant complains*. Nothing else is safe to change while this is true |
| **3** | **Bind public order-create to the server cart; re-scope the 13 PUBLIC-effective RLS policies; harden `auth_password_set_intents`** | Implementation (RLS migration needs **ARB** sign-off) | `ART-14` is inert on the live path; 19 policies carry no `TO` clause, of which 13 are unintended and 6 are deliberate allowlisted catalogs |
| **4** | **Replace the KV rate-limit backend with a *sharded* Durable Object** | Implementation | The first bottleneck. The DO namespace is **already provisioned and unused** in production. ⚠️ Shard from the first line — never promote the existing singleton into a global limiter |
| **5** | **Move telemetry off PostgreSQL to the already-bound Analytics Engine dataset; then restore storefront caching; then raise outbox relay throughput** | Implementation | The remaining three sub-envelope ceilings. Telemetry first, because restoring caching changes traffic shape |
| **6** | **Wire the `app_tenant` / tenant-GUC path that already exists** | Implementation | The Constitution's *load-bearing* tenancy layer is DDL-real and runtime-dead. The plumbing is complete and proven; only the call sites are missing. Resolve the connection strategy first — PostgREST cannot issue `SET LOCAL ROLE`, which is very likely why it was never wired |
| **7** | **Run the load programme in `13`** | Implementation | Every capacity number in this packet is `INFERRED` until it runs. It is the gate to every trigger in `12` |

**Nothing in items 1–7 requires a new runtime, a new service, a topology change, or a constitutional amendment.** Item 3's RLS migration is the only piece needing ARB sign-off.

---

## 6. Later — and only on a measured trigger

`12_TRIGGER_BASED_EVOLUTION.md` carries the full ladder. The shape:

- **Levers 1–12** (rate-limit backend, caching, telemetry, outbox, coalescing, hot-SKU admission control, tenant fairness, indexing, pooling discipline, larger compute, dedicated rate-limit backend, queue splitting) are **all Class-C implementation.** None needs ARB approval.
- **Lever 13 — read replicas** is the **first** step requiring a constitutional amendment (§6 forbids "read replica-now" by name). Draft text and a five-condition trigger are pre-armed in `15`.
- **Levers 14, 18, 19** — partitioning, second region, sharding — are further amendments, none evidenced.

> **The precondition for every trigger is measurement, and no telemetry pipeline is currently connected.** Until it is, not one trigger in the ladder can be evaluated. That makes instrumentation — not architecture — the next constitutional-adjacent priority.

**Beware the wrong trigger variable.** Merchant count is not a capacity signal. The bottleneck order proves it: the first four ceilings are indifferent to how many merchants exist.

---

## 7. What must not be built yet

| Do not build | Why |
|---|---|
| **An AWS backend** (ALB/ECS/RDS/ElastiCache/SQS) | Scored **107/220** against Option 0's **203**, and the ranking survives every weighting tested — including one that discards the Constitution and one that assumes 10M is confirmed. Its floor cost bills regardless of traffic, it adds cross-cloud latency and egress, it forfeits Hyperdrive's ~100-connection decoupling and R2's free egress, and it requires an on-call team that does not exist. Adopting it now would spend the platform's whole engineering capacity relocating a system whose real ceilings are a KV write limit, a missing cache, and a telemetry insert. **The reference document's own principle — measurement-driven scaling — is the argument against its own conclusion.** |
| **D1 as a tenant data store** | Would create a second data authority, violating `R-15`. 10 GB per-database cap, no published write throughput, and rows-written priced **1,000×** rows-read. Cloudflare positions D1 for per-tenant sharded databases, explicitly not a shared multi-tenant ledger |
| **Read replicas, partitioning, multi-region, sharding** | Forbidden by §6 and the Never-Build List, and **no trigger is evidenced.** `15` pre-arms the amendments so they can be taken in days if a trigger fires |
| **Any reserved service; any new runtime; CQRS/saga/event-bus; a Wasm runtime; a headless tier; self-custody payout; a transaction fee** | Constitutionally forbidden, and nothing in this study gives a reason to revisit them |
| **A second observability platform** | The Analytics Engine binding already exists and is unused |

---

## 8. Decisions required

**Founder (`17` §A):** which of S1–S10 is the target (D-1); **does any real merchant or buyer traffic exist today** — this reframes the urgency of everything above; monthly infrastructure budget; engineering headcount and on-call roster, which constrains architecture more tightly than any technical limit here; and whether custom-domain onboarding must be same-day, given Vercel's **100 domain-additions/hour** ceiling means 10,000 merchant apex domains take over eight days end to end.

**ARB (Class B, take now regardless of any amendment):** classify `services/lcis-api` — delete, relocate to `tools/`, or adopt as a ninth runtime with an amendment (it is a real, buildable, launchable Hono service with 52 routes and **no authentication middleware**, absent from every topology file yet inside the root build graph); rule on whether the scheduled partition-maintenance workflow is a disabled seam or live maintenance; approve the RLS re-scoping migration; and decide whether the customer-realm HS256 issuer is an accepted realm split or an `R-14` defect to close.

**ARB (Class A):** **none required now.** `15` is pre-armed, not proposed.

**Legal (`LEGAL-REVIEW-REQUIRED`).** Primary-source research (`08` §6) settled more than expected, and moved the urgency in an unexpected direction:

- **DPDP is largely not yet in force.** Every substantive obligation — notice, consent, security, breach notification, data-principal rights, penalties — commences on or about **13–14 May 2027**; Consent Managers at **13–14 November 2026**. IT Act s.43A and the SPDI Rules 2011 are consequently **not repealed** and remain the operative law today.
- **What binds LetBuyy *now* is CERT-In (in force since June 2022):** a **6-hour** cyber-incident report, and **180-day ICT log retention within Indian jurisdiction.** Both are currently unmet — the platform has no alert delivery channel and 2%-sampled logs with no connected sink. **These are the same fixes as `14` P2-1 and P1-3**, which turns two operability items into compliance items.
- **The never-custody design holds.** The RBI PA Directions 2025 define a PA by the *conjunctive* act of aggregating payments **and** settling collected funds, with an express carve-out for technology infrastructure *"without any involvement in handling of funds."* Merchant-of-record on the merchant's own Razorpay sits outside the perimeter. **One question for counsel:** does `ART-11`'s *split instruction* constitute "involvement in handling of funds"? That is the precise seam between the compliant design and the licensing perimeter.
- **No GST TCS.** The s.52(1) test is cumulative and fails on its last limb — TCS bites only where the operator *collects the consideration*.
- **No general data-residency mandate exists**, so one India region is an architectural choice rather than a legal requirement. But two specific obligations may reach LetBuyy: CERT-In's log residency (directly, today) and the RBI 2018 payment-data localisation circular, whose FAQ extends through PSOs to service providers and payment gateways. ⚠️ If either is confirmed, note that **Cloudflare's Customer Metadata Boundary can be set only to the US or EU — there is no India option at any price**, so it constrains **provider choice before topology**.
- Still open for counsel: **Fiduciary vs Processor** classification (it turns on decision rights, and any move to cross-merchant analytics or fraud scoring would flip LetBuyy to Fiduciary for buyer data platform-wide); PCI SAQ scope; and whether LetBuyy or each merchant is the TCCCPR "Sender".

---

## 9. Cost and team

**Cost is not currently a constraint, and the fixes reduce it.** Removing per-request telemetry inserts and restoring caching both cut spend while raising capacity. Detailed models are in `10` §C. Two facts worth carrying:

- **Vertical scaling does not buy concurrency.** Supabase direct connections move 60 → 500 across a ladder spanning $10 → $3,730/month and plateau at 500 from 12XL upward. Anyone planning to "buy a bigger database" is buying cores, RAM and IOPS — not connections.
- **Indian GST applies on top of USD list prices** for Cloudflare (GST-registered since 2023-10-01), and the GSTIN must be on the billing profile before the cycle.

**Team is the real constraint.** Every option beyond 0 and 1 adds operational surface. The current architecture is well matched to a small team — that is a design achievement, not an accident, and it should not be traded away for headroom the business has not asked for.

---

## 10. What this packet does not know

| Gap | Cost to close |
|---|---|
| **What production is actually running** | `gh run list --workflow=production-deploy.yml` — **free, no new credentials** |
| Whether the `ART-14` hosted checkout origin exists | `curl -I https://checkout.letbuyy.com` — **free** |
| Whether any real traffic exists | One founder sentence — **free** |
| Live RLS/GRANT state (settles whether P0-3 and P0-5 are S1 or S0) | One read-only PostgreSQL role — resolves three items the Constitution has carried as `UNVERIFIED` since 2026-06-10 |
| Every capacity number in this packet | The load programme in `13` |
| Whether the validator suite actually passes | It was **not executed** — read as source only |

**Every capacity figure here is `INFERRED` over `VERIFIED-SOURCE` implementation costs and documented vendor limits. `VERIFIED-LIVE` appears zero times in this packet, by necessity and by design.**

---

## 11. The recommendation

**Adopt Option 0 — correctness-first on the current foundation — and do not open the topology question.**

Fix the one confirmed S0 today. Give the platform an alert channel. Close the tenancy and checkout gaps that make the Constitution's strongest words currently decorative. Replace a rate limiter that fails at two concurrent requests. Stop writing telemetry to the transactional database. Turn caching back on. Then measure — and let the measurements, not the ambition, decide what comes next.

On the model, that path plausibly reaches **Band A: roughly 100× the current envelope, on the order of five million orders per month, on one PostgreSQL.** If that proves true under load, the 10-million question resolves itself for several years — and if it does not, `15` is pre-armed and the ARB can move in days.

**The foundation is not weak. It is unfinished in four specific, cheap, well-understood places — and it is being asked about a scale it will not need before it is finished.**
