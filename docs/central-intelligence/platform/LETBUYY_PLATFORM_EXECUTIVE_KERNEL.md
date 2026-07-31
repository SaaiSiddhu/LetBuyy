---
title: LetBuyy Platform Executive Kernel
version: 1.0
created: 2026-06-19
stability: CONSTITUTIONAL — superseded only by explicit version increment
authority: Supreme platform law; all domain kernels inherit from this document
consumed_by: AI agents, architects, engineers, founders, domain leads, future contributors
---

# LetBuyy Platform Executive Kernel

*The supreme constitutional layer for the LetBuyy Commerce Operating System. Every domain kernel, every architectural decision, every AI agent operating in this ecosystem inherits from this document. Read this before any other knowledge artifact.*

---

## PART 1: PLATFORM IDENTITY

### 1.1 What LetBuyy Is

LetBuyy is a **Commerce Operating System for Indian merchants**.

Not a SaaS product. Not a website builder. Not a payment processor. Not a theme marketplace.

An operating system: a platform that provides foundational capabilities — identity, commerce, payments, logistics, intelligence — on which merchants build their businesses and on which developers and partners build extensions. Every capability the platform provides is a primitive that merchants configure and combine, not a finished product they consume passively.

The platform serves four constituencies simultaneously:

**Merchants** — independent business owners across Tier 1, 2, and 3 India who need a complete commerce infrastructure without an engineering team. Their primary device is an Android phone. Their primary currency is the Indian Rupee. Their primary concern is sales, not software. The platform must be invisible to them: when it works, they see their business grow; when it fails, they see their business stop.

**Shoppers** — customers of merchant stores who may have no awareness of LetBuyy. Their relationship is with the merchant's brand, not the platform's. The storefront they visit is owned by the merchant. The trust they extend is to the merchant. The platform's obligation to shoppers is reliability, security, and commerce correctness — not brand presence.

**Operators** — the LetBuyy team members who manage platform health: onboarding merchants, resolving disputes, monitoring risk, enforcing compliance. They need visibility across all tenants simultaneously and authority to intervene at any layer of the stack. Their tools are internal, not customer-facing, and their requirements are diametrically opposite to merchant requirements: maximum information density, cross-tenant access, and audit trails.

**Developers and partners** — the ecosystem that extends the platform's reach: app developers publishing to the marketplace, theme creators publishing to the theme catalogue, logistics and payment partners integrating via APIs. Their relationship with the platform is one of contract: defined APIs, stable webhooks, predictable versioning, and developer-grade documentation.

### 1.2 What LetBuyy Is Not

**Not a monolith masquerading as a platform.** LetBuyy is architected as a system of sovereign domains with explicit boundaries and governed contracts. No single domain contains all commerce logic. No single team owns the entire system.

**Not India-adapted.** India-first. GST is not an afterthought added to a global tax system. INR is not a currency adapter bolted onto a USD-centric ledger. COD is not an edge case — it is a primary commerce modality. WhatsApp is not a notification channel — it is the primary communication channel for Indian commerce. These are structural choices, not configuration options.

**Not a feature factory.** The platform creates compounding value through depth of capability in core domains, not breadth of superficially implemented features. A merchant with complete inventory, payments, GST, and logistics capabilities on LetBuyy is more powerful than a merchant with twenty half-built features.

**Not disposable infrastructure.** The platform carries real merchant transactions, real customer payment data, and real business records. Decisions made in the platform's architecture have direct consequences for merchant livelihoods. Engineering carelessness is not a technical debt — it is a business failure for real people.

### 1.3 The Core Mission

**Make Indian merchants competitive.**

A merchant on LetBuyy should have access to the same operational infrastructure as the largest e-commerce brands — payments, inventory, analytics, customer data, marketing automation, fulfilment coordination — without requiring a CTO, a DevOps team, or enterprise software contracts.

### 1.4 The Platform Vision

LetBuyy becomes the default infrastructure layer for Indian commerce, the way AWS became default infrastructure for software. Merchants build on LetBuyy not because they have no choice, but because building on LetBuyy gives them capabilities they could not build themselves — and because the platform's intelligence layer makes their businesses smarter over time without requiring them to become data scientists.

---

## PART 2: PLATFORM CONSTITUTION

These principles are permanent. They do not change with technology choices, funding rounds, team changes, or market conditions. Every architectural decision, feature decision, and platform evolution is measured against these principles. When a decision conflicts with a principle, the decision changes — not the principle.

### Principle 1: Merchant-First

Every platform decision is measured by its effect on merchant outcomes. Not engineering elegance. Not operational convenience. Not investor metrics. Merchant outcomes.

This means: a technically elegant solution that makes merchant onboarding harder is the wrong solution. A technically imperfect solution that makes merchant operations more reliable is the right solution. Platform team convenience never outweighs merchant experience. Operational shortcuts that increase merchant risk are prohibited regardless of their short-term benefit to the platform.

Merchant-first is not a sentiment. It is a decision filter applied before any change to the platform.

### Principle 2: Platform Before Features

The platform's infrastructure — its identity system, its payment ledger, its multi-tenancy model, its observability layer — is more important than any individual feature built on top of it. A new feature built on a weak platform compounds the platform's weakness. A new feature built on a strong platform inherits the platform's strength.

