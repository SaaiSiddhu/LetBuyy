# 09 — Failure Modes, Effects, and Recovery

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.

---

## 0. The conclusion, stated first

LetBuyy's failure handling has one defect that dominates every other item in this document:

> **There is no delivery channel by which any production failure reaches a human.** The alert path is fully wired end-to-end at config level and terminates in database rows. `enqueueRuntimeAlert` fires on every 5xx (`services/api-gateway/src/lib/runtime-alerting.ts:108-109`, `:179`), the job type is the literal `'incident.page.dry_run'` (`:7`), and the consumer hardcodes `mode: 'dry_run'` regardless of the row's configured `paging_adapter` (`services/queue-workers/src/incident-command.ts:94-96`), then writes a `production_incident_events` row and an audit row and calls no provider. `VERIFIED-SOURCE`.

Everything else follows from that. The platform has real recovery *mechanisms* — a rollback script, a DLQ, an idempotent ledger, a fail-closed edge — and almost no recovery *triggers*. The mean time to detection for a total checkout outage is **the time until a human decides to look**, which is not a number the repository can produce.

Three second-order conclusions:

| # | Conclusion | Evidence |
|---|---|---|
| 1 | **The dangerous failures are the silent ones, not the loud ones.** A Postgres outage is loud (every request 500s, merchants call). A Razorpay webhook auto-disable, a ledger divergence, a dropped outbox event, and a dry-run push are all silent *and* money-relevant. | §2, §4 |
| 2 | **Security controls fail closed; that is correct, and it is also the largest self-inflicted availability risk.** Turnstile, the rate limiter, the storefront access gate and the queue tenant envelope all deny on failure — with no deadline on three of the four. | §3 |
| 3 | **DR is declared, not proven. Nothing in this repository establishes that a restore has ever been performed, or what the RTO or RPO is.** No RTO or RPO value is recorded anywhere; the only backup is a 7-day GitHub Actions artifact produced by a production deploy. | §5 |

