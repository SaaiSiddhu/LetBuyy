# 08 — Security, Privacy, and Compliance

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.
>
> **This document contains no legal advice.** Every regulatory item is marked `LEGAL-REVIEW-REQUIRED` and is source material for qualified counsel, not a conclusion.
>
> All severities below are **post-adversarial-verification**. Five S0 claims were independently challenged; **one survived**.

---

## 1. Result of adversarial verification

The audit produced 217 findings across ten dimensions, 11 of them rated S0. Every S0 was re-examined by an independent skeptic instructed to refute it. The outcome materially changed the security picture and is stated before anything else:

| Claim | Original | **Verified** | What changed |
|---|---|---|---|
| Checkout confirm accepts an unverified `provider_payment_id` | S0 | **S0 CONFIRMED** | Full attack chain established end to end |
| 19 PUBLIC-effective RLS policies survive replay | S0 | **S1** | 19 not 18; **6 are deliberate allowlisted catalogs, not defects**; 13 are genuine |
| `auth_password_set_intents` PUBLIC policy | S0 | **S1 `INFERRED`** | Policy and consume path confirmed; **the GRANT is `UNKNOWN`** — `000_baseline.sql` is a `--no-privileges` dump |
| `app_tenant`/GUC has zero runtime callers | S0 | **S1** | Confirmed as fact, but it is a **missing control, not a self-contained exploit** |
| Public order-create bypasses the signed handoff | S0 | **S1** | Confirmed unauthenticated, but rate-limited to 20 orders / 5 min per source IP |
| Post-commit outbox dual-write | S0 | **S1** | 38 call sites across 28 files |
| Outbox relay capacity | S0 | **S2** | Real, but the "1.7× under envelope" leg rested on an inferred events-per-order |
| Email batch retry duplicates sends | S0 | **S2** | Confirmed non-idempotent, impact narrowed |
| Incident paging is dry-run | S0 | **S1** | Confirmed: no delivery channel exists |
| Reconciliation mismatches never alerted | S0 | **S1** | Confirmed |
| App-marketplace backend live in the monolith | S1 | **INFO — REFUTED** | A **fail-closed kill switch** returns 404 for every `/app-store/**` and `/app/**` route (`VERIFIED-TEST`) |

> **Twenty-six of thirty-two verified claims were OVERSTATED, two were REFUTED, four were CONFIRMED.** That ratio is itself a finding: single-pass security audits of this codebase systematically overstate severity, most often by reading a migration without checking whether a later migration fixed it, or by finding a defined route without checking whether it is reachable. **Any future audit of this repository should budget for an adversarial pass.**

---

## 2. The one confirmed S0

**`POST /v1/checkout/:cartId/confirm` mints paid orders from an unverified string.**

```
routes/checkout.ts:596      handler accepts provider_payment_id: string, 1-200 chars
packages/checkout-core/src/index.ts:113-118   schema enforces length only
routes/checkout.ts:638      non-empty enforced for non-COD
routes/checkout.ts:691      → PaymentExecutionAdapter.confirmPayment
                            → confirm_order_payment_with_ledger
168_b1_b2_capture_refund_ledgering.sql:154   validates only that the id is non-empty
000_baseline.sql:1439       confirm_order_payment
000_baseline.sql:1478-1504  INSERT payment_webhook_events ... signature_valid = TRUE
                            UPDATE orders SET payment_status='paid', status='confirmed'
168:181                     UPDATE payment_transactions SET status='captured'
                            + balanced ledger transaction crediting merchant_payable

NO signature verification. NO assertProviderPaymentNotReplayed. NO provider fetch.
NO amount check. NO mode gate (mode:'live' is refused; the default 'sandbox' is not).
```

**Attack chain, no credentials required:** anonymous cart → `GET /v1/storefront/:subdomain/cart/:cartToken/checkout-url` (a legitimately obtained signed handoff, valid 10 minutes) → contact → payment-intent (`provider='razorpay'`, `mode` default `sandbox`) → `confirm` with `provider_payment_id: 'x'`.