When resources are constrained, platform depth takes priority over feature breadth. One deeply correct payment reconciliation system is worth more than ten partially correct commerce features.

### Principle 3: India-Native by Architecture

India is not a market segment. India is the design constraint from which the platform's architecture derives.

Concrete consequences: all monetary amounts are stored in the minor denomination (paise, not rupees) as big integers — never as floating-point, never as decimal. GST computation is server-authoritative and invoice-immutable. COD is a first-class payment modality, not an edge case in a Razorpay wrapper. The canonical locale is `en-IN`. The canonical breakpoint is 360px (the smallest Android device in active use in Tier 3 India). WhatsApp commerce is a primary channel, not a plugin.

Any platform capability that requires a merchant to think in US-centric commerce terms has failed this principle.

### Principle 4: Security by Architecture

Security is not a feature added to the platform. It is a structural property of the platform's design.

The consequences of this principle are not optional: tenant isolation is enforced at the database layer via Row Level Security on every tenant table — never trusted to application-layer logic alone. Authentication tokens from different issuers are never interchangeable — merchant sessions and customer sessions are structurally separate. Money mutations occur exclusively through security-defined database procedures — never through direct table writes from application code. Webhooks and queue messages carry HMAC signatures — never trusted by their presence in a queue alone.

Security failures in this platform have direct consequences for merchant livelihoods and customer financial safety. This is not theoretical risk.

### Principle 5: Money Is Sacred

The payment ledger is the single most critical system in the platform. Every rupee that flows through LetBuyy — from a customer payment through to a merchant payout — must be traceable, idempotent, and immutable.

Money amounts are never computed on the client. They are never trusted from request parameters. They are computed server-side from database state by security-defined procedures that cannot be bypassed by application code. Every money operation carries an idempotency key. Every balance has a CHECK constraint that prevents it from going negative. Gift card balances are ledger projections — never mutable decrements.

The canonical ledger is the source of truth. Nothing else is.

### Principle 6: Multi-Tenancy Is Structural

Every data entity in the platform belongs to a tenant. `site_id` is present on every tenant table. Row Level Security is active on every tenant table. There are no tenant tables with public read policies.

Multi-tenancy is not implemented as a filter in application code. It is enforced at the database layer, verified at the gateway layer, and validated by the 107-validator gate. A data access pattern that bypasses tenant isolation is a security vulnerability, not a design choice.

Tenant isolation applies to data, to compute resources, to storage, and to communication channels. Merchants cannot observe each other's data by design — not by policy.

### Principle 7: Intelligence Before Automation

The platform does not automate decisions it does not understand. Before any system is automated, it must be observable. Before any intelligent action is taken, the reason for that action must be explicable.

LCIS (the LetBuyy Central Intelligence System) is the manifestation of this principle: a queryable intelligence layer that maps every relationship in the platform — code to domain, domain to database, database to policy, policy to RLS rule — before any automation acts on that knowledge. Automation without intelligence is brittle. Intelligence without observability is dangerous.

AI systems in the platform operate under documented governance, with explicit knowledge boundaries, and with human override preserved for consequential decisions.

### Principle 8: Observability by Default

Every capability added to the platform must be observable from the moment it ships. Observability is not a phase 2 concern. A feature that cannot be monitored in production is not ready for production.

Observability means: the platform can answer "what is happening now, what failed, what will fail next, who is affected, and how to recover" for every domain at any time. LCIS is the operationalisation of this principle at the platform level.

### Principle 9: Domain Sovereignty

The platform is organised into sovereign domains. Each domain owns its data, its contracts, and its capabilities. No domain may directly read or write another domain's tables. No domain may implement another domain's business logic. Cross-domain dependencies are expressed through explicit contracts — APIs, events, RPCs — not through shared table access.

Domain boundaries are not organisational convenience. They are the mechanism by which the platform scales without becoming a distributed monolith.

### Principle 10: Configuration Before Customisation

Platform capabilities are configured, not forked. A merchant who needs a custom checkout experience configures the platform's checkout system. A theme developer who needs a custom storefront layout uses the platform's theme engine. A partner who needs custom commerce logic uses the platform's extension APIs.

When a merchant or developer need cannot be met through configuration, the answer is to extend the platform's configuration surface — not to allow arbitrary code in the platform's core. The distinction between configuration and customisation preserves platform integrity and makes merchant experiences portable.

### Principle 11: Extensibility Before Fragmentation

The platform grows by deepening its extension model, not by absorbing new capabilities directly into its core. Apps extend merchant capabilities. Themes extend storefront presentations. Webhooks extend integrations. Developer APIs extend automation.

Fragmentation — adding capabilities to the platform core that belong in the extension layer — creates maintenance burden, slows iteration, and reduces the leverage that the extension model provides to the ecosystem.

### Principle 12: Backward Compatibility as Default

The platform serves real merchants with real businesses. Breaking changes to any merchant-facing API, data contract, or configuration format have immediate business consequences. Deprecation is a process, not an event: deprecated capabilities work for a full release cycle before removal, codemechanical migration tooling is provided before deprecation is announced, and no breaking change ships without an ARB decision.

