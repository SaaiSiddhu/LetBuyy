# 17 — Open Questions and Human Actions

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `f52abca7ef6b2ddfc39f03b38206779cbe543e46` · branch `stepup/main` · 2026-08-16.

---

## 0. What this document is

Everything this packet **could not settle**, sorted by **who must act**. Nothing here is an instruction; each item is a question with an owner, a reason it is unanswerable from source, the specific act that unblocks it, its cost, and the downstream work it is holding.

Every item carries an evidence state from `01_EVIDENCE_METHOD_AND_INDEX.md` §1. Most are `HUMAN-REQUIRED` or `UNKNOWN` by construction — that is the point of the document. **`VERIFIED-LIVE` appears nowhere in this packet.** No live provider, runtime, or database access was available, so nothing here establishes what production is running (`04_LIVE_DEPLOYMENT_TRUTH.md` §1).

Where the discovery digest's original finding was corrected by the adversarial pass, this document uses the **corrected** claim and severity. Three such corrections are load-bearing here and are flagged inline (`ARB-1`, `ARB-3`, `OPS-1`).

---

## 1. THE FREE PROBES — highest value per unit of effort in this entire packet

Three actions cost **essentially nothing**, require **no new credential**, and would move a meaningful fraction of this packet out of `UNKNOWN`. They should happen before anything else in this document is discussed.

