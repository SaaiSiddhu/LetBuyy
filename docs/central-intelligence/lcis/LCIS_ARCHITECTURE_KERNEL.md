---
title: LCIS Architecture Kernel
version: 1.0
created: 2026-06-19
stability: CONSTITUTIONAL — superseded only by explicit version increment
authority: Constitutional architecture of the LetBuyy Central Intelligence System
parent: docs/central-intelligence/platform/LETBUYY_PLATFORM_EXECUTIVE_KERNEL.md
consumed_by: AI agents, platform architects, intelligence engineers, domain leads
---

# LCIS Architecture Kernel

*The constitution of the LetBuyy Central Intelligence System. Every intelligence layer, every knowledge artifact, every AI agent operating within this ecosystem inherits from this document. Read this to understand not what the platform knows, but how it knows it.*

---

## PART 1: LCIS IDENTITY

### 1.1 What LCIS Is

The LetBuyy Central Intelligence System (LCIS) is the **platform's queryable knowledge infrastructure**.

Not a documentation system. Not a monitoring dashboard. Not a static wiki. Not an AI model.

An intelligence system: a continuously maintained, queryable map of every relationship in the LetBuyy ecosystem — code to domain, domain to database, database to policy, policy to business rule — structured so that any agent (human or AI) can answer consequential questions about the platform without scanning the repository.

LCIS is the difference between a platform that understands itself and a platform that requires a repository scan every time someone asks "what breaks if I change this?"

The intelligence LCIS maintains spans multiple abstraction layers simultaneously:

**Structural intelligence** — the static shape of the system: what files exist, what they export, what they import, what tables they read, what RLS policies govern those tables, what triggers fire on those tables, what queues consume their outputs. This intelligence is accurate as of the last graph build.

**Domain intelligence** — the business meaning of the system: which files and tables constitute the Identity domain, which constitute the Merchant domain, where the boundaries between domains exist, and what contracts cross those boundaries. Domain intelligence answers "what is this for" rather than "what is this."

**Operational intelligence** — the runtime posture of the system: what is deployed, what is failing, what is recovering, what is at risk of failing. Operational intelligence is honest about the boundary between structural topology (which LCIS knows with certainty) and live metric values (which LCIS maps to their source but does not fabricate).

**Decision intelligence** — the ranked understanding of what matters most: what blocks launch, what blocks scale, what should be fixed next, what is highest risk. Decision intelligence synthesises structural, domain, and operational intelligence into prioritised guidance.

**Knowledge intelligence** — the meta-layer: what the platform knows about itself, how that knowledge is organised, how it is consumed, and how it evolves. This document is an artifact of the knowledge intelligence layer.

### 1.2 What LCIS Is Not

**Not a source of truth for live values.** LCIS maps where live values come from — the exact API, environment variable, or telemetry adapter that would produce the value — but it does not fabricate values when those sources are not connected. Every live value in LCIS is either real (sourced from a connected adapter) or explicitly marked "NOT CONNECTED — source: [exact reference]". There is no third state.

**Not a static document archive.** LCIS knowledge is generated from current code, current database state, and current infrastructure configuration. A document written six months ago is not LCIS intelligence — it is a historical artifact. LCIS intelligence is built by running `pnpm graph:*` commands against the current state of the system.

**Not a decision-maker.** LCIS surfaces ranked guidance and surfaces risk. It does not make architectural decisions on behalf of engineers or agents. A decision that requires human judgment (an ARB decision, a product trade-off, a security exception) is surfaced by LCIS but resolved by humans.

**Not a monitoring system.** LCIS maps the topology of the monitoring system — what signals are emitted where, what adapters consume them, what dashboards display them. The monitoring system itself lives in external telemetry infrastructure (Cloudflare Analytics Engine, Supabase logs, Vercel observability). LCIS is the map of that infrastructure, not the infrastructure itself.

**Not a substitute for the code.** LCIS is a representation of the code, not the code itself. When a query requires exact implementation semantics, the code is read directly. LCIS is the navigation layer that makes it possible to know which file to read — not a replacement for reading it.

### 1.3 Mission

**Make the platform self-describing.**

A platform that can answer "what breaks if I change this" without requiring a senior engineer to hold its full dependency graph in their head is a platform that scales safely. LCIS is the mechanism by which LetBuyy achieves self-description: every relationship is documented, every boundary is explicit, and every question has a queryable answer.

### 1.4 Responsibilities

LCIS is responsible for:

- Maintaining an accurate, queryable map of structural relationships across the platform
- Surfacing blast radius for any proposed change before that change is made
- Mapping domain boundaries and cross-domain dependency contracts
- Surfacing ownership of every platform capability
- Mapping the production readiness posture of every domain
- Providing AI agents with the knowledge they need before they scan the repository
- Providing the kernel hierarchy through which permanent platform law is encoded and consumed
- Honesty about the boundary between connected and not-connected live data

### 1.5 Consumers

**AI coding agents** (Claude Code, Codex, future systems) — the primary consumer. Agents query LCIS before making changes, verify blast radius before modifying shared systems, and consume domain kernels as the permanent law layer.

**Platform engineers** — the secondary consumer. Engineers use LCIS to understand the impact of a change before making it, to find the owner of a capability they need to change, and to onboard into unfamiliar domains.

**Architects** — the tertiary consumer. Architects use LCIS to understand cross-domain dependency health, to identify architectural drift, and to validate that the implemented system matches its intended design.