**Governance note that reframes the severity of this whole document.** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` is 471 lines and contains **zero** occurrences of `observab`, `alert`, `monitor`, `incident`, `paging`, `on-call`, `backup`, `restore`, `RPO`, or `disaster` (verified by direct grep at this SHA). Its single `RTO` hit — line 322, *"the COD-confirm heuristic + RTO gate"* — is the India logistics term **Return To Origin** (`packages/shared-types/src/index.ts:1727` enumerates `'rto'` as a `fulfillment_state`), not Recovery Time Objective. **No constitutional article is violated by anything in this document.** These are sound operational norms with no current legal force, which is itself a finding: `GOVERNED` obligations for detection and recovery do not exist and would require an ARB amendment to create.

---

## 1. Scale used in this document

Severity is stated as *when it must close*, not as a vague magnitude. This matters because `LETBUYY_CONSTITUTION.md:77` states LetBuyy has **zero production merchants**, so most of what follows is prospective, not present, harm.

| Rating | Meaning |
|---|---|
| **S0** | Active, ongoing loss at this SHA |
| **S1** | Must close before the first live merchant or the first rupee of live money |
| **S2** | Must close before the top of the governed envelope (~1,000 merchants / ~30k orders/month) |
| **S3** | Hygiene / correctness of the record |

Probability is *at first live traffic*, not today. Where the discovery digest's original severity was corrected by the adversarial pass, **the corrected value is used** and the original is shown struck through in the notes.

---

## 2. FMEA

### 2.1 Severity, probability, blast radius, detection

Detection is stated brutally. "Row only" means the event is recorded in Postgres and no human is notified.

| # | Failure | Sev | Prob (at first traffic) | Blast radius | Detection **today** | MTTD |
|---|---|---|---|---|---|---|
| F-01 | **Cloudflare outage** (Workers/KV/Queues) | S1 | Low | Total — gateway, webhooks, queues, storefront edge proxy all Cloudflare | None in-repo. Cloudflare status page only; nobody is subscribed in code | Human-report |
| F-02 | **Vercel outage** | S1 | Low | All 5 Next apps: storefront HTML, merchant console, identity, marketing, platform-console. API survives | None in-repo | Human-report |
| F-03 | **PostgreSQL / Supabase outage** | S0-class if live | Low–Med | **Total.** One Postgres is the constitutional source of truth. Every /v1 route, all money, all auth | Every request 500s → `runtime-alerting.ts:109` plans an alert → **row only**. `/v1/health` still returns `'healthy'` (`services/api-gateway/src/index.ts:311-313`) | Human-report |
| F-04 | **Supabase disk-full → read-only mode** | S1 | **Med-High** (see note) | **Platform-wide write outage, every tenant at once.** `cannot execute INSERT in a read-only transaction`; clears only below 95% | None. No disk-utilisation metric is read anywhere; the two highest-write tables are never pruned | Human-report |
| F-05 | **Hyperdrive degradation** | S2 | Low | Only `tenant-transaction.ts` and `routes/storefront.ts` use the pooled `postgres` client; the rest is PostgREST over HTTP | None. No pool-utilisation or connect-error metric | Human-report |
| F-06 | **KV 429 / 60 s eventual consistency** | S1 | **High** | Cache-version bumps, rate-limit counters. A merchant saving twice in one second trips it | None. No KV write-rate metric anywhere | Human-report |
| F-07 | **KV rate-limiter cascade → isolate-wide 503** (`07` C-1) | **S1** / `INFERRED` | **High** | **Every non-exempt `/v1` data route on the affected isolate returns 503 `RATE_LIMIT_UNAVAILABLE` for 60 s, or 10 min on a quota-shaped error** | One `console.error` per 60 s per isolate (`rateLimit.ts:628-639`), inside a 10%-sampled log sink | Human-report |
| F-08 | **Queue backlog / outbox relay under-provision** | S2 (~~S0~~) | Med | Merchant webhooks + analytics/search fanout. **Not** order-confirmation email — that goes direct to `NOTIFICATION_QUEUE` | Queue lag `letbuyy.queue.delivery.batch` IS emitted; **no outbox-backlog-age metric exists**; nothing reads Analytics Engine | Never (no reader) |
| F-09 | **Queue tenant-envelope expiry under backlog** | S1 | Med | Any tenant-scoped message older than 15 min is quarantined as `deterministic`, recorded dead-lettered, and acked — **permanent silent loss** | Counted into `letbuyy.queue.dead_letter.total`; nothing reads it | Never (no reader) |
| F-10 | **D1 / Durable Object outage** | S3 | Low | **None.** Both are bound in production and effectively unused — reflected only at `routes/internal-console.ts:808,810` | n/a | n/a |
| F-11 | **R2 outage** | S2 | Low | Product image upload, shipping labels, exports, GraphQL bulk. Not checkout | None | Human-report |
| F-12 | **Identity / JWKS failure** | S2 | Low | Merchant console login. **No network dependency** — `createLocalJWKSet` over an env-supplied JWKS (`services/api-gateway/src/lib/identity-session-verifier.ts:1,23-39`) | Auth 401s → row only | Human-report |
| F-13 | **KMS outage** | — | — | **Not applicable.** No KMS integration exists anywhere in `services/`, `apps/identity-platform/src` or `config/runtime` | n/a | n/a |
| F-14 | **Razorpay API outage** | S1 | Med | Prepaid checkout fails at payment. **COD should survive** — verify no COD path takes a Razorpay dependency | Error codes land in `worker_request_logs` / AE blobs. **No provider-attributed latency or error metric** | Human-report |
| F-15 | **Razorpay webhook endpoint failing → 24 h auto-disable** | **S1** | Med | **Payments capture at Razorpay; orders never confirm. Customers debited with no order.** Razorpay disables the webhook after 24 h of failure and requires manual dashboard re-enable | **None, and the failure inverts the signal**: once disabled, Razorpay stops calling, so LetBuyy's error rate drops to zero — it looks like recovery | **Never**, absent a reconciliation poller (there is none — see §2.3) |
| F-16 | **Shiprocket outage** | S2 | Med | Serviceability is called per PIN-code entry at checkout → degrades **checkout**, not just fulfilment | None. `packages/infrastructure/logistics-adapter/index.ts` makes no outbound fetch at this SHA; no Shiprocket status page exists | n/a |
| F-17 | **WhatsApp BSP outage / tier limit** | S2 | Med | Notification only. Currently moot: `queue-workers` sets no `WHATSAPP_PROVIDER_MODE`, so every send records `WHATSAPP_UNAVAILABLE`/`failed` | Dispatch-log rows only | Never |
| F-18 | **ESP (Resend) outage / 429** | S2 (~~S0~~) | Med | Order-confirmation, cancelled, refunded, gift-card, invite, contact email | None. **And today the path is dark:** `RESEND_API_KEY` is provisioned only to `api-gateway` (`.github/workflows/production-deploy.yml:329`), never to `queue-workers` (`:358-362`), so the consumer logs `missing-resend-secret` and skips | Never |
| F-19 | **DNS / certificate failure** | S1 | Low | Per-hostname. `infrastructure/dns/dns.tf` manages records; **no certificate resource exists in any `.tf`** — TLS is provider-managed and unrepresented | None. `custom-domain-cname-smoke-test.md` is manual | Human-report |
| F-20 | **Bad deploy — `wrangler deploy` without `--env`** | S2 (~~S1~~) | **Med — has occurred once** | Production Worker `letbuyy-api` overwritten by the staging-flavoured default block: routes vanish, KV/D1/Hyperdrive/DO bindings dropped, `ENVIRONMENT` flips to `staging`. Recorded as a real 2026-08-01 production NXDOMAIN incident | Total API outage → loud. But **`/v1/health` still returns `'healthy'`** because it is a literal | Human-report |
| F-21 | **Bad deploy — frozen apps published** | **S1** (CONFIRMED) | Low | `production-deploy.mjs:125,126,129` publishes three frozen apps via `vercel deploy --prod` on the documented promotion command; creates unlinked, unconfigured public `*.vercel.app` origins | None. No validator reads that script for frozen roots | Never |
| F-22 | **Bad migration** | S1 | Med | Schema-wide. 78 of 126 forward migrations have no paired rollback; **12 unpaired at or above 138, nine of them new since the governance doc was written** | `migrate-production` job failure is loud in CI | CI-immediate |
| F-23 | **Cache poisoning / stale-after-invalidate** | S3 | Low | Storefront reads. Keys are tenant-scoped (`storefrontRequestCacheKey` puts the store handle in the key). **But** `storefrontCacheVersion` fails open to `'0'` on any KV error (`storefront-cache.ts:74-80`), so a KV incident re-exposes pre-invalidation `'0'`-versioned entries; only the `bootstrap` namespace's `'0'` key is explicitly purged (`routes/themes.ts:157`) | None. Cache state is a response header only — never in AE blobs or DB dimensions | Never |
| F-24 | **Hot tenant** | S2 (~~S1~~) | Med | Bounded head-of-line delay for every other merchant. All four claim RPCs order globally by arrival with no `site_id` term and no per-site cap | None. Backlog rows ARE counted at `services/api-gateway/src/index.ts:435-454` and reduced to a boolean `hasWork` | Never |
| F-25 | **Webhook storm (outbound)** | S2 | Med | `webhook-service` processes deliveries **serially** in a `for…of` with an awaited `fetch` and **no timeout**, 50 per cron tick — one slow merchant target burns the whole tick | None | Never |
| F-26 | **DB connection exhaustion** | S1 | Med | Checkout timeouts first. Little's Law: 2,000 req/s × 400 ms hold = 800 pooler slots = the entire Large-tier allowance | **None.** No `pg_stat_activity`, `pg_locks`, `pg_stat_statements` or `max_connections` read exists in any runtime, cron, migration or health route | Human-report |
| F-27 | **Lock pile-up (hot SKU)** | S2 | Med | Single-tenant flash sale. `FOR UPDATE` holds to transaction end, so contention serialises independently of compute size | None | Human-report |
| F-28 | **WAL / disk exhaustion from unpruned telemetry** | **S1** (CONFIRMED) | **High over time** | Feeds F-04. `worker_request_logs`, `runtime_telemetry_metrics`, `operation_metrics` are plain heap tables with **zero** enforced retention, and migration 131's mirror trigger writes every row **twice** | None. No table-size or disk metric anywhere | Human-report (as F-04) |
| F-29 | **Operator error** | S2 | **Med — precedent exists** | See F-20, F-21. Also: `--keep-vars` on one production path and var-replace on the other, so the same commit can leave the Worker in two different effective configurations | None | Human-report |

**Note on F-04 probability.** It is rated Med-High not because disk fills quickly, but because *nothing stops it*: the two highest-write tables have no retention (F-28), the mirror trigger doubles their physical volume, disk autoscale is capped at four modifications per rolling 24 h, and no metric exists to see the approach. The cliff is sharp and platform-wide. See `07` §3.4.

### 2.2 Automatic behaviour, runbook, recovery, data loss

| # | Failure | Automatic behaviour in code (`path:line`) | Runbook | Recovery time | Data-loss risk | Architectural implication |
|---|---|---|---|---|---|---|
| F-01 | Cloudflare outage | None. No fallback origin exists | `infra-recovery.md` — Cloudflare **drift**, not outage | Provider-bound | None | Single-provider control plane for compute, cache, queues and DNS |
| F-02 | Vercel outage | None | ✗ | Provider-bound | None | API + storefront survive independently only if the cache is fixed (`07` C-2) |
| F-03 | Postgres outage | Every call throws → 500. Telemetry writes swallow their own errors (`observability.ts:291,325,370` — correct) | `infra-recovery.md` §Supabase Recovery — 4 lines, generic | Provider-bound | None (nothing accepted) | ONE Postgres is a declared constitutional SPOF, correctly so; the gap is detection |
| F-04 | Disk-full read-only | None. No read-only-aware path; writes simply throw | ✗ | Until usage < 95 % | None | Needs a disk-headroom metric + retention (F-28) more than it needs code |
| F-05 | Hyperdrive degradation | `connect_timeout: 5`, `idle_timeout: 20`, **no statement timeout** (`packages/infrastructure/pooled-sql-adapter/index.ts:52-54`) | ✗ | Provider-bound | None | A missing `statement_timeout` is the mechanism by which one slow query becomes pool exhaustion |
| F-06 | KV 429 / consistency | Read path fails open to `'0'` (`storefront-cache.ts:74-80`). **Write path has no `try`** — `bumpStorefrontCacheVersion` (`:83-91`) rejects | ✗ | Seconds | Stale content window | KV is the wrong store for a per-key counter; `07` §3.2 |
| F-07 | KV limiter cascade | `queryCostKvUnavailableUntil` is **module-level** (`rateLimit.ts:42`), set at `:627`, gating at `:613` → 503 at `:1078-1088` | `production-api-rate-limit-backend.md` — **the best runbook in the repo**: measured numbers, exact commands, named exit criterion | 60 s or 10 min, self-clearing | None | Replace the backend with a **sharded** Durable Object or CF Rate Limiting. `RUNTIME_COORDINATOR` is already bound and unused |
| F-08 | Outbox backlog | Relay is `*/15` × 50 (`wrangler.toml:236`, `index.ts:947`); RPC caps at 100/claim. Operator path exists: `POST /operations/outbox/dispatch` (`routes/operations.ts:126-141`) | ✗ | Config change (raise cron/limit) | None — rows persist | Fix is one config line; the missing piece is a backlog-age metric |
| F-09 | Envelope expiry | `throw QueueProcessingError(..., { deterministic: true })` → quarantine → recorded dead-lettered → **acked** (`services/queue-workers/src/index.ts:172-175`) | ✗ | Unrecoverable | **YES — permanent** | Treating "the system is slow" as "the message is malicious" is a category error; couples correctness to load |
| F-10 | D1 / DO | n/a | ✗ | n/a | n/a | Two undeclared durable stores bound in production and represented in no topology manifest |
| F-11 | R2 | Binding-absent guard only; no timeout, no retry | ✗ | Provider-bound | Upload lost | — |
| F-12 | JWKS | Local verification, fail-closed, no network call | ✗ | n/a | None | **This is the best-designed dependency in the repository** |
| F-14 | Razorpay outage | Bare `fetch`, **no timeout, no retry, no breaker** (`packages/infrastructure/razorpay-adapter/index.ts:100,187,199`) | ✗ | Provider-bound | None | COD is the availability hedge; keep it Razorpay-free |
| F-15 | Webhook auto-disable | **None.** `services/webhook-service/src/index.ts:719+` processes the entire event synchronously — signature verify, `writeWebhookEvent`, order lookup, order mutation — and only then returns. Against Razorpay's **5-second** receiver budget | ✗ | Manual dashboard re-enable + replay (≤15 days, and events after disable may be unreplayable) | **YES — captured payments never confirmed** | **Two required changes: ack-then-enqueue, and a captured-but-unconfirmed reconciliation poller. Neither exists.** |
| F-16 | Shiprocket | No outbound call at this SHA | ✗ | n/a | n/a | Cache serviceability by PIN-code; make failure non-blocking at checkout |
| F-17 | WhatsApp | Records `failed`/`WHATSAPP_UNAVAILABLE` and returns | ✗ | Config | Notification lost | `api-gateway` pins `sandbox`, `queue-workers` resolves `live` — two runtimes, opposite modes, same feature |
| F-18 | ESP | Gateway path fail-open; queue path throws → CF retry (max 6) → DLQ. **Batch retry re-sends already-sent messages** (`index.ts:598` before `:606` ack; `:620-621` retries all) | ✗ | Config | Duplicate email once enabled; **dropped email today** | Ack per message, not per batch; add a per-idempotency-key sent marker |
| F-19 | DNS / cert | Storefront proxy returns a 503 holding page on unresolved access (`apps/storefront-runtime/src/proxy.ts:352`) | `custom-domain-cname-smoke-test.md` — specific and actionable | Minutes–hours (DNS TTL) | None | Certificates are entirely outside the repository's model |
| F-20 | Bad deploy (no `--env`) | Every CI step passes `--env` explicitly; all four `package.json` deploy scripts hard-require it; wrangler warns. **Residual exposure is manual invocation only** | `deployment-rollback.md` + `production-rollback.mjs` — **specific and real** | Minutes (redeploy with `--env`) | None — secrets survive | Add one validator: top-level `name` ≠ `[env.production].name` |
| F-21 | Frozen apps | None | ✗ | Manual Vercel project deletion | None | Extend `deploy-matrix-topology-validator.mjs` to scan `infrastructure/scripts/deploy/*.mjs` |
| F-22 | Bad migration | Encrypted `pg_dump` captured **before** migration (`.github/workflows/production-deploy.yml:252-260`) | `deployment-rollback.md` step 4: *"prefer forward-fix"* | Unmeasured | **Bounded by the backup**, which expires in 7 days | The pre-migration backup is the single strongest recovery control in the pipeline — and its retention is 7 days |
| F-23 | Cache staleness | Fail-open to `'0'`; `purgeStorefrontCache` deletes only the named keys | ✗ | Until TTL or next bump | None | Emit cache state on the AE data point already written per request |
| F-24 | Hot tenant | `FOR UPDATE SKIP LOCKED` bounds it to head-of-line delay, self-clearing | ✗ | Burst size ÷ drain rate | None | `tenant_execution_quotas` exists in the schema with `noisy_neighbor_protection` and has **zero** TypeScript readers |
| F-25 | Webhook storm | Serial loop, no timeout, no redirect policy | `queue-dlq-redrive.md` — **but see §7: the metric it names does not exist and the redrive is a no-op** | Manual | Deliveries delayed | Add `AbortSignal.timeout` + parallelism bound |
| F-26 | Connection exhaustion | `connect_timeout: 5` only | ✗ | Manual | None | **Add the `pg_stat_activity` probe. This is the single highest-value instrumentation change in the packet.** |
| F-27 | Lock pile-up | None | ✗ | Self-clearing | None | Row locks / optimistic versions / sharded counters — **advisory locks will not work** under either pooler (`07` C-5) |
| F-28 | Unpruned telemetry | **None.** Retention exists only for the shadow partitions, and `detach_expired_hot_table_partitions` only DETACHes — nothing drops | ✗ | Manual `DELETE`, or `set_hot_table_partition_shadow_mirror_enabled(false)` | None | Route telemetry to the already-bound `RUNTIME_TELEMETRY` Analytics Engine dataset |
| F-29 | Operator error | `wrangler-exec.mjs:34` guards, but CI bypasses it | `secret-rotation.md` — specific | Varies | Varies | One var semantic for production, not one per path |

### 2.3 The three failures that produce money loss with no signal

Ranked. These deserve separate attention because every other row in §2.1 eventually produces a complaint, and these do not.

| Rank | Failure | Why it is silent | What closes it |
|---|---|---|---|
| 1 | **F-15 Razorpay webhook auto-disable** | Razorpay stops calling → LetBuyy's error rate goes to **zero**. The absence of traffic is indistinguishable from health. Payments are captured; orders are never confirmed. | A dead-man's switch on webhook *arrival*, plus a poller that reconciles Razorpay's Payments API against local orders. **Neither exists: `grep -rn razorpay services/queue-workers/src` returns only three payout-rail enum strings.** |
| 2 | **F-09 tenant-envelope expiry** | Quarantine is classified `deterministic`, recorded dead-lettered, and **acked**. Provider retry is suppressed by design. | Widen or remove the 15-minute window; re-sign on retry; make `signQueueTenantEnvelope` fail closed so a missing secret is a deploy error rather than 100 % silent quarantine (`services/api-gateway/src/lib/queue-tenant-envelope.ts:37-39` returns the body unsigned when no secret is configured, while the consumer hard-fails on a missing envelope). |
| 3 | **Ledger divergence outside the reconciler's scope** | The 6-hourly job compares **only** posted `wallet_ledger_entries` against the canonical `merchant_payable` balance. A double-capture posted consistently to both projections yields variance 0. Gift-card projection drift is not in scope at any latency. | Extend the reconciler's scope, or accept that "reconciliation runs" ≠ "the ledger is reconciled". |

---

## 3. Fail-open vs fail-closed audit

Every external dependency reachable from a deployed runtime, from source at this SHA. `VERIFIED-SOURCE` throughout unless noted.

| Dependency | Call site | Timeout | Retry | Breaker | Fallback | Mode | Verdict |
|---|---|---|---|---|---|---|---|
| Postgres (PostgREST/`supabase-js`) | `packages/infrastructure/supabase-adapter/index.ts:34` | ✗ | ✗ | ✗ | ✗ | fail-closed → 500 | Correct mode, **no deadline** |
| Postgres (Hyperdrive / `postgres.js`) | `packages/infrastructure/pooled-sql-adapter/index.ts:52-54` | connect 5 s, idle 20 s; **no statement timeout** | ✗ | ✗ | ✗ | fail-closed | **Missing `statement_timeout` is the F-26 mechanism** |
| Telemetry insert | `services/api-gateway/src/middleware/observability.ts:291,325,370` | ✗ | ✗ | ✗ | swallow + log | **fail-open** | ✅ Correct — telemetry must never break a request |
| KV — rate limiter (fixed window) | `rateLimit.ts:320-325`, selected at `:860` | ✗ | ✗ | ✗ | 503 | **fail-closed** | ✅ Security-correct. **Auto-enabled in production with no flag** — governs login/OTP/password-reset |
| KV — query-cost limiter | `rateLimit.ts:613-641`, selected at `:928` | ✗ | ✗ | ✅ `:613,:627` isolate-global backoff | 503 `RATE_LIMIT_UNAVAILABLE` | **fail-closed** | ⚠️ Correct mode, **catastrophic blast radius**: one KV error suppresses the limiter and 503s *every* key in that isolate |
| KV — cache version (read) | `storefront-cache.ts:74-80` | ✗ | ✗ | ✗ | returns `'0'` | **fail-open** | ⚠️ Correct for a cache, but re-exposes pre-invalidation `'0'` entries (F-23) |
| KV — cache version (write) | `storefront-cache.ts:83-91` | ✗ | ✗ | ✗ | **none — no `try`** | fail-closed, unguarded | ⚠️ A KV 429 on a double-click publish propagates to the caller |
| Cache API | `storefront-cache.ts:113-131` | n/a | ✗ | ✗ | `BYPASS` | fail-open | ✅ Correct |
| Upstash Redis | `rateLimit.ts:204`, `:694` | ✗ | ✗ | ✗ | KV when `RATE_LIMIT_KV_FALLBACK=on` | fail-closed | ✅ Mode correct. **Note the vendor default is the opposite**: Upstash's own Ratelimit SDK "allows by default" on timeout. LetBuyy does not use that SDK, so it is not exposed to the fail-open default |
| R2 | `routes/upload.ts:195`, `shipping-labels.ts`, `export.ts`, `graphql/bulk.ts` | ✗ | ✗ | ✗ | binding-absent guard | fail-closed | Acceptable |
| D1 / Durable Object | bound; reflected at `routes/internal-console.ts:808,810` | n/a | n/a | n/a | n/a | unused | — |
| CF Queues (producer) | `services/api-gateway/src/lib/runtime-alerting.ts:184-186` | ✗ | ✗ | ✗ | returns `'missing-runtime-queue-binding'` | **fail-open — the alert is silently dropped** | ⚠️ An alerting path that fails open is an alerting path that does not exist |
| CF Queues (consumer) | `platform-queue-consumer.ts:305-334` | n/a | `max_retries` 3–10 + DLQ | ✅ per-isolate `Map`, threshold 3, open 60 s | DLQ | fail-closed to DLQ | ⚠️ **Per-isolate state**: a fresh isolate starts with a closed breaker, so protection ≈ isolate lifetime |
| Razorpay | `packages/infrastructure/razorpay-adapter/index.ts:100,187,199` | ✗ | ✗ | ✗ | ✗ | fail-closed | ⚠️ The one provider on the synchronous money path has **no deadline** |
| Twilio WhatsApp | `packages/infrastructure/whatsapp-commerce-adapter/index.ts:244` | ✗ | ✗ | ✗ | ✗ | fail-closed | Acceptable (notification tier) |
| Resend | `packages/infrastructure/resend-adapter/index.ts:47` (SDK) | ✗ | ✗ (gateway) | ✗ | ✗ | fail-open in gateway; queue path throws → CF retry | ⚠️ Batch-level retry re-sends (F-18) |
| Turnstile — gateway | `services/api-gateway/src/middleware/security.ts:237-247` | ✗ | ✗ | ✗ | ✗ | **fail-closed** | ⚠️ **Correct mode, no deadline.** A slow `siteverify` holds Worker invocations on the two highest-concurrency unauthenticated endpoints |
| Turnstile — identity | `apps/identity-platform/src/lib/turnstile.ts:85-99` | ✗ | ✗ | ✗ | ✗ | **fail-closed** (`:78-81` on missing secret) | Same. The `dev-bypass-token` path (`:70-72`) is **correctly gated**: `canUseIdentityDevAuthBypass` requires non-production **and** `NODE_ENV==='development'` **and** an explicit flag (`apps/identity-platform/src/lib/dev-auth-bypass.ts:20-23`) ✅ |
| Identity JWKS | `services/api-gateway/src/lib/identity-session-verifier.ts:1,23-39` | n/a | n/a | n/a | n/a | fail-closed, **no network dependency** | ✅ **Best in repo** |
| Storefront access gate | `apps/storefront-runtime/src/proxy.ts:110,121,161` | ✅ `AbortSignal.timeout(3000)` | ✗ | ✗ | 503 holding page (`:352`) | **fail-closed + graceful degrade** | ✅ **The only request-path timeout in the repository, and the only graceful degradation** |
| Outbound merchant webhooks | `services/webhook-service/src/app-lifecycle-dispatch.ts:89-105` | ✗ | via `webhook_deliveries` | ✗ | ✗ | fail-closed | ⚠️ No timeout **and** default `redirect: follow` — a merchant 302 escapes the https-only check |
| Internal service auth | `services/api-gateway/src/lib/internal-auth.ts:40-45` | n/a | n/a | n/a | legacy shared secret | **FAILS OPEN** | ⚠️ **A security control that fails open.** `isLegacyAcceptEnabled` returns `true` for unset/empty; only the literals `false/0/off/no/disabled` disable it, and `INTERNAL_AUTH_LEGACY_ACCEPT` is set in no `wrangler.toml`. The shared `INTERNAL_API_SECRET` therefore remains an accepted credential across every runtime |
| **Dead code** | `packages/infrastructure/provider-resilience-adapter/index.ts` — `executeProviderCall` (`:193-255`), `withProviderTimeout` (`:257-269`), backoff, health classification, fallback, recovery planning | — | — | — | — | — | ⚠️ **Zero call sites repo-wide.** The repository's entire timeout/retry/circuit-breaker implementation is written, exported, and never invoked |

### 3.1 Findings from this table

| ID | Finding | Class | State |
|---|---|---|---|
| **FO-1** | **Internal service-to-service auth fails open.** An unset `INTERNAL_AUTH_LEGACY_ACCEPT` keeps the legacy shared-secret credential valid. A security control whose default is "accept" is not a control. | Security fails open | `VERIFIED-SOURCE` |
| **FO-2** | **The runtime alert enqueue fails open.** A missing `RUNTIME_QUEUE` binding returns `{queued:false, reason:'missing-runtime-queue-binding'}` and the alert is dropped without error. | Availability of the alerting path | `VERIFIED-SOURCE` |
| **FO-3** | **Every security control that fails closed does so without a deadline**, except the storefront proxy. Turnstile, the KV limiter, Razorpay, Supabase and the webhook dispatcher all issue unbounded network calls. Fail-closed without a timeout converts a *slow* dependency into a *total* outage. | Availability | `VERIFIED-SOURCE` |
| **FO-4** | **The one non-critical write that fails closed is the cache-version bump** (`storefront-cache.ts:83-91`), against a store with a documented 1-write/s/key ceiling. | Availability | `VERIFIED-SOURCE` |
| **FO-5** | **`provider-resilience-adapter` is defined-but-never-called.** A package list review would conclude the platform has provider resilience. It has the algorithms and applies none of them. | Misleading readiness evidence | `VERIFIED-SOURCE` |

---

## 4. Detection reality

**This is the section that matters.** Everything above assumes someone finds out.

### 4.1 What actually emits

| Channel | Status | Consumer |
|---|---|---|
| Structured JSON logs → Cloudflare Workers Logs | Emitted, **`head_sampling_rate = 0.1` in every environment of all four Workers** | Cloudflare dashboard, manually |
| Cloudflare Analytics Engine (`RUNTIME_TELEMETRY`) | Emitted from `api-gateway` and `queue-workers` only. `webhook-service` and `mobile-bff` **declare the binding and never write** | **None.** `packages/lcis-adapters/src/analytics-engine/AnalyticsEngineAdapter.ts:48` declares AE query values NOT CONNECTED; nothing outside that package references it |
| Postgres `runtime_telemetry_metrics` / `worker_request_logs` | Emitted on the live request path, unsampled for the metric table | Four Grafana dashboard JSONs that query the **correct** emitted metric names — against a `supabase-ops` datasource nothing provisions |
| Traces / spans | **None.** No `@opentelemetry` dependency in any `services/*` or `apps/*` package | — |
| Incident paging | `production_incident_events` rows | **No delivery channel exists** |
| Mobile crashes | Real Sentry HTTP sink exists; every shipped build carries the `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN` sentinel | Falls back to on-device storage |

> **Correction carried from the adversarial pass.** The digest's original headline — *"no live metric pipeline exists"* — is **OVERSTATED** and was corrected to **S2**. A real pipeline does exist in source and config: Analytics Engine bindings in all four Workers plus Postgres rows on the live request path, and the Grafana dashboards query the exact metric names the code emits. What is genuinely dead is `infrastructure/observability/otel-collector.yaml` (Kubernetes service DNS for a cluster that does not exist, and no OTLP producer) and `prometheus-rules.yaml` (three alerts on four metric names with zero emitters repo-wide). The false-assurance surface is real: eight `runtime.manifest.json` files claim the runtimes emit to *"the OpenTelemetry, Prometheus, Tempo, Loki, and Grafana stack"*, and `verify-observability-rollout.mjs` prints *"observability verification passed"* from string-fragment file checks in the plan-mode branch wired into two deploy workflows.

### 4.2 Mean time to detection, stated plainly

**For a total checkout outage.** Ask what happens automatically, in order:

1. Every request 500s. `runtime-alerting.ts:109` classifies it alertable and enqueues (`:179-191`).
2. The consumer writes a `production_incident_events` row and an `audit_logs` row (`incident-command.ts:107-125`). No fetch, no HTTP, no email.
3. ~90 % of the corresponding log lines are discarded by head sampling — which selects *before* the handler runs, so a 500 has exactly the same 10 % chance of retention as a 200.
4. The Analytics Engine data points are written to a dataset that nothing reads.
5. `/v1/health` continues to return the literal `'healthy'` (`services/api-gateway/src/index.ts:311-313`), so any external uptime check pointed at it reports green through the entire outage.
6. No cron evaluates error rate. `api-gateway` runs `*/15` (outbox dispatch + replay lag); `queue-workers` runs `17 */6` (inventory sweeper, ledger reconciliation, analytics rollup, postmortem reminders, compliance export). None of the ten scheduled jobs looks at availability.

> **MTTD for a total checkout outage = UNBOUNDED.** No automatic mechanism converts the outage into a notification. Detection depends entirely on a human choosing to open `/v1/operations/runtime/overview`, or on a merchant or buyer complaint arriving through a channel outside this repository. Practically: minutes to hours in business hours, unbounded overnight and at weekends. `VERIFIED-SOURCE`.
>
> One partial mitigation is real: `apps/storefront-runtime/src/proxy.ts:352` returns a 503 holding page rather than a blank failure, so a merchant visiting their own store sees a definite outage rather than an ambiguous one. That improves *complaint quality*, not detection latency.

**For a ledger divergence.** Two clocks, and they must not be conflated.

| Clock | Value | Basis |
|---|---|---|
| Divergence → **durable row** | ≤ **6 hours** (cron `17 */6 * * *`) + job runtime | `services/queue-workers/wrangler.toml:237`; `refresh_money_ledger_site_reconciliation` UPSERTs a per-site row with `status='mismatch'` and `variance_minor` |
| Divergence → **merchant-visible symptom** | Next wallet read | `services/api-gateway/src/routes/wallet.ts:163-176` returns **409 `LEDGER_RECONCILIATION_REQUIRED`** whenever the row is absent, not `verified`, or variance ≠ 0 — an immediate fail-closed symptom |
| Divergence → **operator sees it** | Whenever someone opens the console | `GET /v1/internal/console/money/reconciliation?status=mismatch` → `apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx:102-129` renders a `tone='critical'` "Breaks" table |
| Divergence → **a human is pushed a notification** | **NEVER** | `runMoneyLedgerReconciliation` returns a `mismatches` count (`money-ledger-reconciliation.ts:102`); the handler pipes it into `writeQueueLog('info', {status:'completed'})` (`services/queue-workers/src/index.ts:648-662`); `writeQueueLog` (`:426-439`) only calls `console.info`/`console.error` and **never inspects `result.mismatches`**. A mismatch is indistinguishable from a clean run at the log level. |

> **Correction carried from the adversarial pass.** The original claim was rated S0 with the risk statement that a break is discoverable *"only by someone reading 10%-sampled Cloudflare Workers Logs for a line whose level is 'info'."* That is **factually wrong** and was corrected to **S1**: the break is durably persisted, surfaced on a purpose-built critical-tone operator console, and produces an immediate fail-closed 409 on the affected merchant's wallet read. It is a **paging gap, not a blindness gap**.
>
> **But the scope correction is worse than the latency finding.** The job compares only posted `wallet_ledger_entries` against the canonical `merchant_payable` account balance. It reads no `payment_transactions`, no `refunds`, and no gift-card tables. **A double-capture posted consistently to both projections yields variance 0, and gift-card projection drift is not detected at any latency.** That is a coverage gap, and no clock above applies to it.
>
> Also corrected: `MONEY_LEDGER_RECONCILIATION_ALERT_READY` is **not** a machine-enforced cutover blocker. `evaluateProductionSafetyPreflight` has no caller in the deploy pipeline, and `production-safety-validator.mjs` merely asserts the flag *name* appears as a source string. It is a runbook precondition.

### 4.3 The signals that do not exist at all

| Signal | Emission point today | Consequence |
|---|---|---|
| Postgres connections in use | **none** | Approach to F-26 is invisible |
| Postgres lock wait / slow queries | **none** | F-27 is invisible |
| Disk utilisation / table size | **none** | F-04 and F-28 are invisible until the cliff |
| KV write rate | **none** | F-06 and F-07 are invisible; this is a *documented* quota the team's own comment flags |
| Cloudflare Queue depth (provider-side) | **none** | — |
| Outbox backlog **age** | **none** — the cron's lag metric reads `replay_operation_schedules`, not outbox age | F-08 is invisible |
| Cache hit ratio | response header only (`X-Storefront-Cache`) — never in AE blobs or DB dimensions | `07` C-2's dominant capacity lever is unmeasurable |
| Razorpay latency / error rate | **none** | F-14 and F-15 are invisible |
| Webhook signature-failure rate | **none** — `webhook-service` emits no data point at all | The most security-critical ingress is unmeasured |
| Error budget / burn rate | **none** — computed nowhere | Two runbooks instruct operators to act on it |

**The only SLO that exists** is `deployment-gate-success` (`infrastructure/monitoring/slo-catalog.yaml`), target 100, 30 d — measured against `/v1/health`, which returns a hardcoded literal. There is no availability, latency, checkout-success, payment-success, refund-success or queue-lag SLO. `infrastructure/monitoring/AGENTS.md:9` requires monitors covering auth, storefront, checkout, API gateway and webhook health *"before production readiness claims"*. None exist.

### 4.4 Ownership reality

`.github/CODEOWNERS` assigns **every path in the repository to one GitHub handle** (`* @saai-sidd`), including `/database/supabase/migrations/`, `/.github/workflows/` and `/services/api-gateway/src/routes/payments.ts`. The `oncall_schedules` table is read at `services/queue-workers/src/incident-command.ts:76` and `services/api-gateway/src/routes/operations/incident-command.ts:162,366`, so the schema supports a rotation — **no schedule data, no contact, and no escalation target appears anywhere in the repository.** `UNKNOWN` whether one exists outside it; `HUMAN-REQUIRED` to establish.

---

## 5. Backup, restore, and disaster recovery

### 5.1 Declared vs proven

| Item | Declared | Proven | State |
|---|---|---|---|
| RTO | **No value recorded anywhere.** `config/runtime/database-recovery-policy.json:16` lists *"RPO/RTO target recorded"* as `resumeEvidence` — i.e. a prerequisite that has not been met | ✗ | `UNKNOWN` |
| RPO | Same — not recorded | ✗ | `UNKNOWN` |
| PITR | `"status": "human-required-paid-tier"`, `skipId: "SKIP-W0-PITR-TIER"`, `defaultEnabledByCodex: false` | Whether it is enabled on the live project is **not knowable from the repository** | `HUMAN-REQUIRED` |
| Logical backup | `requiredBeforeSharedMigration: true`; `pg_dump --format=custom` + `pg_restore --list` + `gpg --symmetric --cipher-algo AES256` at `.github/workflows/production-deploy.yml:252-260` | The step exists and is ordered before migration | `VERIFIED-CONFIG` |
| Backup retention | `retention-days: 7` on a GitHub Actions artifact (`:262-269`) | — | `VERIFIED-CONFIG` |
| Restore drill | `scripts/governance/foundation-restore-drill.mjs`, `codexDefaultMode: "plan"`, `executeScope: "local Postgres URLs only"` | **The script hard-refuses any non-localhost URL** (`:12-17`) and additionally requires `LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE=true` (`:32-34`) | `VERIFIED-SOURCE` |
| A restore ever performed | — | **No evidence of any kind.** No drill output, no timed result, no `operational_certification_reports` artifact, no dated restore record anywhere in the tree | `UNKNOWN` |
| Restore runbook | — | **Does not exist.** `docs/runbooks/infra-recovery.md:18-23` §Supabase Recovery is four generic lines: *run verification SQL, restore into an isolated environment, run RLS/migration/dashboard checks, promote after gates pass.* It names no command, no artifact, no decryption step, no target | `VERIFIED-SOURCE` |

> **DR-1 (`S2`, `VERIFIED-CONFIG`).** Disaster recovery is declared policy only. There is no RTO, no RPO, no evidence of PITR, and the sole backup evidenced in the repository is a 7-day GitHub Actions artifact produced only when a production deploy runs. **If Postgres is lost or corrupted between deploys, the recovery point is the last production deploy** — potentially days of orders, payments and ledger entries — **and the backup itself expires 7 days after that deploy.** Recovery time is unknown because it has never been measured. Whether a usable artifact exists at any given moment is therefore a function of deploy frequency, and changes weekly.

### 5.2 What the vendor actually offers (primary-source, accessed 2026-08-16)

| Capability | Value | Class |
|---|---|---|
| Free plan backups | **None.** *"No automatic backups provided"* | HARD |
| Pro plan backups | Last **7 days** of daily backups | HARD |
| Team plan backups | Last **14 days** | HARD |
| Enterprise backups | Up to **30 days** | HARD |
| PITR | **Paid add-on**: $100 / $200 / $400 per month for **7 / 14 / 28-day** retention; **requires ≥ Small compute**; achieves **RPO ≈ 2 minutes** worst case with WAL archiving | HARD |
| PITR restore RTO | **Not published.** Only *"Restoration downtime correlates with database size"* | UNKNOWN |
| Uptime SLA | **Enterprise only** — 99.9 % monthly, tiered credits capped at 20 % of annual fees. Free / Pro / Team are **not covered** | NEGOTIABLE |

**LetBuyy's actual retention is `UNKNOWN`,** because the plan tier of the live Supabase organisation cannot be established from the repository. What *can* be said: `database-recovery-policy.json:11-12` marks PITR `human-required-paid-tier` with `defaultEnabledByCodex: false`, which is a strong indication it is **not** enabled. If PITR is off, the achievable RPO is the daily-backup granularity of whatever plan is in force — **up to 24 hours of orders, payments and immutable GST invoices** — versus the ~2 minutes PITR would give. `04_LIVE_DEPLOYMENT_TRUTH.md` item **L-16** is the resolving action.

### 5.3 What this costs to fix, and what it buys

| Action | Cost | RPO after | Authority |
|---|---|---|---|
| Record an explicit RTO and RPO target in `database-recovery-policy.json` | Zero | unchanged | Founder decision |
| Enable Supabase PITR, 7-day retention | **$100/mo** + ≥ Small compute | **~2 minutes** vs up to 24 hours | Founder (paid tier) |
| Move the encrypted dump off the 7-day artifact into R2 (**already provisioned**) | Hours of work | unchanged, but the artifact stops expiring | Implementation |
| Run one timed restore into a clone and record the measured RTO | Hours | unchanged; converts RTO from `UNKNOWN` to a number | `HUMAN-REQUIRED` — the drill script refuses non-localhost by design |
| Write the database-restore runbook | Hours | unchanged | Implementation |

> **The asymmetry is stark.** For a platform whose canonical ledger is append-only and whose India GST invoices are immutable once issued, $100/month moves the worst-case data-loss window from **up to 24 hours to about 2 minutes**. This is the cheapest material risk reduction available anywhere in this packet.

### 5.4 One DR control that is genuinely strong

The pre-migration backup step (`.github/workflows/production-deploy.yml:252-269`) runs `pg_dump` **before** `migrate-production`, verifies it with `pg_restore --list`, encrypts with GPG AES256, and records a SHA-256. Ordered correctly, verified, encrypted. **The only defect is where it is stored and for how long.** Migration 22 (F-22) is consequently the *best*-covered high-blast-radius failure in this document, which is the inverse of the usual pattern.

---

## 6. Load shedding and graceful degradation

### 6.1 What exists

| Mechanism | Location | What it protects |
|---|---|---|
| Per-key fixed-window rate limiting, 429 + `Retry-After` | `rateLimit.ts:479,1005,1091,1171` | Per-identity fairness on auth/OTP/abuse paths |
| Cost-weighted leaky bucket on `/v1`, 20 pts/s, capacity 200 | `services/api-gateway/src/index.ts:684-688` | Per-identity fairness on data routes |
| 503 when the limit backend is down | `rateLimit.ts:1078-1088` | Nothing — this is the failure, not the protection |
| App-platform kill switch | `services/api-gateway/src/middleware/appPlatformKillSwitch.ts` | The frozen extension surface |
| Per-flag `kill_switch` | `packages/shared-types/src/index.ts:4803-4804` | Individual features |
| Queue drain budget + claim limit (1–100) | `platform-queue-consumer.ts:252-262` | Per-batch DB pressure |
| Queue circuit breaker (per-isolate) | `platform-queue-consumer.ts:308-334` | A failing downstream, **within one isolate's lifetime only** |
| KV backoff breaker (per-isolate) | `rateLimit.ts:42,613,627` | KV — but at the cost of 503ing every key in the isolate |
| Storefront 503 holding page | `apps/storefront-runtime/src/proxy.ts:352` | **The only true graceful degradation in the repository** |

### 6.2 What does not exist

Verified by direct grep at this SHA: `MAINTENANCE_MODE`, `maintenanceMode`, `READ_ONLY_MODE`, `readOnlyMode`, `degradedMode` return **zero matches** across `services/`, `apps/` and `packages/`.

- **No admission control keyed to any saturation signal** — not queue depth, not DB connection count, not DB latency, not Worker CPU.
- **No read-only mode. No maintenance mode. No feature degradation under load.**
- `/v1/health/queues` returns 503 **only when a binding object is missing** (`services/api-gateway/src/index.ts:340-346,680-683`), never on depth or drain failure.
- The gateway *does* count backlog rows exactly (`index.ts:435-454`) and then reduces the result to a boolean `hasWork`.

> **LS-1 (`S2`, `VERIFIED-SOURCE`).** Rate limiting is per-tenant fairness, not global protection. A legitimate aggregate load spike across many merchants passes every limiter and saturates the shared Postgres, at which point **everything fails together — including checkout — rather than degrading**. There is no lever to turn off analytics, exports or search and preserve the money path.

### 6.3 Minimum viable set, tied to the bottleneck order in `07` §4

Ordered by the rank of the bottleneck each one protects. All four are Class-C implementation work inside already-canonical systems; none requires an ARB decision.

| Priority | Mechanism | Protects `07` rank | Why it is cheap |
|---|---|---|---|
| **1** | **Scope the KV breaker to the key, not the isolate.** Today `queryCostKvUnavailableUntil` is a module-level variable (`rateLimit.ts:42`), so one 429 on one hot key 503s every other key in the isolate for 60 s (10 min on a quota error). | **Rank 1** — KV 1 write/s/key | A variable-scope change. It converts a platform-wide outage into per-key degradation |
| **2** | **A cheap global pressure signal + shed the already-classified expensive routes.** `calculateQueryCost` (`rateLimit.ts:507-524`) *already* labels `/analytics`, `/export`, `/ai/` and `/internal/` as high-cost. The backlog counts already exist at `index.ts:435-454`. | **Ranks 3, 6, 8** — Postgres write load, hot-SKU serialisation, pooler slots | The classification work and the counting work are both already done; only the admission decision is missing |
| **3** | **A `pg_stat_activity` probe on a 1–5 minute cron, written as one telemetry row + one AE data point.** | **Ranks 3, 8** | The 6-hourly `queue-workers` cron already exists. **This is the single highest-value instrumentation addition in the packet** — without it, approach-to-saturation on the constitutional single Postgres is entirely invisible |
| **4** | **A per-site cap in the four claim RPCs** — `ROW_NUMBER() OVER (PARTITION BY site_id ORDER BY created_at)` and take lowest ranks first. | **Rank 7** — tenant fairness | Pure SQL inside the existing `SECURITY DEFINER` functions. `tenant_execution_quotas` already carries `max_queued_jobs`, `priority_class` and `noisy_neighbor_protection` and has zero readers |

Two further items belong on the same list but are not load shedding:

- **A statement timeout** on the pooled client (`pooled-sql-adapter/index.ts:52-54`). Without it, one slow query is unbounded, and Little's Law does the rest (`07` C-4).
- **`AbortSignal.timeout` on every outbound provider call.** Suggested budgets: Turnstile ~2 s, Razorpay ~5 s, Redis ~500 ms, Supabase REST ~5 s. `withProviderTimeout` is already written at `packages/infrastructure/provider-resilience-adapter/index.ts:257-269` and has never been called.

---

## 7. Runbook inventory

17 files in `docs/runbooks/`. They are short — the largest is 4.7 KB — and the quality is genuinely bimodal.

### 7.1 Specific and actionable

| Runbook | Why it is good |
|---|---|
| `production-api-rate-limit-backend.md` | **The best operational document in the repository.** Records a dated production incident (2026-08-01), the measured burst behaviour (120 requests → 100×200 + 20×503; 10 requests one second apart → `200 503 503 503 503 200 503 200 200 200`), the root cause (a plain `wrangler deploy` producing a routeless Worker), the manual remediation, the rollback Worker version, and a **named exit criterion** for removing the flag |
| `deployment-rollback.md` | Cites a real script with real arguments: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=<worker> --version-id=<version>` (`:6`). Step 4 correctly prefers forward-fix for schema |
| `incident-sev1.md` | Cites four real, verified routes — `POST /v1/operations/runtime/incidents`, `/readiness-gates`, `/runtime/overview` — all present in `services/api-gateway/src/routes/operations.ts` |
| `secret-rotation.md` | Names the exact script and the `ROTATE_SECRET_<NAME>` env convention, forbids pasting values into git/docs/logs, and handles the historically-committed-secret case |
| `custom-domain-cname-smoke-test.md` | Concrete DNS verification procedure |
| `foundation-wave3/wave4-apply.md` | Named preconditions, explicit human/Codex boundary |

