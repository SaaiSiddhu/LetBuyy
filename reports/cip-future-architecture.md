# Central Intelligence Platform (CIP)
**Future Architecture: A Multi-Product Intelligence Platform for LetBuyy + Papaa Escola + Future Products**
*Date: 2026-06-19 | Based on forensic analysis of LCIS + Papaa Escola intelligence blueprint*

---

## 1. Vision

The Central Intelligence Platform (CIP) is a product-agnostic intelligence layer that can serve any software platform — from e-commerce (LetBuyy) to education management (Papaa Escola) to healthcare, logistics, or fintech.

**One sentence:** CIP is a queryable knowledge brain that converts any software platform's code graph, database schema, and infrastructure topology into answerable intelligence about architecture, security, business, and operations.

---

## 2. Why CIP Exists

LCIS proves that a local, zero-dependency intelligence server can dramatically improve AI agent productivity, prevent architectural drift, and provide operational intelligence. But building LCIS from scratch for each new product is expensive.

**CIP solves this by:**
1. Extracting the product-agnostic intelligence layer from LCIS
2. Making it configurable for any domain model
3. Shipping it as a reusable package
4. Keeping the honesty contract (NOT CONNECTED) as a first-class feature

**Products using CIP:**
- LetBuyy (commerce platform, 22 domains) — existing LCIS migrated
- Papaa Escola (education platform, 13 domains) — built using this blueprint
- Future products — configured, not coded

---

## 3. CIP Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CENTRAL INTELLIGENCE PLATFORM                      │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    CIP Core (shared)                             │  │
│  │                                                                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ Code Graph   │  │ DB Intel     │  │ Infra Intel          │  │  │
│  │  │ Engine       │  │ Engine       │  │ Engine               │  │  │
│  │  │ (Graphify)   │  │ (SQL parser) │  │ (wrangler/CI parser) │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │ Intelligence Engines (shared, domain-agnostic)               │ │  │
│  │  │ blast-radius, deps, consumers, path, ownership, lineage,    │ │  │
│  │  │ cross-domain, detect, predict, diagnose, runbook, fix       │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │ Live Adapter Layer (shared, provider-agnostic)               │ │  │
│  │  │ Supabase, Cloudflare, Vercel, GitHub, Resend, Razorpay,    │ │  │
│  │  │ + extensible adapter interface for new providers             │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Product: LetBuyy     │  │ Product: Papaa Escola                 │  │
│  │ config/letbuyy/      │  │ config/papaa-escola/                  │  │
│  │ - 22 domains         │  │ - 13 domains                          │  │
│  │ - Commerce narratives│  │ - Education narratives                │  │
│  │ - Commerce journeys  │  │ - Education journeys                  │  │
│  │ - INR/GST/Razorpay  │  │ - Fee/Payroll money rules             │  │
│  │ Port 3333            │  │ Port 3335                             │  │
│  └──────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. CIP Repository Structure

```
packages/
└── @cip/core/
    ├── src/
    │   ├── server.mjs                    ← CIP HTTP server factory
    │   ├── intelligence.mjs              ← Graph query engine (shared)
    │   ├── extractors/
    │   │   ├── db-extractor.mjs          ← SQL migration parser (shared)
    │   │   ├── infra-extractor.mjs       ← Infrastructure parser (shared)
    │   │   └── domain-classifier.mjs     ← Domain classification engine (configurable)
    │   ├── engines/
    │   │   ├── blast-radius.mjs          ← Blast radius (shared)
    │   │   ├── cross-domain.mjs          ← Cross-domain coupling (shared)
    │   │   ├── governance-memory.mjs     ← Decision extraction (shared)
    │   │   ├── runbook-engine.mjs        ← Runbook generation (shared)
    │   │   ├── diagnosis-engine.mjs      ← Root cause (shared)
    │   │   ├── fix-engine.mjs            ← Fix plans (shared)
    │   │   ├── detection-prediction.mjs  ← INFINITY-style detectors (shared)
    │   │   └── live-adapters.mjs         ← Provider adapters (shared)
    │   └── ui/
    │       └── index.html                ← Atlas SPA shell (configurable branding)
    └── package.json

products/
├── letbuyy/
│   ├── cip.config.mjs                    ← LetBuyy product config
│   └── explain/                          ← Hand-authored domain narratives
│       ├── payments.md
│       ├── orders.md
│       └── ... (22 narratives)
│
└── papaa-escola/
    ├── cip.config.mjs                    ← Papaa product config
    └── explain/                          ← Hand-authored domain narratives
        ├── finance.md
        ├── students.md
        └── ... (13 narratives)
```

