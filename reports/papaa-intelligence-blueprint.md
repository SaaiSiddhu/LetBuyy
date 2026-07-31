# Papaa Escola Intelligence Blueprint
**The definitive blueprint for recreating LCIS inside Papaa Escola**
*Date: 2026-06-19 | Based on forensic analysis of LetBuyy LCIS*

---

## 1. The Mission

Papaa Escola is an education management platform. This blueprint defines how to build a **Papaa Intelligence System (PIS)** — a queryable knowledge brain over the Papaa Escola codebase — using the exact architecture and patterns proven by LCIS.

The goal: Any AI agent or human engineer working on Papaa Escola can answer any architectural, business, or operational question about the platform without reading source files.

---

## 2. The 12 Papaa Escola Business Domains

Papaa Escola has 12 primary business domains. These are the equivalent of LetBuyy's 22 commerce domains.

| Key | Domain | Equivalent LetBuyy Domain | Money Path | Tenant |
|-----|--------|--------------------------|-----------|--------|
| `admissions` | Admissions & Enrollment | `orders` | No | Yes |
| `students` | Student Records & Progress | `merchant` (tenant entity) | No | Yes |
| `parents` | Parent Portal & Engagement | `storefront` (customer-facing) | No | Yes |
| `teachers` | Teacher Management | `identity` | No | Yes |
| `academics` | Curriculum, Grades, Exams | `products`, `collections` | No | Yes |
| `attendance` | Attendance Tracking | `inventory` (resource tracking) | No | Yes |
| `finance` | Fee Collection & Accounts | `payments`, `refunds`, `payouts` | **YES** | Yes |
| `payroll` | Staff Payroll | `payouts` | **YES** | Yes |
| `hr` | Human Resources | `identity`, `merchant` | No | Yes |
| `transport` | School Bus & Routes | `shipping` | No | Yes |
| `library` | Books & Resources | `inventory` | No | Yes |
| `communication` | SMS/Email/Notifications | `notifications` | No | Yes |
| `analytics` | Reports & Dashboards | `analytics` | No | Yes |

---

## 3. Papaa Escola Domain Model

### 3.1 Core Entities (Database Tables)

For each domain, the following entities are expected:

**Admissions:**
- `schools` — Tenant root (equivalent to `sites`)
- `applications` — Admission applications
- `applicants` — Prospective students
- `admission_batches` — Academic year/batch
- `enrollment_records` — Confirmed enrollments

**Students:**
- `students` — Core student entity (`school_id` tenant key)
- `student_profiles` — Extended profile
- `student_guardians` — Parent-student linkage
- `academic_records` — Historical records
- `student_documents` — KYC/document storage

**Parents:**
- `parents` — Parent entity
- `parent_credentials` — Auth credentials
- `parent_notifications` — Notification preferences

**Teachers:**
- `teachers` — Teacher entity
- `teacher_assignments` — Subject/class assignments
- `teacher_credentials` — Auth credentials
- `teacher_qualifications` — Certification records

**Academics:**
- `subjects` — Curriculum subjects
- `classes` — Class/grade levels
- `sections` — Sections within a class
- `exams` — Examination definitions
- `exam_grades` — Grade records
- `homework_assignments` — Homework/assignments
- `homework_submissions` — Student submissions
- `timetables` — Class schedules

**Attendance:**
- `attendance_records` — Daily attendance
- `leave_requests` — Student leave
- `attendance_summaries` — Rollup counts

**Finance:** *(MONEY DOMAIN — canonical ledger required)*
- `fee_structures` — Fee definition per class/period
- `fee_invoices` — Invoice per student
- `fee_payments` — Payment records (MONEY TABLE)
- `fee_ledger_entries` — Double-entry ledger (MONEY TABLE)
- `refunds` — Fee refunds (MONEY TABLE)
- `expense_categories` — Expense types
- `expenses` — School expenses

**Payroll:** *(MONEY DOMAIN — canonical ledger required)*
- `payroll_periods` — Pay periods
- `payroll_records` — Individual pay records (MONEY TABLE)
- `payroll_ledger_entries` — Payroll ledger (MONEY TABLE)
- `deductions` — Deduction types
- `employee_salaries` — Salary definitions

**HR:**
- `employees` — Staff entity
- `departments` — Departments
- `job_roles` — Role definitions
- `employment_records` — Employment history
- `leave_policies` — Leave allowances
- `leave_balances` — Leave balance (MONEY-LIKE — requires idempotent mutations)

**Transport:**
- `routes` — Bus routes
- `stops` — Bus stops
- `vehicles` — Vehicle registry
- `vehicle_assignments` — Student-to-route assignments
- `transport_tracking` — Real-time position (live, NOT CONNECTED initially)

