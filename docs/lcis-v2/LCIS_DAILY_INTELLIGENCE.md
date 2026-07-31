# LCIS Daily Intelligence System — V3 Phase 28

The DailyIntelligenceSystem is the automated brief-generation facade introduced in LCIS V3 Phase 28. It orchestrates six specialist generators to produce a daily brief family that gives founders, engineers, security reviewers, and merchants a single Markdown artifact covering platform posture, risk, predictions, goals, and what changed — without requiring a manual repo scan or LCIS query session.

Output directory: `graphify-out/briefs/` (gitignored).

---

## 1. Purpose

The system answers the question "what does the team need to know today?" by assembling structural intelligence from the graphify-out artefacts (CONNECTED) and clearly marking every live metric that requires an external credential as NOT CONNECTED with the exact source and env var needed to connect it. The output is a family of seven brief types, each scoped to a specific audience and cadence.

The brief family is designed to be consumed by humans reading Markdown files, piped into a Slack or email digest, or surfaced via the Intelligence API. It is not a dashboard replacement — it is a point-in-time snapshot intended for asynchronous consumption.

---

## 2. Relationship to V2 IntelligenceReportGenerator

The DailyIntelligenceSystem builds on, but does not replace, the V2 `IntelligenceReportGenerator` (`tools/central-intelligence/autonomous-operations/IntelligenceReportGenerator.mjs`). The relationship is additive:

- V2 `IntelligenceReportGenerator` produces a real-time operational report via `generateDailyReport()` and `getLatestReport()`, and is the authoritative source for operational insights. It is exposed at `GET /intelligence/operations/daily`.
- V3 `DailyIntelligenceSystem` calls V2 lazily inside `generateDailyBrief()`: it loads `IntelligenceReportGenerator`, calls `generateOperationalInsights()`, and appends the top three insights as a "V2 Operational Highlights" section. If V2 is not running the section is omitted gracefully — it never aborts the brief.

The daily brief contains a V2 excerpt, not a V2 replacement. Operators who want the full V2 operational report should call `GET /intelligence/operations/daily` directly.

---

## 3. The Brief Family

`generateAll()` fires all six generators concurrently via `Promise.allSettled` and returns `{paths, errors, date}`. A failure in one generator does not abort the others — fulfilled paths are collected; rejection reasons are collected into `errors`.

| Brief Type | Generator | File Pattern | Audience | Cadence |
|---|---|---|---|---|
| Daily operational | `DailyIntelligenceSystem.generateDailyBrief()` | `daily-{date}.md` | All operators | Daily |
| Platform health | `DailyIntelligenceSystem.generatePlatformHealthBrief()` | `platform-health-{date}.md` | SRE / on-call | Daily |
| Executive summary | `ExecutiveSummaryGenerator.generate()` | `executive-summary-{date}.md` | Founder / leadership | Daily |
| Engineering summary | `EngineeringSummaryGenerator.generate()` | `engineering-summary-{date}.md` | Engineering team | Daily |
| Security summary | `SecuritySummaryGenerator.generate()` | `security-summary-{date}.md` | Security reviewer | Daily |
| Merchant impact | `MerchantImpactSummaryGenerator.generate()` | `merchant-impact-{date}.md` | Merchant success / ops | Daily |
| Weekly rollup | `DailyIntelligenceSystem.generateWeeklyBrief()` | `weekly-{week}.md` | All operators | Weekly |

The weekly brief is not part of `generateAll()` — it must be called separately. It reads the last seven `daily-*.md` files from `graphify-out/briefs/`, sorted lexicographically and reversed, and extracts the Platform Posture and Top Risks sections from each by regex match. The ISO week identifier is computed with `isoWeek()` using the Jan 4 anchor (ISO 8601), zero-padded to two digits (`YYYY-Www`).

`getLatestBrief(type)` accepts one of the seven type strings (`'daily'`, `'weekly'`, `'platform-health'`, `'executive-summary'`, `'engineering-summary'`, `'security-summary'`, `'merchant-impact'`) and returns `{path, content, generatedAt}` by scanning `graphify-out/briefs/` for the newest file matching the type prefix. Returns `null` if no file exists.

---

## 4. Section Architecture — Daily Brief

Each section in the daily brief is produced by a dedicated `build*Section()` async function. All use `.catch()` so a section failure emits an `"ERROR collecting X"` placeholder rather than aborting the brief. All eight sections are assembled in parallel via `Promise.all`.