---

## 5. CIP Configuration Schema

Every product provides a `cip.config.mjs` that configures the shared CIP core:

```javascript
// products/papaa-escola/cip.config.mjs
export default {
  // Product identity
  name: 'Papaa Escola',
  description: 'School management platform',
  port: 3335,
  
  // Data sources
  dataRoot: '../..',  // path to the product repository root
  output: 'cip-out', // output directory for artifacts
  
  // Domain model
  domains: [
    { key: 'finance', label: 'Finance & Fees', money: true, tenant: true, t: /fee_|payment|invoice|ledger|refund/ },
    { key: 'payroll', label: 'Payroll', money: true, tenant: true, t: /payroll|salary/ },
    { key: 'students', label: 'Students', money: false, tenant: true, t: /student|pupil/ },
    { key: 'academics', label: 'Academics', money: false, tenant: true, t: /subject|class|grade|exam/ },
    // ... 9 more domains
  ],
  
  // Money configuration
  moneyTables: [
    'fee_payments', 'fee_ledger_entries', 'refunds',
    'payroll_records', 'payroll_ledger_entries',
  ],
  
  // Tenant configuration
  tenantKey: 'school_id',         // column name for tenant isolation
  tenantRootTable: 'schools',     // root table (equivalent to sites)
  
  // Provider adapters
  providers: {
    supabase: { required: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] },
    cloudflare: { required: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] },
    razorpay: { required: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] },
    resend: { required: ['RESEND_API_KEY'] },
    vercel: { required: ['VERCEL_TOKEN'] },
  },
  
  // Narratives (hand-authored domain explanations)
  narrativesDir: './explain/',
  
  // Journeys (end-to-end business flows)
  journeys: [
    {
      key: 'student-admission',
      label: 'Student Admission',
      domains: ['admissions', 'students', 'finance'],
      // ... flow steps
    },
    // ... 9 more journeys
  ],
  
  // Governance
  governanceDocs: [
    'PAPAA_CONSTITUTION.md',
    'PAPAA_AGENTS.md',
    'CLAUDE.md',
    'docs/architecture/**/*.md',
  ],
  
  // Branding
  ui: {
    title: 'Papaa Escola Intelligence',
    logo: '/assets/papaa-logo.svg',
    primaryColor: '#2B6CB0',
  },
};
```

---

## 6. CIP API Contract

All CIP products share the same API contract. Products can extend but not override core endpoints.

### Core Endpoints (Every CIP Product)
```
GET /api/health                    — liveness check
GET /api/stats                     — graph statistics
GET /api/search?q=                 — fuzzy search
GET /api/blast?q=                  — blast radius
GET /api/db                        — DB summary
GET /api/table?name=               — table trace
GET /api/rpc?name=                 — RPC trace
GET /api/domains                   — list all domains (configured count)
GET /api/domain?key=               — domain detail
GET /api/cross-domain?key=         — cross-domain blast
GET /api/explain?node=             — plain-language domain explanation
GET /api/ai-pack?target=           — AI context pack < 20k tokens
GET /api/runbook?domain=           — operational runbook
GET /api/launch-command-center     — GO/NO-GO readiness
GET /api/fix-engine                — ranked fix plans
GET /api/diagnose?target=          — root cause
GET /api/connections               — live adapter status
GET /api/detection                 — autonomous detectors
GET /api/predict                   — structural predictors
GET /api/business-flow?journey=    — business journeys
GET /api/workspace?domain=         — 16-perspective workspace
GET /api/copilot?q=                — natural-language routing
```

### Product-Specific Endpoints (Extended by config)
Products can register additional endpoints:
```javascript
// products/letbuyy/endpoints/gst.mjs
export default {
  path: '/api/gst',
  handler: (req, res, ctx) => {
    return ctx.domainIntel.domains.find(d => d.key === 'gst');
  },
};
```

---

## 7. The CIP Honesty Contract (Inherited from LCIS)

The NOT CONNECTED contract is a first-class feature of CIP — not optional.

