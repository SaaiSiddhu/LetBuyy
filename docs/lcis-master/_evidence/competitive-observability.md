# Competitive Evidence — Observability, Incident & Ops Intelligence

**Phase 4 evidence (cluster 2 of 3).** Compiled from sub-agent research streams (Datadog/Grafana, Sentry, New Relic, PagerDuty/Incident.io/SigNoz/Elastic).

> **Honesty note (per the research-rigor panel):** the live `WebSearch`/`WebFetch` tool hit a model-routing error for parts of this session; findings were reconstructed from current architectural knowledge of these products and cited against **canonical documentation URLs** (verifiable). Treat as design-lesson extraction, not a live feature audit. Architectural details accurate to ~mid-2025.

---

## Datadog
- **What:** unified observability+security SaaS; ~20 modules under one tag taxonomy; the "single pane" bet. Nav = Infrastructure · APM · Logs · Digital Experience · Service Management · Security · Dashboards. Source: `docs.datadoghq.com/getting_started/`.
- **Data model:** metrics+logs+traces unified by **tags**; `trace_id` propagation is the universal join (one click trace→logs). Correlation is a filter, not a JOIN.
- **Service Catalog:** services as first-class entities, **auto-discovered from APM traces** ("inferred services"), enriched by humans (owner/tier/runbook/PagerDuty id); health rolled up per card from existing telemetry (the catalog stores zero metrics). Dependency graph from span `peer.service`. Source: `docs.datadoghq.com/service_catalog/`.
- **Watchdog (AIOps):** seasonal ARIMA baseline per service×resource×env; **correlation clustering** = co-deviating signals become *one* root-cause card with ranked contributing factors (r-values), not 47 alerts. Source: `docs.datadoghq.com/watchdog/`.
- **Bits AI:** NL→query, incident-sidebar (summarize affected services, suggest runbook steps, draft status update), log explanation. Full-platform context. Source: `docs.datadoghq.com/bits_ai/`.
- **LCIS lessons:** (1) **Auto-discover entities, enrich later** — don't hand-register the catalog. (2) **Correlation > detection** — cluster co-occurring signals into one card. (3) Tag/`site_id` as the universal join key at emission. (4) The incident timeline IS the product (auto-assembled → becomes the postmortem).

## Grafana (LGTM)
- **What:** query+visualization layer that federates any data source ("you own your data"); LGTM = Loki+Grafana+Tempo+Mimir. Source: `grafana.com/docs/grafana/latest/`.
- **Core abstraction:** the **Data Source plugin** (`query()`/`testDatasource()`); panel = data source → query → panel type. Mixed-source panels overlay backends.
- **Dashboards-as-code:** every dashboard is JSON; **Grafonnet** (Jsonnet) generates N per-service/per-tenant dashboards from one template → zero marginal cost per tenant. GitOps via `GrafanaDashboard` CRD.
- **Loki:** index **labels only**, store log text compressed in object storage; cheap; label-cardinality is the constraint (`site_id` works for thousands of tenants). **Tempo:** trace blobs in S3, emits service-graph metrics. **Mimir:** multi-tenant Prometheus TSDB (`X-Scope-OrgID`).
- **Sift (2024):** on alert fire, **auto-runs investigations** (correlated metrics, error-log scan, deploy check) → a findings card *before* a human arrives. Source: `grafana.com/.../grafana-sift-automated-root-cause-analysis/`.
- **LCIS lessons:** (1) **Label at emission, not query** — `{site_id, domain, operation, env}` as first-class fields. (2) **Templates → per-tenant views at zero cost** (the entity-page-from-template pattern). (3) **Auto-Sift on every detector trigger** — pre-run investigations, attach to timeline. (4) Storage-agnostic/query-route rather than own all data.

## Sentry
- **What:** error/issue platform. **Event** (atomic, billed) vs **Issue** (fingerprint grouping). Lifecycle: New→Ongoing→Escalating→Regressed→Resolved/Archived. Source: `docs.sentry.io/product/issues/`.
- **Grouping:** deterministic **fingerprint** (priority: built-in rules → stack-trace in-app frames → type+value → message), with an **AI second pass** (transformer embedding) that only *merges* semantically-similar new issues, never splits fingerprint groups. Source: `docs.sentry.io/concepts/grouping-and-fingerprinting/`.
- **Releases = regression mechanism:** commit→file→blame→**suspect commit** (first in-app frame, <1yr old) → suggested assignee. Source: `docs.sentry.io/product/releases/`.
- **Seer (AI):** **Autofix** = root-cause → plan → code → PR, with **explicit human-approval gates** ("Code It Up") and an ML **fixability score** controlling automation depth; **hands off to Claude Code / Cursor** for execution; reads its rules files. Source: `docs.sentry.io/product/seer/`.
- **LCIS lessons (high value):** (1) **Deterministic primitive first, AI as a merge-only second pass** — exactly LCIS's "structural-first, deterministic" doctrine. (2) **Agentic but human-gated** (fixability score + approval) = the template for evolving SafetyGuard from read-only to *gated proposals*. (3) **Hand off to coding agents** with structural context = LCIS-as-grounding-layer. (4) Suspect-commit/blame = LCIS's git-aware ownership + change attribution.