### 7.2 Generic, broken, or actively misleading

| Runbook | Defect |
|---|---|
| `queue-dlq-redrive.md:9` | Instructs the operator to watch **`cloudflare.queue.delivery.lag`** — a metric name that **exists nowhere in the repository**. The emitted names are `letbuyy.queue.delivery.batch` and `letbuyy.queue.dead_letter.total` |
| `queue-dlq-redrive.md:8` | **Worse: the action itself is a no-op.** `POST /runtime/queues/:queueName/redrive-dead-letters` calls `redrive_distributed_dead_letters`, which only flips `distributed_queue_messages` rows to `'retrying'`. **Nothing ever claims them back** — all four supporting RPCs have zero TypeScript callers, and `queue-workers` declares no `[[queues.producers]]`, so it cannot re-enqueue either. The operator receives `{redriven_count: N}` and reasonably concludes the work is being reprocessed. It is not. *(The outbox DLQ is different and does work: `replay_outbox_dead_letter` resets rows to `'queued'` and the relay genuinely re-claims them.)* |
| `deployment-rollback.md:10` | Step 6: *"Close the rollback only when error budget burn returns below alert threshold."* **No error budget is computed anywhere in the codebase.** The instruction cannot be executed |
| `feature-flag-rollback.md:11-12` | Steps 3–4 require confirming *"exposure telemetry shows disabled evaluations"* and watching *"SLO burn rate"*. Neither signal exists |
| `incident-sev1.md:13` | Step 7: close only after *"telemetry is stable for two observation windows"*. No observation window is defined and no telemetry is queryable |
| `infra-recovery.md:18-23` | §Supabase Recovery is four generic lines with no command, no artifact reference, and no decryption step. It is the closest thing to a restore procedure and it is not one |