The same principle applies internally: domain contracts, API shapes, and data schemas are changed through versioned migration, not through silent modification.

---

## PART 3: PLATFORM DOMAINS

Each domain is a sovereign unit with defined purpose, clear boundaries, and explicit contracts with other domains. No domain's responsibilities overlap with another's. When a capability could belong to multiple domains, the decision of ownership is made explicitly and recorded as an architectural decision.

### Identity Domain

**Purpose:** The single source of truth for who can access what in the LetBuyy ecosystem.

**Responsibilities:** Merchant authentication (signup, login, session management, MFA), merchant authorisation (store ownership verification, role-based access within a store), customer authentication (shopper sessions on merchant storefronts), OAuth 2.0 and OIDC server for third-party app authorisation, step-up authentication for high-stakes operations (refunds, payouts, bulk actions).

**Boundaries:** Identity issues tokens and validates tokens. It does not enforce what a token-holder is allowed to do with a specific resource — that is the responsibility of the domain that owns the resource. Identity does not store business data. Identity does not know what merchants are selling or what customers are buying.

**Forbidden responsibilities:** Identity must not implement business logic for any other domain. Identity must not make decisions about payment authorisation, inventory ownership, or order access — those belong to their respective domains.

**Consumers:** Every other domain. Identity is the only domain with zero dependencies on other business domains.

### Merchant Domain

**Purpose:** The operating experience of a merchant running their business on LetBuyy.

**Responsibilities:** The merchant control plane (product management, order fulfilment, customer management, marketing, content, settings), merchant onboarding (store creation, subdomain assignment, store type configuration), billing and subscription management, merchant-facing analytics and reporting.

**Boundaries:** The Merchant domain owns everything a merchant sees and touches in `admin.letbuyy.com`. It does not own the shopper-facing storefront — that belongs to the Storefront domain. It does not own payment processing — it initiates payments through the canonical ledger but does not implement payment logic.

**Forbidden responsibilities:** Merchant must not implement its own authentication. Merchant must not write directly to money tables. Merchant must not access another tenant's data through any path.

### Storefront Domain

**Purpose:** The shopper-facing presentation of a merchant's store.

**Responsibilities:** Request routing from merchant subdomains and custom domains to the correct tenant context, rendering product catalogues and collection pages, managing the shopping cart, the checkout flow, and customer account management for shoppers. The storefront presents the merchant's brand — not LetBuyy's brand.

**Boundaries:** The Storefront domain renders content. It does not own products — the Merchant domain does. It does not process payments — the canonical ledger does. It does not own customer identity — the Identity domain does. Storefront is a presentation layer with a thin logic layer for cart management.

**Forbidden responsibilities:** Storefront must not contain LetBuyy branding visible to shoppers. Storefront must not cache or store merchant product data — it reads it in real time. Storefront must not expose any operator or merchant administrative capability to shoppers.

### Themes Domain

**Purpose:** The system by which merchants control the visual presentation of their storefronts.

**Responsibilities:** The theme engine (Liquid/React renderer), the theme registry (catalogue of available themes), theme installation and activation, theme settings and customisation, the theme editor (merchant-facing visual customisation), the preset system.

**Boundaries:** Themes control presentation. Themes do not own commerce logic. A theme change cannot affect pricing, inventory, or payment behaviour. The Liquid template system is sandboxed — it cannot execute arbitrary code or access data outside the tenant's permitted scope.

**Forbidden responsibilities:** Themes must not implement business logic that affects commerce outcomes. The Liquid sanitizer rules (FORBID lists, output escaping) are non-negotiable security boundaries — they are not configuration options.

### Apps Domain

**Purpose:** The extension ecosystem that allows third-party developers to add capabilities to merchant stores.

**Responsibilities:** The app marketplace (catalogue of published apps), app installation and permissions, the app bridge (communication layer between embedded apps and the merchant control plane), webhook delivery for app events, app billing and revenue share.

**Boundaries:** Apps extend merchant capability. Apps operate within the permissions granted to them. An app cannot exceed its declared permissions. The platform does not trust apps with platform-level credentials.

**Forbidden responsibilities:** Apps must not have access to data beyond what their declared permissions permit. Apps must not be able to impersonate other apps or the platform. Apps must not bypass the gateway API to access database resources directly.

### Developer Domain

**Purpose:** The programmatic interface for building on the LetBuyy platform.

**Responsibilities:** The public REST API, API documentation, developer authentication (API keys), rate limiting and quota management, SDK distribution, webhook event specifications, the developer portal.

**Boundaries:** The Developer domain is the published contract between the platform and external builders. Changes to Developer domain contracts require the highest level of backward compatibility discipline — developers build businesses on these APIs.

**Forbidden responsibilities:** Developer APIs must not expose internal platform infrastructure. Developer APIs must not grant access beyond what the authenticated merchant's permissions allow. Developer APIs must not provide operational or administrative capabilities that belong to the Operations domain.

### Operations Domain

**Purpose:** The internal capability for LetBuyy team members to observe, manage, and intervene in platform operations.

**Responsibilities:** The platform console (cross-tenant visibility for founders and engineering leads), the operations portal (support, CRM, merchant health for operations staff), risk monitoring, compliance escalation, audit logging, merchant intervention tooling.