**Domain leads** — quarterly consumers. Domain leads use LCIS to review production readiness, verify that their domain's observability signals are connected, and track the evolution of domain boundaries.

### 1.6 Boundaries

LCIS operates within the following limits:

- LCIS observes and maps. It does not modify code, data, or configuration.
- LCIS surfaces risk and prioritises guidance. It does not make decisions.
- LCIS maps live value sources. It does not fabricate live values.
- LCIS is built from the current state of the system. It does not maintain real-time synchronisation — it must be rebuilt (`pnpm graph:omega`) to reflect changes.
- LCIS serves the platform's own intelligence needs. It is not a public-facing product.

---

## PART 2: KNOWLEDGE ARCHITECTURE

### 2.1 The Five Knowledge Layers

LCIS knowledge is organised in five layers. Each layer is built from the one below it. Each layer is consumed differently. Each layer has different stability characteristics.

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: KERNEL LAYER                              │
│  Platform Executive Kernel, Domain Executive Kernels│
│  Stability: Constitutional — changes rarely         │
│  Built by: Human synthesis from Masters             │
│  Consumed: First, by all agents and humans          │
└────────────────────────┬────────────────────────────┘
                         │ inherits from
┌────────────────────────▼────────────────────────────┐
│  LAYER 2: MASTER LAYER                              │
│  Domain Intelligence Masters, Design Master         │
│  Stability: Stable — updated after major audits     │
│  Built by: Multi-agent investigation + synthesis    │
│  Consumed: For full domain context and evidence     │
└────────────────────────┬────────────────────────────┘
                         │ synthesised from
┌────────────────────────▼────────────────────────────┐
│  LAYER 3: REGISTRY LAYER                            │
│  Decision Registry, Domain Registry, Service        │
│  Registry, Component Registry, Security Registry    │
│  Stability: Semi-stable — updated per change        │
│  Built by: ARB decisions + governance processes     │
│  Consumed: For authoritative current-state lookup   │
└────────────────────────┬────────────────────────────┘
                         │ compiled from
┌────────────────────────▼────────────────────────────┐
│  LAYER 4: EVIDENCE LAYER                            │
│  Audit reports, certifications, gap analyses,       │
│  investigation documents, discovery reports         │
│  Stability: Accumulating — never deleted            │
│  Built by: Automated auditors + investigation runs  │
│  Consumed: For point-in-time historical reference   │
└────────────────────────┬────────────────────────────┘
                         │ derived from