**Protocol (implemented in `@cip/core/src/engines/live-adapters.mjs`):**
1. Check credential PRESENCE only — never read or emit values
2. Return `{ status: 'NOT CONNECTED', exactSource: 'VAR1 + VAR2' }` when absent
3. Return `{ status: 'CONNECTED', httpStatus: 200 }` when present AND probe succeeds
4. Return `{ status: 'ERROR', httpStatus: 500 }` when present but probe fails
5. All live values in all endpoints carry the NOT CONNECTED label if not connected

**Non-negotiable:** CIP must never fabricate live values. Any engine that generates a live value without a live adapter connection is a bug.

---

## 8. CIP Validator Gate

CIP ships a base set of validators that all products must pass, plus a configuration interface for product-specific validators:

### Base Validators (Every CIP Product)
```
cip-tenant-isolation-validator.mjs      — tenant key on all tenant tables
cip-canonical-ledger-validator.mjs      — money tables via SECURITY DEFINER RPCs only
cip-rls-force-coverage-validator.mjs    — FORCE RLS on all tenant tables
cip-no-public-rls-validator.mjs         — no USING (true) on public data
cip-identity-sole-issuer-validator.mjs  — single ES256 issuer
cip-topology-drift-validator.mjs        — canonical runtime topology unchanged
cip-no-scan-generated-agents-validator.mjs — hand-authored governance only
cip-committed-secret-placeholder-validator.mjs — no secrets in repo
```

### Product Validators (Registered in cip.config.mjs)
```javascript
// products/letbuyy/cip.config.mjs
validators: [
  './validators/canonical-ledger-only-validator.mjs',  // Letbuyy-specific money rule
  './validators/gst-computation-validator.mjs',         // India GST rule
  './validators/razorpay-hmac-validator.mjs',           // Razorpay signature rule
]
```

---

## 9. CIP Governance Architecture

**The same governance insight from LetBuyy applies to all CIP products:**

> "Governance documents MUST be hand-authored law. MUST NOT generate from repository scans."

Each product must have:
1. A **Constitution** (`PRODUCT_CONSTITUTION.md`) — hand-authored supreme law
2. An **Agents Rulebook** (`PRODUCT_AGENTS.md`) — hand-authored operating rules
3. A **Canonical Systems** doc (`PRODUCT_CANONICAL_SYSTEMS.md`) — winner registry
4. **Hand-authored narratives** (`explain/*.md`) — NOT generated

CIP provides tooling to detect violations:
- `cip-constitution-validator.mjs` — checks Constitution markers
- `cip-no-scan-generated-governance-validator.mjs` — prevents auto-generated authority

---

## 10. CIP Deployment Model

### Single-Product Deployment (Current: LetBuyy, Papaa Escola)
```
Product repository → CIP config → Local server on port 333X
```
- CIP server runs locally
- Knowledge artifacts stored in `cip-out/` (gitignored)
- AI agents query `localhost:333X/api/*`

### Multi-Product Cloud Deployment (Future)
```
                    ┌─────────────────────────────────────┐
                    │     CIP Cloud (centralized)          │
                    │                                       │
         ┌──────────┤  ┌─────────────────────────────────┐│
LetBuyy ─┤  sync    │  │ Product: letbuyy    (live)       ││
         └──────────┤  │ Endpoints: /api/letbuyy/*        ││
                    │  └─────────────────────────────────┘│
         ┌──────────┤  ┌─────────────────────────────────┐│
Papaa   ─┤  sync    │  │ Product: papaa-escola (live)     ││
         └──────────┤  │ Endpoints: /api/papaa-escola/*   ││
                    │  └─────────────────────────────────┘│
         ┌──────────┤  ┌─────────────────────────────────┐│
Future  ─┤  sync    │  │ Product: product-N   (live)      ││
         └──────────┤  │ Endpoints: /api/product-N/*      ││
                    │  └─────────────────────────────────┘│
                    └─────────────────────────────────────┘
                         Shared authentication
                         Cross-product analysis
                         Portfolio intelligence
```

**Cross-product intelligence (future):**
- `GET /api/cip/products` — list all registered products
- `GET /api/cip/portfolio` — cross-product health dashboard
- `GET /api/cip/common-patterns` — shared patterns across products
- `GET /api/cip/shared-infrastructure` — shared Supabase/Cloudflare usage

---

## 11. CIP Roadmap