**Boundaries:** Operations has read access to cross-tenant data and write access for administrative interventions. Operations tools are not accessible to merchants or shoppers. Operations tools require MFA and leave immutable audit trails.

**Forbidden responsibilities:** Operations tools must not be used to process merchant orders or payments. Operations domain capabilities must not be exposed through any merchant-facing or developer-facing API. Operations interventions that affect money must go through the canonical ledger, never through direct table writes.

### Infrastructure Domain

**Purpose:** The platform capabilities that all other domains depend on but none own individually.

**Responsibilities:** The API gateway (routing, authentication middleware, rate limiting), the queue system (async job processing, event distribution), the webhook service (outbound event delivery with HMAC signing), storage infrastructure, caching infrastructure, the email delivery system.

**Boundaries:** Infrastructure provides capabilities. It does not implement business logic. The API gateway routes requests and verifies authentication — it does not make commerce decisions. Queue workers process jobs — the jobs carry the business logic of the domain that enqueued them.

**Forbidden responsibilities:** Infrastructure must not own business data. Infrastructure must not implement domain-specific business rules. Infrastructure components must not bypass the authentication and tenant isolation contracts that protect the data they carry.

### Security Domain

**Purpose:** The cross-cutting governance of security posture across the entire platform.

**Responsibilities:** Security review processes (PR-level and weekly audit), the validator gate (107 deterministic checks run on every topology change), RLS policy governance, secret management standards, penetration testing and vulnerability management, the canonical security review workflow.

**Boundaries:** The Security domain governs security posture. It does not implement security controls in other domains — those domains implement their own controls, and the Security domain verifies them. Security is the auditor, not the executor.

**Forbidden responsibilities:** The Security domain must not make product or architecture decisions outside the security dimension. Security reviews block unsafe changes — they do not design the alternatives.

### Design Domain

**Purpose:** The visual, interaction, and component governance layer of the platform.

**Responsibilities:** The design token system (`--lb-*` namespace, ~330 CSS custom properties), the component library (`@letbuyy/ui`), the theme provider and surface system, the design ratchet validator, design governance (the Design Constitution, component graduation, token deprecation), the mobile token mirror.

**Boundaries:** The Design domain governs how the platform looks and behaves in UI. It does not own product decisions or feature scope. The design system is infrastructure — it enables product teams, it does not constrain their product decisions.

**Forbidden responsibilities:** Design must not make technology stack decisions. Design must not override domain-specific visual identity (the storefront is intentionally identity-less; the marketing site has intentional visual extensions). The design system ratchet tracks violations but does not block domain teams from building — it signals technical debt.

*Detailed governance for this domain: `docs/central-intelligence/design/DESIGN_EXECUTIVE_KERNEL.md`*

### LCIS Domain

**Purpose:** The intelligence and knowledge infrastructure of the platform.

**Responsibilities:** The code graph (Graphify — maps files, functions, and dependencies), the database graph (414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes), the domain intelligence layer (22 business domains, cross-domain edges), the operations intelligence layer (live detectors, predictors, incident timelines), the query API (`/api/search-v2`, `/api/blast`, `/api/domain`, `/api/workspace`), the AI context packs, the kernel hierarchy.

**Boundaries:** LCIS is a read layer. It observes, maps, and surfaces intelligence. It does not modify code, data, or configuration. LCIS answers questions — it does not make decisions.

**Forbidden responsibilities:** LCIS must not fabricate live data values. Where live signals are not connected, LCIS must report "NOT CONNECTED — source: [exact env var or API]". LCIS must not provide incorrect blast radius assessments — when uncertain, it must say so.

---

## PART 4: ARCHITECTURAL LAWS

These laws are non-negotiable. They are not guidelines. They are not best practices. They are the structural constraints that make the platform safe for real merchants and real money. Violating any of these laws requires an explicit ARB decision and a documented exception — not a workaround.

**Law 1: No domain bypasses Identity.**
Every request to any platform capability that involves a merchant or customer must carry a valid token issued by the Identity domain. There is no back door. There is no internal bypass. Service-to-service calls use signed service tokens — not unauthenticated direct connections.

**Law 2: No domain directly reads or writes another domain's tables.**
Domain boundaries are enforced at the data layer. If Domain A needs data owned by Domain B, it calls Domain B's API or RPC. It does not JOIN across domain tables. It does not access Domain B's tables through a shared database connection with elevated privileges.

**Law 3: Money mutations occur exclusively through security-defined procedures.**
There are no exceptions. No domain writes directly to money tables (`payment_transactions`, `refunds`, `payouts`, `gift_card_ledger_entries`, `orders`, `order_items`). All money mutations go through the canonical SECURITY DEFINER RPCs. This is enforced by the `canonical-ledger-only-validator` in CI.

**Law 4: All monetary amounts are stored in the minor denomination as big integers.**
`*_minor bigint`. Paise, not rupees. This prevents floating-point precision errors in financial calculations. The display layer converts to display format — the storage layer never does.

**Law 5: Server-authoritative amounts.**
Order totals, tax amounts, shipping costs, and discount values are computed server-side from database state by the canonical ledger RPCs. Client-submitted amounts are never trusted. Payment gateway amounts are verified by the platform against its own computation before confirmation.