**Why this is the worst finding in the packet:** it does not merely produce free goods. It writes a `payment_webhook_events` row asserting `signature_valid = TRUE` and posts a balanced ledger entry. **The fraud is recorded as legitimate, so reconciliation-to-zero will not detect it.** It defeats the platform's own money-integrity control.

It also violates `R-22` directly: a `sandbox` provider mode reads as `success`.

**Minimal fix:** a fail-closed kill switch on the `/checkout` prefix before `index.ts:753`, mirroring `appPlatformKillSwitch` at `index.ts:735-745`. No first-party client uses these routes — the shipped storefront uses `/storefront/:subdomain/payments/razorpay/*` — so the surface disappears with zero functional regression. See `14` P0-1.

---

## 3. Threat model

Each threat mapped to its current control, the evidence, and the gap.

### 3.1 Tenancy and data isolation

| Threat | Current control | Evidence | Verdict |
|---|---|---|---|
| Cross-tenant data read/write via a missed predicate | App-layer query-shape lint (`tenant-scoped.ts`) — a Proxy requiring a scope predicate | `lib/supabase.ts:13-14` | ⚠️ **Sole control.** It cannot detect a *wrong* `site_id`, only a *missing* predicate |
| RLS bypass | RLS `ENABLE`+`FORCE` + `app_tenant` policies exist and survive replay (`164:63-73`, extended by `196`) | `139:8-14`, `164:11` | ❌ **Runtime-dead.** `withResolvedTenantTx` has zero non-test callers; all traffic uses `service_role` (BYPASSRLS) |
| Unguarded table access | `tenant-tables.registry.ts` | `tenant-scoped.ts:119` | ❌ Tables **absent from the registry get no guard at all** |
| Unguarded RPC access | — | `tenant-scoped.ts:115` | ❌ **77 `.rpc(` call sites are never intercepted by the proxy** |
| Anon direct PostgREST access | RLS policies | §4 below | ⚠️ 13 tables PUBLIC-effective at replay-final |
| Forged tenant context | GUC must come from a validated claim (`R-4`) | `164` | ➖ Not exercised — the GUC path is unwired |
| Cache-key tenant collision | Cache key construction | `03` §storefront | See `03`; key scoping must include `site_id` |
| Custom-domain takeover | Domain→site mapping | `03` §storefront | See `03` |
| **Reserved-hostname claim** | `RESERVED_STOREFRONT_LABELS` / `RESERVED_SUBDOMAINS` | `packages/tenant-core/src/index.ts:27-57` | ❌ **`checkout` is not reserved** — a merchant can claim the hostname the Constitution designates as the hosted checkout origin |

> **The tenancy verdict, precisely stated.** The database-level backstop the Constitution calls *load-bearing* does not exist on the live path. This is a **missing control**, not a self-contained exploit: converting it into cross-tenant access requires an additional route-level defect. But two structural shapes supply exactly that opportunity — unregistered tables and the 77 uninterceptable RPC call sites — and there is no second line of defence behind either.

### 3.2 Identity and sessions

| Threat | Control | Evidence | Verdict |
|---|---|---|---|
| Token forgery (merchant realm) | ES256 asymmetric, `identity-platform` sole issuer | `02` §4 R-14 | ✅ Design correct |
| **Token forgery (customer realm)** | HS256 with a **shared** secret; signing and verification use the identical key; **two runtimes mint** on live mounted paths | `packages/auth-core/src/customer-session.ts:52,:86` | ❌ **The verification key is the forgery key.** `R-14` / `SEC-R7` conflict — `ARB-review` to rule whether this is an accepted realm split or a defect |
| Shared secret across trust domains | One `AUTH_SECRET` deployed to **six** trust domains including `marketing-site` | `production-deploy.yml:315,443` | ⚠️ S2. Same value signs the `lb_accounts` cookie that is guard 2 of 2 on `/api/auth/switch` |
| Session replay | `validate_and_rotate_merchant_session` implements rotation **and reuse-detection** | `175_fix_session_rpc_search_path.sql:37-56, 95-117` | ❌ **Dead code** — both call sites pass `{ rotate: false }` (`middleware/auth.ts:136`, `routes/auth.ts:387`), so a 30-day bearer never rotates |
| Account takeover via `/switch` | Fix present and correctly ordered | `apps/identity-platform/src/app/api/auth/switch/route.ts:35-110` | ⚠️ Present, but **no behavioural test** — coverage asserts source-*text* ordering via `readFileSync` + `indexOf` |
| Password-set intent forgery | RLS policy + consume-path checks | `078:52`; `auth.ts:940-949, 1013-1027` | ❌ Policy is PUBLIC-effective; cookie is **unsigned**; **no "user has no password yet" check** before overwriting `password_hash` |
| Privilege escalation via `user_metadata` | Role only from `app_metadata`/DB | `SEC-R10` | See `03` |
| Placeholder JWKS | `ART-07` forbids it | `03` | See `03` |

