# LCIS X Federation Report (Phases 1-8)

Read-only federation over 7 production providers, composed by `federation-intel.mjs` from `live-adapters.mjs` (connection truth) + repository-truth extracts (structural truth). Every discovery is tagged **repository (known)** or **live (NOT CONNECTED + exact env)**. No metric is fabricated; no credential value is ever read or emitted.

## Connection status (dev)
| # | Provider | Generated graph | Connection | Required env (exact source) |
|:-:|----------|-----------------|:----------:|------------------------------|
| 1 | Supabase | Live Database Graph | NOT CONNECTED | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| 2 | Cloudflare | Live Infrastructure Graph | NOT CONNECTED | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| 3 | Vercel | Live Deployment Graph | NOT CONNECTED | `VERCEL_TOKEN` |
| 4 | GitHub | Engineering Graph | NOT CONNECTED | `GITHUB_TOKEN` |
| 5 | Razorpay | Money Operations Graph | NOT CONNECTED | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` |
| 6 | Resend | Communication Graph | NOT CONNECTED | `RESEND_API_KEY` |
| 7 | Turnstile | Security Graph | NOT CONNECTED | `TURNSTILE_SECRET_KEY` (request-time; no pull API) |

All 7 are NOT CONNECTED in dev — no deploy-time secrets live in the dev `process.env` (they are wired at deploy via `wrangler secret put`). The moment a read-only token is set, that provider's adapter probes its real API and the federation graph fills with live discovery.

## Per-provider discovery (repository truth vs live)
Each provider exposes the full discovery surface the spec requires. Where the repository already knows the structure, the count is real and labelled `repository (…)`; where the value is only knowable live, it is `NOT CONNECTED` with the exact endpoint + env.

- **Phase 1 — Supabase → Live Database Graph** (1,221 structural nodes): Tables **414**, Functions **156**, Policies **651**, Triggers **395**, Indexes **826**, tenant tables 255, SECURITY DEFINER 128, money functions 34 — all repository truth (db-intel). Live: Projects, Views, Storage Buckets, Realtime, Health, row counts → NOT CONNECTED.
- **Phase 2 — Cloudflare → Live Infrastructure Graph** (18 nodes): Workers **4**, queue producers/consumers, R2, Hyperdrive, crons, bindings, Secrets metadata **19** — repository truth (infra-intel / wrangler). Live: Analytics Engine, Routes, Deployment Status, Health, queue depth → NOT CONNECTED.
- **Phase 3 — Vercel → Live Deployment Graph** (5 nodes): Projects **5** (marketing-site, identity-platform, merchant-control-plane, storefront-runtime, platform-console) — repository truth. Live: Domains, Deployments, Env var metadata, Build status, Health, Traffic → NOT CONNECTED.
- **Phase 4 — GitHub → Engineering Graph** (27 nodes): Repository, CODEOWNERS rules, workflows — repository truth. Live: Branches, PRs, Actions runs, Failures, Releases → NOT CONNECTED.
- **Phase 5 — Razorpay → Money Operations Graph** (34 nodes): money/ledger functions (canonical SECURITY DEFINER RPCs) — repository truth. Live: Payments, Refunds, Orders, Settlements, Failures → NOT CONNECTED.
- **Phase 6 — Resend → Communication Graph**: Email volume, Failures, Bounce rate, Deliverability → NOT CONNECTED (needs `RESEND_API_KEY`).
- **Phase 7 — Turnstile → Security Graph**: Challenge rate, Failure rate, Threat signals → NOT CONNECTED (request-time siteverify; no pull-metrics API).

## Phase 8 — Unified Live Graph
Merges the Repository Graph + all 7 provider graphs into one federation layer:

| Metric | Value |
|--------|------:|
| Layers | 8 (Repository + Database + Infrastructure + Deployment + Engineering + Money + Communication + Security) |
| Total nodes | **53,551** |
| Total edges | **68,020** |
| Connected layers | **1 / 8** (Repository — repository truth) |
| NOT CONNECTED layers | 7 / 8 (live provider layers) |

The repository layer (52,246 nodes · 66,761 links) is CONNECTED — it is structural truth. The 7 provider layers carry their **structural shape** (what live federation would populate) and are NOT CONNECTED until read-only credentials are set. This is the honest federation contract: structure is known now; live values arrive only with a wired environment.

## Endpoints
`/api/federation` (all, or `?provider=`), `/api/live-graph` (Phase 8 unified graph). Surfaced in the UI via the **🌐 Live** workspace perspective.

## Honesty
0 / 7 providers connected; 0 fabricated live values. Every `discovers[].live` is `NOT CONNECTED`; every repository count carries its `repositorySource`. Read-only: adapters GET only; no writes.