**Law 6: Every money operation carries an idempotency key.**
Duplicate payment processing is a merchant trust failure. Every RPC that creates or modifies a financial record accepts an `idempotency_key` and uses `ON CONFLICT` semantics to ensure exactly-once semantics regardless of retry behaviour.

**Law 7: Row Level Security is active on every tenant table.**
No tenant table has a permissive `USING (true)` policy. No application code is trusted to filter by `site_id` without RLS enforcement. The service-role gateway accesses tenant data only after `verifySiteOwnership` has confirmed the requesting merchant's relationship to the site.

**Law 8: Two issuers, never crossed.**
Merchant sessions are signed with ES256 by the Identity platform. Customer (shopper) sessions are signed with HS256 using a separate secret. These token types are never interchangeable. No customer token grants merchant access. No merchant token grants cross-merchant access. The JWT validation layer rejects any token presented to the wrong surface.

**Law 9: No app may create its own authentication system.**
Apps within the platform — merchant-control-plane, storefront-runtime, platform-console — do not implement authentication. They delegate to the Identity domain. An application that validates passwords, issues its own JWTs, or manages its own session tokens is in violation of this law.

**Law 10: Webhooks and queue messages are HMAC-signed.**
No outbound webhook is trusted without a valid HMAC signature. No queue message is processed without a valid tenant envelope signature (`signQueueTenantEnvelope`). Replay attacks are prevented by timestamp validation on signatures.

**Law 11: GST computation is server-authoritative and invoice-immutable.**
GST amounts are computed server-side from verified merchant GST configuration. Once a GST invoice is generated for an order, it is immutable — no post-hoc modification of tax amounts is permitted under Indian tax law or platform policy.

**Law 12: No platform capability exists without observability.**
Before any feature ships to production, its critical paths must emit signals that LCIS can surface. A service that fails silently is a liability. Observability is not a future improvement — it is a shipping requirement.

**Law 13: Tenant isolation applies to all layers.**
Data isolation (RLS), compute isolation (rate limiting per tenant), storage isolation (tenant-scoped paths), communication isolation (tenant-scoped queue envelopes). A design that achieves data isolation but exposes compute resources of one tenant to another has achieved partial compliance, not compliance.

**Law 14: No private infrastructure is exposed directly to external callers.**
External callers (merchants, developers, partners, shoppers) interact with platform capabilities through the API gateway. Database connections, internal service ports, queue interfaces, and storage APIs are never exposed directly. The gateway is the single point of ingress.

**Law 15: The canonical ledger is the only source of financial truth.**
Reporting, analytics, and reconciliation are derived from the canonical ledger. No parallel financial record is maintained by any domain. If a payment gateway, a third-party integration, or an analytics pipeline disagrees with the canonical ledger, the canonical ledger is correct by definition — and the discrepancy is an incident.

**Law 16: Liquid templates execute in a sandboxed environment.**
The Liquid template engine enforces FORBID lists and output escaping. These are security boundaries protecting shoppers from merchant-delivered malicious content. They are not configurable. They are not overridable per-theme.

**Law 17: Step-up authentication gates high-stakes operations.**
Refunds, payouts, and other irreversible financial operations require a step-up token separate from the session token. A compromised session token alone cannot initiate a payout.

**Law 18: No secret is stored in the repository.**
Platform secrets (database passwords, payment provider keys, JWT signing keys, HMAC secrets) are never committed to the repository. They are injected at deploy time through the environment variable system. The validator gate enforces this.

**Law 19: The 107-validator gate runs before every merge.**
The validator gate is not optional. It is not skippable. PRs that fail the gate do not merge. The gate is the constitutional enforcement mechanism for Laws 1–18 above.

**Law 20: New app routes are gateway proxies, not local database connections.**
Applications in the platform do not connect to the database directly through new API routes. New API routes are proxies to the canonical API gateway, which enforces authentication, rate limiting, tenant isolation, and canonical business logic. Applications that need a new data capability request it through a new gateway endpoint — they do not implement it locally.

---

## PART 5: INTELLIGENCE MODEL

### 5.1 LCIS as the Platform Brain

The LetBuyy Central Intelligence System is not a monitoring dashboard. It is the platform's queryable knowledge layer — a continuously updated model of every relationship in the system, accessible through a natural language query API.

LCIS answers seven fundamental questions without a repository scan:
1. How does X work?
2. What breaks if X fails?
3. Who owns X?
4. What should be fixed next?
5. What blocks launch?
6. What is affected by a change to X?
7. How do you recover from X failing?

When LCIS can answer the question, repository scanning is unnecessary. The LCIS-first policy exists because repository scanning is slower, less complete, and more likely to miss cross-domain relationships than a graph-structured intelligence query.

### 5.2 The Knowledge Graph Layers

```
Code Graph        — files, functions, imports, exports, call chains
DB Graph          — tables, RPCs, policies, triggers, indexes, foreign keys
Domain Graph      — 22 business domains, cross-domain edges, dependency chains
Intelligence Layer — blast radius, ownership, incident response, production readiness
Operations Layer  — live detectors, predictors, incident timelines
AI Context Layer  — domain packs, kernel hierarchy, agent consumption interfaces
```