### 7.3 Missing entirely

Each of these maps to a failure in §2 that has no procedure:

| Missing runbook | Covers |
|---|---|
| **Database restore from the encrypted `pg_dump` artifact** | F-03, F-22 — the highest-blast-radius procedure in the platform, entirely undocumented |
| **Postgres connection exhaustion** | F-26 |
| **KV write-quota / rate-limiter cascade** | F-07 — *partly* covered by `production-api-rate-limit-backend.md`, which documents the incident but not the quota-exhaustion variant |
| **Razorpay outage and webhook auto-disable** | F-14, F-15 — the highest-severity money failure in the stack |
| **Supabase disk-full read-only mode** | F-04 |
| **Vercel burst throttle (`FUNCTION_THROTTLED`)** | `07` C-9 |
| **On-call rotation and escalation contacts** | Everything. No runbook names a human, a rotation, or a channel |

---

## 8. What would falsify this document

| Claim | Falsified by |
|---|---|
| "No human is notified of any production failure" | Evidence that a paging provider is wired out-of-band — e.g. Cloudflare Logpush to a service with alerting, or a Worker secret configuring a webhook that no `wrangler.toml` declares. `HUMAN-REQUIRED`: `wrangler secret list --env production` (names only) |
| "MTTD for a checkout outage is unbounded" | An external uptime monitor existing outside the repository. Note it would need to probe something other than `/v1/health`, which is a literal |
| "DR is unproven" | A dated, timed restore result — from a drill, a Supabase branch restore, or a support-provided restore-time expectation for a stated DB size |
| "LetBuyy's backup retention is UNKNOWN" | The Supabase organisation's plan tier and PITR add-on state (`04` item L-16) |
| "The KV limiter cascade is live" | `UPSTASH_REDIS_REST_URL`/`_TOKEN` being set on the production Worker, which makes both KV paths unreachable dead code. This is precisely why `07` C-1 carries `INFERRED`, not `VERIFIED-SOURCE` |
| "No Razorpay reconciliation poller exists" | Any scheduled job polling Razorpay's Payments API. `grep -rn razorpay services/queue-workers/src` returns three payout-rail enum strings and nothing else at this SHA |