| Section | Data Source | Connected? |
|---|---|---|
| Platform Posture | V1 LCIS `/api/production-health` + `/api/launch-command-center` | CONNECTED when V1 running at localhost:3333; NOT CONNECTED otherwise |
| Top Risks | `RiskScorer.scoreDomain()` for payments / checkout / identity / orders / webhooks, sorted descending | CONNECTED via structural artefacts; live anomaly signal NOT CONNECTED (Cloudflare Analytics Engine) |
| Predictions | `PredictionEngine.getPredictionReport()`; each prediction carries an inline CONNECTED/NOT CONNECTED badge | CONNECTED (structural predisposition); live trend data NOT CONNECTED (Analytics Engine / SigNoz) |
| Top Recommendations | `ExecutiveRecommendationEngine.recommendAll()`; top 5, formatted `[priority] [effort] title: action` | CONNECTED when structural artefacts present |
| Goal Status | `GoalEngine.refreshAll()` with fallback to cached `graphify-out/goals/goals.json` | CONNECTED when goals.json present |
| What Changed | `ArchitectureIntelligenceEngine.whatChanged()` | CONNECTED (structural diff); deployment history NOT CONNECTED (Vercel API / GitHub Actions API) |
| V2 Operational Highlights | `IntelligenceReportGenerator.generateOperationalInsights()` top 3 insights | Optional; omitted gracefully if V2 not running |
| Data Source Status | Hardcoded connection table (always appended) | Always present regardless of other sections |

**Risk scoring thresholds:** `scoreDomain()` returns a 0–100 composite score. Score ≥ 70 = `HIGH`, 40–69 = `MEDIUM`, < 40 = `LOW`. The score breakdown includes `blastRadius`, `moneyWeight`, and `tenantWeight` factors.

**Goal status icons:** `✓` achieved, `⚠` at-risk, `✗` blocked, `→` on-track.

---

## 5. Generator Classes

All five specialist generators live in `tools/central-intelligence/daily-intelligence/` alongside the facade.

**`DailyIntelligenceSystem.mjs`** (672 lines) — the facade and entry point. Exports a singleton instance. All five engines are lazy-loaded (`loadPredictionEngine`, `loadRiskScorer`, `loadGoalEngine`, `loadExecutiveRecommendationEngine`, `loadArchitectureIntelligenceEngine`, `loadV2ReportGenerator`) on first use via dynamic `import()` inside try/catch; a module load failure returns `null` and the affected section degrades gracefully to a NOT CONNECTED message.

**`ExecutiveSummaryGenerator.mjs`** — leadership-facing brief. Sources: `ExecutiveIntelligenceEngine.getExecutiveBriefing()`, `GoalEngine.refreshAll()`, `MissionEngine.getMissionProgress()`, V1 LCIS `/api/launch-command-center`, V1 LCIS `/api/production-readiness-v2`. Exports a singleton with a single `generate()` method that writes and returns the file path.

**`EngineeringSummaryGenerator.mjs`** — engineering-team brief. Focuses on technical debt, validator gate status, architecture drift, and top engineering recommendations from `ExecutiveRecommendationEngine.recommendEngineering()`.

**`SecuritySummaryGenerator.mjs`** — security brief. Sources V1 LCIS `/api/security-intelligence`, highlights critical control gaps, RLS coverage, and webhook signature enforcement status.

**`MerchantImpactSummaryGenerator.mjs`** — merchant-facing brief. Sources V1 LCIS `/api/merchant-intelligence`, surfaces per-merchant risks and onboarding completion percentage.

All five specialist generators follow the same pattern: lazy engine loading, `Promise.all` section assembly, `writeBrief(filename, content)` output, and the honesty contract enforced at the section level.

---

## 6. CONNECTED vs NOT CONNECTED Labeling

Every brief applies the same honesty contract that governs all LCIS outputs:

- **CONNECTED** — the value is derived from a local structural artefact (`graphify-out/*.json`, `graphify-out/goals/goals.json`) or V1 LCIS running at localhost:3333. No external credential needed.
- **NOT CONNECTED** — the value is a live metric that requires an external credential or running service. Every NOT CONNECTED entry names the exact env var or service required.

The Data Source Status table (appended to every brief) makes this explicit for all seven live data sources. Section builders also inline NOT CONNECTED markers where relevant — for example, the Predictions section appends `> Live trend data: NOT CONNECTED (source: Cloudflare Analytics Engine / SigNoz OTel endpoint)` after the structural predictions list, and the Top Risks section appends `> Live anomaly signal: NOT CONNECTED (source: Cloudflare Analytics Engine / Wrangler tail)`.

This means a brief generated without any live credentials is still useful — it provides structural risk scores, structural predictions at 95% confidence, and goal status from goals.json — while being unambiguous about what data remains absent.

**Data Source Status table (appended to every brief):**