| # | Action | Cost | What it settles | Currently |
|---|---|---|---|---|
| **P-1** | `gh run list --workflow=production-deploy.yml --limit 20` | **Zero** — repo access already exists | Whether the production pipeline has **ever run successfully, and when**. By inference it also bounds most of `04` §4.1 (which Worker versions, whether Vercel projects were deployed, whether the reserved services were ever shipped) | `UNKNOWN` — `04` L-06 |
| **P-2** | `curl -I https://checkout.letbuyy.com` + a DNS lookup | **Zero** | Whether the `ART-14` hosted checkout origin exists at all. The repo declares the CNAME in Terraform (`infrastructure/dns/dns.tf:91-98`) and the gateway mints handoffs to it (`services/api-gateway/wrangler.toml:286`), but the repo's own records say the apply was never performed (`SKIPPED_HUMAN_DECISIONS.md:14`, `:23`; `EXECUTABLE_HUMAN_REQUIRED.md:16`) | `UNKNOWN` — `04` L-04 |
| **P-3** | **One founder sentence**: does any real merchant or buyer traffic exist today? | **Zero** | Whether every "production" concern in this packet is *present* or *prospective*. The Constitution states LetBuyy has "zero production merchants and zero legacy burden" (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:77`); if still true, the foundation can be fixed **before** traffic, which is materially cheaper than after | `UNKNOWN` — `04` L-25 |

> **Why P-3 outranks almost everything else.** `07_CAPACITY_MODEL.md` §1 finds four independent ceilings that bind **at or below the platform's own ratified 10,000-merchant envelope** — the KV rate limiter (`services/api-gateway/wrangler.toml:259`), a storefront cache hit ratio of approximately zero, one-to-two PostgreSQL telemetry writes per API request, and a 4,800-events/day outbox relay. If P-3 returns "no traffic", those are **cheap engineering tasks on an idle system**. If it returns "yes, live merchants", the same four items are **live incidents**. The identical evidence produces opposite urgency, and one sentence decides which.

**A note on scope discipline.** P-1 and P-2 are live probes. This packet deliberately did **not** run them: no authorised live access was in scope, and `04` §7 makes the standing rule that configuration is never presented as deployment. They are listed here as founder/operator actions, not as work this study left undone.

---

## 2. Item schema

| Field | Meaning |
|---|---|
| **ID** | Stable within this document. `F-` founder · `ARB-` Architecture Review Board · `LEG-` legal · `PRV-` provider · `OPS-` operations |
| **Class** | Constitutional decision class from `LETBUYY_CONSTITUTION.md` §11 / `02_GOVERNED_ARCHITECTURE.md` §7 — **A** constitutional (ARB amendment only), **B** operative (ARB review), **C** implementation |
| **Cost** | Zero · Minutes · Hours · Days · Weeks · Commercial · Counsel |
| **Blocks** | Work that cannot correctly proceed until the item is answered |

---

## 3. A — FOUNDER DECISIONS

### D-1 — Which of S1–S10 does "10 million concurrent users" mean? *(the decision every other decision waits on)*

| | |
|---|---|
| **ID** | `F-1` · **Class** A (it selects, or does not select, a target outside the ratified envelope) |
| **Evidence state** | `HUMAN-REQUIRED` |
| **Source** | `06_10M_WORKLOAD_DEFINITION.md` §1.1, §1.2 |
| **Cost** | One founder decision. Zero engineering. |

"10 million concurrent users" is not one requirement. `06` §1 separates it into **ten** genuinely different engineering targets spanning **four orders of magnitude** of implied origin load. The three plausible readings:

| Reading | What it means | Modelled peak origin RPS | Modelled orders/month | vs the ratified envelope |
|---|---|---|---|---|
| **S3** | 10M **daily active users** | ~10³ | — | Demanding, tractable |
| **S5** | 10M **simultaneously online sessions** (Band C) | **~178,667** (or ~31,000 at 5% uncacheable) | ~49M | **1,640×** |
| **S7** | 10M **concurrently active** request-generating shoppers (Band D) | **~508,000** | 10³ orders/s order of magnitude | Exceeds single-PostgreSQL feasibility under any tuning |

> **S3, S5 and S7 differ by roughly 100× in origin load while describing what a non-engineer would call the same success.** (`06` §1.1, §5 Bands C and D.) There is no architecture recommendation in this packet — or anywhere — that is valid without this answer. `06` §5, `07` §5 and `11_ARCHITECTURE_OPTIONS.md` are all deliberately modelled **across** S3/S5/S7 so that the answer can be supplied late; but it must be supplied before any topology is chosen.

**Two facts the founder should have in hand before answering** (`06` §1.2):

- India has on the order of 900M internet users. Under **S7**, 10M concurrently active shoppers is roughly **1.1% of every internet user in India shopping on LetBuyy at the same instant** — larger at peak than the current Indian e-commerce market combined. That is a market-share hypothesis, not an architecture requirement.
- **S8** ("10M concurrent in-flight HTTP requests") is not a coherent target: by Little's Law at 100 ms mean latency it implies **100,000,000 RPS** (`06` §3.5). Anyone who says it almost certainly means held *sessions* (S5) or held *sockets* (S6).

**Blocks:** the option selection in `11_ARCHITECTURE_OPTIONS.md`; the trigger thresholds in `12_TRIGGER_BASED_EVOLUTION.md`; the amendment scope in `15_ARB_AMENDMENT_PACKET.md`; the final recommendation in `16_FINAL_RECOMMENDATION.md`.

**A caution the packet is obliged to state.** `07_CAPACITY_MODEL.md` §5 Finding C-11 concludes that the 10M conversation is **premature by two orders of magnitude**: the system as currently configured does not serve Band G (its own ratified envelope, ~20 origin RPS). Answering D-1 is necessary for the long-range plan; it is not a precondition for the near-term work, which is identical under every reading.

---

### The remaining founder decisions

| ID | Question | Why the repository cannot answer it | What unblocks it | Cost | Blocks |
|---|---|---|---|---|---|
| **F-2** | **Does any real merchant or buyer traffic exist today?** | Traffic is a runtime property. No telemetry sink is connected (`04` §4.3 L-20…L-25), and the Constitution's "zero production merchants" statement (`LETBUYY_CONSTITUTION.md:77`) is a 2026-06-10 ratification-time fact, not a 2026-08-16 measurement | One founder sentence, or any request-count metric | **Zero** | **Reframes the urgency of every other item in this packet** — see §1 P-3 |
| **F-3** | **Target merchant count and timeline** (100 → 1,000 → 10,000, and by when) | The Constitution fixes the *design* envelope at 10,000 merchants / ~30,000 orders per month (`LETBUYY_CONSTITUTION.md:110`) but states no commercial trajectory. `06` §2.1 M-1 carries merchant count as an unknown input | A founder commitment with dates | Zero | Which of the `07` §4 bottlenecks are near-term (ranks 1–8, all implementation-class) versus theoretical (ranks 9–11, amendment-class); whether `PRV-2` and `PRV-3` are urgent |
| **F-4** | **Monthly infrastructure budget ceiling** | Not expressible in source. `06` §2.4 O-4 records it as `HUMAN-REQUIRED` | A number | Zero | **Determines which options in `11_ARCHITECTURE_OPTIONS.md` are even admissible.** Vendor prices are primary-sourced and dated in `10_VENDOR_LIMITS_AND_COSTS.md`; without a ceiling they cannot be scored |
| **F-5** | **Engineering headcount and the on-call roster** | Not a repository property | A founder answer | Zero | **This constrains architecture more than any technical limit** (`06` §2.4 O-5). A 3-service estate and a 20-service estate need different *teams*, not different diagrams. Also gates `OPS-1` (there is no rota to page) |
| **F-6** | **Acceptable staleness per data class** | A product/risk judgement, not a code fact. `06` §2.4 O-6 and §4 carry it as unknown | A per-class decision: catalog, price, inventory count, order status, merchant dashboard | Hours | The cache design that `06` §6 Finding W-4 identifies as **the single highest-leverage capacity investment available** (worth up to 8×, versus ≤1.15× for cache-hit tuning). Catalog may tolerate 60 s; inventory count may not; **price must not** |
| **F-7** | **Must custom-domain onboarding be same-day?** | A commercial promise, not a code property | A founder answer, then `PRV-4` if the answer is yes | Zero (then Commercial) | See below |
| **F-8** | **Target SLOs and error-budget policy per surface** | None exist. `infrastructure/monitoring/slo-catalog.yaml` contains exactly one entry (`deployment-gate-success`); there is no availability, latency, checkout-success, payment-success, refund-success or queue-lag SLO, and no code computes an error budget | A founder/ops decision per surface | Hours | `09_FAILURE_MODES_RECOVERY.md` RTO/RPO targets; `13_TEST_AND_LOAD_VALIDATION.md` pass criteria; `12_TRIGGER_BASED_EVOLUTION.md` thresholds. The `docs/runbooks/deployment-rollback.md` step that says to close a rollback when "error budget burn returns below alert threshold" **cannot be executed** because no error budget exists |

#### F-7 detail — the Vercel domain-provisioning wall

`07_CAPACITY_MODEL.md` §3.7 Finding C-10, from primary-source vendor documentation accessed 2026-08-16:

- Custom-domain **additions** are capped at **100/hour per team**; **verifications** at **50/hour per team** (`HARD`).
- Onboarding 10,000 merchant apex domains therefore takes **~100 hours to add and ~200 hours to verify — over 8 days end to end, assuming zero retries.**
- The `*.letbuyy.com` wildcard consumes **exactly one** domain slot, so `{store}.letbuyy.com` tenancy is free and instant. **Only merchant-supplied apex domains hit this wall.**

This is a commercial conversation with Vercel (`PRV-4`), not an engineering fix, and it must happen **before** custom domains are marketed as same-day.

> **A second, sharper wall sits behind the same decision.** The vendor sweep (`evidence/21-vendor-digest.md`, providers area) finds Turnstile's Free plan is **20 widgets × 10 hostnames = 200 distinct hostnames per account**. At one custom domain plus its apex/www variant per merchant, that is a hard ceiling at roughly **100 custom-domain merchants** — new onboarding simply fails to register a hostname. The sweep flags one unresolved unknown that **moves this wall by two orders of magnitude**: whether a widget hostname entry automatically covers subdomains. **Resolve that unknown before any Turnstile Enterprise conversation** (`PRV-5`). This constraint is invisible in load testing; it appears only at onboarding time. Evidence state: primary-source vendor limit, dated 2026-08-16.

---

## 4. B — ARB DECISIONS (Class A / Class B)

Per `LETBUYY_CONSTITUTION.md` §11 and §11.2, an agent or engineer may **never** decide any of these alone. The default rule (§11.3): when in doubt about the class, treat it as the higher class and escalate.

### ARB-1 — Classification of `services/lcis-api` *(corrected from the digest)*

| | |
|---|---|
| **Class** | **A** — resolving it as "adopt" alters the canonical runtime list (`ARCH-R2`), which is a Constitution amendment; resolving it as "delete" or "relocate" is **B** |
| **Evidence state** | `VERIFIED-SOURCE` for the facts; `HUMAN-REQUIRED` for the classification |
| **Digest correction** | The dimension audit rated this **S1**. The adversarial pass returned **OVERSTATED** and corrected it to **S2 / VERIFIED-SOURCE**. This document uses **S2**. |

**Confirmed by my own reading at this SHA:**

- `services/lcis-api/` contains `package.json`, `src/`, `test/`, `tsconfig.json`, and a hand-authored `AGENTS.md` — and **no `runtime.manifest.json`**. It is the only `apps/*` or `services/*` root in that state.
- `scripts/validators/governance-common.mjs:97-102` lists four `canonicalServiceRoots` and `:105-112` lists six `reservedServiceRoots`. `services/lcis-api` is in **neither**.
- It is registered as requiring human classification: `config/governance/web-v1-scope-registry.json:451-459` names it `lcis_api_service`, "undocumented runtime; human classification required."

**What the adversarial pass established that reduces the severity** (and that this document therefore adopts): it is **not deployed** (no wrangler/Vercel/Docker config; absent from every deploy workflow); it **is** code-owned (`.github/CODEOWNERS:6,27`); its boundary **is** documented (`services/lcis-api/AGENTS.md`); and the two precise escalations that would matter — adding it to `production-deploy.yml`, or adding an `lcis` dependency to the gateway — are **un-baselined probes** in the same registry (`:458`, `:459`) and would fail the governance gate today.

**The real defect is the validator blind spot.** `scripts/validators/runtime-validator.mjs` enumerates the `apps/` directory and rejects unexpected app roots, but for services it iterates only the canonical list and **never enumerates `services/`**. An undeclared service root is structurally undetectable.

| Option | Class | Consequence |
|---|---|---|
| Delete | B | Simplest. The 19 `packages/lcis-*` workspaces are in the build graph independently and would remain |
| Relocate under `tools/` | B | Matches its actual role (governed tooling). Requires a governed tooling tier to be named |
| Adopt as a 9th runtime | **A** | Requires a Constitution amendment + ARB approval + DOC 03/04 updates **before** any further source (`ARCH-R2`) |

**Blocks:** closing the `ARCH-R2` conformance item in `05_DRIFT_AND_CONFLICT_REGISTER.md`; any accurate runtime count in `02` §3.1.
**Cost:** one ARB session. The validator fix is Class C and independent.

---

### ARB-2 — The customer-realm HS256 issuer vs R-14's sole asymmetric issuer

| | |
|---|---|
| **Class** | **A** if the ARB chooses to carve out an exception to `R-14`; **B** if it schedules remediation with a named gate |
| **Evidence state** | `VERIFIED-SOURCE` (raised from the original claim's `VERIFIED-CONFIG`); severity **S1** confirmed by the adversarial pass |

**Verified directly against source at this SHA — my own reading, not the digest's:**

- `packages/auth-core/src/customer-session.ts:52` signs with `alg: 'HS256'`; `:86-88` verifies by **recomputing the identical HMAC with the identical secret**. The verification key **is** the forgery key.
- **Two** runtimes mint on live, mounted paths: the api-gateway (`routes/storefront/customer-registration.ts:141`, `routes/storefront/customer-engagement-routes.ts:610`, `:770`) and `apps/storefront-runtime` (`src/lib/session.ts:34,:56`, called from `app/api/customer/{login,register,set-password}/route.ts`).

**The governing law is unambiguous and unwaived.** `LETBUYY_CONSTITUTION.md:173-176` (ART-05) makes `identity-platform` the sole issuer "for all three realms" including buyer/customer, and forbids "any service minting tokens other than identity-platform" and "a shared symmetric signing secret across services." `:411` restates it as `R-14`. `AGENTS.md:262` (IDN-R1) and `:233` (SEC-R7) repeat it. `SKIPPED_HUMAN_DECISIONS.md:53` waives only the **merchant-session** drain (`SKIP-IDN-R2-DRAIN-TELEMETRY`), not the customer realm.

**Two corrections carried from the adversarial pass that the ARB must not skip:**

1. The claim that the secret reaches **six** runtimes is **not established**. The production deploy step runs `vercel deploy --prod` without `--prebuilt`, `-e` or `-b`, and there is no `vercel env add` anywhere, so a step-level `env:` block reaches five **GitHub Actions runner** environments — not five deployed app runtimes. `config/env/staging-production-secret-matrix.json:60` is a permissive class-wide superset, demonstrably not a per-app grant (the same file's `LETBUYY_IDENTITY_PRIVATE_JWK` at `:62` **is** scoped per-app). Four of the five apps contain **zero** source references to the variable. **Two holders are proven; the other four are `UNKNOWN`.**
2. The green validator is not evidence of conformance: `scripts/validators/identity-sole-issuer-validator.mjs:11` explicitly allowlists `customer-session.ts`, and its regexes cannot match the raw WebCrypto HMAC actually used.

**An additional instance the ARB should decide on together with the above:** `services/api-gateway/src/routes/export.ts:174` reuses `CUSTOMER_SESSION_SECRET` as a fallback CSV-export signing secret, cross-purposing one key across two signing domains.

**The question for the ARB:** is this (a) an open `R-14` violation to be remediated against a named gate, or (b) a transitional state with an ARB-recorded waiver and an expiry? **It cannot remain undecided**, because `LETBUYY_CONSTITUTION.md:349` forbids resolving an `UNVERIFIED`/open item by silently upgrading it.
**Blocks:** the `R-14` conformance verdict in `05_DRIFT_AND_CONFLICT_REGISTER.md`; the identity threat model in `08_SECURITY_PRIVACY_COMPLIANCE.md`; `PRV-6` (KMS key for the asymmetric issuer). **Cost:** one ARB session; remediation is engineering weeks.

---

### ARB-3 — Is the post-commit outbox dual-write an accepted transitional bridge, or an open `ART-19` defect? *(corrected from the digest)*

| | |
|---|---|
| **Class** | **B** — how a canonical system (the transactional outbox) is implemented |
| **Evidence state** | `VERIFIED-SOURCE` |
| **Digest correction** | The dimension audit rated this **S0**. The adversarial pass returned **OVERSTATED** and corrected it to **S1 / VERIFIED-SOURCE**. This document uses **S1**. |

**The facts, as corrected:**

- The gateway's TypeScript outbox emission is a **non-atomic post-commit dual write** at **38** non-test call sites across 28 files. `EventExecutionAdapter.emitDomainEvent` (`services/api-gateway/src/execution/event-execution.adapter.ts:60-77`) issues a standalone PostgREST upsert **after** the caller's RPC has already committed.
- **The SQL path is genuinely atomic.** The current `create_checkout_order` (`database/supabase/migrations/170_v1_shipping_rates_gst.sql:31-597`) still inserts the outbox row in-body at `:550`. So the **ledger-bearing** events (`checkout.completed`, `payment.confirmed`, `refund.succeeded`, `payment.reference.attached`, `order.created`) are safe. **No money is lost or mis-stated.**
- The at-risk events are the notification / webhook / analytics / search tier.
- **The claimed remedy does not work.** `writeWithOutbox` (`packages/event-core/src/index.ts:1120-1166`) is **not** a same-transaction helper — it performs the same two-step non-atomic write with no `BEGIN`/`COMMIT`, differing only in that it throws rather than swallowing. Adopting it would **not** satisfy `ARCH-004`/`PAY-007`.
- **The failure is loud, not silent.** Only a narrow PostgREST schema-cache miss returns null; every other error throws, producing a 500 *after* the order committed.
- **A defect the original finding missed:** `checkout.completed` is emitted by **both** paths with **different** idempotency keys (SQL `'checkout.completed:'||v_order_id` vs TS `checkout.completed:${session.id}:${body.idempotency_key}` at `services/api-gateway/src/routes/checkout.ts:739`), producing duplicate outbox rows and double-firing consumers.
- `tests/federation/event-spine-contracts.test.mjs:153-235` are **source-text regex assertions that actively lock in the violating pattern.** They provide no atomicity coverage.

`AGENTS.md:93` (ARCH-R8) already requires making the outbox dual-write **atomic (same-transaction)**. The repository's own record treats this as ARB-accepted and sequenced (`STRATEGIC_CANONICALIZATION_2026_06_10/FINAL_ARCHITECTURE_DECISION_RECORD.md:354-356`, `:450` item 7).

**The question for the ARB:** accept it as a transitional bridge **with a named retirement gate and an owner**, or reclassify it as an open defect that blocks a specific wave. Either answer is defensible; **"tracked, indefinitely" is not**, because the duplicate-`checkout.completed` defect and the misnamed `writeWithOutbox` will otherwise be inherited by whoever implements the fix.
**Cost:** one ARB session + a named gate. **Blocks:** `05`'s `R-16`/`ARCH-R8` verdict; `09_FAILURE_MODES_RECOVERY.md`'s event-loss analysis.

---

### ARB-4 — Resolve each Constitution §14.4 `UNVERIFIED` item

`LETBUYY_CONSTITUTION.md:453-460` carries four items as `UNVERIFIED`, and `:349` forbids any agent from resolving one by silently upgrading it to fact. `:371` item 5 assigns resolution to the ARB **once verification evidence exists** — which is precisely why each row below pairs an ARB decision with a provider action.

| §14.4 item | Verbatim status | What produces the evidence | Depends on |
|---|---|---|---|
| **1.** The six anon RLS-to-PUBLIC table GRANTs are set by Supabase's managed bootstrap, not repo SQL | `UNVERIFIED`; migration 107's header is described as strong evidence they are live | `\dp public.orders` + an anon-key probe against `orders`, `store_customers`, `sites`, `products`, `billing`, `subscriptions` | **`PRV-1`** (read-only Postgres role). Tracked as `SKIP-D2-LIVE-ANON-GRANT-PROBE` (`SKIPPED_HUMAN_DECISIONS.md:19`) |
| **2.** The final ARB signature for the ops-console survivor | `UNVERIFIED` human seam; the repository survivor is fixed as `apps/platform-console` | **An ARB signature. No technical work required.** Tracked as `SKIP-GATE-OPS-SURVIVOR-ARB` (`:16`) | Nothing. **This one can be closed today.** |
| **3.** Full RLS/FORCE coverage per tenant table, and the live writers of the "product-dead" tables | `UNVERIFIED`; needs live database introspection **before any DROP** | `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class`; `SELECT * FROM pg_policies`; `SELECT relname, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables` | **`PRV-1`**. Tracked as `SKIP-D4-LIVE-FORCE-COVERAGE-PROBE` (`:21`) and `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE` (`:35`) |
| **4.** Live deployment state of every "complete" wave is ~0% until the deploy meta-blocker clears | `UNVERIFIED` | **§1 P-1** settles most of it at zero cost | Nothing |

> **Context the ARB needs for item 4.** `ART-03` named the `main` ↔ fix-branch lag as *the keystone meta-blocker* — the reason every remediation was undeployable. At this SHA `git rev-list --left-right --count main...stepup/main` returns **`0 0`** (`evidence/00-preflight.txt`): **the lag is zero and the structural precondition for shipping is satisfied.** Whether anything has actually shipped is P-1.

> **Related, and separately ARB-owned.** The adversarial pass returned **CONFIRMED / S0** on `ART-08`: the RLS+GUC tenant backstop is DDL-real and runtime-dead. `withTenantTx` (`services/api-gateway/src/lib/tenant-transaction.ts:15`, the only code issuing `SET LOCAL ROLE app_tenant` at `:29` and the per-transaction GUC at `:30`) is reachable only via `withResolvedTenantTx` (`lib/tenant-context.ts:67`), which has **zero non-test callers**, while 114 non-test gateway files use the `service_role` client. Decisively, `database/supabase/migrations/163_d2_live_data_leak_rls.sql` creates `FOR ALL TO service_role USING (true) WITH CHECK (true)` policies on `orders` (`:11`), `products` (`:27`), `sites` (`:92`), `subscriptions` (`:159`) and four more, and **no later migration drops them**. This is `VERIFIED-SOURCE` and needs **no live access** — it is not an open *question*, it is an open *defect*, and it belongs in `14_FOUNDATION_ACTION_REGISTER.md`, not here. It is listed only because §14.4 items 1 and 3 are frequently mistaken for it.

---

### ARB-5 / ARB-6 — The amendments that must NOT be requested yet

| ID | Amendment | Never-Build item | Measured trigger that must fire **first** | Status |
|---|---|---|---|---|
| **ARB-5** | **Read replicas** | `LETBUYY_CONSTITUTION.md` §10 item 4 / §6 "no read-replica-now" | Sustained direct-connection pressure approaching the **500-connection plateau** — `07` §3.4 Finding C-3: the vertical ladder buys cores, RAM and IOPS, **not concurrency**. Binds at ~Band B (~1M simultaneously online) | **Do not request.** `PROPOSED-NOT-RATIFIED` draft text lives in `15_ARB_AMENDMENT_PACKET.md` |
| **ARB-6** | **Partitioning / sharding** | §10 item 4 | Single-primary write ceiling, ~Band C/D | **Do not request.** Same |

> **The packet's position, stated plainly.** `07` §4 ranks eleven bottlenecks. **Ranks 1–8 are all Class-C implementation work inside already-canonical systems** — not one requires an ARB decision, a new runtime, or an amendment. Only ranks 9 and 11 are amendment-class, and both sit at Band B and above. `07` §5 Finding C-11 concludes that fixing ranks 1–8 plausibly carries the platform to **Band A, roughly 100× its own ratified envelope**. **Bringing ARB-5 or ARB-6 to the board before a measured trigger fires would itself violate `R-17`** (`LETBUYY_CONSTITUTION.md`, §10 / `02` §4), which forbids designing for anything on the Never-Build List. The amendment text exists in `15` so that it is ready — **not so that it is filed.**

---

## 5. C — LEGAL REVIEW

> **Every item in this section is `LEGAL-REVIEW-REQUIRED`.** Nothing below is legal advice, and no item may be resolved by an engineer, an agent, or this packet.

### 5.1 The missing evidence file — stated explicitly

**`evidence/22-india-legal.md` does not exist.** I checked; the path returns "No such file or directory". The evidence directory contains `00-preflight.txt`, `01`–`04` command output, `10`/`11` (discovery), and `20`/`21` (vendor). The vendor digest `evidence/21-vendor-digest.md` covers six areas — `cf-compute`, `cf-storage`, `vercel-next`, `postgres`, `aws-alt`, `providers` — and **contains no Indian regulatory research**. Its only regulatory mentions are incidental vendor-billing facts (Cloudflare pricing is exclusive of Indian GST; Indian cards require RBI-mandated 3D Secure to be saved; a GSTIN cannot be applied retroactively to past invoices).

**Consequence:** no primary-source Indian legal research was performed for this packet. The questions below are therefore listed **as questions for counsel**, each anchored to what the repository actually does, with **no legal position taken or implied**.

### 5.2 The questions counsel must answer

| ID | Question | What the repository actually does (the fact pattern counsel needs) | Why the repo cannot answer it | Blocks |
|---|---|---|---|---|
| **LEG-1** | Under the **DPDP Act**, is LetBuyy a **Data Fiduciary or a Data Processor** for *merchants'* customers? | The Constitution makes an append-only DPDP consent ledger canonical and fail-closed (`LETBUYY_CONSTITUTION.md:185-188`, ART-07; `R-13` at `:408`; `AGENTS.md:267` IDN-R6). It does **not** allocate fiduciary/processor status. The repo already records this as an open leadership/legal decision: `EXECUTABLE_HUMAN_REQUIRED.md:23` (`HR-IDENTITY-DECISIONS`) names "DPDP fiduciary/processor allocation" and children's-data handling as requiring signed approval | Statutory characterisation of a commercial relationship | Consent-ledger scope; DSR export/erasure obligations and their throughput (`06` §1 S1); merchant contract terms; the privacy section of `08_SECURITY_PRIVACY_COMPLIANCE.md` |
| **LEG-2** | Is the **merchant-of-record** model outside the **RBI Payment Aggregator** perimeter? | `AGENTS.md:248` (PAY-R4) and `LETBUYY_CONSTITUTION.md` `R-7` require **never custody**: money-in flows to the merchant's own Razorpay (merchant = MoR); money-out is a split instruction + statement mirror through a licensed PA. **A legal characterisation is already rendered in product UI**: `apps/merchant-control-plane/src/components/billing/BillingPaymentMethods.tsx:236` tells merchants verbatim that "LetBuyy is not an RBI-licensed payment aggregator." Tracked as `HR-LEGAL-DPDP-PA` (`EXECUTABLE_HUMAN_REQUIRED.md:18`) and `HR-PA-SPLIT-LIVE` (`:5`) | Regulatory perimeter is a legal question. **A statement of legal status is currently being shown to merchants without a recorded counsel sign-off in the repository** | PA onboarding (`PRV-8`); payout go-live; whether that UI string may remain |
| **LEG-3** | Is LetBuyy an **"electronic commerce operator"** liable to collect **GST TCS under s.52**? | The data model supports marketplace TCS — `database/supabase/migrations/144_executable_tax_gst_invoices.sql:96-97` (`marketplace_tcs_bps`, `tcs_amount_minor`), `packages/checkout-core/src/index.ts:636` (default 0). **But the live order path hardcodes it to zero**: `services/api-gateway/src/execution/order-execution.adapter.ts:333` passes `marketplace_tcs_bps: 0`. The machinery exists and is switched off | Whether the platform meets the statutory ECO definition | Whether the hardcoded zero is correct or a compliance exposure; GST registration scope; invoice content. Note `HR-GST-IRP-LIVE` (`EXECUTABLE_HUMAN_REQUIRED.md:14`) separately gates IRP/e-way credentials |
| **LEG-4** | **PCI SAQ scope** — which SAQ, and for whom? | The hosted `checkout.letbuyy.com` origin exists precisely to shrink PCI scope (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md:474`). Card fields render inside Razorpay's hosted iframe and are never in LetBuyy's DOM (`docs/checkout-research/14-checkout-editor.md:71`). **But the origin's Terraform apply and Vercel host attach have not been performed** per the repo's own record (`SKIPPED_HUMAN_DECISIONS.md:14,:23`), so the current scope-shrinking claim is architectural intent, not an achieved state | SAQ eligibility is determined by an assessor against actual data flows, not by source | Merchant-facing compliance claims; the security control matrix in `08`; whether the checkout cutover is a compliance prerequisite |
| **LEG-5** | **DLT / TRAI registration** — who owns the entity, header and template registrations: LetBuyy or each merchant? | `EXECUTABLE_HUMAN_REQUIRED.md:9` (`HR-DLT-TRAI-LIVE`) records that live SMS/WhatsApp utility sends require approved sender IDs, templates and provider credentials, and names `services/api-gateway/src/routes/notifications.ts` and `services/queue-workers/src/platform-queue-consumer.ts`. **The repository does not say whose registration it is** | Registration ownership is a legal/commercial allocation | All live SMS/WhatsApp sends; `SKIP-D10-WHATSAPP-BSP-WABA-HSM` (`SKIPPED_HUMAN_DECISIONS.md:25`); the multi-tenant quality-rating contagion risk in `10_VENDOR_LIMITS_AND_COSTS.md` |
| **LEG-6** | **Data-residency obligations** — what must remain in India, and under whose contract? | `PRIMARY_REGION = "ap-south-1"` is declared in production config (`04` §5), and multi-region is on the Never-Build List with "a data-residency mandate" as its **named reopen trigger** (`LETBUYY_CONSTITUTION.md:315`). Two provider facts cut against pinning: **Durable Objects cannot be pinned to India** (jurisdictions are EU / US / FedRAMP-Moderate; an object created by a first request from outside India stays outside India permanently), and whether **D1 supports an India jurisdiction is `UNKNOWN`** — both from `evidence/21-vendor-digest.md` (cf-storage). Tracked as `HR-RESIDENCY-DPDP` (`EXECUTABLE_HUMAN_REQUIRED.md:22`) | A statutory/contractual obligation, not a config value | `06` §2.4 O-7; whether the multi-region Never-Build trigger has fired; the D1/DO second-data-plane decision (`evidence/04-d1-durable-object-second-authority.txt`) |
| **LEG-7** | **Children's-data handling** | Named alongside the fiduciary/processor decision at `EXECUTABLE_HUMAN_REQUIRED.md:23` as requiring leadership/legal/security sign-off. No handling exists in source | DPDP treats children's data specially; the characterisation is legal | Identity migration waves; consent-ledger design |
| **LEG-8** | **Brand and entity facts** | `SKIPPED_HUMAN_DECISIONS.md:33` (`SKIP-BRAND-LEGAL-FACTS`) records that the verified founder legal name, founding date, registered entity details and official profile URLs are **not established** | Not a repository property | Marketing-site legal pages; merchant contracts; provider onboarding forms |

**Cost for §5 as a whole:** one counsel engagement covering LEG-1 through LEG-7 together. They share one fact pattern and should not be asked piecemeal. LEG-8 is a founder/company-secretary task, not counsel.

---

## 6. D — PROVIDER ACTIONS

Ranked to preserve the priority order in `04_LIVE_DEPLOYMENT_TRUTH.md` §6. `04` ranks 1–3 are the free probes in §1 above; the credentials below are `04` ranks 4–7.

| ID | Action | `04` rank | Cost | Resolves | Notes |
|---|---|---|---|---|---|
| **PRV-1** | Provision **one read-only PostgreSQL role** | **4** | Minutes | `04` L-10…L-15, and **§14.4 items 1 and 3** (`ARB-4`) | **The single highest-value credential for closing this packet's gaps.** It resolves six live-evidence items *and* three constitutional `UNVERIFIED` items carried since 2026-06-10. Also settles L-16 (real compute tier, connection ceiling, disk, IOPS) which `07` §3.4 needs as an input |
| **PRV-2** | Provision a **read-only Cloudflare API token** | **5** | Minutes | `04` L-01, L-02, L-07, L-22 | Settles which Worker versions are live, whether live bindings match `wrangler.toml` `env.production`, whether any reserved service has a deployed artefact, and **the actual KV write rate — the input `07` §3.2 Finding C-1 most needs** |
| **PRV-3** | Provision a **read-only Vercel token** | **6** | Minutes | `04` L-03, L-05, L-34 | Settles which projects exist and on what commit; whether the frozen `app-marketplace` / `developer-portal` are deployed (an `ART-22` violation if so); and how many custom domains are attached |
| **PRV-4** | **Vercel domain-provisioning rate raise** | — | **Commercial** | `07` Finding C-10 | 100 additions/hour, 50 verifications/hour per team. Only needed if **F-7** answers "yes, same-day". Conversation must precede the marketing promise, not follow it |
| **PRV-5** | **Turnstile hostname-model resolution, then plan decision** | — | Minutes, then Commercial | The ~100-custom-domain-merchant wall (§3 F-7 note) | **Resolve the subdomain-coverage unknown first** — it moves the wall by two orders of magnitude and determines whether an Enterprise conversation is needed at all. Related live-credential seams: `SKIP-W7-MOBILE-TURNSTILE-SECRET` (`SKIPPED_HUMAN_DECISIONS.md:31`), `HR-TURNSTILE-LIVE` (`EXECUTABLE_HUMAN_REQUIRED.md:12`) |
| **PRV-6** | **Provision a KMS key for the asymmetric issuer** (`ART-05`) | — | Hours | `04` L-33 | `config/env/templates/worker.env.example:51-54` shows `LETBUYY_KMS_MODE=sandbox` with `LETBUYY_ALLOW_SANDBOX_KMS=true`; `config/env/production.env.example:54` carries `LETBUYY_IDENTITY_PRIVATE_JWK=SKIP_NEEDS_HUMAN_PRODUCTION_IDENTITY_ES256_PRIVATE_JWK_JSON` — a **placeholder, not a key**. Tracked as `HR-KMS-LIVE` (`EXECUTABLE_HUMAN_REQUIRED.md:13`) and `SKIP-D3-IDENTITY-LIVE-PROVIDERS` (`SKIPPED_HUMAN_DECISIONS.md:20`). **Depends on `ARB-2`** — provisioning the key is the precondition for retiring the HS256 issuer |
| **PRV-7** | **Upstash provisioning decision — or adopt the Durable Object alternative** | — | Minutes (Upstash) or Days (DO) | `04` L-31; `07` §3.2 Finding C-1 | `services/api-gateway/wrangler.toml:259` sets `RATE_LIMIT_KV_FALLBACK = "on"`, and the committed comment states verbatim that Upstash is not provisioned and that KV's write quota can be exhausted. **The founder-approved comment identifies the daily write allowance as the risk; the sharper limit is 1 write/second/key, which the comment does not mention.** Env var names exist (`UPSTASH_REDIS_REST_URL` / `_TOKEN`, `turbo.json:25-26`). **A Durable Object namespace `RUNTIME_COORDINATOR` is already declared and billed in production and is unused** (`evidence/04-d1-durable-object-second-authority.txt`) — ⚠️ if that route is taken it **must be sharded by identity from the outset**; promoting the existing singleton object into a global limiter would serialise everything addressed to it (`07` §3.2) |
| **PRV-8** | **Live Razorpay / Shiprocket / WhatsApp / ESP credentials** | — | Days–Weeks (external onboarding) | `04` L-32 | Each is a distinct external gate, already enumerated in the repo: `HR-MERCHANT-PSP-LIVE` (`:6`), `HR-PA-SPLIT-LIVE` (`:5`), `HR-CARRIER-LIVE` (`:8`), `HR-WHATSAPP-LIVE` (`:10`), `HR-ESP-LIVE` (`:11`) — plus `SKIP-MERCHANT-PSP-LIVE-CREDENTIALS` (`SKIPPED_HUMAN_DECISIONS.md:57`), `SKIP-CAP-LOGISTICS-LIVE-PROVIDER` (`:59`), `SKIP-CAP-LIVE-EMAIL-DISPATCH` (`:61`). **Provider mode for AI and WhatsApp is declared `sandbox` in production config** (`04` §5) |

> **Three provider facts that should be obtained in writing at the same time as `PRV-8`**, from `evidence/21-vendor-digest.md` (providers, accessed 2026-08-16):
> 1. **Razorpay publishes no numeric API rate limit at any tier.** LetBuyy therefore **cannot compute a checkout-throughput ceiling for its own payment path from documentation.** Ask Razorpay Support for the account's configured limit **in writing** and treat it as a capacity input for `07`.
> 2. **A Razorpay webhook endpoint failing for 24 continuous hours is auto-disabled** and needs a manual dashboard re-enable. The failure is silent from LetBuyy's side — Razorpay stops calling, so error rates fall to zero, which *looks like recovery* while payments are captured and orders never confirm. This argues for a dead-man's-switch alert on the **absence** of webhook traffic, and for a reconciliation job that polls Razorpay independently of webhooks.
> 3. **Resend is 10 requests/second per team** — the tightest documented throughput number in the entire stack, and per-second rate, not monthly volume, is the binding constraint.

---

## 7. E — OPERATIONS

### OPS-1 — There is no delivery channel for any alert *(corrected from the digest)*

| | |
|---|---|
| **Evidence state** | `VERIFIED-SOURCE` |
| **Digest correction** | The dimension audit rated this **S0** ("no human is ever notified of any production failure"). The adversarial pass returned **OVERSTATED** and corrected it to **S1**. This document uses **S1**. |

**Confirmed at this SHA — the alert path is wired end to end and terminates in database rows:**

- Every 5xx plans an alert (`services/api-gateway/src/lib/runtime-alerting.ts:108-110`) with job type `'incident.page.dry_run'` (`:7`), enqueued from the **live** observability middleware (`services/api-gateway/src/middleware/observability.ts:305`) onto a configured producer/consumer pair.
- The consumer **hardcodes** `mode: 'dry_run'` (`services/queue-workers/src/incident-command.ts:96` — verified by direct read) irrespective of the row's configured `paging_adapter`, and only inserts `production_incident_events` + `audit_logs` rows. There is no fetch, HTTP or email call in that file.
- The operations API accepts `pagerduty|opsgenie` (`services/api-gateway/src/routes/operations/incident-command.ts:55`) but always emits dry-run. No migration through 197 implements a provider.
- `infrastructure/observability/prometheus-rules.yaml:4-30` declares three alert rules — **inert paper**: no Alertmanager receiver exists, and the expressions reference metric names (`http_server_errors_total`, `letbuyy_queue_dead_letter_total`) that **nothing emits**; the runtimes emit dot-separated names (`letbuyy.runtime.request`, `letbuyy.queue.dead_letter.total`).

**Why S0 is not earned, and why this is an *operations* item rather than a defect:** no constitutional article requires alerting — a search of `LETBUYY_CONSTITUTION.md` for `observab|alert|monitor|incident|paging|on-call` returns **zero hits**. And it is not an oversight: it is a **recorded, gate-enforced, human-owned seam** — `SKIPPED_HUMAN_DECISIONS.md:47` (`SKIP-CAP-ALERTING-END-TO-END`) and `CAPABILITY_BACKLOG.md:16` (`CAP-C10`) state that production incidents cannot be certified as human-paged until provider DSNs, on-call routing and delivery drills are supplied, and `scripts/validators/beta-readiness-validator.mjs:236-240` asserts the gap must **remain recorded**.

| ID | Action | Owner | Cost | Blocks |
|---|---|---|---|---|
| **OPS-1** | **Establish an on-call rota** | Founder + ops | Depends on **F-5** (headcount) | Everything below. There is currently no rota to page even if a channel existed |
| **OPS-2** | **Select and wire one incident paging adapter** | Ops | Hours once a provider is chosen | Merchant onboarding beyond a pilot. Note a working outbound email channel **already exists** and is simply not used by the incident path — a minimal escalation is closer than a full paging-provider integration. ⚠️ **Citation corrected against the digest:** the discovery digest cites `services/api-gateway/src/routes/contact-public.ts:146` for this; my own read shows `:146` is `resolveTeamInbox`, and **the actual send is `sendResendEmail` at `:501`** (imported at `:6`). The conclusion stands; the line number does not. Related seams: `SKIP-W3-SENTRY-DSN` (`SKIPPED_HUMAN_DECISIONS.md:27`) |
| **OPS-3** | **Backup restore drill** | DB/platform ops | Hours | RTO/RPO in `09_FAILURE_MODES_RECOVERY.md`. `SKIP-W0-PITR-TIER` (`:26`) records that PITR enablement **and a live restore-drill evidence record** are both outstanding. `config/runtime/database-recovery-policy.json` declares a policy; **no exercised proof exists** (`06` §2.4 O-3). Vendor fact: Supabase PITR is a paid add-on with **RPO ≈ 2 minutes** (`07` §3.4) |
| **OPS-4** | **Deploy rollback drill** | Platform ops | Hours | The rollback path is **unrehearsed and partly absent.** First-hand audit (`evidence/01-migrations-and-rollback-pairing.txt`): 126 forward migrations, only **48** paired rollbacks. **12 migrations at or above 138 are unpaired**, and **nine of those are new since `AGENTS.md` MIG-R3 named 138/140/157 as the known set** (170, 175, 179, 182, 183, 184, 186, 187, 194). **`R-23` has regressed**, and the rollback-pairing validator either does not exist or does not gate merge. A bad schema change at or after 138 has no rehearsed DOWN path; recovery falls back to a whole-database PITR restore on a single-region single-Postgres topology — i.e. **restoring one tenant's mistake reverts every tenant** |
| **OPS-5** | **Reconcile the observability estate with the actual topology** | Ops + ARB (B) | Days | Pick one: (a) delete the Prometheus/Grafana/Loki/Tempo artifacts and build alerting on the Analytics Engine SQL API + Cloudflare Workers Logs, which is what the Cloudflare + Vercel topology supports; or (b) provision the stack. `infrastructure/observability/otel-collector.yaml` exports to `tempo.letbuyy-observability.svc.cluster.local` and `loki.…` — **Kubernetes service DNS for a cluster that does not exist in the constitutional topology.** Do not leave `mustUseLiveTelemetry: true` pointed at unreachable targets. Either way, rename the alert expressions to the metric names actually emitted |

> **One correction the operations owner should carry forward.** `package.json:53` maps `validate:observability` to a validator whose assertions are **file-existence and JSON-key-shape checks**. It is the mechanism by which both the alert-name mismatch and the unreachable Kubernetes collector stayed green. **A passing gate there is not evidence of operational readiness** — which is the same category error `01_EVIDENCE_METHOD_AND_INDEX.md` §1.2 warns about generally.

---

## 8. Summary — what is blocked on whom

| Owner | Items | Total cost to clear the *questions* | Single highest-value action |
|---|---|---|---|
| **Founder** | `F-1`…`F-8`, plus P-1/P-2/P-3 | **Essentially zero for P-1…P-3 and F-1…F-5.** Hours for F-6, F-8 | **P-3** — one sentence on whether real traffic exists reframes the urgency of the entire packet |
| **ARB** | `ARB-1`…`ARB-4`; `ARB-5`/`ARB-6` deferred until a measured trigger | 2–3 sessions | **§14.4 item 2** — the ops-console survivor signature needs no evidence and can be closed today |
| **Legal** | `LEG-1`…`LEG-8` — **`evidence/22-india-legal.md` does not exist**, so no primary-source research backs any of them | One counsel engagement (LEG-1…LEG-7 share a fact pattern) | **LEG-2** — a legal-status statement is already being shown to merchants in product UI (`BillingPaymentMethods.tsx:236`) with no recorded sign-off |
| **Provider** | `PRV-1`…`PRV-8` | Minutes for PRV-1…PRV-3; Commercial/Weeks for the rest | **PRV-1** — one read-only Postgres role closes six `04` gaps **and** two constitutional `UNVERIFIED` items |
| **Operations** | `OPS-1`…`OPS-5` | Hours–Days, gated on **F-5** | **OPS-4** — `R-23` rollback pairing has regressed by nine migrations, and this is verifiable and fixable **today with no credential** |

### What is *not* in this document

Items that are **already decided and merely unbuilt** belong in `14_FOUNDATION_ACTION_REGISTER.md`, not here. In particular, the four ceilings in `07` §1 (KV rate limiter, storefront cache, per-request telemetry writes, outbox relay cadence) are **not open questions** — they are `VERIFIED-SOURCE` / `VERIFIED-CONFIG` defects with bounded, Class-C fixes inside already-canonical systems. Nothing in §3–§7 above blocks any of them.

---

## 9. Standing caveat

Every item here is `HUMAN-REQUIRED`, `UNKNOWN`, or `LEGAL-REVIEW-REQUIRED`. **None may be resolved by an agent, and none may be resolved by inference.** `LETBUYY_CONSTITUTION.md:349` is explicit: resolving an `UNVERIFIED` item by silently upgrading it to "fact" is one of the seven things an agent must never do alone. This document exists so that the resolution is **recorded, attributed, and dated** — not so that it is guessed.