**Library:**
- `books` — Book catalog
- `copies` — Physical copies
- `issues` — Book issue records
- `returns` — Return records
- `fines` — Late return fines (MONEY-LIKE)

**Communication:**
- `notification_templates` — Message templates
- `notifications` — Sent notifications
- `notification_logs` — Delivery logs
- `announcements` — School-wide announcements

**Analytics:**
- `report_definitions` — Report configurations
- `report_runs` — Generated report records
- `analytics_events` — Raw event stream
- `analytics_rollups` — Pre-aggregated rollups

---

## 4. PIS Architecture Design

### 4.1 Server (pis-server.mjs)

Identical pattern to LCIS `server.mjs`:
- Zero external dependencies (Node.js built-ins only)
- Port 3335 (to not conflict with LCIS on 3333)
- Start: `pnpm pis:ui`
- All 4 primary data sources loaded at startup
- 50+ REST API endpoints
- SPA fallback for deep links

### 4.2 Primary Data Sources

| Artifact | Producer | Contents |
|---------|---------|---------|
| `pis-out/graph.json` | `graphify update .` | Code graph (TypeScript/React/Dart) |
| `pis-out/db-intel.json` | `pis-db-intel.mjs` | All Papaa tables/RPCs/policies |
| `pis-out/infra-intel.json` | `pis-infra-intel.mjs` | Workers/queues/secrets/Vercel/Supabase |
| `pis-out/domain-intel.json` | `pis-domain-intel.mjs` | 12 education domains |

### 4.3 Domain Classifier (pis-domain-intel.mjs)

The domain classification rules for Papaa Escola:

```javascript
const DOMAIN_RULES = [
  // Most specific first
  { key: 'finance', label: 'Finance & Fees', t: /fee_|payment|invoice|ledger|refund|expense/ },
  { key: 'payroll', label: 'Payroll', t: /payroll|salary|deduct/ },
  { key: 'admissions', label: 'Admissions', t: /admission|enrollment|applicant|application/ },
  { key: 'students', label: 'Students', t: /student|pupil|learner/ },
  { key: 'parents', label: 'Parents', t: /parent|guardian|caregiver/ },
  { key: 'teachers', label: 'Teachers', t: /teacher|instructor|faculty/ },
  { key: 'academics', label: 'Academics', t: /subject|class|grade|exam|curriculum|timetable|homework|assignment/ },
  { key: 'attendance', label: 'Attendance', t: /attendance|leave_request|present|absent/ },
  { key: 'hr', label: 'Human Resources', t: /employee|department|job_role|employment/ },
  { key: 'transport', label: 'Transport', t: /route|stop|vehicle|transport|bus/ },
  { key: 'library', label: 'Library', t: /book|copy|issue|return|fine/ },
  { key: 'communication', label: 'Communication', t: /notification|announcement|template|sms|email/ },
  { key: 'analytics', label: 'Analytics', t: /analytics|report|rollup|event/ },
];
```

### 4.4 Money Tables (Papaa Equivalent of MONEY_TABLES)

```javascript
const MONEY_TABLES = new Set([
  'fee_payments', 'fee_ledger_entries', 'refunds',
  'payroll_records', 'payroll_ledger_entries',
  'expense_categories', 'expenses',
  'library_fines', 'leave_balances',
]);
```

**Money Governance (same rules as LetBuyy):**
- ALL writes to money tables go through SECURITY DEFINER RPCs
- Every money RPC requires `idempotency_key` parameter
- Every money RPC uses `FOR UPDATE` row lock
- Balance columns have `CHECK (balance >= 0)`
- Fee invoices are immutable after generation

---

## 5. PIS API Surface (Proposed 50+ Endpoints)

### Foundation
- `GET /api/stats` — graph statistics
- `GET /api/search?q=` — search 50k+ code nodes
- `GET /api/node?id=` — single node view
- `GET /api/blast?q=` — blast radius
- `GET /api/community?id=` — community profile

### Database Intelligence
- `GET /api/db` — full DB summary
- `GET /api/table?name=` — single table trace
- `GET /api/rpc?name=` — single RPC trace
- `GET /api/policy?table=` — RLS policies on table

### Domain Intelligence
- `GET /api/domains` — list all 12 education domains
- `GET /api/domain?key=` — single domain detail
- `GET /api/cross-domain?key=` — cross-domain blast radius
- `GET /api/finance` — finance/fee domain intelligence
- `GET /api/security` — security posture
- `GET /api/student-journey` — student lifecycle