| Source | Status | Note |
|---|---|---|
| V1 LCIS structural graph (localhost:3333) | see posture section | Run `pnpm graph:omega` to refresh |
| Live telemetry (Cloudflare Analytics Engine) | NOT CONNECTED | Requires CLOUDFLARE_ACCOUNT_ID + Analytics Engine binding |
| Live transaction amounts / GMV | NOT CONNECTED | Requires Supabase service-role key + ledger reconciliation RPCs |
| Active merchants / store count | NOT CONNECTED | Requires Supabase `sites` table query |
| Deploy versions (Vercel) | NOT CONNECTED | Requires VERCEL_TOKEN |
| Error rates / latency (SigNoz) | NOT CONNECTED | Requires OTEL_EXPORTER_OTLP_ENDPOINT |
| Security advisories (crawled) | NOT CONNECTED | Requires LCIS V2 Qdrant + Crawl4AI running |

---

## 7. Real Brief Example — 2026-06-20

The following was generated by `DailyIntelligenceSystem.generateDailyBrief()` and written to `graphify-out/briefs/daily-2026-06-20.md` at `2026-06-20T03:32:55.213Z`.

**Platform Posture:** V1 LCIS returned UNKNOWN overall status (not running at generation time). Five active launch blockers were extracted: shipping rates + GST, announcement bar, appearance bridge (top three shown in the brief excerpt).

**Top Risks:** `RiskScorer` engine failed to load — section shows `ERROR collecting risk data`.

**Predictions (all CONNECTED, structural basis):** Five domains — payments, orders, checkout, refunds, gift_cards — all scored HIGH structural risk (65/100), 95% confidence, 7–30 day horizon. Every prediction cited the same two drivers: money path touching `payment_transactions` / ledger RPCs requiring ledger integrity review, and 15 dependency SPOFs detected. Live trend data labeled NOT CONNECTED.

**Goal Status (CONNECTED via goals.json):**
- `⚠ launch-readiness` [strategic] — at-risk (68%)
- `✓ 107-validator-gate-green` [engineering] — achieved (100%)
- `→ zero-money-ledger-drift` [reliability] — on-track (88%)
- `→ rls-force-coverage` [security] — on-track (80%)
- `⚠ merchant-onboarding-completion` [merchant] — at-risk (60%)

**What Changed:** No architecture drift detected in latest structural snapshot. Deployment history NOT CONNECTED.

**All seven live data sources:** NOT CONNECTED (no credentials present at generation time).

---

## 8. Output Directory

```
graphify-out/briefs/
  daily-2026-06-20.md
  platform-health-2026-06-20.md
  executive-summary-2026-06-20.md
  engineering-summary-2026-06-20.md
  security-summary-2026-06-20.md
  merchant-impact-2026-06-20.md
  weekly-2026-W25.md          ← generated separately via generateWeeklyBrief()
```

The directory (`graphify-out/briefs/`) is created automatically by `ensureBriefsDir()` on first write using `mkdirSync({ recursive: true })`. It is gitignored. File sizes are tracked by `briefSize()` (`statSync().size`) but not enforced.

---

## 9. API Endpoints

Three endpoints under the V3 Daily Briefings group in `tools/central-intelligence/intelligence-api/server.mjs`:

| Method | Path | Handler | Returns |
|---|---|---|---|
| `GET` | `/intelligence/brief/daily` | `DailyIntelligenceSystem.getLatestBrief('daily')` | `{path, content, generatedAt}` or `null` |
| `POST` | `/intelligence/brief/generate` | `DailyIntelligenceSystem.generateAll()` | `{generated: true, result: {paths, errors, date}}` |
| `GET` | `/intelligence/brief/executive` | `ExecutiveSummaryGenerator.generate()` | Absolute file path string (writes file, returns path) |

`POST /intelligence/brief/generate` triggers all six generators concurrently. It is the recommended way to refresh the full brief family from the dashboard or a cron job. A partial failure (one generator throws) still returns paths for the successful generators.

---

## 10. Scheduling

`DailyIntelligenceSystem` has no built-in scheduler. Three recommended integration patterns:

**node-cron (daily at 06:00):**
```js
import cron from 'node-cron';
import daily from './tools/central-intelligence/daily-intelligence/DailyIntelligenceSystem.mjs';

cron.schedule('0 6 * * *', () => daily.generateAll());
```

**System cron (if the server is not always running):**
```
0 6 * * * node -e "import('./tools/central-intelligence/daily-intelligence/DailyIntelligenceSystem.mjs').then(m=>m.default.generateAll())"
```

**Operating Loop integration (recommended):** Wire `generateDailyBrief()` as a side-effect of the LCIS Operating Loop's Learn stage so briefs are generated automatically after each loop cycle that refreshes the structural graph. The loop already runs `pnpm graph:omega` as part of its update phase, which ensures CONNECTED artefacts are current before section builders read them.

Refresh structural data before generating briefs when running manually:
```bash
pnpm graph:omega   # refreshes db + infra + domain + code graph artefacts
curl -X POST http://localhost:3334/intelligence/brief/generate
```