### Phase 1 (Current): LetBuyy LCIS → CIP
- Extract domain-agnostic code from LCIS into `@cip/core`
- Create LetBuyy product config that produces identical behavior to current LCIS
- Gate: LCIS behavior unchanged; all 107 validators pass; all 117 endpoints respond

### Phase 2 (Papaa Escola): First new product
- Create `products/papaa-escola/cip.config.mjs`
- Write 13 domain narratives in `products/papaa-escola/explain/`
- Write 10 education journeys
- Write Papaa governance constitution
- Gate: Papaa Escola PIS starts cleanly; all 12 education domains visible

### Phase 3 (API stabilization): CIP as a package
- Publish `@cip/core` to private npm registry
- Define stable API contract (semver)
- Write migration guide for LCIS → CIP users

### Phase 4 (Cloud deployment): Multi-product hub
- Deploy CIP as a hosted service
- Build cross-product portfolio dashboard
- Add product authentication (API keys per product)

---

## 12. Technology Decisions

### Why Vanilla JavaScript (No TypeScript)?
Same reason as LCIS: zero build step, zero compilation time, immediate startup. CIP is tooling, not application code. `node --check` catches syntax errors.

### Why No External Dependencies?
Supply-chain security. A single npm `require()` from the intelligence server could introduce a vulnerability. Node.js built-ins only.

### Why Local HTTP Server (Not Library)?
- Protocol-agnostic: any AI agent, any IDE plugin, any browser can query
- No coupling to Claude API, OpenAI API, or any specific AI vendor
- Claude, Gemini, Copilot, and Cursor can all query the same endpoints
- Future-proof: AI tooling landscape will change; HTTP never will

### Why Pre-Computed JSON (Not Vector DB)?
- No embedding costs
- No vector index maintenance
- Zero latency (in-memory queries < 10ms)
- Deterministic answers (no probabilistic retrieval)
- Inspectable (JSON files are human-readable)

### Why No RAG?
LCIS proves that structural knowledge (code graph + DB schema + infrastructure topology) can answer architectural questions with higher accuracy than semantic search over documentation. The repository IS the ground truth.

---

## 13. CIP Quality Standards (Inherited from LCIS)

**Standard 1: Honesty before completeness.**
A partial answer that accurately marks live values as NOT CONNECTED is better than a complete answer that fabricates them.

**Standard 2: Governance before intelligence.**
The validator gate is always the authority. CIP intelligence is always advisory.

**Standard 3: Extension over rebuild.**
New products add a `cip.config.mjs`. New intelligence layers extend existing engines. Never rebuild.

**Standard 4: Hand-authored governance.**
No CIP tooling generates governance documents. The Constitution and Agents Rulebook are always hand-authored.

**Standard 5: Query before scan.**
Every CLAUDE.md in a CIP product must include the query table. Repo scans are the last resort.

---

## 14. CIP Success Metrics

| Metric | Target |
|--------|--------|
| Time to onboard a new product | < 5 days |
| Time to answer "what breaks if X fails?" | < 1 second (single API call) |
| AI agent context window savings | > 80% reduction (vs file scanning) |
| Validator gate coverage per product | > 10 validators minimum |
| Live adapter connections | ≥ 1 per product (Supabase) within 30 days of launch |
| Intelligence accuracy | A− (93%+) on first certification |
| Governance drift incidents | 0 (validator gate prevents drift) |

---

## 15. CIP vs LCIS: What Changes, What Stays

| Dimension | LCIS (LetBuyy) | CIP (Multi-Product) |
|-----------|---------------|-------------------|
| Domain count | 22 (hard-coded) | Configured per product |
| Money tables | 18 (LetBuyy-specific) | Configured per product |
| Tenant key | `site_id` | Configured (`school_id`, `org_id`, etc.) |
| Port | 3333 | Configured per product |
| Providers | Razorpay, Resend, Turnstile, Supabase, Cloudflare, Vercel, GitHub | Configured per product |
| Domain narratives | LetBuyy commerce prose | Hand-authored per product |
| Business journeys | 10 commerce journeys | Configured per product |
| Governance constitution | LETBUYY_CONSTITUTION.md | PRODUCT_CONSTITUTION.md |
| Validator count | 107 (LetBuyy-specific) | 8 base + product validators |
| API surface | 90+ LCIS endpoints | Core 30+ endpoints + product extensions |
| Core engines | LCIS-specific | Shared, domain-agnostic |
| Honesty contract | NOT CONNECTED | Identical — first-class feature of CIP |