### Runtime Intelligence
- `GET /api/runtime` — worker/queue/cron topology
- `GET /api/deployment-state` — current deployment state
- `GET /api/execution` — open blockers + launch verdict

### Business Intelligence
- `GET /api/explain?node=` — plain-language domain explanation
- `GET /api/business-flow?journey=` — education journeys
- `GET /api/impact-score?domain=` — what-breaks-if analysis
- `GET /api/workspace?domain=` — 16-perspective workspace
- `GET /api/ai-pack?target=` — AI context pack < 20k tokens

### Operations
- `GET /api/runbook?domain=` — domain runbooks
- `GET /api/diagnose?target=` — root cause analysis
- `GET /api/launch-command-center` — GO/NO-GO readiness
- `GET /api/health` — server liveness

### Live Adapters (initially all NOT CONNECTED)
- `GET /api/connections` — adapter status
- `GET /api/live?provider=` — live probe
- `GET /api/detection` — autonomous detectors
- `GET /api/predict` — structural predictors

---

## 6. Papaa Escola Education Journeys (V11 Equivalent)

The 10 LetBuyy business journeys map to these education journeys:

| Journey | Domains Traversed | Equivalent LetBuyy Journey |
|---------|-----------------|--------------------------|
| `student-admission` | admissions → students → finance | `merchant-onboarding` |
| `fee-collection` | finance → students → communication | `checkout` + `payment` |
| `exam-management` | academics → students → communication | `order-fulfillment` |
| `attendance-reporting` | attendance → students → parents → analytics | `inventory-management` |
| `payroll-processing` | payroll → hr → finance → communication | `payouts` |
| `parent-engagement` | parents → students → academics → communication | `storefront` customer journey |
| `staff-onboarding` | hr → teachers → payroll → communication | `merchant-onboarding` |
| `transport-dispatch` | transport → students → parents → communication | `shipping` |
| `library-checkout` | library → students → communication | `product-catalog` |
| `academic-reporting` | analytics → academics → students → parents | `analytics` domain |

---

## 7. The 13 PIS Intelligence Layers (Adoption Plan)

Adopt LCIS layers in the same order, adapted for education context:

| Phase | Layer | Papaa Content | Estimated Effort |
|-------|-------|-------------|----------------|
| 1 | Code Graph | Run `graphify update .` on Papaa repo | 1 day |
| 2 | DB Intelligence | Build `pis-db-intel.mjs` for school DB | 2-3 days |
| 3 | Domain Intelligence | Build `pis-domain-intel.mjs` (12 domains) | 2-3 days |
| 4 | Runtime Intelligence | Map workers/queues/deployments | 1-2 days |
| 5 | Memory Intelligence | Extract Papaa governance decisions | 1 day |
| 6 | Explain Mode | Write purpose narratives for 12 domains | 3-5 days |
| 7 | Business Journeys | Define 10 education journeys | 2-3 days |
| 8 | Runbooks | Write domain runbooks with escalation | 2-3 days |
| 9 | AI Integration | Wire CLAUDE.md with PIS-FIRST protocol | 1 day |
| 10 | Launch Readiness | Define GO/NO-GO dimensions | 1 day |
| 11 | Live Adapters | Wire Supabase + cloud provider | 2-3 days |
| 12 | Detection/Prediction | 8 detectors for education failures | 2-3 days |
| 13 | Atlas + Deep Links | Full visual graph + URL navigation | 2-3 days |

**Total estimated effort: 22-34 days** (reusing LCIS codebase directly: ~10-15 days)

---

## 8. Finance Domain — Special Rules (Equivalent to LetBuyy Payments)

The `finance` domain in Papaa Escola must follow the same canonical ledger rules as LetBuyy's `payments` domain:

### Fee Collection RPCs (Canonical, SECURITY DEFINER)
```sql
-- Required RPC pattern
CREATE OR REPLACE FUNCTION create_fee_invoice(
  p_school_id UUID,
  p_student_id UUID,
  p_fee_structure_id UUID,
  p_amount_paise BIGINT,  -- INR amounts in paise
  p_idempotency_key TEXT   -- REQUIRED
) RETURNS JSON AS $$
BEGIN
  INSERT INTO fee_invoices (...) VALUES (...) ON CONFLICT (idempotency_key) DO NOTHING;
  ...
END;
$$ SECURITY DEFINER;
```

