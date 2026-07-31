# DevEx Panel Review — Phase 9

**Reviewer:** Principal Developer-Experience Architect  
**Date:** 2026-06-20  
**Corpus:** LCIS_FUTURE_MODEL.md · LCIS_INFORMATION_ARCHITECTURE.md · LCIS_EXPERIENCE_ARCHITECTURE.md

---

## 1. AGREE + Why

**The ⌘K-first stance is correct.** Engineers reach for a keyboard shortcut when they have a question mid-task; they do not open a new browser tab and navigate a sidebar. Linear proved this. The cited-answers contract is also right: an intelligence tool that asserts without provenance gets distrusted and ignored inside two weeks. Personas-as-saved-views (not walled modes) is the right call — the V11 five-mode sprawl was five half-finished products, not one good one. The catalog-as-spine decision is grounded in the strongest external evidence (Backstage, Datadog Service Catalog, New Relic Entity Explorer).

---

## 2. CHALLENGE + Evidence

**The sharpest challenge: ⌘K-first only works if the app is already open.** It isn't. LCIS has zero deployed presence today (`LCIS_REPOSITORY_ARCHAEOLOGY.md`: not in `pnpm-workspace.yaml`, no `vercel.json`, 100% localhost). Engineers working in VS Code, reviewing a PR on GitHub, or reading a Slack incident thread will not switch to a browser tab to hit ⌘K. The real DevEx win is **meeting engineers where they are** — not building the app they will visit, but wiring LCIS into the surfaces they never leave:

- **GitHub PR check** — a LCIS blast-radius comment on every PR that touches a high-impact symbol (`create_checkout_order`, `getSupabaseAdmin`). Zero new app required. Engineers read this before merging.
- **IDE sidebar / Cursor context** — the Query API + MCP already supports this (`LCIS_FUTURE_MODEL.md` §3, Decision 4). The cited structural context that makes Claude Code accurate on LetBuyy is more useful than the app for the median engineer task.
- **CI gate** — `pnpm graph:intel blast` already runs; surfacing its output as a PR status check would be adoption for free.

The "30-minute onboarding" claim is also suspect. LCIS is self-certified end-to-end (`LCIS_DOCUMENT_ARCHAEOLOGY.md` §meta); the System surface's onboarding path has never been tested by a real new engineer. There is no evidence it actually takes 30 minutes or that it produces a productive engineer, not just a finished tour.

Additional challenges:
- **<50ms is load-bearing** but unverified. Pre-computed artifacts claim <10ms structural; client-side local-first cache is proposed, not built. If the app ships slow, the adoption case collapses.
- **The catalog is the spine, but LetBuyy has 22 domains and 417 tables.** Without strong defaults (what a new engineer sees first, which domain is pinned, what the Home readiness snapshot surfaces), a blank catalog is as intimidating as `git log --oneline`.
- **No adoption loop.** Linear succeeded because it replaced an existing workflow (Jira). LCIS replaces nothing — engineers currently grep, scan, or ask a human. The proposal does not explain how the first engineer changes their habit.

---

## 3. MISSING

1. **Inline-in-merchant-control-plane is listed as "later" but it is the highest-leverage surface.** Engineers and operators already spend hours in the merchant control plane. A LCIS sidebar there (Shopify Sidekick pattern, cited in `LCIS_FUTURE_MODEL.md` §7) would get daily use without any habit change. Deferring it until after `apps/lcis` is the wrong order.

2. **No PR/CI integration spec.** The MCP and Query API exist; the proposal does not define what a GitHub PR check looks like, what it surfaces, or how it is wired. This is the single highest-ROI DevEx deliverable and it is absent from all three documents.

3. **No adoption metric.** How do we know if engineers are using this? Weekly active users, blast-radius queries per PR, `⌘K` asks per day? Without a measurement target, "engineers actually use this" is untestable — the same self-certification disease applied to the product.

4. **The onboarding ("30 min") needs an adversarial test.** One real new engineer, timed, observed. The corpus forbids self-certification; the onboarding claim is not exempt.

---

## 4. Top 5 Recommendations

**R1 — Wire the GitHub PR check before shipping the app.**  
The blast-radius comment on PRs touching high-impact symbols (`create_checkout_order`, `getSupabaseAdmin`, `@letbuyy/api-client`) is a one-day implementation over the existing `graph:intel blast` CLI. It proves LCIS value to every engineer on every PR with zero new app to open. Ship this first; use the PR adoption data to validate demand for the full app.

**R2 — Make the MCP/IDE integration the MVP "app" for engineers.**  
The `apps/lcis` human UI serves founders and operators. For engineers, the primary surface is the Cursor/Claude Code context pack — cited, structural, <10ms. Spec and ship the MCP integration (it is already partially wired per `LCIS_FUTURE_MODEL.md` §3) as the engineer-facing MVP. The browser app is the operator/founder face.

**R3 — Define a concrete adoption metric before the first release.**  
Pick one: blast-radius queries per merged PR, `⌘K` weekly actives, or onboarding completion rate. Gate the Phase 9 "done" verdict on a measured baseline, not a self-assessed one. This operationalizes the "adversarial truth" principle from `LCIS_FUTURE_MODEL.md` §2.

**R4 — Pull the merchant-control-plane inline intelligence forward.**  
Move it from "later" (Horizon 1-Year) to MVP scope as a narrow LCIS sidebar: blast radius + ownership for whatever route/RPC/table the operator is looking at. The audience is already there; no habit change required. This is the highest-leverage surface per user-hour.

**R5 — Test the 30-minute onboarding adversarially before publishing it.**  
Have one real new engineer (not a team member) run through the System → "Understand LetBuyy in 30 min" path, timed, with think-aloud protocol. Record what breaks or confuses. Fix it. Only then use the 30-minute claim as a selling point. If it takes 90 minutes or produces confusion, know that before the panel ratifies the architecture.

---

## Path

**Immediate (before Phase 10 ratification):**
1. Implement the GitHub PR blast-radius check (one-day, existing CLI).
2. Spec the MCP engineer integration as the engineer-facing MVP (separate from the browser app).
3. Run the adversarial onboarding test.

**Phase 10 ratification input:**  
The architecture is sound in structure; the adoption risk is not in the design — it is in deployment sequence. The panel should ratify the 8-surface IA AND mandate that the PR integration ships before or concurrent with `apps/lcis` v1, not after.

---

*Verdict: Structurally AGREE. Sequencing CHALLENGE. The app without the PR/IDE integration is a beautiful dashboard nobody opens.*