---

## 9. Contradictions between this document and the discovery digest

Recorded because the packet's method requires it. In each case **my own reading of source at this SHA governs.**

| Digest citation | My reading | Impact |
|---|---|---|
| `services/api-gateway/src/index.ts:307-315` for `healthResponse` | `services/api-gateway/src/index.ts:311-318`; `status: 'healthy'` is at **:313** | None — the claim is unchanged, the line numbers are off by ~4 |
| `docs/runbooks/deployment-rollback.md:9` for the error-budget instruction | The file is 10 lines; the error-budget instruction is step 6 at **:10**. `:9` is *"Re-run verify-health-gates.mjs"* | None — the claim is unchanged |
| Digest narrative: *"no live metric pipeline exists"* | Corrected by the adversarial pass to **S2**; a real Analytics Engine + Postgres pipeline does exist on the live request path, and the Grafana dashboards query the correct emitted metric names. Only `otel-collector.yaml` and `prometheus-rules.yaml` are dead | Severity down; used as corrected throughout §4 |
| Digest finding: money-ledger reconciliation is discoverable *"only by reading 10 %-sampled logs"* | **Refuted.** A dedicated critical-tone operator console and a fail-closed 409 on the merchant wallet read both exist | Restated as a *paging* gap in §4.2, with the scope gap flagged as the more serious issue |
| Digest finding: telemetry writes saturate a `max=5` connection pool | **Refuted.** Telemetry inserts go through `supabase-js`/PostgREST over HTTP; the `max: 5` pool belongs to the `postgres` client used only by `tenant-transaction.ts` and `routes/storefront.ts`. Contention is at shared Postgres write capacity | Mechanism corrected in F-28 and `07` §3.5 |

---

## 10. Cross-references

| Topic | Document |
|---|---|
| Why no live claim can be made | `04_LIVE_DEPLOYMENT_TRUTH.md` |
| Bottleneck order (ranks 1–11) and findings C-1…C-11 | `07_CAPACITY_MODEL.md` §3–§4 |
| Vendor limits, SLAs and the cost of PITR | `10_VENDOR_LIMITS_AND_COSTS.md` |
| Which invariants are `GOVERNED` (and that none cover detection or DR) | `02_GOVERNED_ARCHITECTURE.md` |
| Evidence-state definitions | `01_EVIDENCE_METHOD_AND_INDEX.md` §1 |
| Human actions arising from §4.4 and §5 | `17_OPEN_QUESTIONS_AND_HUMAN_ACTIONS.md` |