### Fee Payment RPCs
```sql
CREATE OR REPLACE FUNCTION confirm_fee_payment(
  p_invoice_id UUID,
  p_amount_paise BIGINT,
  p_payment_method TEXT,  -- 'razorpay' | 'cash' | 'bank_transfer'
  p_idempotency_key TEXT
) RETURNS JSON AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  SELECT * INTO v_invoice FROM fee_invoices WHERE id = p_invoice_id FOR UPDATE;
  -- Verify amount
  -- Create ledger entry
  -- Update invoice status
  -- Return confirmation
END;
$$ SECURITY DEFINER;
```

### Payroll RPCs
```sql
CREATE OR REPLACE FUNCTION process_payroll_payment(
  p_school_id UUID,
  p_employee_id UUID,
  p_period_id UUID,
  p_amount_paise BIGINT,
  p_idempotency_key TEXT
) RETURNS JSON AS $$
BEGIN
  ...
END;
$$ SECURITY DEFINER;
```

---

## 9. Tenant Model

Papaa Escola uses `school_id` as the tenant key (equivalent to LetBuyy's `site_id`):

- **Root entity:** `schools` table (equivalent to `sites`)
- **All tenant tables:** Must have `school_id UUID NOT NULL REFERENCES schools(id)`
- **RLS pattern:** `USING (school_id = auth.jwt() -> 'school_id')`
- **FORCE RLS:** Required on all tenant tables

**Papaa tenant isolation validator (equivalent to LetBuyy's validators):**
```javascript
// scripts/validators/papaa-tenant-isolation-validator.mjs
// Check all tables with school_id have RLS enabled and FORCED
```

---

## 10. Authentication Model

Two issuers (same pattern as LetBuyy — NEVER cross):

| Issuer | Algorithm | For | Secret |
|--------|----------|-----|--------|
| Student/Parent sessions | HS256 | Portal access | `STUDENT_SESSION_SECRET` |
| Staff/Admin sessions | ES256 | Admin access | `PAPAA_IDENTITY_PUBLIC_JWKS` |

---

## 11. PIS Validator Gate (Equivalent to LetBuyy's 107 validators)

Start with these minimum validators (expand as platform grows):

| Validator | Equivalent LetBuyy Validator |
|-----------|---------------------------|
| `papaa-tenant-isolation-validator.mjs` | `tenant-isolation-validator.mjs` |
| `papaa-canonical-ledger-validator.mjs` | `canonical-ledger-only-validator.mjs` |
| `papaa-rls-force-coverage-validator.mjs` | `rls-force-coverage-validator.mjs` |
| `papaa-identity-sole-issuer-validator.mjs` | `identity-sole-issuer-validator.mjs` |
| `papaa-topology-drift-validator.mjs` | `topology-drift-validator.mjs` |
| `papaa-no-scan-generated-agents-validator.mjs` | `no-scan-generated-agents-validator.mjs` |
| `papaa-sequential-migration-validator.mjs` | `sequential-migration-validator.mjs` |
| `papaa-committed-secret-placeholder-validator.mjs` | `committed-secret-placeholder-validator.mjs` |
| `papaa-money-table-protection-validator.mjs` | `canonical-ledger-only-validator.mjs` |
| `papaa-no-public-rls-validator.mjs` | `no-public-using-true-validator.mjs` |

---

## 12. PIS CLAUDE.md Integration

Add to Papaa Escola's `CLAUDE.md`:

```markdown
## Papaa Intelligence System (PIS) — Query Before Scan

PIS runs at `http://localhost:3335`. Query PIS FIRST before any file search.

| Question | PIS Query |
|----------|----------|
| Where is X implemented? | `/api/search?q=X` |
| What breaks if X changes? | `/api/blast?q=X` |
| Which domain owns X? | `/api/domain?key=finance` |
| How does fee collection work? | `/api/explain?node=finance` |
| What breaks if finance fails? | `/api/cross-domain?key=finance` |
| Who owns X? | `/api/owner?q=X` |
| What's the student journey? | `/api/business-flow?journey=student-admission` |
| What should be fixed next? | `/api/execution` |
| Launch readiness? | `/api/launch-command-center` |
```

---

## 13. Live Adapter Plan (NOT CONNECTED by default)

| Provider | What it unlocks | Env Var |
|---------|----------------|---------|
| Supabase | Active school count, fee collections, attendance counts | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Razorpay (or Stripe) | Fee payment success rate, refunds | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` |
| Cloudflare | Worker health, queue depth, error rates | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| Resend / MSG91 | SMS/email delivery rate | `RESEND_API_KEY` or `MSG91_API_KEY` |
| Vercel | Deployment status, build health | `VERCEL_TOKEN` |

---

## 14. Files to Copy From LCIS (Minimal Adaptation)

These LCIS files can be copied with search-and-replace substitution:

| LCIS File | Papaa File | Adaptation Needed |
|-----------|-----------|-----------------|
| `tools/graph-server/server.mjs` | `tools/pis-server/server.mjs` | Port 3335, domain list, 12→22 domain count |
| `tools/graph-server/intelligence.mjs` | `tools/pis-server/intelligence.mjs` | None — pure graph queries, domain-agnostic |
| `tools/graph-server/db-intel.mjs` | `tools/pis-server/db-intel.mjs` | MONEY_TABLES set, school_id instead of site_id |
| `tools/graph-server/infra-intel.mjs` | `tools/pis-server/infra-intel.mjs` | Adapt wrangler.toml paths |
| `tools/graph-server/live-adapters.mjs` | `tools/pis-server/live-adapters.mjs` | Provider list (add MSG91, update Razorpay) |
| `tools/graph-server/runbook-engine.mjs` | `tools/pis-server/runbook-engine.mjs` | 12 domain runbooks with education escalation |
| `tools/graph-server/detection-prediction-intel.mjs` | `tools/pis-server/detection-prediction-intel.mjs` | 8 education-specific detectors |
| `tools/graph-server/index.html` | `tools/pis-server/index.html` | Branding + Papaa domain names |

### Files to Write New (Papaa-specific)

| File | Purpose |
|------|---------|
| `tools/pis-server/domain-intel.mjs` | 12-domain education classifier |
| `tools/pis-server/explain-intel.mjs` | Education domain narratives (hand-authored) |
| `tools/pis-server/business-flow-intel.mjs` | 10 education journeys |
| `PAPAA_AGENTS.md` | Papaa operating rulebook (hand-authored) |
| `scripts/validate-papaa-governance.mjs` | Papaa validator gate runner |

---

## 15. Governance Constitution for Papaa Escola

Create `PAPAA_CONSTITUTION.md` with equivalent articles:

- ART-01: Canonical tenant key is `school_id` on the `schools` table
- ART-02: All fee and payroll mutations go through SECURITY DEFINER RPCs
- ART-03: Two issuers never crossed: student/parent HS256, staff ES256
- ART-04: RLS FORCE required on all school-scoped tables
- ART-05: Student data is private by default (never `USING (true)`)
- ART-06: Fee invoices are immutable after confirmation
- ART-07: PIS heuristics are candidates; the validator gate is authoritative
- ART-08: PIS is advisory; the blocking gate is `validate-papaa-governance.mjs`
- ART-09: All governance documents are hand-authored law (NEVER generated from scans)
- ART-10: Live values are marked NOT CONNECTED until a live adapter is wired

---

## 16. First 30 Days Implementation Roadmap

### Week 1: Foundation
- [ ] Run `graphify update .` on Papaa Escola repo → `pis-out/graph.json`
- [ ] Copy + adapt `db-intel.mjs` with `school_id` tenant key and education money tables
- [ ] Copy + adapt `infra-intel.mjs`
- [ ] Write `domain-intel.mjs` with 12 education domain classification rules
- [ ] Start `pis-server.mjs` with basic graph + DB + domain endpoints
- [ ] Verify `/api/domains` returns all 12 education domains

### Week 2: Intelligence
- [ ] Copy + adapt `intelligence.mjs` (blast radius, deps, consumers — zero adaptation needed)
- [ ] Copy + adapt `cross-domain-engine.mjs` (zero adaptation needed)
- [ ] Write `explain-intel.mjs` with education domain narratives
- [ ] Write `business-flow-intel.mjs` for 10 education journeys
- [ ] Add `/api/explain?node=finance`, `/api/explain?node=students` etc.

### Week 3: Operations
- [ ] Write `runbook-engine.mjs` for 12 education domains
- [ ] Copy + adapt `detection-prediction-intel.mjs` with education failure detectors
- [ ] Copy + adapt `live-adapters.mjs` for Supabase + Razorpay + Cloudflare
- [ ] Connect staging Supabase read token → first live adapter active
- [ ] Write `/api/launch-command-center` with education-specific GO/NO-GO dimensions

### Week 4: Governance + AI Integration
- [ ] Write `PAPAA_CONSTITUTION.md`
- [ ] Write `PAPAA_AGENTS.md` (hand-authored, NOT generated)
- [ ] Implement first 10 validators (`papaa-tenant-isolation-validator.mjs`, etc.)
- [ ] Update `CLAUDE.md` with PIS-FIRST protocol
- [ ] Generate first AI context pack: `/api/ai-pack?target=claude`
- [ ] Write `PAPAA_ONBOARDING.md` ("Understand Papaa Escola in 30 minutes")