┌────────────────────────▼────────────────────────────┐
│  LAYER 5: RUNTIME LAYER                             │
│  Code graph, DB graph, domain graph, ops layer,     │
│  AI context packs, query API (/api/*)               │
│  Stability: Generated — rebuilt on demand           │
│  Built by: pnpm graph:* commands from live state    │
│  Consumed: By query API before any repo scan        │
└─────────────────────────────────────────────────────┘
```

### 2.2 Layer Relationships

**Kernels inherit from Masters.** A kernel is the distillation of a master: it contains only what remains true regardless of how the codebase changes. When a master is updated (because an investigation revealed new findings), the kernel is updated only if a permanent truth changed — not merely because the audit landscape changed.

**Masters are synthesised from Evidence.** A master document represents the current best understanding of a domain, built from the accumulated evidence of multiple investigations. Evidence documents are never deleted — they are historical records. Masters are updated when new evidence materially changes the domain's understanding.

**Evidence is compiled from Registries.** Registry entries — ARB decisions, domain boundary definitions, component graduations, security policy changes — are the structured inputs that feed investigation and audit processes.

**Registries are derived from the Runtime.** The authoritative source for what exists in the system is the runtime layer: the code graph, the database graph, and the domain graph, all generated from the current state of the codebase. Registry entries codify what the runtime layer reveals, adding human judgment (ownership, purpose, governance status) that the runtime layer cannot infer.

### 2.3 Layer Ownership

| Layer | Owner | Mutation process | Frequency |
|-------|-------|-----------------|-----------|
| Kernel | Platform architects + ARB | Human synthesis after major investigation | Quarterly or per major platform change |
| Master | Domain leads + intelligence engineers | Multi-agent investigation → synthesis | After major audits or significant feature additions |
| Registry | Domain leads + ARB (for decisions) | Governed process per change type | Per change that affects registry entries |
| Evidence | Automated systems + intelligence engineers | Append-only; generated by audit runs | Per audit cycle (PR-level, weekly) |
| Runtime | Generated automatically | `pnpm graph:*` rebuild | On-demand; recommended after significant changes |

### 2.4 Inheritance Protocol

When a domain kernel is created or updated, the following inheritance protocol applies:

1. The kernel must not contradict the Platform Executive Kernel. If a contradiction is found, the kernel is wrong — not the platform document.
2. The kernel must reference its parent kernel in its frontmatter.
3. The kernel must be reviewed against the current Master to ensure it accurately represents the domain's permanent truths.
4. The kernel must be reviewed by the domain lead and a platform architect.
5. Any kernel that encodes a pattern contradicting an established ARB decision must explicitly reference that decision and explain why the domain is an exception.

---

## PART 3: INTELLIGENCE MODEL

### 3.1 The Seven Intelligence Types

LCIS maintains seven distinct intelligence types. Each answers a different class of question. Each is built from different data. Each has different freshness requirements.

**Architectural Intelligence** answers: *What is the structure of the system?*
- Maps files, functions, exports, imports, and call chains
- Maps tables, columns, RPCs, policies, triggers, indexes, and foreign keys
- Maps the dependency graph: what A calls to reach B, what breaks in A if B changes
- Built from: code graph + database graph
- Freshness: as of last `graphify update .` + `pnpm graph:db` run
- Authority: the code graph is the authoritative source of structural truth

**Domain Intelligence** answers: *What is this for, who owns it, and where does it stop?*
- Maps the 22 business domains and their boundaries
- Maps cross-domain dependency edges
- Maps domain ownership and accountability
- Maps the production readiness of each domain
- Built from: domain graph (`pnpm graph:domain`) + registry layer
- Freshness: as of last `pnpm graph:v3` run
- Authority: the domain registry (codified by ARB decisions) is authoritative for boundary disputes

**Security Intelligence** answers: *What is the attack surface and where are the risks?*
- Maps authentication boundaries (two-issuer JWT system)
- Maps tenant isolation (RLS policies, verifySiteOwnership chain)
- Maps secret distribution (which services need which secrets)
- Maps webhook/queue trust model (HMAC signing)
- Maps attack surface candidates (cross-tenant data access paths, auth bypass risks)
- Built from: DB graph (RLS policies) + code graph (auth middleware)
- Freshness: as of last `pnpm graph:security` run
- Authority: the 107-validator gate is the authoritative source for compliance verdicts

**Design Intelligence** answers: *What governs the visual and interaction layer?*
- Maps the design token system (`--lb-*` namespace, ~330 properties)
- Maps the component library (50+ components, 12 functional groups)
- Maps design system compliance (ratchet violations, surface assignments)
- Maps design governance (constitution, ARB triggers, component graduation status)
- Built from: the Design Intelligence Master + Design Executive Kernel
- Freshness: updated per major audit cycle
- Authority: the Design Executive Kernel for governance; the Design Intelligence Master for findings

**Operational Intelligence** answers: *What is running, what is failing, and what will fail next?*
- Maps deployment topology (Workers, Queues, Cron, serverless functions)
- Maps emission points for runtime signals
- Maps incident response chains (root cause → rollback → owner → recovery)
- Maps production readiness verdicts per domain
- Built from: infrastructure graph (`pnpm graph:infra`) + operational manifests
- Freshness: as of last `pnpm graph:omega` run; live values sourced from telemetry adapters (NOT CONNECTED until adapters are configured)
- Authority: live telemetry infrastructure for metric values; LCIS for topology + emission points

**Decision Intelligence** answers: *What should be done next and why?*
- Ranks platform blockers by severity and blast radius
- Surfaces what blocks launch, what blocks scale, what blocks the next milestone
- Maps fix plans (fix + verify + test + rollback for each blocker)
- Built from: all other intelligence types synthesised
- Freshness: as of last `pnpm graph:omega` run; recomputed from current structural state
- Authority: LCIS is authoritative for ranked structural blockers; human judgment required for product trade-offs

**Knowledge Intelligence** answers: *What does the platform know about itself and how is it organised?*
- Maps the kernel hierarchy (Platform → Domain → Master → Runtime)
- Maps the registry system
- Maps the intelligence lifecycle
- Maps how AI agents are expected to consume knowledge
- Built from: this document + registry contents
- Freshness: updated when the LCIS architecture changes
- Authority: this document (LCIS Architecture Kernel)

### 3.2 How Intelligence Types Interact

Intelligence types share a common substrate (the code and database graph) but operate at different abstraction levels. Their interactions create emergent capabilities:

**Blast radius** = Architectural Intelligence + Domain Intelligence. A code symbol's blast radius is computed from the structural dependency graph, then enriched by domain membership to express the business domains affected.

**Production readiness** = Domain Intelligence + Operational Intelligence + Security Intelligence. A domain is production-ready when its structural scope is complete (domain), its critical paths are observable (operational), and its security posture is compliant (security).

**What to fix next** = Decision Intelligence synthesising inputs from all six other types. The ranking accounts for: structural blast radius, business domain criticality, security severity, operational risk, and engineering effort.

**Incident response** = Operational Intelligence + Architectural Intelligence + Domain Intelligence. An incident in the payment domain triggers: what is failing (operational), what is structurally related (architectural), who owns it (domain), and how to recover (operational).

---

## PART 4: TRUTH MODEL

### 4.1 Source of Truth Hierarchy

When two sources of truth disagree, the hierarchy below resolves the conflict. Lower numbers win.

```
1. Deterministic validators (107-gate) — authoritative for compliance verdicts
2. Code graph / DB graph — authoritative for structural relationships
3. Canonical ledger (Postgres RPCs) — authoritative for financial state
4. Kernel layer documents — authoritative for platform governance law
5. ARB decision records — authoritative for architectural precedents
6. Domain registry — authoritative for domain boundaries
7. Master layer documents — authoritative for domain understanding
8. Runtime layer (generated) — authoritative for current structural state
9. Evidence layer (audits, reports) — authoritative for point-in-time state
10. Heuristic intelligence findings — candidates, not verdicts
```

**The validator gate is constitutional.** A finding that contradicts a validator gate result is wrong. The 107 deterministic validators are the ground truth for compliance. Heuristic findings from AI agents are candidates that must be validated against the gate.

**The code is the ground truth for implementation.** A kernel or master document that describes a pattern that does not exist in the code is aspirational, not descriptive. The distinction must be made explicit: governance documents describe law (what must be true) while runtime intelligence describes state (what is true).

**Live values are sourced or absent.** A metric value reported by LCIS is either:
- Real — sourced from a connected telemetry adapter with the adapter identified
- NOT CONNECTED — the topology is mapped but the live data source is not providing values; the exact source (environment variable, API endpoint, telemetry adapter) is named

There is no third state. Estimated, simulated, mocked, or fabricated values are prohibited.

### 4.2 Conflict Resolution Protocol

When a conflict between intelligence sources is detected:

1. Identify the layer of each conflicting source (kernel vs. master, registry vs. runtime, etc.)
2. Apply the truth hierarchy — the lower-numbered source wins
3. If the winning source appears wrong (e.g., the code has changed since the registry was updated), the registry must be updated — not the code
4. Surface the conflict in the Evidence layer as a gap finding
5. Update the losing source to align with the winning source

**Special case: code contradicts a kernel.** If the current code implements a pattern that contradicts a kernel (e.g., code performs a direct table write to a money table, which the Platform Kernel prohibits), the code is wrong. The kernel is not updated to reflect the violation — the violation is flagged as a compliance issue and the code is corrected.

**Special case: kernel contradicts ARB decision.** The ARB decision record is the higher authority within the kernel layer. If a kernel statement contradicts an ARB decision, the ARB decision was either (a) made after the kernel was written, in which case the kernel must be updated, or (b) made before the kernel was written, in which case the kernel should not have been written that way and must be corrected.

### 4.3 Versioning

**Kernel documents** carry a version number and a `superseded_by` field. Version 1.0 is the initial publication. A kernel is versioned when platform law changes — not when the audit landscape changes. Version increments require an ARB decision.

**Master documents** carry a timestamp and a list of source investigations. Masters are updated in place when new investigations materially change domain understanding. Old versions are preserved in the evidence layer as historical records.

**Registry entries** carry creation date, last-modified date, and the author (human or agent) of the last modification. Superseded registry entries are marked superseded but not deleted.

**Evidence documents** are append-only. They are never modified after creation. Their file names include a timestamp. They accumulate over time as a historical record of what the platform discovered about itself and when.

**Runtime intelligence** is not versioned — it reflects current state. The timestamp of the last build is the only version marker that matters.

### 4.4 Historical Preservation

Evidence documents and superseded registry entries are never deleted. The purpose of preservation is:

1. **Traceability** — understanding why a decision was made requires understanding what was known at the time
2. **Regression detection** — comparing current findings to historical findings reveals when a problem was introduced
3. **Audit compliance** — external security and compliance audits may require evidence of what the platform knew and when
4. **Knowledge archaeology** — when a new engineer or agent needs to understand a long-standing architectural decision, the evidence trail explains the path

Historical documents are stored under `docs/archive/` when they represent deprecated patterns. Evidence documents are stored under `docs/central-intelligence/` with generation timestamps.

---

## PART 5: AI CONSUMPTION MODEL

### 5.1 The Consumption Contract

Every AI agent operating in this ecosystem enters into a consumption contract with LCIS. The contract has three obligations:

**Obligation 1: Read before acting.** Before modifying any code, the agent must consult the kernel layer for the domain being modified. Before modifying any shared system, the agent must query LCIS for blast radius.

**Obligation 2: Query before scanning.** Before performing a repository scan (grep, find, file reads across the codebase), the agent must attempt to answer the question through an LCIS query. Repository scanning is the fallback, not the default.

**Obligation 3: Surface not act.** When LCIS reveals a risk, conflict, or prohibited pattern, the agent surfaces it to the user rather than acting on it autonomously. Consequential decisions — touching money, security, cross-domain contracts, or production systems — require human confirmation.

### 5.2 Required Reading Order

Every AI agent must consult knowledge artifacts in this order before beginning substantive work:

```
1. Platform Executive Kernel
   docs/central-intelligence/platform/LETBUYY_PLATFORM_EXECUTIVE_KERNEL.md
   Why: Platform law governs all other decisions.

2. LCIS Architecture Kernel [this document]
   docs/central-intelligence/lcis/LCIS_ARCHITECTURE_KERNEL.md
   Why: Defines how to use the intelligence system itself.

3. Domain Executive Kernel (for the relevant domain)
   docs/central-intelligence/design/DESIGN_EXECUTIVE_KERNEL.md  [Design]
   docs/central-intelligence/{domain}/...                        [others when created]
   Why: Domain law governs domain-specific decisions.

4. LCIS Runtime Query (for current state)
   curl "localhost:3333/api/workspace?domain=<domain>"
   Why: Current state may differ from documented state.

5. Repository code (only when LCIS cannot answer)
   Why: The code is the implementation; kernels are the law.
```

### 5.3 Query Protocol

The LCIS query protocol governs how agents retrieve information before taking action. Each query type answers a different class of question.

**Before changing any shared symbol:**
```
curl "localhost:3333/api/blast?q=<symbol>"
```
Returns: blast radius (files, domains, merchants, RPCs, tables, workers affected)

**To understand a domain:**
```
curl "localhost:3333/api/workspace?domain=<key>"
```
Returns: 16-perspective workspace (explain, technical, database, API, security, operations, impact, trace, related, AI pack)

**To answer a natural-language question:**
```
curl "localhost:3333/api/search-v2?q=<question>"
```
Returns: semantic answer from the domain knowledge graph

**To understand cross-domain impact:**
```
curl "localhost:3333/api/cross-domain?key=<domain>"
```
Returns: what domains depend on this domain, what domains this domain depends on

**To find the owner of a capability:**
```
curl "localhost:3333/api/owner?q=<capability>"
```
Returns: owner team/person from CODEOWNERS + domain ownership registry

**To trace a request through the system:**
```
curl "localhost:3333/api/trace?entity=<entity>"
```
Returns: full trace (route → RPC → tables → policies → triggers → queues → emails → analytics)

**To check production readiness:**
```
curl "localhost:3333/api/production-readiness-v2"
```
Returns: structural readiness per domain + blockers + launch verdict

**To get a complete AI context pack:**
```
curl "localhost:3333/api/ai-context-pack?target=claude"
```
Returns: self-contained context pack (<20k tokens) for the requesting agent type

### 5.4 Decision Protocol

When an AI agent must make an architectural decision, the following protocol applies:

1. **Check if the decision is already made.** Query `localhost:3333/api/memory-v2?mode=rule&q=<decision>` to check if an ARB decision or authoritative record already answers the question. If yes, apply the recorded decision. Do not re-derive.

2. **Check if the decision is prohibited.** Consult the Platform Executive Kernel Part 9 (Authoritative Decisions: Prohibited). If the proposed approach is prohibited, surface the prohibition and propose an alternative that is not prohibited.

3. **Check blast radius.** Before committing to an approach, query blast radius. If the blast radius is unexpectedly large, surface it to the user before proceeding.

4. **Apply the law.** Apply the relevant kernel law (Platform → Domain → LCIS). Kernel law is not optional — it is not balanced against implementation convenience.

5. **If no kernel law applies,** apply the closest architectural precedent from the ARB decision registry. If no precedent exists, surface the decision to the user with a recommendation.

### 5.5 Escalation Protocol

Escalate to human review (do not proceed autonomously) when:

- The proposed action contradicts a kernel or ARB decision and no prior exception has been documented
- The blast radius of a change affects more than 20 files or more than 3 domains
- The change touches the canonical payment ledger, authentication system, or RLS policies
- The change involves a secret, a production credential, or a database migration
- The LCIS query returns conflicting information from different sources
- The agent has insufficient confidence about which kernel law applies

Escalation format:
```
ESCALATION REQUIRED
Action: [what the agent was about to do]
Conflict: [what kernel/law/decision creates the conflict]
Blast radius: [what is affected]
Recommendation: [what the agent would do if proceeding]
Requires: [ARB decision / human confirmation / exception documentation]
```

---

## PART 6: LCIS GOVERNANCE

### 6.1 Ownership

LCIS is owned by the platform architecture function. Ownership responsibilities:

- Maintaining the accuracy of the knowledge hierarchy (kernels, masters, registries)
- Ensuring the runtime intelligence build pipeline (`pnpm graph:*`) remains functional after infrastructure changes
- Reviewing all new kernel documents and all updates to existing kernels
- Maintaining the LCIS query API and ensuring it accurately serves the runtime intelligence
- Enforcing the NOT CONNECTED law (no fabricated live values)
- Evolving the intelligence creation protocol as the platform matures

### 6.2 Intelligence Lifecycle

A piece of LCIS intelligence passes through four lifecycle stages:

**Generated** — produced by automated processes (`pnpm graph:*`, audit runs). No human review required. Accuracy is bounded by the quality of the source.

**Validated** — reviewed by a domain lead or platform architect. The human confirms that the generated intelligence reflects their understanding of the domain. Validated intelligence is promoted to the evidence layer.

**Synthesised** — combined with other validated intelligence by a master document. Synthesis requires human judgment about which findings are permanent and which are transient.

**Canonised** — extracted from synthesis into a kernel. Canonised intelligence is platform law and requires ARB sign-off for modification.

### 6.3 Mutation Controls

| Layer | Who can mutate | Process | Reversible? |
|-------|----------------|---------|-------------|
| Kernel | Platform architects with ARB | Version increment + ARB decision record | Yes, via counter-version |
| Master | Domain lead + intelligence engineer | Updated in place; prior version archived | Yes, via evidence trail |
| Registry | Domain lead | Governed process per registry type | Yes, supersession |
| Evidence | Automated systems only | Append-only; no mutation | No (historical record) |
| Runtime | Automatic rebuild | `pnpm graph:*` command | N/A (rebuilt from source) |

### 6.4 Knowledge Generation Standards

Every piece of knowledge generated for LCIS must meet the following standards before it enters the registry or higher layers:

**Accuracy standard:** the knowledge must be derived from the actual state of the system, not from memory, inference, or assumption. Claims about code must be backed by the code. Claims about data must be backed by the database graph.

**Attribution standard:** the source of every knowledge claim must be traceable. "The payment domain has 6 canonical RPCs" must be traceable to the DB graph output. "The design ratchet has 847 baseline violations" must be traceable to the validator gate output.

**Honesty standard:** the knowledge must not overstate certainty. Heuristic findings (from AI agents) are candidates. Deterministic findings (from the validator gate) are verdicts. The distinction must be explicit. Live metric values must be sourced or absent — never estimated.

**Stability standard:** knowledge entering the kernel layer must be stable: true regardless of current audit findings, true regardless of current codebase state, true for the platform's architectural intent. Transient findings (this file has 27 violations today) belong in evidence, not kernels.

### 6.5 Knowledge Retirement

Knowledge is retired when it is no longer accurate and cannot be updated to remain accurate.

**Retired kernels** — a kernel is retired when the domain it describes no longer exists or has been completely restructured. The kernel is marked `stability: RETIRED` and moved to `docs/archive/`. It is never deleted.

**Retired masters** — a master is retired when a new master supersedes it. The new master references the old one as `supersedes: <filename>`. The old master is moved to `docs/archive/`.

**Retired registry entries** — a registry entry is marked `status: superseded` with a reference to the superseding entry. The entry remains in the registry as a historical record.

Evidence documents are never retired — they are historical records by definition.

---

## PART 7: REGISTRY SYSTEM

### 7.1 The Role of Registries

Registries are the structured layer between generated runtime intelligence and human-synthesised master documents. A registry entry represents a human decision about the meaning or status of something the runtime intelligence discovered. Registries are semi-stable: they change when platform decisions change, not when code changes.

Each registry answers a different class of question about the platform's current authoritative state.

### 7.2 Decision Registry

**What it contains:** Architectural Decision Records (ADRs). Every ARB decision that has been reviewed and approved.

**What each entry contains:** Decision ID, date, decision statement, context (what prompted the decision), consequences (what changes as a result), status (active/superseded/retired), superseded_by reference (if applicable).

**How it is used:** AI agents and engineers query the decision registry before making architectural choices. A decision registry hit means the question has been answered — the answer is applied, not re-derived.

**Mutation:** New entries are added after ARB approval. Existing entries are superseded when later ARB decisions overturn them. Entries are never deleted.

**Authority:** The decision registry is authoritative for architectural precedents within its domain. When a decision registry entry conflicts with a kernel, the kernel takes precedence (the kernel was presumably written with the decision in mind — if not, the kernel needs updating).

### 7.3 Domain Registry

**What it contains:** The authoritative definition of every platform domain — its purpose, boundaries, responsibilities, forbidden responsibilities, ownership, and dependency contracts.

**What each entry contains:** Domain key, display name, purpose statement, boundaries (what the domain owns), responsibilities (what the domain does), forbidden responsibilities (what the domain must never do), owner, upstream dependencies (domains this domain depends on), downstream consumers (domains that depend on this domain), status (active/reserved/frozen/retired).

**How it is used:** When a capability's domain is disputed, the domain registry resolves the dispute. When a new capability is being built, the domain registry determines which domain should own it. When blast radius is computed, the domain registry maps structural dependencies to business domains.

**Mutation:** New domain entries are added via ARB. Boundary changes to existing domains require ARB. Status changes require ARB. Owner changes require domain lead sign-off.

### 7.4 Component Registry

**What it contains:** Every component in `@letbuyy/ui`, its graduation status, its governance tier, and its consumers.

**What each entry contains:** Component name, package export, functional group, governance tier (Layer 1 or candidate), graduation date (if Layer 1), consumer apps, deprecated aliases, migration codemod (if applicable), status (active/deprecated/retired).

**How it is used:** When an AI agent or engineer asks "does @letbuyy/ui have a component for X", the component registry answers before the source code is checked. When a Layer 2 app component is being evaluated for graduation to Layer 1, the registry tracks its candidacy.

**Mutation:** New entries added on graduation to @letbuyy/ui. Deprecation status updated when a deprecation cycle begins. Codemods linked when they become available.

### 7.5 Service Registry

**What it contains:** Every runtime service in the canonical runtime map — its role, its status (active/reserved/frozen), its owner, its dependencies, and its deployment characteristics.

**What each entry contains:** Service identifier, display name, canonical path, role, status, owner, upstream dependencies, deployment target, environment variable requirements, health check endpoint (if applicable).

**How it is used:** When an agent is modifying code and needs to understand what services its change affects, the service registry provides the topology. When a new service is being designed, the service registry defines the naming and classification standards it must follow.

**Mutation:** New entries are added via ARB (service boundary changes are architectural). Status changes require ARB. Owner changes require platform lead sign-off.

### 7.6 Security Registry

**What it contains:** The authoritative map of security controls — authentication boundaries, RLS policies, webhook signing configurations, secret distribution, and attack surface classifications.

**What each entry contains:** Control type (auth/RLS/signing/secret), control name, domain scope, implementation location, validation mechanism (which validator enforces it), last verified date, risk level if absent, status.

**How it is used:** When a security review is performed, the security registry is the checklist. When a new feature crosses a security boundary, the registry defines what controls must be present. When an audit finding is reviewed, the registry determines whether the finding represents a new control gap or a known drift.

**Mutation:** New entries when new security controls are implemented. Updates when control implementation locations change. Gaps added when audits reveal missing controls.

### 7.7 Design Registry

**What it contains:** The authoritative state of the design system — active tokens, deprecated tokens, ratchet baselines, surface assignments, and component governance status.

**What each entry contains (tokens):** Token name, tier (primitive/semantic/component/density), purpose, Tailwind alias (if applicable), deprecation status, replacement (if deprecated), codemod (if deprecated).

**What each entry contains (ratchet):** Category name, current baseline, last-modified date, direction (decreasing/stable), next milestone target.

**How it is used:** When an AI agent is making UI changes, the design registry provides the canonical token reference without requiring a read of `tokens.ts`. When a new token is proposed, the registry determines if a suitable token already exists.

**Mutation:** Token entries added or deprecated via ARB. Ratchet baselines updated after successful migration runs (direction: decreasing only).

---

## PART 8: INTELLIGENCE CREATION

### 8.1 The Intelligence Creation Pipeline

Intelligence in LCIS follows a deterministic creation pipeline. Each stage produces an artifact. Each artifact feeds the next stage.

```
[1] Raw discovery
    pnpm graph:* commands
    Code graph, DB graph, domain graph
    Output: graphify-out/ (gitignored, generated)

[2] Evidence generation
    Automated auditors + validation gate
    Compliance reports, gap analyses, certifications
    Output: docs/central-intelligence/*.generated.md + certifications

[3] Investigation
    Multi-agent parallel research
    Domain investigation across multiple dimensions
    Output: docs/{domain}-research/ or docs/{domain}-intelligence/

[4] Synthesis
    Single synthesis agent or human synthesis
    Combines investigation outputs into coherent master
    Output: docs/{domain-intelligence}/MASTER.md (or equivalent)

[5] Kernel extraction
    Human extraction of permanent truths from master
    Only stable, technology-agnostic, governance-relevant content
    Output: docs/central-intelligence/{domain}/KERNEL.md

[6] Runtime serving
    pnpm graph:* + API server at localhost:3333
    Serves all layers through query API
    Output: live API responses
```

### 8.2 How Investigations Occur

An investigation is a structured multi-agent research process that produces a comprehensive understanding of a platform domain. Investigations are triggered when:

- A new domain is being added to the platform
- A domain has changed significantly since its last investigation
- An ARB decision requires deep understanding of a domain before a cross-domain change is made
- A security or compliance audit requires domain-level evidence

**Investigation structure:**
1. **Scope definition** — define the investigation dimensions (structural, security, compliance, operational, design, cross-domain dependencies)
2. **Parallel research** — multiple specialized agents investigate different dimensions simultaneously
3. **Evidence collection** — each agent produces an evidence document with specific findings, each finding traceable to its source
4. **Synthesis** — a synthesis agent combines evidence documents into a coherent master document; contradictions are explicitly noted
5. **Review** — domain lead reviews the master for accuracy; platform architect reviews for cross-domain consistency

Investigation artifacts enter the Evidence layer. The Master produced by synthesis enters the Master layer.

### 8.3 How Audits Occur

Audits are automated processes that verify compliance against known standards. They produce findings — not decisions. Findings are candidates for remediation, verified by the deterministic validator gate.

**Two audit types:**

**Deterministic audits** — the 107-validator gate. These run on every relevant change (topology, import, governance). They produce binary verdicts (pass/fail). Their findings are authoritative. A deterministic audit finding is not a candidate — it is a compliance violation that must be corrected before merge.

**Heuristic audits** — AI agent-driven pattern detection. These run on a schedule (PR-level for security, weekly for broader patterns). They produce candidate findings — patterns that appear to be violations but require human review to confirm. Heuristic findings enter the Evidence layer as candidates, not verdicts.

Audit certificates (LCIS_V*_CERTIFICATION.md, LCIS_OMEGA_CERTIFICATION.md) are the point-in-time records of the platform's compliance posture at a specific audit run. They are appended to the Evidence layer and never modified.

### 8.4 How Kernels Are Created

A kernel is created through the following process:

1. **Prerequisite: a master must exist.** A kernel is extracted from a master, not invented from scratch. If no master exists for a domain, the master is created first.

2. **Extraction criteria.** Extract only knowledge that meets all three tests:
   - *Stable* — true regardless of current codebase state (no specific file counts, violation counts, or audit scores)
   - *Permanent* — true even if the underlying technology changes (no framework-specific implementation details unless the framework choice is itself a permanent platform decision)
   - *Governance-relevant* — tells an agent or engineer what they must do, must not do, or should do when working in this domain

3. **Format.** Kernels follow the structure defined in this document (Part 2.1). They include a parent reference to the Platform Executive Kernel (or their direct parent kernel). They include a frontmatter stability declaration.

4. **Review.** The kernel draft is reviewed by: (a) the domain lead for accuracy, (b) a platform architect for consistency with the Platform Executive Kernel, (c) an ARB reviewer if the kernel introduces new governance rules.

5. **Publication.** The kernel is published to `docs/central-intelligence/{domain}/` with the naming convention `{DOMAIN}_EXECUTIVE_KERNEL.md`.

### 8.5 How Masters Are Created and Updated

A master document is the comprehensive record of what is known about a domain. It includes everything that investigations have produced — including findings that are transient (current audit scores, current violation counts, current readiness percentages).

Master creation follows the same investigation pipeline (Part 8.2). Master updates occur when:

- A new investigation reveals materially new findings
- A platform change significantly alters the domain's structure or boundaries
- The domain lead determines that the current master no longer accurately represents the domain

When a master is updated, the previous master is archived in `docs/archive/` with a timestamp. The new master references the archived version in its frontmatter.

### 8.6 How Runtime Intelligence Is Generated

Runtime intelligence is generated by the `pnpm graph:*` command family. Each command rebuilds a specific intelligence type from the current state of the codebase and database.

```
pnpm graph:db      → database graph (tables, RPCs, policies, triggers, indexes)
pnpm graph:infra   → infrastructure graph (workers, queues, secrets, deployments)
pnpm graph:domain  → domain graph (22 domains, cross-domain edges)
pnpm graph:v3      → db + infra + domain + reports
pnpm graph:v4      → v3 + runtime + memory + execution
pnpm graph:v5      → v4 + live operating intelligence
pnpm graph:omega   → all layers (the full rebuild command)
```

Generated outputs are stored in `graphify-out/` (gitignored). They are consumed by the LCIS API server (`localhost:3333`) which serves all intelligence types through the `/api/*` query interface.

The runtime layer must be rebuilt after:
- Database schema migrations
- New service or worker additions
- Significant code changes that affect cross-domain dependencies
- Infrastructure configuration changes

The runtime layer is not automatically rebuilt. It is rebuilt on demand by the engineering team or by CI when configured to do so.

---

## PART 9: AUTHORITATIVE DECISIONS

### 9.1 ACCEPTED — Correct Patterns That Must Continue

**Knowledge architecture:**
- The five-layer knowledge hierarchy (Kernel → Master → Registry → Evidence → Runtime) is the canonical structure. Domain-specific knowledge systems must fit within this hierarchy, not parallel it.
- The NOT CONNECTED law is permanent. No LCIS layer, at any time, fabricates live metric values.
- Kernels inherit from the Platform Executive Kernel. No kernel may contradict the Platform Kernel without an explicit ARB-approved exception.
- Evidence documents are append-only. Historical intelligence records are never modified or deleted.

**AI consumption model:**
- The read-before-acting obligation is permanent. No AI agent may modify code in this repository without having consulted the relevant kernel.
- The query-before-scanning obligation is permanent. LCIS queries are the first resort; repository scanning is the last resort.
- The surface-not-act obligation for consequential decisions is permanent. AI agents surface risks and recommendations; humans make decisions that cross security, money, or architectural boundaries.

**Registry system:**
- Every domain must have a domain registry entry before any code is written for that domain.
- Every ARB decision must have a decision registry entry before the decision is implemented.
- Ratchet baselines may only decrease. The design registry tracks this direction as constitutional law.

**Intelligence creation:**
- Heuristic findings are candidates; deterministic findings are verdicts. The distinction must be explicit in every intelligence artifact.
- Investigations precede kernel creation. A kernel may not be created without an underlying master; a master may not be created without investigation evidence.

### 9.2 REQUIRED — Mandatory Patterns

- Running `pnpm graph:omega` (or the appropriate subcommand) after any change that affects structural relationships, domain boundaries, or infrastructure topology.
- Querying `localhost:3333/api/blast?q=<symbol>` before modifying any symbol with cross-domain blast radius.
- Including a `parent:` frontmatter reference in every domain kernel pointing to its parent in the kernel hierarchy.
- Including a `stability:` declaration in every kernel document.
- Archiving superseded masters before publishing updated versions.
- Including the generation timestamp in every evidence layer artifact.
- Distinguishing between "connected" and "NOT CONNECTED" in every intelligence artifact that references live values.

### 9.3 FORBIDDEN — Patterns Prohibited Without Exception

- Fabricating live metric values in any LCIS layer. If a value is not connected, it is NOT CONNECTED.
- Creating a kernel without a corresponding master as its evidence base.
- Deleting evidence layer documents (they are historical records).
- Increasing a ratchet baseline (direction is constitutionally decreasing).
- Creating a domain registry entry that overlaps with an existing domain's defined responsibilities without an ARB decision.
- Serving LCIS intelligence that has not been rebuilt since a significant structural change without flagging the staleness.
- Treating heuristic audit findings as verdicts without deterministic validator confirmation.

### 9.4 FUTURE DIRECTION

LCIS will evolve. The evolution is constrained by the permanent truths above but enabled in the following directions:

**Live adapter connectivity.** The current state is structural topology fully connected, live values mostly NOT CONNECTED. The evolution direction is: connect each NOT CONNECTED signal to its authoritative source, one adapter at a time. Priority: payment telemetry → queue health → worker health → deployment versions.

**Domain kernel completion.** The current state is one domain kernel (Design) and one platform kernel. The evolution direction is: one kernel per active domain, in this priority order: Identity → Merchant → Storefront → Payments → Operations → Security → Infrastructure.

**Query API standardisation.** The LCIS query API (`/api/*`) is the interface through which all agents consume intelligence. The evolution direction is: every intelligence type queryable through a consistent, documented, versioned API. No agent should need to read raw files when an API exists.

**Bidirectional traceability.** Every requirement in a kernel should be traceable to its evidence in a master; every finding in a master should be traceable to its source in the runtime or evidence layer. The evolution direction is: make this traceability automatic, not manual.

**Intelligence freshness signals.** An agent querying LCIS should know how stale the intelligence is. The evolution direction is: every LCIS API response includes the timestamp of the last rebuild and a staleness warning if significant structural changes have occurred since the rebuild.

---

### Closing Statement

LCIS exists because a platform that can only be understood by its original architects is a platform with a single point of failure. The intelligence system is the mechanism by which platform knowledge is externalised, structured, and made queryable — so that any engineer, any AI agent, and any future architect can understand the platform without needing to hold its entire structure in memory.

The architecture of this intelligence system is as important as the architecture of the platform it describes. An intelligence system that fabricates values, that tolerates undefined boundaries, that allows agents to act without consulting established law, is not an intelligence system — it is a liability.

The principles encoded in this document are the result of that understanding.

---

*Parent document: `docs/central-intelligence/platform/LETBUYY_PLATFORM_EXECUTIVE_KERNEL.md`*
*Generated domain kernels must reference this document as their intelligence architecture layer.*
*When this document must change, increment the version, record an ARB decision, and update all domain kernels that reference it.*