## New Relic
- **What:** all-in-one; entity-centric. An **entity** = "anything that reports data," stable `entityGuid` is the join key everywhere (NRQL + NerdGraph). Source: `docs.newrelic.com/.../what-entity-new-relic/`.
- **Entity model:** domain×type; **open GitHub entity-definition files** (TTL, **golden_metrics.yml** per type); custom synthesis ("propose a mapping"); placeholder entities for uninstrumented services. **11 typed relationship edges** (`CALLS`, `CONTAINS`, `HOSTS`, `SERVES`, `CONSUMES`/`PRODUCES`…) **auto-inferred from telemetry metric names** with TTL.
- **NRQL:** one SQL-like language over the unified NRDB (MELT); every chart/alert/AI-query is NRQL; `FACET`/`funnel()`/`COMPARE WITH` built in. **Lookout** = no-config visual anomaly (5-min vs prior hour). **Alert coverage gaps** = AI surfaces entities lacking alert conditions (per golden metrics).
- **NR AI:** NL→NRQL (50+ languages), explain concepts/dashboards, analyze stack traces, predictive alerts. Source: `newrelic.com/platform/new-relic-ai`.
- **LCIS lessons:** (1) **Stable entity id + typed relationships + golden facts per type** = the catalog data model LCIS should adopt (it already has 15 relation types in V10). (2) **One query language** over the catalog. (3) **Coverage-gap detection** — LCIS's domain agent already found "what lacks validators/alerts"; make it a first-class surface (which validators/RLS/runbooks a domain is missing).

## PagerDuty
- **Model:** Alert→Incident→Triage→Postmortem; **Services** are the central abstraction (own escalation policy, schedule, grouping). **Intelligent Alert Grouping** (time/content-ML/flexible). **Change Events** (deploys/config/flags via the same Events API) appear in the timeline **correlated by time proximity** ("deploy 3 min before alerts"). Runbook Automation (Rundeck) one-click from incidents. Source: `support.pagerduty.com/docs/aiops`.
- **LCIS lessons:** (1) **Change-event correlation** — the most LCIS-credible AIOps pattern (LCIS knows deploys/migrations from git) — **but** it requires a live *outcome* signal to be true correlation; pre-telemetry, LCIS can only ship a structural **deployment-risk diff** (see Observability panel). (2) Append-only incident timeline as audit. (3) Services = entities own their runbook/owner.

## Incident.io
- **Model:** incident as a first-class object + a **workflow engine** (trigger→conditions→steps); Slack-native (`/inc` creates `#inc-NNNN`); timeline auto-populated (Slack msgs, status, roles, workflow actions) → **AI-drafted postmortem** from the timeline. On-call product (2023). Source: `incident.io/docs/`.
- **LCIS lessons:** workflow-driven incident lifecycle; auto-drafted postmortems from a timeline LCIS could assemble structurally; roles as first-class.

## SigNoz
- **What:** OSS, **OTel-native** (OTel the only ingestion path), ClickHouse single store for traces/metrics/logs; trace↔log via `trace_id`; seasonal anomaly (beta). Source: `signoz.io/docs/`.
- **LCIS lessons:** **OTel is the standard** if/when LCIS wires telemetry (central-intelligence already references it, unconnected). ClickHouse economics if LCIS ever needs an event store. Auto-discovered services from traces (catalog reinforcement).

## Elastic / Kibana
- **What:** search-first observability; Elasticsearch unified store; Kibana Discover (KQL), Lens dashboards, APM service map, **ML anomaly-detection jobs** (detector functions + influencers + bucket span + 0–100 score) and **AIOps Log Rate Analysis** (log-likelihood ratio to find over-represented field-values in a spike). Native **SLOs + burn-rate alerts**. Source: `elastic.co/guide/en/observability/`.
- **LCIS lessons:** (1) **Real ML anomaly needs live data + a model** — confirms LCIS's "detectors" are heuristics until live. (2) **SLO/error-budget** is a pattern LCIS could adopt *once live*, but should NOT reimplement raw-trace ingestion (OTel/APM boundary).

---

## Cross-cutting synthesis → LCIS
1. **Service/entity catalog is the universal backbone** (every tool). → LCIS catalog = surface #2, the spine; auto-discovered; typed relationships; golden facts per type.
2. **Correlation/auto-investigation beats raw detection** (Watchdog, Sift, Bits AI). → LCIS: cluster + auto-run structural investigations on trigger; attach to timeline.
3. **Change-event correlation is the near-term AIOps win — but honestly a structural deployment-risk diff until live outcomes exist** (PagerDuty + the LCIS observability panel's correction).
4. **Real anomaly detection / SLOs require live signal** (Elastic, NR, Datadog). → LCIS detectors/predictors are **structural heuristics**; relabel; the frontier is wiring ≥1 adapter.
5. **Agentic but human-gated, hand off to coding agents** (Sentry Seer). → the template for SafetyGuard's evolution.
6. **Draw the boundary:** LCIS consumes pre-aggregated metrics from adapters; it does **not** ingest raw traces/spans and does **not** own SLO arithmetic — else it becomes a poorly-reimplemented Datadog.

**Canonical sources:** docs.datadoghq.com (getting_started, service_catalog, watchdog, bits_ai, service_management) · grafana.com/docs (grafana, loki, tempo, mimir, ML, sift blog) · docs.sentry.io (issues, grouping-and-fingerprinting, releases, seer, tracing) · docs.newrelic.com (what-entity, NRQL, APM/apdex, alerts, lookout) · support.pagerduty.com (aiops, intelligent-alert-grouping, incidents) · incident.io/docs · signoz.io/docs · elastic.co/guide (observability, ML, SLO).