Each layer is generated from the authoritative source (code, database, analysis) and stored in `graphify-out/` (gitignored). Refresh: `pnpm graph:omega`.

### 5.3 The Kernel Hierarchy

The knowledge architecture follows a strict inheritance hierarchy:

```
Platform Executive Kernel          ← this document (supreme)
         ↓
Domain Executive Kernels           ← per-domain permanent law
  ├── Design Executive Kernel       (exists: docs/central-intelligence/design/)
  ├── Identity Domain Kernel        (future)
  ├── Merchant Domain Kernel        (future)
  ├── Storefront Domain Kernel      (future)
  ├── Payments Domain Kernel        (future)
  ├── Operations Domain Kernel      (future)
  ├── Security Domain Kernel        (future)
  └── Infrastructure Domain Kernel  (future)
         ↓
Domain Intelligence Masters        ← full investigation artifacts
  └── Design Intelligence Master    (exists: docs/design-intelligence/)
         ↓
LCIS Runtime Intelligence          ← queryable, live, generated
  └── /api/workspace, /api/blast, /api/domain, etc.
```

Each layer inherits from its parent. Domain kernels may specialise platform principles but may not contradict them. LCIS runtime intelligence reflects current state — kernels encode permanent law.

### 5.4 The Query Protocol

Before any repository scan or code inspection, consult LCIS in this order:

1. **Unified brain** → `curl localhost:3333/api/unified-intelligence`
2. **Domain context** → `curl "localhost:3333/api/domain?key=<domain>"`
3. **Blast radius** → `curl "localhost:3333/api/blast?q=<symbol>"`
4. **Semantic search** → `curl "localhost:3333/api/search-v2?q=<question>"`
5. **Change impact** → `curl "localhost:3333/api/change-impact?key=<symbol>"`

Repository scanning is the fallback, not the default.

---

## PART 6: PLATFORM GOVERNANCE

### 6.1 The Architecture Review Board (ARB)

The ARB is the decision body for changes that cross domain boundaries, modify platform contracts, or establish new architectural precedents. ARB decisions are recorded as Architectural Decision Records (ADRs). Once recorded, ARB decisions are the authoritative resolution — they are not re-litigated in code review.

**ARB approval is required for:**
- Any new domain or service boundary
- Any change to authentication token structure or issuers
- Any change to the canonical ledger RPC signatures
- Any change to RLS policy structure that modifies tenant isolation guarantees
- Any change to the public developer API shape
- Any deprecation of a platform capability used by merchants or developers
- Any new AI capability with consequential platform effects
- Any Layer 0 design token change (as defined in the Design Executive Kernel)

**Standard code review is sufficient for:**
- Implementing new capabilities within an established domain
- Migrating code to comply with existing architectural laws
- Bug fixes that do not change contracts
- Internal refactoring that preserves external behaviour

### 6.2 The Two-Lane Merge Rule

The platform maintains two active code lanes at any time. No single engineer or team controls both lanes simultaneously. This prevents a single point of failure in the review and merge process and ensures cross-domain changes receive independent review.

### 6.3 Domain Ownership

Every capability in the platform has a declared owner. Ownership means: the owning team is responsible for the capability's correctness, its observability, its security compliance, and its migration when it changes. Ownership is not optional. A capability without an owner is a platform risk.

Owner accountability includes:
- Participating in ARB reviews for cross-domain impacts on their domain
- Maintaining the domain's observability signals in LCIS
- Providing migration tooling before any capability is deprecated
- Responding to incidents in their domain within the defined SLA

### 6.4 Change Management

**Additive changes** (new capabilities, new endpoints, new configuration options) can ship through standard code review after passing the validator gate.

**Modifying changes** (changing existing behaviour, narrowing permissions, changing data structures) require explicit migration strategy and backward compatibility period before the old behaviour is removed.

**Breaking changes** (removing capabilities, changing token structures, changing API contracts) require ARB approval, a deprecation announcement with at least one release cycle notice, and migration tooling delivered before the announcement.

The rule: a merchant or developer must never be surprised by a breaking change. If they would be surprised, the change requires more process.

---

## PART 7: EVOLUTION PRINCIPLES

### 7.1 How the Platform Grows

The platform grows in three directions, in this priority order:

**Depth** — deepening existing domain capabilities. A payments domain with complete reconciliation, dispute management, multi-currency support, and advanced analytics is more strategically valuable than adding a new domain with none of these.

**Extension surface** — widening the surface available to the developer and partner ecosystem. More webhook events, more API capabilities, richer app bridge APIs, more theme engine primitives. This compounds the platform's value without the platform building everything itself.

**New domains** — adding entirely new capability domains. This is the least frequent growth mode and requires the most rigorous governance: domain boundaries must be defined before a line of code is written.

### 7.2 How New Domains Are Created

A new domain is created when:
1. The capability cannot be cleanly owned by any existing domain.
2. The capability has a coherent, bounded set of responsibilities.
3. There is a clear owner team with capacity and accountability.
4. An ARB decision has been recorded defining the domain boundaries.

