# Panel Review — AI Systems Architect
**Phase 9 · 2026-06-20 · Principal AI Systems Architect**
**Scope:** `LCIS_FUTURE_MODEL.md`, `LCIS_EXPERIENCE_ARCHITECTURE.md`, `LCIS_COMPETITIVE_RESEARCH.md`, `_evidence/inventory-central-intelligence.md`

---

## 1. AGREE — and why

The core thesis is correct: **deterministic structural truth is LCIS's actual moat, and the :3334 RAG stack was architectural debt masquerading as capability.** The inventory confirms this objectively — 32% standalone functionality, 0 external deps installed, 40+ synchronous HTTP calls per request to V1. The "no RAG, structural-only" direction is the right call for *structural questions* (blast radius, ownership, lineage, runbooks). These are graph-traversal problems, not semantic retrieval problems. Pre-computed, <10ms, inspectable, zero hallucination surface — this is genuinely better than a Qdrant retrieval over the same source for the deterministic questions LCIS must answer.

The SafetyGuard is also correctly preserved: the inventory confirms no bypass path exists, and the Sentry-Seer-style "propose, don't execute" evolution is the right trajectory for agentic capability.

---

## 2. CHALLENGE — the sharpest one

**"Structural-only" has a hard ceiling that will hurt LCIS within months, specifically over unstructured prose.**

The proposal correctly identifies the structural graph answers well. It does not acknowledge that a large, growing fraction of what agents and engineers ask is *over prose*, not graph edges:

- **Governance docs and decision records** — the Constitution, AGENTS.md, 108+ validators, and the 20+ hand-authored governance docs are *prose*. An agent asking "why is this pattern required?" or "what does the Constitution say about X?" gets no answer from a code graph. The current :3334 reasoning engine (`ReasoningEngine.mjs`) does exactly this: it pattern-matches NL questions and synthesises prose answers using V1 structural data *plus* free-form reasoning over the governance corpus. Removing it without a replacement leaves a real gap.
- **Incident postmortems, runbook prose, and operational decisions** — also unstructured. The :3334 investigation engine's value is synthesising narrative context, not traversing a graph edge.
- **The `/api/copilot` cite-the-trace model is incomplete for code agents** — when Claude Code asks "why was this decision made?", a graph node citation is not an answer. The answer lives in a governance doc, a git commit message, or a prior incident report. These are retrieval problems over text, not graph problems.

**Evidence from inventory:** The `ReasoningEngine.mjs` 6-specialised-reasoners, the `ArchitectureIntelligenceEngine`, and the `InvestigationEngine` all produce real, non-trivial synthesis over prose + structure. They work with V1 alone (no Qdrant). These are *not* the RAG-dependent engines. The proposal conflates "kill Qdrant/GraphRAG" (correct) with "kill all text synthesis" (wrong).

The risk: if LCIS answers structural questions perfectly but cannot answer "why does this rule exist?" or "what happened during the last payment incident?", agents will route around it and scan the repo — which is exactly the context-exhaustion failure LCIS was built to prevent.

---

## 3. MISSING

Three gaps the proposal does not address:

**M1 — No plan for prose retrieval without Qdrant.** The proposal kills semantic retrieval but offers nothing for governance/incident/decision-record queries. The right answer is **not Qdrant** (too heavy, OpenAI dependency, needs ingestion pipeline) but also not nothing. A lightweight BM25 index over the governance corpus (`docs/`, `AGENTS.md`, Constitution, migration comments) built at extraction time is deterministic, zero-dependency, fast, and answers prose questions. This is the missing piece.

**M2 — MCP exposure is under-specified.** The proposal names MCP as the agent API but provides no schema. What tools does the MCP server expose? Which of the 32 consolidated capabilities become MCP tools vs. resources vs. prompts? How does Claude Code know to call `/blast?q=` vs `/domain?key=`? The Sentry-Seer grounding model only works if the MCP interface makes the right capability obvious without the agent needing to enumerate 32 endpoints. Concrete recommendation: 5–7 named MCP tools (`lcis_blast`, `lcis_explain`, `lcis_runbook`, `lcis_launch_check`, `lcis_cite`), each returning cited structured JSON, discoverable via tool descriptions. The current ad-hoc HTTP surface is not agent-friendly.