### 3.3 Money

| Threat | Control | Verdict |
|---|---|---|
| **Payment forgery** | — | ❌ **The confirmed S0** (§2) |
| Duplicate capture / webhook replay | `assertProviderPaymentNotReplayed`, idempotency keys | Present on the webhook path; **absent on the confirm path** |
| Ledger tampering | Append-only by trigger **and** `REVOKE UPDATE/DELETE`; `165:463-464` revokes from every role including `app_tenant` | ✅ Correct |
| Ledger integrity in aggregate | `post_ledger_transaction` is the **transitive kernel of every production money write** — reached via `post_settlement_ledger_transaction` (`165:253`) from `confirm_order_payment_with_ledger` (`168:238`), `complete_order_refund` (`168:401`), `record_order_payment_failure_with_ledger` (`168:663`), `reconcile_cod_remittance_with_ledger` | ✅ **A criticism of this was REFUTED.** The kernel is genuine and behaviourally tested |
| Undetected divergence | 6-hourly reconciliation | ❌ Mismatches logged at `info`/`completed`; **never alerted** |
| Self-custody rail | `razorpayx` must be dead | See `03` |
| Forgeable step-up | Must be real cryptography (`R-10`) | See `03` |
| Audit-trail forgery | `audit_logs` `audit_insert` policy is `FOR INSERT WITH CHECK(true)` with no `TO` | ❌ Anyone with the anon key can inject audit rows. Reads *are* gated by `is_super_admin` |

### 3.4 Application and infrastructure