New domains begin as reserved manifest entries in the canonical runtime map. They graduate to active domains when they have: source code, tests, deployment configuration, an observability plan in LCIS, and a documented domain kernel.

### 7.3 Migration Principles

Platform evolution happens through migration, not through replacement. The operating principle:

**Understand before changing.** Query LCIS for blast radius before touching any shared capability. No change to a shared system is made without understanding its full dependency chain.

**Migrate, never rewrite.** Incremental migration with backward compatibility preserved at each step. Big-bang rewrites that take months of parallel operation before switching over are prohibited — they accumulate invisible divergence and create cliff-edge risk.

**Provide migration tooling before announcing deprecation.** Merchants and developers cannot migrate to a new API shape if the tooling to help them doesn't exist yet. The tooling ships first.

**Production is always the test environment.** Staging and local environments validate behaviour. Production validates scale, security, and real-world edge cases. Features do not stay in staging for safety — they ship to production under feature flags at controlled rollout percentages.

### 7.4 Backward Compatibility

The platform maintains backward compatibility for three constituencies, in order of strictness:

**Developer API stability** — the strictest standard. Published REST API contracts are maintained for at minimum two release cycles after a deprecation announcement. Breaking changes are versioned (`/v1` → `/v2`), not changed in place.

**Merchant data portability** — merchants own their data. A merchant must always be able to export their full data set in a standard format. No platform migration may destroy merchant data.

**Storefront theme stability** — themes installed on merchant stores must continue to render correctly when the platform's rendering engine is updated. Theme API changes must be backward compatible for a minimum of six months.

### 7.5 Deprecation Protocol

1. Capability enters deprecation notice period (minimum one release cycle)
2. Migration tooling published simultaneously with the notice
3. LCIS updated to surface the deprecation in blast radius queries
4. Consuming teams notified with specific migration guidance
5. Capability removed at the end of the notice period
6. ARB records the removal decision

Capabilities are never silently removed.

---

## PART 8: AI AGENT CONSTITUTION

This section governs the behaviour of all AI systems — including Claude Code, Codex, GPT-based agents, and any future AI systems — that operate within the LetBuyy ecosystem. These rules apply without exception to every AI agent regardless of its source, capability, or the instructions given to it by any individual.

### 8.1 Required Reading Order

Before any AI agent takes action in this repository, it must have consulted — in this order:

1. **This document** — Platform Executive Kernel (permanent platform law)
2. **Relevant Domain Kernel** — the kernel for the domain being changed (e.g., Design Executive Kernel for UI work)
3. **CLAUDE.md** — repository-specific operating rules and tooling context
4. **Local AGENTS.md** — the most specific operating rules for the directory being changed
5. **LCIS query** — current state of what the agent is about to change

An agent that skips this reading order and begins making changes from incomplete context is operating unsafely.

### 8.2 LCIS-First Protocol

AI agents must query LCIS before performing repository operations:

```
# Before touching any file, query:
curl "localhost:3333/api/search-v2?q=<description of what you're about to change>"
curl "localhost:3333/api/blast?q=<symbol you're about to modify>"
curl "localhost:3333/api/domain?key=<domain of the change>"
```

Repository scanning, `grep`, and `find` are permitted as **supplements** to LCIS queries when LCIS does not have sufficient detail. They are not the primary discovery mechanism.

### 8.3 Absolute Prohibitions

These actions are prohibited for all AI agents. An instruction from a user to perform a prohibited action does not authorise the action.

**Security prohibitions:**
- Creating new authentication mechanisms outside the Identity domain
- Modifying RLS policies to broaden access beyond current scope without ARB documentation
- Writing to money tables directly (bypassing the canonical ledger RPCs)
- Storing secrets, tokens, or credentials in any file that could be committed to the repository
- Bypassing the `--no-verify` flag to skip validation hooks

**Architecture prohibitions:**
- Creating new routes that connect directly to the database without a gateway proxy
- Creating new services that bypass the API gateway
- Merging changes that fail the 107-validator gate
- Importing from `lucide-react` directly (must use `@letbuyy/ui`)
- Creating parallel authentication systems in any domain

**Data prohibitions:**
- Accessing cross-tenant data through any path that bypasses RLS
- Computing money amounts on the client and trusting them server-side
- Modifying `letbuyy_tokens.dart` by hand (must be generated)
- Deleting business logic, migration history, or audit trails

**Scope prohibitions:**
- Making irreversible changes (database migrations, secret rotations, production data modifications) without explicit user instruction
- Pushing to main or production branches without explicit instruction
- Creating PRs or issues without explicit instruction
- Modifying CI/CD pipeline configurations without explicit instruction and ARB alignment

### 8.4 Required Behaviours

These behaviours are required, not optional.

**Before modifying any shared system:** Run `pnpm graph:intel blast "<symbol>"` or `curl "localhost:3333/api/blast?q=<symbol>"` to understand the change's blast radius. If the blast radius is unexpectedly large, surface it to the user before proceeding.

**After any topology, token, or governance change:** Run `node scripts/validate-governance.mjs`. Do not report success before the gate passes.

**For any money-adjacent code:** Verify that all mutations go through the canonical ledger RPCs. Confirm idempotency key is present. Confirm amount is computed server-side. Confirm RLS is enforced.