**M3 — LLM-as-Judge eval is deferred too far (3-year horizon).** The corpus is 100% self-certified. The proposal's solution is an adversarial review gate for the architecture docs — correct, but that only catches structural claims. LCIS's NL synthesis outputs (copilot answers, executive briefings, runbook text) have no groundedness check. This should be a 1-year deliverable, not 3-year. Specifically: a lightweight eval harness that spot-checks `/copilot` and `/runbook` outputs against the cited source nodes — not a full LangSmith deployment, just a deterministic assertion that "cited node X actually contains claim Y." This is achievable with the structural engine alone.

---

## 4. Top 3–5 Recommendations

**R1 (highest priority) — Add a deterministic prose index alongside the structural graph.**
At extraction time, BM25-index the governance corpus (Constitution, AGENTS.md, local AGENTS.md, migration comments, decision records under `docs/`). Expose via `/api/governance?q=` + a `lcis_governance` MCP tool. Zero external dependencies; fully deterministic; answers the "why does this rule exist?" class that structural graph cannot. This is the bridge between "structural-only" and "complete agent grounding."

**R2 — Define the MCP interface concretely, now.**
Before the 202→32 consolidation, decide which 5–7 capabilities become MCP tools. The test: can a fresh Claude Code session answer "what breaks if I change `getSupabaseAdmin`?" with a single `lcis_blast` tool call, without reading any file? If yes, the MCP surface is right. If the agent needs to know which of 32 endpoints to call, it is not. Ship the MCP server in the MVP cycle, not as a later horizon.

**R3 — Preserve and migrate the 5 genuinely-novel :3334 engines; archive only the RAG-dependent ones.**
The inventory identifies exactly which engines work with V1 alone: `ArchitectureIntelligenceEngine`, `ExecutionEngine`/`SafetyGuard`, `VerificationEngine`, `InvestigationEngine` (structural timelines), and `ReasoningEngine` (prose synthesis). These have zero Qdrant/OpenAI dependency paths that add value. Migrating them into :3333 as modules costs ~2 weeks and preserves real capability. Archiving them alongside Qdrant/GraphRAG/Crawl4AI loses months of validated logic with no replacement.

**R4 — Make the LLM-as-Judge eval a 1-year deliverable, not 3-year.**
Implement a deterministic citation verifier: for any NL output that cites a graph node, assert the node actually contains the claimed fact. Flag answers where the citation does not support the claim. This requires only the structural engine and a string-match pass — no LLM needed for the first pass. Full LLM-as-Judge scoring can follow later, but the citation-integrity check closes the self-certification gap for LCIS's own outputs immediately.

**R5 (conditional) — Pilot one live adapter (Supabase read-only) before expanding the app surface.**
`apps/lcis` as a full 8-surface product is the right 1-year target, but building it on 0 live connections is building on a scaffold. Wire the Supabase read-only adapter and instrument one real answer (e.g., live order count on the Home surface) *before* shipping the catalog and change-safety surfaces. This proves the live-adapter pattern, tests the honesty UI under real conditions, and gives the "NOT CONNECTED" label a visible counterpart — one surface that IS connected.

---

## Path

1. **Now (MVP):** R1 (BM25 governance index) + R2 (MCP interface spec) in parallel with the 202→32 consolidation. These unblock agent grounding.
2. **MVP → 1-year:** R3 (migrate 5 engines) during consolidation, not after. R4 (citation verifier) ships with the first `/copilot` endpoint.
3. **1-year:** R5 (live adapter pilot) gates the full `apps/lcis` surface build.
4. **Do not:** restart the Qdrant/OpenAI/GraphRAG stack. The evidence is clear — those are the wrong primitives for this system's questions. The structural engine + a BM25 prose index is the right stack.

---

*Adversarial posture maintained: no claim above is derived from the prior self-certified corpus alone. All findings cross-reference the source-verified inventory (`_evidence/inventory-central-intelligence.md`) and the competitive evidence files.*