| Threat | Control | Verdict |
|---|---|---|
| **Webhook SSRF** | `url.protocol === 'https:' && url.hostname.length > 0` — **and nothing else** (`packages/notification-core/src/index.ts:505-512`) | ❌ S2. Private and link-local addresses accepted, at registration, fanout eligibility, and dispatch |
| Stored XSS via theme/content | Data-only sandbox + allowlist sanitiser | See `03` §theme |
| Stored XSS via `pages` | RLS | ❌ `pages` is PUBLIC-effective READ+WRITE — `html_content`/`body` cross-tenant defacement |
| Third-party code in the live path | `R-12`; app-platform kill switch | ✅ **REFUTED as a live risk** — fail-closed 404 (`VERIFIED-TEST`) |
| Bot inventory hoarding | Turnstile on registration/contact/review only | ❌ Not on order-create |
| DDoS / economic denial | Cloudflare WAF + the KV limiter | ⚠️ The limiter is itself a DoS amplifier (`07` C-1) |
| Secrets in the repository | `SEC-R2`; `SKIP_NEEDS_HUMAN_*` placeholders | ✅ No secret values found; placeholders are honest |
| **Anon key exposure** | Not shipped to any browser | ⚠️ **Corrected on verification.** The key is distributed to 5 Vercel build environments, 4 Worker secrets, and GitHub Actions — but **no deployed LetBuyy surface publishes it**: no app source references `NEXT_PUBLIC_SUPABASE_*`, and there is no browser-side Supabase client. The only `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the tree is `apps/developer-portal/.env.local`, which is gitignored and belongs to a **frozen, non-deployed** app. Supabase treats anon keys as public by design and migration `107` calls it *"the public anon key"* — so it should still be assumed obtainable by a determined attacker, but it is **not trivially readable from the product**, which materially lowers the practical exploitability of §4 |
| Undeclared attack surface | — | ⚠️ `services/lcis-api`: 52 routes, **no authentication middleware**, live provider probes (`/db/status`, `/cloudflare/status`, `/vercel/status`), in no topology file, in the root build graph |

---

## 4. The RLS policy register

19 policies carry `USING(true)`/`WITH CHECK(true)` with **no `TO` clause** at replay-final, out of 680 total. Migration `163_d2_live_data_leak_rls.sql` fixed 12 tables and **covers none of these 19**.

| Table | Exposure | Evidence |
|---|---|---|
| `auth_password_set_intents` | **READ+WRITE — highest stakes** | `078:52` |
| `pages` | READ+WRITE — defacement, stored XSS | `000_baseline.sql:26708` |
| `collections`, `collection_products` | READ+WRITE | `000_baseline.sql:26652, :26645` |
| `onboarding_attempts` | READ+WRITE — PII (`ip_address`, `user_agent`, `user_id`) | `000_baseline.sql:26694` |
| `store_surveys` | READ+WRITE | `000_baseline.sql:26743` |
| `gift_cards` | READ+WRITE — **money** | `000_baseline.sql:26666` |
| `audit_logs` | INSERT — audit forgery | `000_baseline.sql:24380` |
| `ai_usage` | INSERT **+ SELECT** via a sibling `USING (store_id IN (SELECT sites.id FROM public.sites WHERE true))` policy with no `TO` | `000_baseline.sql:23960, :24127` |
| `app_collections`, `app_collection_items`, `app_featured_placements`, `app_discovery_events` | Low impact — frozen marketplace, platform-global | `100:133, :145, :152, :155` |
| `plans`, `employee_roles`, `employee_permissions` (+3) | **NOT vulnerabilities** — deliberate SELECT-only global catalogs, explicitly allowlisted | `scripts/validators/foundation-sql-policy-residue-validator.mjs:13-23` |

**Fix:** one additive migration `198_*.sql` mirroring `163`: `DROP POLICY` → recreate `FOR ALL TO service_role` → `REVOKE` from `PUBLIC, anon, authenticated`, with a paired rollback. No application change is needed, because the gateway uses `service_role` — the same argument `107:16-19` makes explicitly. **Requires ARB sign-off** (RLS changes on tenant tables).

> **`HUMAN-REQUIRED` — the deciding probe.** Whether these are S1 or S0 turns on whether `anon` actually holds the table GRANT. `000_baseline.sql` is a `--no-privileges` `pg_dump` (zero `GRANT` statements across 28,083 lines), so the repository **cannot** answer it. `\dp public.auth_password_set_intents` settles it in one query. This is `04` §4.2 L-10 and it is the single highest-value security probe available.

### 4.1 Why the gate did not catch this — a validator that matches on a policy *name*

This is the most instructive finding in the packet, because it is a concrete instance of the failure class `ART-02` and `R-18` exist to prevent.

```
scripts/validators/foundation-sql-policy-residue-validator.mjs:46-54
    classifies a USING(true) policy as a "service_role-only policy"
    if the policy NAME merely contains the string "service role"
    — WITHOUT requiring an actual TO clause.