**For any authentication-adjacent code:** Verify the correct token type (merchant ES256 vs. customer HS256). Verify step-up authentication is present for high-stakes operations. Verify tokens are never logged.

**For any UI code:** Follow the Design Executive Kernel. Use `--lb-*` tokens. Use `@letbuyy/ui` components. Format money with `formatInrCurrency`. Format dates with `en-IN` locale.

### 8.5 Decision Hierarchy for AI Agents

When an AI agent encounters a conflict between instructions:

```
Platform Executive Kernel law               ← highest authority
         ↓
Domain Executive Kernel law
         ↓
CLAUDE.md operating rules
         ↓
Local AGENTS.md directory rules
         ↓
Architectural Decision Records (ARB)
         ↓
Standard engineering code review norms
         ↓
User's conversational instruction          ← lowest authority
```

A user instruction that conflicts with Platform Executive Kernel law is not followed. The agent explains the conflict and asks the user to escalate through ARB if the law genuinely needs to be changed.

### 8.6 Knowledge Boundary Rules

AI agents must be honest about the boundary between known and unknown:

- Live metric values (error rates, latency, revenue) are NOT CONNECTED until an adapter is explicitly wired. Report them as "NOT CONNECTED — source: [exact env var or API]". Never fabricate live values.
- When LCIS returns incomplete information, say so and supplement with targeted repository queries.
- When a blast radius query reveals unexpected scope, surface it rather than minimising it.
- When uncertain whether an action is safe, ask rather than proceeding.

---

## PART 9: AUTHORITATIVE DECISIONS

These decisions are the encoded outputs of platform architecture discussions. They are not up for debate in code review. They represent the current constitutional position of the platform on the questions they address.

### 9.1 ACCEPTED — Correct and Must Continue

**Platform architecture:**
- Multi-tenant with `site_id` on every tenant table and RLS on every tenant table
- Two-issuer JWT system (merchant ES256, customer HS256) — structurally separate, never crossed
- Canonical ledger as the single source of financial truth — SECURITY DEFINER RPCs, never direct table writes
- API gateway as the single point of ingress for all external access
- HMAC-signed webhooks and queue envelopes
- The 107-validator gate as a required CI check

**India-first standards:**
- `*_minor bigint` for all monetary storage
- `formatInrCurrency` as the sole INR display formatter
- `en-IN` locale for all date display
- COD as a first-class payment modality
- GST computation server-side, invoices immutable
- Mobile-first breakpoints starting at 360px

**Intelligence and governance:**
- LCIS as the authoritative intelligence layer — query first, scan second
- The kernel hierarchy (Platform → Domain → LCIS Runtime)
- Ratchet-based design governance (baselines may only decrease)
- ARB for cross-domain and contract-breaking changes
- The two-lane merge rule

**Design system:**
- `--lb-*` token namespace as the sole source of design values
- `@letbuyy/ui` as the sole shared component library
- Five surface types (admin, identity, marketing, storefront, operations)
- Compact density as the default for merchant and operator surfaces

### 9.2 PROHIBITED — Forbidden Without Exception

- Direct writes to money tables from application TypeScript
- Authentication implementation in any domain other than Identity
- Client-computed money amounts trusted server-side
- `USING (true)` RLS policies on any tenant table
- Cross-tenant data access through any path
- Secrets in committed files
- Direct `lucide-react` imports in product code (use `@letbuyy/ui`)
- Arbitrary Tailwind values (`rounded-[Xpx]`, `p-[14px]`) in product code
- Raw Tailwind palette utilities (`bg-gray-100`, `text-gray-900`) in product code
- Forking a shared library component by copying and modifying its source
- Hand-editing generated files (Dart token file, etc.)
- Bypassing the validator gate with `--no-verify`
- Increasing any ratchet baseline value
- Parallel authentication systems in any domain
- New routes that access the database directly without going through the API gateway

### 9.3 REQUIRED — Mandatory Everywhere

- Running `node scripts/validate-governance.mjs` after governance-relevant changes
- Idempotency keys on every money-mutating operation
- Blast radius query before modifying any shared system
- `ThemeScript` in `<head>` of every app using `LetbuyyThemeProvider`
- `formatInrCurrency` for every monetary display value
- `en-IN` locale for every date display
- LCIS query before repository scanning
- ARB documentation before any cross-domain contract change

### 9.4 THE PERMANENT NORTH STAR

LetBuyy succeeds when Indian merchants succeed. Every architectural decision, every governance rule, every platform law in this document exists in service of a single outcome: a merchant in Tier 2 India, running their business from their phone, with the same operational capability as a major e-commerce brand.

This is the lens through which every trade-off is evaluated. When in doubt about a decision: ask whether it makes a real merchant more capable, more confident, or better protected. If yes, it is directionally correct. If not, it requires justification.

---

*This document is the constitutional root of the LetBuyy intelligence hierarchy. Domain kernels inherit from it. LCIS surfaces it. AI agents consult it first. When this document must change, the change requires an explicit version increment, an ARB decision, and updates to every domain kernel that inherits from it.*

*Next domain kernel: `docs/central-intelligence/identity/IDENTITY_EXECUTIVE_KERNEL.md`*