```

The offending policy is literally named `"Service role manages auth password set intents"`. **It is whitelisted by its own name while granting PUBLIC access.** A validator that greps for an intention rather than checking the mechanism is satisfied by a policy that does the opposite of what its name says.

The history makes it sharper still. **Migration `107` exists specifically to fix this exact defect class.** Its own header (`107:4-8`) states that policies named `"Service role …"` which *"OMITTED `TO service_role` … evaluated `USING(true)` for the anon and authenticated PostgREST roles"*, and that *"password-reset tokens were readable with the public anon key."* `107:25-43` re-scoped `devices`, `sessions`, `users_custom`, `verification_tokens`, and `customer_credentials` — and **missed `auth_password_set_intents`**, which migration `078` had introduced. The generated LCIS graph also misses it: `graphify-out/db-intel.json` carries no policy record for this table, because the parser does not descend into the `DO $$` block.

So the defect survived: a targeted remediation migration, a purpose-built validator, and a code-intelligence layer. **This is what "a green gate that proves nothing behavioural" costs in practice** — see `13_TEST_AND_LOAD_VALIDATION.md` §A.

### 4.2 Scope correction — merchant identities only

The foreign key at `078:7` points to `public.users_custom`, i.e. **merchant and platform identities only**. Storefront customers use `store_customers` / `customer_credentials` and the separate migration-`077` reset flow, and are **not reachable** through this table. The blast radius is merchant account takeover, not buyer account takeover.

The consume path's specific weaknesses, for the remediation: the `lb_password_set_intent` cookie stores the **raw, unsigned** intent UUID; CSRF is double-submit (cookie == header), which an attacker controlling both trivially satisfies; the rate limit is 5 per 15 minutes per IP and only one success is needed; and the `id` column, while defaulted, is **explicitly insertable**, so an attacker never needs `SELECT` to learn it. Separately, the table's own `USING(true)` SELECT exposes `(user_id, email)` for every merchant who has completed OTP verification since `078` — a self-sufficient discovery oracle.

---

## 5. Control ↔ test matrix

Whether each control is *proved* to work, using the corrected test findings.

| Control | Implemented | Behavioural test | Telemetry | Verdict |
|---|---|---|---|---|
| Tenant isolation (RLS) | DDL yes, runtime no | `tests/executable/tenant-redteam-*` exercises real SQL under `SET ROLE` | none | ⚠️ **Tested for a path production does not take** |
| Tenant isolation (app guard) | Yes | Partial | none | ⚠️ Sole live control |
| Sole issuer | Merchant yes; customer no | — | none | ❌ |
| Session rotation / reuse detection | Implemented, **unreachable** | — | none | ❌ |
| `/switch` takeover fix | Yes | **Source-text assertion only** | none | ⚠️ |
| Checkout handoff binding | Partial | — | none | ❌ |
| Server-side totals | Yes | — | none | ⚠️ |
| Payment signature verification | Webhook yes, **confirm no** | — | none | ❌ **S0** |
| Ledger append-only | Trigger **and** `REVOKE` | `tests/executable/money-ledger-postgres` — real SQL | none | ✅ |
| Reconciliation-to-zero | Yes | Yes | ❌ **no alert** | ⚠️ |
| Outbox atomicity | SQL path yes; **TS path no** (38 sites) | — | none | ❌ |
| Queue idempotency | Partial | — | none | ⚠️ |
| Theme sandbox / XSS | Yes | See `03` | none | see `03` |
| Cache tenant isolation | See `03` | — | none | ⚠️ |
| Webhook SSRF guard | ❌ **absent** | — | none | ❌ |
| Rate limiting | Yes, on an unsuitable backend | `rate-limit-query-cost-backend.test.ts` | none | ❌ |
| Backup / restore | Declared | **no drill evidence** | — | ⚠️ |
| Incident detection | ❌ **dry-run only** | — | — | ❌ |

**The gate context, stated fairly.** Of 110 gate-lane validators, **zero** make an HTTP request, boot a runtime, or connect to PostgreSQL; exactly two spawn a subprocess. But `ci.yml` genuinely runs `pnpm test:behavioral`, which docker-starts `postgres:16-alpine` and executes 21 real-SQL suites under 43 `SET ROLE` statements — **that is real behavioural coverage**, and it is where the tenancy and money proofs live. The honest summary is: *the structural gate proves almost nothing about behaviour, and a genuine behavioural suite exists alongside it that proves rather more than the gate does.*

---

## 6. Privacy and compliance

Primary-source research, accessed 2026-08-16. Full obligation register at `evidence/23-india-legal.md`. **Every item is `LEGAL-REVIEW-REQUIRED`** — this is source material for counsel, not a legal conclusion.

### 6.1 The headline: DPDP is largely NOT yet in force, and something else binds today

MeitY's commencement notification **G.S.R. 843(E) of 13 November 2025** brought into force only s.1(2), s.2 (definitions), ss.18–26 (the Data Protection Board), ss.35, 38–43, and s.44(1) & (3). **Every substantive obligation LetBuyy would engineer for sits in the eighteen-month bucket, commencing on or about 13–14 May 2027:** notice (s.5), consent (s.6), Data Fiduciary obligations including security and breach notification (s.8), children's data (s.9), Significant Data Fiduciary duties (s.10), data-principal rights (ss.11–14), cross-border transfer (s.16), and the penalty regime (ss.28–34). The **Consent Manager** provisions (s.6(9), Rule 4) commence at twelve months, on or about **13–14 November 2026**. The DPDP Rules 2025 (G.S.R. 846(E)) mirror this: only Rules 1, 2, and 17–21 are live, and those are Board-internal.

> **Two consequences that change the engineering picture:**
>
> 1. **IT Act s.43A and the SPDI Rules 2011 are NOT repealed.** Because DPDP s.44(2) is itself in the eighteen-month bucket, they remain the operative personal-data security and grievance law binding LetBuyy today, alongside IT Act s.72A.
> 2. **What actually binds LetBuyy right now is the CERT-In Directions of 28 April 2022** — and they carry concrete engineering obligations that are live *today*, not in 2027.

### 6.2 CERT-In — in force since 28 June 2022, and engineering-relevant now

| Obligation | Engineering consequence for LetBuyy |
|---|---|
| **Mandatory 6-hour cyber-incident report to CERT-In** | ⚠️ **`09` establishes there is no alert delivery channel at all** — incident paging is hardcoded `dry_run`. A six-hour statutory reporting clock cannot be met by a pipeline whose detection mechanism is "a merchant complains." This converts `14` P2-1 from an operability item into a **compliance** item |
| **ICT logs enabled and maintained securely for a rolling 180 days, within Indian jurisdiction** | ⚠️ Directly engages `07` §3.5. Request logs are **2%-sampled** for anonymous storefront traffic and there is **no connected log sink**. Moving telemetry off PostgreSQL (P1-3) must therefore route to a retained, India-resident store — not simply be deleted |
| NIC/NPL time synchronisation | Configuration item |
| Designated Point of Contact | `HUMAN-REQUIRED` |

### 6.3 Data Fiduciary vs Data Processor — the answer turns on decision rights

The statutory test is purely who *"determines the purpose and means of processing"* (s.2(i)) versus who processes *"on behalf of a Data Fiduciary"* (s.2(k)). **It turns on decision rights — not on data custody, contract labels, or fund flows.** s.2(i)'s *"alone or in conjunction with other persons"* means LetBuyy can be a **joint** Data Fiduciary alongside the merchant, and s.8(1) makes each responsible *"irrespective of any agreement to the contrary"* — **there is no GDPR-style allocation mechanism available.**

The likely split, for counsel to confirm:

| Data | Probable role |
|---|---|
| Merchant-instructed order and customer data | **Processor** — and the Act imposes **no direct duty on a Processor at all** |
| LetBuyy's own merchant account holders | **Data Fiduciary** in its own right |
| Cross-tenant analytics, cross-merchant fraud scoring, ML training, LetBuyy's own marketing, unilaterally-set retention | **Data Fiduciary** — any of these flips the classification |

> **Engineering consequence.** The `ART-07` fail-closed DPDP consent ledger — recorded by DOC 03 §3.1 as **CANONICAL (build), absent today** — becomes a hard requirement from May 2027 for whatever LetBuyy is Fiduciary for. Building it is not urgent *this quarter*; deciding the classification is, because it determines scope. Also note that **any move toward cross-merchant analytics or fraud scoring converts LetBuyy into a Fiduciary for buyer data platform-wide** — a product decision with a large compliance consequence.

### 6.4 RBI — the never-custody design holds, with one question for counsel

The **RBI (Regulation of Payment Aggregators) Directions 2025**, effective 15 September 2025, define a PA by the **conjunctive** act of aggregating customer payments **and** *"subsequently settl[ing] the collected funds to such merchants."* Paras 4.j and 10.g expressly carve out the payment gateway that *"provides technology infrastructure to route and facilitate processing of a payment transaction without any involvement in handling of funds."*

> **A platform where the merchant is merchant-of-record on their own Razorpay account and LetBuyy never custodies funds sits OUTSIDE the authorisation perimeter.** `R-7` and `ART-11` are therefore not merely prudent — they are the specific design choice that keeps LetBuyy out of PA licensing. Risk arises only if LetBuyy ever routes, holds, nets fees from, or splits merchant collections.

⚠️ **The one question counsel must answer.** `ART-11` and DOC 03 §3.3 specify money-out as a **"PA-split instruction + statement mirror + reconciliation."** Does *instructing a split* constitute *"involvement in handling of funds"* under paras 4.j / 10.g? This is the precise seam between the compliant design and the perimeter, and it is the single most consequential legal question for the platform's business model. Note also that the Directions **removed the fixed regulatory T+n settlement schedule** — settlement timing is now purely contractual between PA and merchant.

Two RBI rules reach LetBuyy indirectly:

| Rule | Status | Consequence |
|---|---|---|
| **Card-on-file restriction** — no entity in the card chain other than issuers and networks may store CoF data | In force since 1 October 2022 | LetBuyy is an entity in the chain; it must store no card data |
| **Payment-data localisation** (2018 circular) — whose FAQ extends the *"stored only in India"* obligation **through PSOs to their service providers, intermediaries, payment gateways, and third-party vendors** | In force and actively enforced | ⚠️ **This is the residency obligation that plausibly does reach LetBuyy.** See §6.7 |

### 6.5 GST — no TCS, on a cumulative test that fails on its last limb

CGST s.52(1) imposes TCS only *"where the consideration with respect to such supplies is to be collected by the said operator."* **A SaaS platform that never collects consideration owes no TCS**, needs no s.24(x) registration, and files no GSTR-8 or GSTR-9B. Whether LetBuyy is an "electronic commerce operator" at all under the broader s.2(45) remains **arguable and unlitigated** — but the TCS consequence does not follow from that label alone.

In force and applicable in substance today: e-invoicing (IRN/QR) under Rule 48(4) at the ₹5 crore AATO threshold — **per merchant, not per platform**; the 30-day IRN reporting limit for taxpayers above the specified AATO since 1 April 2025; invoice retention under CGST s.36; credit-note and amendment rules under s.34(1) with the 30 November cut-off; and place-of-supply CGST+SGST vs IGST with HSN reporting. These validate `ART-15`'s GST requirements as legally grounded rather than merely prudent.

### 6.6 PCI DSS

**v4.0.1 is the only active version.** SAQ scope turns on the checkout integration shape — whether the platform redirects to a hosted page, embeds a provider iframe/SDK, or touches card data. `HUMAN-REQUIRED`: confirm the intended integration before SAQ selection. The `sandbox`-mode confirm path (§2) is a scope question as well as a security one.

### 6.7 Data residency — no general mandate, one specific one that likely reaches LetBuyy

> **There is NO general Indian data-residency mandate** as of 2026-08-16. This is important: a single `ap-south-1` region is an **architectural choice**, not a legal requirement — which means multi-region is not blocked by residency, and equally is not compelled by it.

Two exceptions:

1. **RBI payment-data localisation (2018)** — in force and actively enforced. Its FAQ extends the obligation through PSOs to **service providers, intermediaries, payment gateways, and third-party vendors**. `LEGAL-REVIEW-REQUIRED`: does LetBuyy fall inside that chain? If yes, payment data must be stored only in India.
2. **CERT-In (§6.2)** — ICT logs must be maintained **within Indian jurisdiction** for 180 days. This one applies **directly and today**.

⚠️ **The provider constraint the ARB must know.** Cloudflare's **Customer Metadata Boundary can be set only to the United States or the European Union — there is no India option at any price.** If either residency obligation is confirmed to reach LetBuyy, it constrains **provider choice before it constrains topology**, and no amount of multi-region architecture resolves it. This should be settled with counsel before any provider commitment deepens.

### 6.8 Messaging

TCCCPR 2018 as amended by the Second Amendment (2025) is in force: DLT registration, sender-ID and template registration, scrubbing, and a tightened promotional / transactional / service classification. `LEGAL-REVIEW-REQUIRED`: **who is the "Sender"** — LetBuyy or each merchant? That answer determines whether registration is a platform obligation or a per-merchant onboarding step, and it shapes the notification router and the WhatsApp wedge. WhatsApp Business Platform opt-in and template rules apply as **Meta contract terms** rather than statute, and bind if LetBuyy ships the WhatsApp channel.

### 6.9 Privacy-relevant engineering facts established by this study

| Fact | Consequence |
|---|---|
| The DPDP consent ledger does not exist (DOC 03 §3.1: CANONICAL (build), absent; the OIDC consent route returns 501) | Not yet a legal gap — s.6 commences ~May 2027. **It becomes one, for whatever LetBuyy is Fiduciary for** |
| `onboarding_attempts` (`ip_address`, `user_agent`, `user_id`) is **PUBLIC-effective READ+WRITE** at replay-final | A live personal-data exposure under **IT Act s.43A / SPDI Rules**, which are in force today — not a 2027 problem. One migration fixes it |
| Request logs are 2%-sampled with no connected sink | ⚠️ Conflicts with **CERT-In's 180-day India-resident log retention**, in force now |
| No alert delivery channel exists | ⚠️ Conflicts with **CERT-In's 6-hour incident reporting**, in force now |
| PITR is a paid add-on ($100/$200/$400 for 7/14/28-day retention, RPO ≈ 2 min); Supabase Pro includes 7-day backups | Erasure obligations must also reach backups; retention beyond 7 days is a purchase decision |
| Consent gating (`R-13`) must fail closed | See `03` §async |

---

## 7. Priority order

| # | Item | Severity | Authority |
|---|---|---|---|
| 1 | Kill-switch / fix `/v1/checkout/:cartId/confirm` | **S0 CONFIRMED** | Implementation |
| 2 | Wire an alert delivery channel | S1 | Implementation |
| 3 | Re-scope the 13 PUBLIC-effective policies (`198_*.sql` + rollback) | S1 | **ARB** |
| 4 | Harden `auth_password_set_intents`: policy, `REVOKE`, sign the cookie, add the "no existing password" guard | S1 | ARB + Implementation |
| 5 | Bind public order-create to the server cart | S1 | Implementation |
| 6 | Run `\dp` on the affected tables — **settles items 3 and 4's true severity** | — | **`HUMAN-REQUIRED`** |
| 7 | Wire `withResolvedTenantTx`; audit the 77 uninterceptable `.rpc(` sites and unregistered tables | S1 | Implementation |
| 8 | Rule on the customer-realm HS256 issuer | S1 | **ARB** |
| 9 | Enable session rotation (`rotate: true`) | S2 | Implementation |
| 10 | Add the webhook SSRF guard | S2 | Implementation |
| 11 | Reserve the `checkout` subdomain | S2 | Implementation |
| 12 | Classify or authenticate `services/lcis-api` | S2 | **ARB** |
| 13 | Replace source-text assertions with behavioural tests for `/switch` and the handoff | S2 | Implementation |
| 14 | **Meet CERT-In's in-force obligations** — a 6-hour incident reporting capability (needs item 2) and 180-day India-resident ICT log retention (needs `14` P1-3 to route to a *retained* store, not merely off PostgreSQL) | — | Implementation + `HUMAN-REQUIRED` (PoC designation) |
| 15 | Counsel on the **PA-split instruction** question (§6.4) — does instructing a split constitute "involvement in handling of funds"? | — | **`LEGAL-REVIEW-REQUIRED`** |
| 16 | Counsel on **Fiduciary vs Processor** classification (§6.3) and on whether **RBI payment-data localisation** reaches LetBuyy (§6.7) | — | **`LEGAL-REVIEW-REQUIRED`** |

> **Two compliance items are in force *today* and are not in the 2027 DPDP bucket:** CERT-In's 6-hour incident report and its 180-day India-resident log retention. Both are currently unmet, and both are downstream of engineering items already in this list (the alert channel and the telemetry re-route). That is a useful alignment: **the operability fixes and the compliance obligations are the same work.**
