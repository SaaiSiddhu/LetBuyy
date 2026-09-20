# AGENT F — Customers, Privacy, Staff & RBAC — Discovery Notes

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-bf35062e`
Branch `stepup/main` @ `bf35062e`. Read-only discovery. No files other than this one were touched.

Governance read before inspection:
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-05, ART-07, ART-08, ART-10, ART-11; R-10, R-13)
- root `AGENTS.md` (SEC-R1, PAY-R7, IDN-R1, IDN-R6, WIN-R7)
- `apps/merchant-control-plane/AGENTS.md`, `services/api-gateway/AGENTS.md`

> **Method note.** Everything below is static code + schema reading. Nothing in this domain was executed. Per the mission rules the ceiling for every claim here is `IMPLEMENTED_NOT_RUNTIME_VERIFIED`; several items are demoted to `BROKEN` where a *deterministic* code/schema contradiction (a query filtering on a column that does not exist, a route mounted behind a middleware that must reject it, a payload field the producer never emits) makes the runtime outcome provable by inspection rather than by execution.

---

## 0. Executive summary of this domain

1. **Customer detail is NOT the historical gap.** A real detail page (`[store]/customers/[email]/page.tsx`) exists, backed by a real proxy and a real gateway route `GET /v1/customers/:email`. Order history and addresses are joined and site-scoped. The prior audit claim is **STALE**.
2. **The customer LIST page is broken by a payload contract mismatch** — the gateway emits `display_name` / `order_count`; the page reads `full_name` / `total_orders`. Every customer renders as "Anonymous" with 0 orders, and the "Has orders" saved view is permanently empty.
3. **The customer CSV export is broken the same way** — every row exports blank email/name/phone.
4. **The merchant staff (RBAC) system does not function end-to-end.** There is no reachable invite-acceptance path, no staff login that yields a merchant session, and every store-resolution route is owner-only. Separately, the grant lookup queries `employees.site_id` — **a column that does not exist**.
5. **Staff RBAC is `dryrun` by default and `MERCHANT_STAFF_RBAC_MODE` is set nowhere in the repo** → the 30 guards are behaviour-neutral. 5 of the 12 declared staff permissions have **zero** enforcement sites.
6. **Step-up IS real cryptography** (HMAC-SHA256 over a structured payload, constant-time compare, TOTP-gated issuance, fail-closed on unset secret) and IS enforced at the gateway for `POST /payments/:id/refund`, `POST /payouts/:id/settle`, `POST /security/dsr/erase`. **But two other refund routes bypass it entirely.**
7. **`POST /v1/orders/:id/refund/complete` calls the canonical money RPC `complete_order_refund` with NO step-up, and passes an unvalidated `refund_id` to an RPC that has no site parameter** → step-up bypass + cross-tenant money mutation. `[HIGH-STAKES]`
8. **The canonical DPDP consent ledger (`public.consents`, migration 153) has ZERO runtime references.** It is schema-only. Consent is instead scattered across `wa_optins` (fail-closed, WhatsApp only) and a `store_customers.accepts_marketing` boolean. `POST /v1/customers/:email/email` sends arbitrary merchant→customer email with **no consent check at all**.
9. **Staff-lifecycle audit writes are guaranteed to fail** — `employee.ts` inserts `actor_type: 'merchant'`, which violates the `audit_logs_actor_type_check` CHECK constraint; the failure is swallowed by a try/catch.
10. **Staff role-change and staff-removal (the Users & permissions page's only two write actions after invite) are broken** — `verifyEmployeeOwnership` queries `employees` without a tenant predicate, which the runtime tenant guard rejects.

---

## 1. Surface inventory

### 1.1 Customer surfaces — merchant control plane

| Surface | Path | Kind |
|---|---|---|
| Customer list | `apps/merchant-control-plane/src/app/[store]/customers/page.tsx` | page |
| Customer detail | `apps/merchant-control-plane/src/app/[store]/customers/[email]/page.tsx` | page |
| Segments | `apps/merchant-control-plane/src/app/[store]/customers/segments/page.tsx` | page |
| Export (CSV) | `apps/merchant-control-plane/src/app/[store]/export/page.tsx` | page |
| list proxy | `.../api/stores/[store]/customers/route.ts` | proxy (GET) |
| detail proxy | `.../api/stores/[store]/customers/[email]/route.ts` | proxy (GET) |
| notes proxy | `.../api/stores/[store]/customers/[email]/notes/route.ts` | proxy (GET, POST) |
| segments proxy | `.../api/stores/[store]/customers/segments/route.ts` | proxy (GET, POST) |
| segment update proxy | `.../api/stores/[store]/customers/segments/[id]/route.ts` | proxy (PATCH) |
| segment preview proxy | `.../api/stores/[store]/customers/segments/preview/route.ts` | proxy (POST) |

**No merchant UI exists** for: customer create, customer edit (`PATCH`), tag edit, merge, delete/redact, per-customer email send, address CRUD, per-customer DPDP data-export, DSR export/erase, or account enable/disable.

### 1.2 Gateway customer routes — `services/api-gateway/src/routes/customers.ts` (mounted `services/api-gateway/src/index.ts:792`)

| # | Route | Line | Ownership gate | Staff permission | Step-up | MCP proxy? |
|---|---|---|---|---|---|---|
| 1 | `GET /` (list) | 423 | `hasOwnedStoreScope` :433 | **none** | n/a | yes |
| 2 | `POST /` | 457 | :462 | `customers:write` :469 | n/a | no |
| 3 | `GET /segments` | 497 | :501 | **none** | n/a | yes |
| 4 | `POST /segments` | 532 | :537 | **none** | n/a | yes |
| 5 | `PATCH /segments/:id` | 562 | :578 (after unscoped read :568) | **none** | n/a | yes — **BROKEN, see G-F-06** |
| 6 | `POST /segments/preview` | 607 | :611 | **none** | n/a | yes |
| 7 | `GET /segments/:id/customers` | 629 | :638 | **none** | n/a | no |
| 8 | `GET /:email/data-export` | 661 | :671 | **none** | **none** | no |
| 9 | `PATCH /:email` | 748 | :759 | `customers:write` :765 | n/a | no |
| 10 | `GET /:email/notes` | 833 | :843 | **none** | n/a | yes |
| 11 | `POST /:email/notes` | 863 | :869 | **none** | n/a | yes |
| 12 | `PUT /:email/tags` | 917 | :923 | **none** | n/a | no |
| 13 | `POST /:email/email` | 949 | :955 | **none** | n/a | no |
| 14 | `POST /:email/merge` | 995 | :1006 | **none** | n/a | no |
| 15 | `GET /:email` (detail) | 1134 | :1145 | **none** | n/a | yes |
| 16 | `DELETE /:email` (redact) | 1207 | :1217 | **none** | **none** | no |
| 17 | `GET /:email/addresses` | 1342 | :1352 | **none** | n/a | no |
| 18 | `POST /:email/addresses` | 1370 | :1376 | **none** | n/a | no |
| 19 | `PATCH /:email/addresses/:id` | 1416 | :1432 (after unscoped read :1424) | **none** | n/a | no — **BROKEN, see G-F-07** |
| 20 | `DELETE /:email/addresses/:id` | 1468 | :1483 (after unscoped read :1475) | **none** | n/a | no — **BROKEN, see G-F-07** |

Evidence type: `GATEWAY_CODE`. Every route above **does** carry a tenant-ownership gate — I found **no customer route missing an ownership check**.

### 1.3 Gateway staff routes — `services/api-gateway/src/routes/employee.ts` (mounted `index.ts:789`, **after** `api.use('/*', authMiddleware)` at `index.ts:750`)

| Route | Line | Gate | Reachability |
|---|---|---|---|
| `POST /auth/login` | 135 | Supabase `signInWithPassword` | **UNREACHABLE** — behind `authMiddleware`; a staff member with no token gets 401 before the handler runs |
| `POST /auth/accept-invite` | 208 | invite token in `employee_invites` | **UNREACHABLE** — same reason (G-F-09) |
| `GET /` | 269 | `verifySiteOwnership` :280 | owner only |
| `POST /` | 313 | `verifySiteOwnership` :324 + seat limit :328 | owner only |
| `GET /me` | 369 | `employees.user_id = auth.user.id` | any employee |
| `GET /limits` | 388 | `verifySiteOwnership` :397 | owner only |
| `POST /invite` | 413 | `verifySiteOwnership` :430, sends email :456 | **never called** by any client (G-F-10) |
| `GET /tickets` | 481 | employee row only | **BROKEN** — unscoped `support_tickets` (G-F-13) |
| `GET /analytics` | 525 | employee row only | **BROKEN** — unscoped `sites`/`orders` (G-F-13) |
| `PATCH /:id` | 556 | `verifyEmployeeOwnership` :562 | **BROKEN** — unscoped `employees` read (G-F-12) |
| `DELETE /:id` | 586 | `verifyEmployeeOwnership` :591 | **BROKEN** — same (G-F-12) |

### 1.4 Privacy / DSR routes — `services/api-gateway/src/routes/security.ts` (mounted `index.ts:780`)

| Route | Line | Ownership | Step-up | Staff perm | MCP UI |
|---|---|---|---|---|---|
| `POST /security/step-up/challenges` | 159 | `resolveTenantContextForOwnedSite` :163 | issues token | none | yes (`components/security/StepUpDialog.tsx`) |
| `POST /security/dsr/export` | 252 | :256 | **none** (despite `customer.dsr.export` being a declared step-up action, `security.ts:26`) | none | **no UI** |
| `POST /security/dsr/erase` | 310 | :314 | `verifySensitiveActionStepUp` :317 | none | **no UI** |

---

## 2. Required end-to-end traces

### 2.1 Customer LIST — **PARTIAL (rendering defect)**

```
Merchant clicks "Customers" in nav
→ page  apps/merchant-control-plane/src/app/[store]/customers/page.tsx:160
→ fetch `/api/stores/{store}/customers?limit=100[&search=]`   (page.tsx:181)
→ proxy apps/merchant-control-plane/src/app/api/stores/[store]/customers/route.ts:6
     resolveOwnedStoreId(store)   -> lib/stores/resolve-owned-store.ts (GET /v1/stores/handle/:handle, owner-only)
→ typed client  packages/typescript/api-client/src/index.ts (customers.list)
→ gateway  GET /v1/customers?store_id=…   services/api-gateway/src/routes/customers.ts:423
     auth: authMiddleware (index.ts:750) — Supabase bearer OR internal-session HMAC
     authz: hasOwnedStoreScope -> resolveOwnedStoreScope -> verifySiteOwnership (auth-user.ts:39) — OWNER ONLY
     staff permission: MISSING (no `customers:read` guard anywhere in the repo)
→ data: store_customers (customers.ts:131-157) + orders (159-181), site-scoped `.eq('store_id', storeId)`
     merged by buildCustomerSummaries (packages/commerce-core/src/index.ts:983)
     serialized by customerSummaryPayload (customers.ts:290-318)
→ response fields: id, store_id, email, phone, first_name, last_name, display_name, status,
     accepts_marketing, tags, order_count, total_spent, last_order_at, created_at, …
→ page mapCustomer (page.tsx:142-158) reads: full_name || customer_name  ->  MISSING  -> "Anonymous"
                                             total_orders                ->  MISSING  -> 0
                                             first_order_at, last_order_id -> MISSING -> null
→ RLS: bypassed (service_role); the effective control is the tenant-guard proxy (tenant/tenant-scoped.ts)
→ tests: NONE covering this route or page
→ runtime observation: NOT PERFORMED
```

**MISSING links:** `customers:read` server-side permission; contract test between `customerSummaryPayload` and `mapCustomer`; any pagination beyond the hardcoded `limit=100` in the page (`page.tsx:178`) — the gateway itself reads up to 5000 rows (`customers.ts:141`, `:169`) and supports cursors, the UI uses none of it.

### 2.2 Customer DETAIL — **IMPLEMENTED_NOT_RUNTIME_VERIFIED** (the historical gap is CLOSED)

```
Row click -> router.push(`/{store}/customers/{encodeURIComponent(email)}`)   (page.tsx:402)
→ page  [store]/customers/[email]/page.tsx:504
→ fetch `/api/stores/{store}/customers/{email}`            (page.tsx:523)
     + fetch `/api/stores/{store}/customers/{email}/notes` (page.tsx:557)
→ proxy .../customers/[email]/route.ts:7  -> resolveOwnedStoreId -> customers.getByEmail({query:{store_id}})
→ gateway GET /v1/customers/:email        customers.ts:1134
     authz  hasOwnedStoreScope :1145
     profile  store_customers .eq(store_id).eq(email)          (loadCustomerProfileRow :370-383)
     orders   orders .eq('store_id').eq('customer_email')      (:1151-1156)   ← site-scoped join, correct
     addresses customer_addresses .eq('store_id').eq('customer_email') (:1157-1162) ← site-scoped, correct
     404 when neither a profile row nor any order exists (:1171)
     synthesises a customer from orders when no store_customers row exists (:1181-1204) — a guest-checkout
        buyer still gets a detail page. Good.
→ page mapCustomerDetail (page.tsx:151-182) reads display_name / order_count / total_spent → MATCHES payload
→ renders ProfileCard, OrderHistoryCard, AddressesCard, NotesCard
→ tests: NONE.  runtime observation: NOT PERFORMED
```

**Verdict on the prior "customer detail gap":** `CONTRADICTORY_EVIDENCE` against the doc claim — the page, proxy and endpoint all exist and the order history join *is* site-scoped. What is genuinely absent from the detail page: edit profile, edit tags, enable/disable account, delete/redact, per-customer data export, merge, address management, per-customer email — all of which exist as gateway routes with no UI (see §1.2 "MCP proxy?" column).

### 2.3 Customer NOTES — **IMPLEMENTED_NOT_RUNTIME_VERIFIED**

`NotesCard` (page.tsx:393) → `POST /api/stores/{store}/customers/{email}/notes` → proxy `.../notes/route.ts:24` → `POST /v1/customers/:email/notes` (`customers.ts:863`). Ownership at :869. **No `customers:write` guard** (contrast `PATCH /:email` at :765 which has one). The handler also appends the note text into `store_customers.notes` (`customers.ts:904-912`) — a second, denormalised copy that is never reconciled if the `customer_notes` row is later soft-deleted.

### 2.4 Customer SEGMENTS — **PARTIAL** (create/preview/list OK; **edit BROKEN**)

Create/list/preview paths are scoped correctly. The edit path is broken:

```
segments/page.tsx:609  fetch(url, { method: 'PATCH' })
→ proxy .../customers/segments/[id]/route.ts:8 -> customers.segments.update(id, …)
→ gateway PATCH /v1/customers/segments/:id   customers.ts:562
     first statement (customers.ts:568-573):
         db.from('customer_segments').select('id,store_id,rules').eq('id', id).is('deleted_at', null).maybeSingle()
     `customer_segments` is a registered tenant table with scopeColumns = ['store_id']
         (services/api-gateway/src/tenant/tenant-tables.registry.ts)
     the runtime tenant guard (tenant/tenant-scoped.ts:78-108) only marks a query "scoped" on
         eq/in/filter/match/or/insert/upsert against a scope column — `eq('id',…)` and `is(…)` do not qualify
     → the awaited builder REJECTS with "Tenant table customer_segments requires a tenant/owner predicate
       before execution" (tenant-scoped.ts:87-92)
     → the throw escapes the handler → app.onError (index.ts:838) → HTTP 500 INTERNAL_ERROR
```
There is **no DELETE segment route** in the gateway and no delete affordance in the UI, so segments can be created but never removed.

### 2.5 Customer DELETE / redaction — **BACKEND_ONLY**

`DELETE /v1/customers/:email` (`customers.ts:1207`) redacts `store_customers`, hard-deletes `customer_addresses`, `customer_credentials`, `wishlists`, `customer_wishlists`, and rewrites `orders.customer_email/name/phone`, then dispatches a `customers/redact` app-compliance webhook with `failClosed: false` (`customers.ts:1313-1324`). **No UI, no staff-permission gate, no step-up, no `audit_logs` entry, and no `data_subject_requests` record** — unlike the parallel `POST /security/dsr/erase` which does create a DSR record and does require step-up.

### 2.6 Customer data export (two parallel implementations)

| Path | Route | Gate | Persists evidence? | UI |
|---|---|---|---|---|
| A | `GET /v1/customers/:email/data-export` (`customers.ts:661`) | ownership only | **no** — returns raw JSON in the response | none |
| B | `POST /v1/security/dsr/export` (`security.ts:252`) | ownership only | yes — `data_subject_requests` + encrypted `customer_dsr_exports` (`security.ts:124-157`) | none |
| C | `GET /v1/export/customers` (`export.ts:727`) | ownership only (`export.ts:306`) | R2 CSV job, signed download token (`export.ts:656-683`) | **not used by the UI** |
| D | merchant Export page | `GET /api/stores/{store}/customers?limit=100` then client-side CSV (`export/page.tsx:232-260`) | ownership only | yes — **and it is broken (G-F-03)** |

Four overlapping export mechanisms; the only one wired to the UI is the broken client-side one.

### 2.7 Staff invite → activation — **BROKEN end to end**

```
Owner: settings/users page -> "Add staff"        [store]/settings/users/page.tsx:181
  body { email, full_name, role, permissions: permissionsForRole(role), status:'invited' }   (:194-201)
→ proxy /api/stores/[store]/users/route.ts:30 -> employees.create({...body, store_id})
→ gateway POST /v1/employees                    employee.ts:313
     verifySiteOwnership :324 ; seat limit :328
     planEmployeeStaffCreate(body, …)            packages/auth-core/src/index.ts:1482-1507
        → returns ONLY { store_id, email, full_name, role, status:'invited', is_active, created_by }
        → the `permissions` the UI sent is SILENTLY DROPPED                        [G-F-11]
     inserts into `employees` — NO token, NO employee_invites row, NO email sent   [G-F-10]
     writeEmployeeAudit(…, 'employee.created') -> audit_logs INSERT with actor_type:'merchant'
        → violates audit_logs_actor_type_check -> insert fails -> swallowed by catch (employee.ts:198) [G-F-14]

The only route that mints a token + sends the invite email is POST /v1/employees/invite (employee.ts:413).
  packages/typescript/api-client/src/index.ts:4697-4707 exposes employees.{list,limits,create,update,remove}
  — there is NO `invite` method, and no proxy or page calls that path.                [G-F-10]

Invitee side: apps/merchant-control-plane/src/app/accept-invite/page.tsx:40
→ POST /api/employees/accept-invite
→ apps/merchant-control-plane/src/app/api/employees/accept-invite/route.ts:21
     merchantApiFetch('/employees/auth/accept-invite')  — no session cookie ⇒ NO auth headers attached
     (apps/merchant-control-plane/src/lib/api/client.ts:44-80: headers are only added when
      LETBUYY_MERCHANT_SESSION_COOKIE is present)
→ gateway /v1/employees/* sits BEHIND api.use('/*', authMiddleware) (index.ts:750)
     authMiddleware exhausts all three verifiers and returns 401 "Missing or invalid authorization header"
     (services/api-gateway/src/middleware/auth.ts:264-272)                            [G-F-09]

And the invite email link points at a page that does not exist:
     services/api-gateway/src/lib/transactional-email.ts:66-68
        `${platformBaseUrl}/employees/auth/accept-invite?token=…`
     the actual page is `/accept-invite?token=…`                                      [G-F-15]
```

**Conclusion:** there is no path by which a merchant staff member can activate an account. `BROKEN`.

### 2.8 Staff session → store access — **BROKEN**

Even if an `employees` row existed and the person authenticated, every merchant page resolves the store through `resolveOwnedStoreId` → `GET /v1/stores/handle/:handle` (`services/api-gateway/src/routes/stores.ts:553`), whose query is
```
.or(`store_name.eq.${handle},subdomain.eq.${handle}`)
.or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)     stores.ts:567-568
```
i.e. **the site row must be owned by the caller**. Staff are not in `sites`. Result: 404 "Store not found" for every staff member on every merchant page. Same for `GET /v1/stores/:id` (`stores.ts:589`) and for `resolveOwnedStoreScope` (`lib/tenant-context.ts:184-215`, ownership asserted at `:193-196` *before* any membership/role resolution).

---

## 3. Customer identity model

- **Customers are strictly per-site.** `public.store_customers` is keyed by `store_id` + `email` (`database/supabase/migrations/000_baseline.sql:12186-12207`). `public.customer_credentials` is unique on `(store_id, email_or_phone)` (`000_baseline.sql:8898-8907`; the `ON CONFLICT (store_id, email_or_phone)` in `migrations/111_customer_credentials_source_of_truth.sql:31` confirms the constraint). There is **no** cross-store customer identity, no global customer id, and no shared login.
- **`customer_credentials` holds** `id, store_id, email_or_phone, password_hash, last_login_at, login_count, created_at, updated_at`, plus `customer_id` (added by migration 111) and `encrypted_identifier` / `pii_encryption_key_id` (added by `153_executable_identity_security.sql:152-154`).
- **`store_customers.password_hash` is legacy and drained.** Migration 111 moved values into `customer_credentials` and nulled the column (`111_…sql:35-38`). One route still writes it: `customers.ts:1243` sets `password_hash: null` during redaction (harmless but it re-references a column the migration declared dead).
- **Secret handling is clean.** Passwords are bcrypt-hashed at cost 10 (`services/api-gateway/src/routes/storefront/customer-registration.ts:79`) and the "first password only when no credential exists" precondition at `:62-77` prevents account takeover. `password_hash` is **never** in any `select()` column list on a merchant-facing read path (`loadCustomerProfileRow` `customers.ts:377`; data-export `customers.ts:696`; DSR payload `security.ts:107` — all enumerate columns explicitly and exclude it). I found no code that logs or returns a credential.
- **Customer sessions are HS256** (`CUSTOMER_SESSION_SECRET`, `issueCustomerSession`) — `services/api-gateway/src/routes/storefront/customer-registration.ts:141-143`, `.../customer-engagement-routes.ts:610,770`, verified at `services/api-gateway/src/middleware/customer-session.ts:58`. This is the deviation CLAUDE.md flags; see §8 (cross-cutting) — **not** ART-05 compliant.

---

## 4. DPDP consent & DSR

### 4.1 The canonical consent ledger is DEAD CODE

`public.consents` is created in `database/supabase/migrations/153_executable_identity_security.sql:6-30` with `subject_type`, `consent_type ∈ {dpdp_account, dpdp_marketing, whatsapp_optin, billing_mandate}`, `status ∈ {granted, revoked, expired}`, `evidence jsonb`, `idempotency_key`, RLS ENABLE+FORCE and a `site_id = current_site_id()` policy (`:224-231`).

Exhaustive grep for runtime references to the table across `services/`, `apps/`, `packages/` returns **only**:
- `services/api-gateway/src/tenant/tenant-tables.registry.ts:594` (generated registry entry)
- `services/api-gateway/src/identity-foundation/repository-boundary.ts:32` (`consent: ['consents']` — a name map)
- `services/api-gateway/src/__tests__/security-v1.test.ts:64,83` (asserts the migration text contains `CREATE TABLE`/`DROP TABLE`)

**There is not one `.from('consents')` read or write anywhere.** Status: `NOT_IMPLEMENTED` for the canonical ledger; the only tests that "cover" it assert the migration file's string content, not behaviour.

### 4.2 What actually gates sends today

| Send path | Gate | Fails | Canonical? |
|---|---|---|---|
| `POST /v1/whatsapp/send` (`whatsapp.ts:654`) | `wa_optins.consent_status='opted_in' AND revoked_at IS NULL` (`whatsapp.ts:250-289`, enforced `:692-701`) | **CLOSED** (403 `WA_CONSENT_REQUIRED`) | no — parallel store (`migrations/150_executable_whatsapp_scoped.sql:60-73`) |
| marketing campaigns (`marketing.ts`) | `store_customers.accepts_marketing` boolean (`marketing.ts:240`, `:279-281`) | **CLOSED** (recipient filtered out) | no — a mutable boolean, not an append-only ledger with evidence |
| **`POST /v1/customers/:email/email`** (`customers.ts:949`) | **NONE** — no consent record, no `accepts_marketing` check; sends via Resend at `:979-986` | **OPEN** | no |
| contact form | `contact_requests.consent_privacy/consent_marketing` (`migrations/195_contact_requests.sql:87-88`) | n/a | no — 4th store |

`POST /v1/whatsapp/optins` (`whatsapp.ts:618`) lets the **merchant** self-assert `consent_status:'opted_in'` with `consent_source:'manual'` and no evidence payload — a merchant-attested consent record with no proof artefact.

### 4.3 DSR export / erasure

- Export: `POST /v1/security/dsr/export` (`security.ts:252`) creates a `data_subject_requests` row, builds the payload (`:102-122`), KMS-encrypts it into `customer_dsr_exports` (`:124-157`), marks the request fulfilled and emits `customer.dsr_requested`. **No step-up**, even though `customer.dsr.export` is one of the four declared step-up actions (`security.ts:26`, `security-controls.ts:1`, and the DB CHECK at `migrations/153_…sql:115`).
- Erasure: `POST /v1/security/dsr/erase` (`security.ts:310`) **does** require step-up (`:317-325`) and does record the DSR. It redacts `store_customers`, deletes `customer_addresses` + `customer_credentials`, and rewrites `orders` contact fields (`:343-357`).
- **Neither has any merchant UI.** Grep across `apps/merchant-control-plane/src` for `dsr|data-export|erase|redact` returns only unrelated policy/plan pages.
- `sensitive_action_approvals` (maker-checker, `migrations/153_…sql:120-141`) — **zero runtime references** outside the registry and a migration-text test. Dead schema.

---

## 5. STAFF RBAC — the core of this assignment

### 5.1 The role/permission catalogue

Declared **only in the UI package**: `apps/merchant-control-plane/src/lib/staff/roles.ts`.

12 permissions (`roles.ts:25-38`): `products:write`, `products:read`, `orders:write`, `orders:read`, `customers:write`, `customers:read`, `content:write`, `marketing:write`, `shipping:write`, `returns:write`, `reports:read`, `settings:write`.

6 roles (`roles.ts:47-92`):

| Role | Granted |
|---|---|
| manager | products:write, orders:write, customers:write, content:write, marketing:write, shipping:write, returns:write, reports:read, settings:write |
| editor *(default, `roles.ts:96`)* | products:write, content:write, reports:read |
| fulfillment | orders:write, shipping:write, reports:read |
| marketing | marketing:write, customers:read, reports:read |
| support | orders:read, customers:write, returns:write |
| viewer | products:read, orders:read, reports:read |

The gateway's own `StaffPermissionKey` union (`services/api-gateway/src/middleware/staff-permission.ts:30-41`) lists 11 keys and **omits `reports:read`** — a role that grants only `reports:read` maps to nothing the gateway can express.

The DB `employees.role` CHECK allows `support|sales|marketing|operations|manager|admin|editor|viewer|fulfillment|staff` (`000_baseline.sql:9192`) — `sales`, `operations`, `admin`, `staff` have no UI role definition, and the UI's roles are a strict subset.

### 5.2 Enforcement mechanism and its two fatal defects

`assertStaffPermission` / `requireStaffPermission` (`staff-permission.ts:185`, `:200`) → `evaluateStaffRequest` (`:129`):

```
mode = staffRbacMode(env)                          :135   default 'dryrun'  (:45-52)
if mode === 'off' → allow                          :136
if !siteId || !userId → allow                      :137          ← fail-OPEN
isOwner = verifySiteOwnership(db, siteId, userId)  :141
if !isOwner → granted = resolveGrants(...)         :146
decision = evaluateStaffPermission(...)            :151
return { block: !allowed && mode === 'enforce' }   :153
catch → return { block:false }                     :154-163      ← fail-OPEN on any error
```

**Defect A — the mode is never set to `enforce` anywhere in the repository.** `MERCHANT_STAFF_RBAC_MODE` appears in `staff-permission.ts`, one unit test, and 13 `docs/v1-execution/**` files that all describe it as "dry-run by default … not fully closed until the flip". It is **absent from `services/api-gateway/wrangler.toml`** (its `[vars]` block starts at line 31 and contains no RBAC key) and absent from `config/env/*`. All 30 guards are therefore behaviour-neutral. `docs/v1-execution/phase-5-lock/04-known-gaps.md:13` says exactly this.

**Defect B — `resolveGrants` queries a column that does not exist.**
```
staff-permission.ts:89-95
  db.from('employees').select('permissions, status, role')
    .eq('site_id', siteId)        ← employees has NO site_id column
    .eq('user_id', userId)
    .eq('status', 'active').maybeSingle()
```
`public.employees` columns (`000_baseline.sql:9172-9194`): `id, user_id, email, full_name, phone, avatar_url, role, permissions, is_active, last_login_at, created_by, created_at, updated_at, role_id, department, login_count, **store_id**, status, deleted_at`. No `site_id`, and no later `ALTER TABLE … employees ADD COLUMN site_id` exists (`grep "ALTER TABLE.*employees"` over all migrations returns only baseline constraint/RLS statements). The query executes (the tenant guard is satisfied by `eq('user_id', …)`, a declared scope column) but PostgREST returns an error; `const { data } = await …` discards the error, `row` is `null`, and the function returns `{ found:false, granted: [] }`. **Every non-owner therefore resolves to zero grants**, so `evaluateStaffPermission` returns `{allowed:false, reason:'no-grants'}` (`:66-68`) for every staff member for every permission.

Consequence: the "dry-run logs" the rollout plan says to verify before flipping to `enforce` would show `allowed:false, reason:"no-grants", employee_found:false` for 100 % of staff requests — indistinguishable from a correctly-denying viewer. Flipping to `enforce` would deny **all** staff **all** guarded writes.

**Defect C — grants are never persisted on create.** `planEmployeeStaffCreate` (`packages/auth-core/src/index.ts:1482-1507`) constructs the insert payload and never copies `body.permissions`. The UI does send it (`settings/users/page.tsx:199`). Only `planEmployeeUpdate` (`auth-core/src/index.ts:1537-1542`) persists `permissions`, i.e. only after a subsequent role change — which is itself broken (G-F-12).

### 5.3 The parallel, dormant RBAC model

`site_memberships` / `site_roles` / `site_role_permissions` exist (`000_baseline.sql:11896`, `:11922`, `:11941`) and are read by `resolveTenantAccessProfile` (`lib/tenant-context.ts:156-182`). But:
- ownership is asserted **before** membership resolution (`tenant-context.ts:193-196`), so a membership can never grant access;
- **no route or migration ever inserts a `site_memberships` or `site_role_permissions` row** (grep across `services/`, `apps/`, `packages/`, `database/supabase/migrations/` for `insert` + those table names returns nothing);
- `site_role_permissions` is not even in the tenant-table registry.

Two competing RBAC authorities, neither functional. `AGENTS.md` WIN-R7 forbids exactly this shape (a second implementation beside the named winner).

### 5.4 The 15-operation sensitive-action matrix

(a) = UI hides/disables for insufficient role · (b) = server-side permission check at the gateway/RPC

> **(a) is `NO` for every row.** Exhaustive grep of `apps/merchant-control-plane/src` for role/permission gating returns only `settings/users/page.tsx` (which *composes* the permission payload for an invite) and `lib/staff/roles.ts` itself. There is **no** conditional rendering, no disabled state, no route guard and no middleware anywhere in the merchant control plane that depends on the caller's staff role. `apps/merchant-control-plane/middleware.ts` does not exist.

| # | Sensitive operation | Gateway route (path:line) | (a) UI gate | (b) Server staff-permission gate | Step-up | Audit |
|---|---|---|---|---|---|---|
| 1 | Refund a payment | `routes/payments.ts:467` | NO | **NONE** | **YES** `:497-506` | none |
| 2 | Complete an order refund (money RPC) | `routes/orders.ts:1342` | NO | `orders:write` `:1349` (dry-run) | **NONE** | none |
| 3 | Create an order refund/return | `routes/orders.ts:1427` · `routes/returns.ts:185` | NO | `orders:write` `:1434` / **none** in returns.ts | **NONE** | none |
| 4 | Release a payout | `routes/payouts.ts:553` | NO | **NONE** | **YES** `:576-586` | none |
| 5 | Delete a product | `routes/products.ts:1188` | NO | `products:write` `:1198` (dry-run) | n/a | none |
| 6 | Edit a product price | `routes/products.ts:1130` | NO | `products:write` `:1141` (dry-run) | n/a | none |
| 7 | View customer PII (list + detail) | `routes/customers.ts:423`, `:1134` | NO | **NONE** (`customers:read` has 0 enforcement sites) | n/a | none |
| 8 | Export customer data | `routes/export.ts:727` · `routes/customers.ts:661` · `routes/security.ts:252` | NO | **NONE** on all three | **NONE** | export.ts/customers.ts: none; security.ts: DSR row only |
| 9 | Change payment settings | `routes/stores.ts:353` (`POST /:id/payment-config`) | NO | **NONE** | n/a | none |
| 10 | Invite / create staff | `routes/employee.ts:313`, `:413` | NO | **NONE** (owner-only) | n/a | `audit_logs` attempted — **fails**, G-F-14 |
| 11 | Change a staff role | `routes/employee.ts:556` | NO | **NONE** (owner-only) | n/a | attempted, fails |
| 12 | Change GST / tax settings | `routes/shipping-tax.ts:383`, `:414`, `:451` | NO | **NONE** (only *shipping* rates carry `shipping:write` at `:251,296,340`) | n/a | none |
| 13 | Publish a theme | `routes/themes.ts:673` | NO | **NONE** | n/a | none |
| 14 | Issue a gift card | `routes/gift-cards.ts:62` | NO | **NONE** (ownership only, `:70`) | n/a | none |
| 15 | Cancel an order | `routes/orders.ts:1142` (`PATCH /:id`) | NO | `orders:write` `:1148` (dry-run) | n/a | none |
| 16 | Delete / redact a customer | `routes/customers.ts:1207` | NO | **NONE** | **NONE** | none |
| 17 | Change notification prefs / webhooks | `routes/notifications.ts:225`, `:462` | NO | **NONE** | n/a | none |
| 18 | Delete the store | `routes/stores.ts:816` | NO | **NONE** | n/a | none |

Permission-key enforcement census (grep of `services/api-gateway/src`, excluding tests and `staff-permission.ts` itself):

| Key | Staff-RBAC enforcement sites |
|---|---|
| `products:write` | 23 |
| `orders:write` | 9 |
| `marketing:write` | 3 (all in `coupons.ts`) |
| `shipping:write` | 3 (all in `shipping-tax.ts`, shipping rates only) |
| `customers:write` | 2 (`customers.ts:469`, `:765`) |
| `customers:read` | **0** |
| `returns:write` | **0** |
| `content:write` | **0** |
| `reports:read` | **0** (not even a valid gateway key) |
| `settings:write` | **0** as a staff key — the 3 hits are `middleware/permission.ts`, which is the **billing-plan** entitlement guard, not RBAC |
| `products:read` / `orders:read` | **0** as staff keys — same, plan-tier lists in `middleware/permission.ts:31-72` |

**Important nuance for the final dossier:** because staff cannot currently authenticate into the merchant control plane at all (§2.7, §2.8), the absent server-side checks are **not presently exploitable by a staff member**. They become an immediate privilege-escalation surface the moment staff access is made to work. The correct framing is *"the RBAC design is UI-shaped and server-absent, and the feature it protects is non-functional"* — not *"staff can escalate today"*.

---

## 6. Step-up (PAY-R7 / R-10)

**The implementation is real cryptography.** `services/api-gateway/src/lib/security-controls.ts`:
- Issuance requires an **active TOTP factor** and a verified code (`routes/security.ts:176-180`, `verifyTotpCode`), then signs `lb-stepup-v1.<base64url(payload)>` with **HMAC-SHA256** via WebCrypto (`security-controls.ts:79-88`).
- The payload binds `action`, `actor_id`, `site_id`, `challenge_id`, `jti`, `verified_at`, `exp` (`:31-42`, `:127-140`).
- Verification recomputes the MAC and uses a **constant-time compare** (`:91-98`, `:184-186`), then re-checks `action`, `actor_id`, `site_id` and `verified_at` against the caller's context (`:187-190`).
- Window is 10 minutes with a 60 s future-skew cap (`:29`, `:203`).
- **Fails closed** when `STEP_UP_SIGNING_SECRET` is absent/placeholder — `configuredSecret` requires ≥32 chars and rejects `SKIP_NEEDS_HUMAN_*` / `replace-with*` (`:47-52`), and `verifySensitiveActionStepUp` returns `STEP_UP_REQUIRED` (`:165-176`).
- A hashed token + `metadata.step_up_crypto:'hmac-sha256'` row is persisted in `step_up_challenges` (`routes/security.ts:199-229`).

There is **no string-length check and no boolean flag** anywhere in this path. **PAY-R7 / R-10 are satisfied for the routes that call it.**

**Enforced at the gateway (not just the UI)** for exactly three actions:
| Action | Route | Line |
|---|---|---|
| `refund.approve` | `POST /v1/payments/:paymentId/refund` | `payments.ts:497-506` |
| `payout.release` | `POST /v1/payouts/:id/settle` | `payouts.ts:576-586` |
| `customer.dsr.erase` | `POST /v1/security/dsr/erase` | `security.ts:317-325` |

**Gaps in step-up coverage** (each is a separate gap below):
- `POST /v1/orders/:id/refund/complete` → `complete_order_refund` (canonical money RPC) — **no step-up** (G-F-01).
- `POST /v1/orders/:id/refund` and `POST /v1/returns` → `create_order_return_and_refund` — no step-up.
- `customer.dsr.export` is a declared step-up action but `POST /v1/security/dsr/export` does not verify it (G-F-05).
- `DELETE /v1/customers/:email` (irreversible PII destruction + order rewriting) — no step-up.
- **No replay binding.** `verifySensitiveActionStepUp` never looks the `challenge_id`/`jti` back up in `step_up_challenges`, and nothing marks a challenge consumed. Within the 10-minute window a single token can authorise an unlimited number of refunds/payouts of the same action type for the same actor+site (G-F-04).

Secrets `STEP_UP_SIGNING_SECRET` and `TOTP_ENCRYPTION_KEY` are declared in `config/env/{staging,production}.env.example:51,118` and `config/env/templates/worker.env.example:40,103` as **placeholders only** — no real value is in the repository. `SKIPPED_HUMAN_DECISIONS.md:43` (`SKIP-CAP-STEPUP-CRYPTO`) records provisioning + live smoke as human-owned. That is honest and fail-closed; it also means **refunds and payouts are impossible in any environment without a provisioned signing secret and an enrolled TOTP factor** (428 `STEP_UP_FACTOR_REQUIRED` / 503 `STEP_UP_SIGNING_SECRET_REQUIRED`).

---

## 7. Audit logging

**Schema** (`000_baseline.sql:8440-8455`): `id, actor_id, actor_type, actor_email, action, resource_type, resource_id, old_values, new_values, metadata, ip_address, user_agent, created_at`.
- **No `site_id` / `store_id` column** → the merchant audit trail is not tenant-scoped; `writeEmployeeAudit` stuffs `store_id` into `metadata` (`employee.ts:362`, `:468`).
- `audit_logs` is **not** in the tenant-table registry (verified against `tenant-tables.registry.ts`), so the runtime tenant guard does not apply to it.
- RLS is ENABLEd (`000_baseline.sql:24387`) with `audit_insert … WITH CHECK (true)` (`:24380`) and super-admin-only SELECT (`:24393`, `:27490`). **No UPDATE or DELETE policy** ⇒ append-only *under RLS*. But there is **no FORCE ROW LEVEL SECURITY** on `audit_logs` (grep for `FORCE ROW` + `audit_logs` returns nothing) and the gateway connects with the Supabase **service role**, which bypasses RLS — so append-only is a policy convention, not an enforced invariant, for the writer. There is no hash chain, no signature, no external sink.
- Merchants can never read their own audit trail (SELECT is `is_super_admin()` only) and there is no merchant audit UI.

**Coverage.** `audit_logs` writes exist in: `middleware/rbac.ts:388`, `lib/internal-developer-ops.ts:93`, `lib/internal-compliance.ts:137`, `routes/employee.ts:187`, `routes/admin.ts:128/167/330/354`, `routes/operations.ts:112`, `routes/internal-console*.ts`, `routes/operations/*.ts`. i.e. **platform-operator actions are audited; merchant actions are not**, with the single exception of staff lifecycle — which fails (below).

**The staff audit writes are guaranteed to fail.** `employee.ts:187-197` inserts `actor_type: 'merchant'`. The CHECK constraint is `actor_type = ANY (ARRAY['user','employee','super_admin','system'])` (`000_baseline.sql:8454`) and no migration widens it (grep over all 187 migrations for `audit_logs_actor_type_check` returns only the baseline definition). The insert therefore raises a check violation, which is caught and logged at `employee.ts:198-205`. Every other writer in the repo uses a legal value (`'employee'`, `'super_admin'`, `'system'`, `'user'`, `'webhook'`) — `employee.ts` is the only offender.

**Not audited at all:** refunds, payouts, gift-card issuance/status, customer PII view, customer export, customer redaction, customer merge, price changes, payment-config changes, tax changes, theme publish.

---

## 8. Cross-tenant analysis

**The real control is a runtime proxy, not RLS.** `getSupabaseAdmin` (`lib/supabase.ts:17`) wraps the **service-role** client in `createTenantGuardedSupabaseClient` (`tenant/tenant-scoped.ts:112-123`), which rejects any query against a registered tenant table that never applied a scope predicate (`:78-92`). 261 tables are registered. `tests/governance/foundation-wave2-tenant.test.ts:58-75` asserts the reject/allow behaviour for the whole registry. This is a genuinely strong default-deny control and it is the reason several routes in this domain fail closed rather than leaking.

*(Constitutional note, ART-08: the gateway still connects as blanket `service_role`, so RLS/FORCE on tenant tables is bypassed and the guard proxy is the sole enforcement. `db.rpc(...)` calls are **not** proxied at all. Flagging for the tenancy agent; not re-derived here.)*

**Customer routes.** All 20 routes in §1.2 carry `hasOwnedStoreScope`/`resolveOwnedStoreScope`. **None is missing an ownership check.** Three of them additionally violate the tenant-guard contract and therefore 500 instead of leaking (G-F-06, G-F-07).

**Staff routes.** All owner-scoped routes use `verifySiteOwnership`. Two routes are scoped by *employee membership alone*, with no site predicate:
- `GET /v1/employees/tickets` (`employee.ts:481`) — `support_tickets` (registry scope `site_id`) queried with only `.is('deleted_at', null)` + `.order` + `.range` (`:501-506`). Intent was clearly a **platform-wide** ticket list for any active employee of any store. The tenant guard rejects it → 500. **Fails closed, but the intent was a cross-tenant read.**
- `GET /v1/employees/analytics` (`employee.ts:525`) — `sites`, `orders` (both registered) counted with no predicate (`:542-546`); `user_profiles` is unregistered and would have returned a **platform-wide user count**. Guard rejects on the first two → 500.

**The one confirmed cross-tenant money hole:** `POST /v1/orders/:id/refund/complete` — see G-F-01. The tenant is derived from the **order id in the path** (`orders.ts:1345`, `resolveTenantContextForOrder`), but `body.refund_id` is forwarded unchecked to `complete_order_refund`, whose signature is `(p_refund_id, p_provider_refund_id, p_provider_event_id, p_actor_id, p_request_id, p_idempotency_key)` — **no site parameter** — and which looks the refund up globally: `SELECT * FROM refunds WHERE id = p_refund_id AND deleted_at IS NULL FOR UPDATE` (`migrations/168_b1_b2_capture_refund_ledgering.sql:340-345`), then posts a settlement ledger transaction for `v_refund.site_id` (`:400-404`). The route's tenant check runs **after** the RPC returns (`execution/order-execution.adapter.ts:517-520`) — by which point the RPC's own transaction has committed.

**Address routes.** `PATCH/DELETE /customers/:email/addresses/:id` resolve the owning `store_id` from the address row before checking ownership (`customers.ts:1424-1434`, `:1475-1485`) — logically correct, but the lookup itself is unscoped so it never executes (G-F-07).

---

## 9. PII in logs

Method: grepped every `console.*` call in `services/api-gateway/src`, `services/queue-workers/src`, `services/webhook-service/src`, `apps/merchant-control-plane/src`, `apps/identity-platform/src` for `email|phone|address|customer|card|password|token|gstin|pan`.

**Result: no PII value is written to any log.** Findings, by pattern:

| Pattern | File:line | Assessment |
|---|---|---|
| Structured JSON log with ids only | `services/api-gateway/src/lib/order-confirmation-email.ts:133-141` | logs `order_id`, `store_id`, `request_id`, `environment` — **no recipient address**. Safe. |
| Same | `services/api-gateway/src/lib/gift-card-email.ts:101-107` | `store_id`, `request_id` only. Safe. |
| Same | `services/api-gateway/src/lib/transactional-email.ts:70-82`, `:97-102` | `job_type`, `site_id`, `request_id`. The invite recipient address is passed to `enqueueEmployeeInviteEmail` but is **not** logged. Safe. |
| Staff RBAC decision log | `services/api-gateway/src/middleware/staff-permission.ts:111-121` | logs `site_id`, `user_id` (UUIDs), permission key. Identifiers, not PII content. Acceptable; note it is `console.warn` even for `level:'info'` decisions, so every allowed staff request emits a warn-level line. |
| Generic error strings | `apps/identity-platform/src/app/api/auth/{reset,set}-password/route.ts:123,117`; `apps/identity-platform/src/lib/email/resend.ts:36,42` | `console.error('Reset password error:', error)` — logs the provider/DB error object. **Unstructured**; if Supabase or Resend ever includes the address in an error message it would be logged transitively. Low-likelihood, worth tightening. |
| Gateway error handler | `services/api-gateway/src/index.ts:847-855` | logs `err.message` only, and responses are sanitised to `INTERNAL_ERROR`. Safe. |
| Audit rows | `employee.ts:187-197` | writes `actor_email` into `audit_logs` — intentional and appropriate for an audit trail (and currently failing anyway). |

**No secret, token, password or hash is logged anywhere I inspected.** No `.env` content is read into a log.

---

## 10. GAP LIST

Provisional IDs `G-F-nn`. Severity/likelihood are my assessment; confidence is stated per gap.

---

### G-F-01 — Refund step-up is bypassable, and the bypass route can complete another tenant's refund `[HIGH-STAKES]` `[IRREVERSIBLE]`
- **Domain:** payments / RBAC / tenancy · **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (defect is static-provable; exploitation not executed)
- **Impact:** the second factor that ART-11/R-10/PAY-R7 mandates on refunds can be skipped entirely, and a merchant who owns *any* order can cause a refund belonging to a *different* site to be marked succeeded and posted to that site's settlement ledger.
- **Evidence:**
  - `services/api-gateway/src/routes/orders.ts:1342-1349` — `POST /:id/refund/complete`; only guard is `assertStaffPermission(..., 'orders:write')` (dry-run). No `verifySensitiveActionStepUp` anywhere in `orders.ts` (`grep verifySensitiveActionStepUp services/api-gateway/src/routes/orders.ts` → no match).
  - `services/api-gateway/src/routes/orders.ts:1366` → `service.completeRefund(orderId, tenant, body)`.
  - `services/api-gateway/src/execution/order-execution.adapter.ts:504-513` — `db.rpc('complete_order_refund', { p_refund_id: input.refund_id, … })`; `refund_id` comes straight from the request body and is never checked against `tenant.siteId`.
  - `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:314-321` — RPC signature has **no site parameter**; `:340-345` selects the refund by id alone; `:400-404` posts `post_settlement_ledger_transaction(v_refund.site_id, 'refund', …)`.
  - `services/api-gateway/src/execution/order-execution.adapter.ts:517-520` — the `order.store_id !== tenant.siteId` check runs **after** the RPC has committed.
  - Contrast: `services/api-gateway/src/routes/payments.ts:497-506` does verify step-up for the same business action.
- **Expected:** every route that reaches a canonical money RPC verifies a cryptographic step-up token bound to `action`, `actor_id` and `site_id`; every money RPC takes and enforces `p_site_id`.
- **Missing link / root cause:** two independent refund entry points were built against different security models; the RPC's tenancy is trusted to the caller.
- **Blast radius:** `refunds`, `refund_transactions`, `ledger_*` (via `post_settlement_ledger_transaction`), `orders`, gift-card ledger (`restore_gift_card_on_refund`, `orders.ts:1397`), customer refund emails.
- **Severity:** P0 · **Likelihood:** MEDIUM (requires an authenticated merchant and knowledge of a foreign `refund_id` UUID) · **Reversibility:** ledger entries are append-only — a wrong posting can only be compensated, not deleted.
- **Dependencies:** step-up secret provisioning (`SKIP-CAP-STEPUP-CRYPTO`).
- **Remediation approach (no code):** (1) add step-up verification to every refund-completing route, matching `payments.ts`; (2) add a `p_site_id` parameter to `complete_order_refund` and make the RPC raise when `v_refund.site_id <> p_site_id`; (3) validate `refund_id` belongs to the resolved order *before* the RPC call. **Do not** remediate by writing money tables from TypeScript.
- **Acceptance:** a request carrying a valid order id and a foreign `refund_id` returns 403/404 with **zero** rows written to `refunds`, `refund_transactions` and the ledger; a request with no step-up header returns 428.
- **Tests required:** integration (ephemeral PG) — cross-tenant refund_id rejected; step-up-absent rejected; step-up-expired rejected; idempotent replay.
- **Owner:** security + payments-provider + ARB · **Confidence:** HIGH on the code path; MEDIUM on real-world exploitability (depends on how `refunds.id` values could be discovered).

---

### G-F-02 — Customer list renders every customer as "Anonymous" with 0 orders (payload contract mismatch)
- **Domain:** customers · **Status:** `BROKEN`
- **Impact:** the primary customer surface is unusable — no names, no order counts; the "Has orders" saved view (`page.tsx:88`) can never match; sorting by name/orders is meaningless.
- **Evidence:**
  - Gateway emits `display_name`, `order_count`, `total_spent`, `last_order_at` — `services/api-gateway/src/routes/customers.ts:290-318` (`customerSummaryPayload`).
  - Page reads `full_name || customer_name` and `total_orders` — `apps/merchant-control-plane/src/app/[store]/customers/page.tsx:147`, `:150`; falls back to literal `'Anonymous'` at `:266`.
  - The page's own type alias already points at the right field (`page.tsx:14`: `total_orders: SharedCustomer['order_count']`), confirming the mapper is simply wrong.
  - `first_order_at` / `last_order_id` (`page.tsx:154`, `:156`) are likewise never emitted by the gateway.
- **Expected:** the list shows the customer's name and order count.
- **Missing link:** no shared response contract / contract test between `customerSummaryPayload` and `mapCustomer`.
- **Blast radius:** customers list page only. · **Severity:** P1 · **Likelihood:** HIGH (deterministic) · **Invariant:** none
- **Remediation:** map to the emitted field names, or make the gateway payload the typed `Customer` contract the page imports and delete the ad-hoc mapper.
- **Acceptance:** a store with ≥1 named customer with ≥1 order shows the name and a non-zero count; "Has orders" filters correctly.
- **Tests:** contract test asserting the gateway payload keys; component test on `mapCustomer`.
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH.

---

### G-F-03 — Customer CSV export produces blank email/name/phone for every row
- **Domain:** customers / export · **Status:** `BROKEN`
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/export/page.tsx:246-253` writes `customer.customer_email`, `customer.customer_name`, `customer.customer_phone`; the proxy returns `customerSummaryPayload` shape (`services/api-gateway/src/routes/customers.ts:290-318`) which has `email`/`display_name`/`phone`. Only `created_at` matches.
- **Additional defect:** the export is capped at `limit=100` (`export/page.tsx:232`) and is built client-side, while a real job-based export exists at `GET /v1/export/customers` (`services/api-gateway/src/routes/export.ts:727`) with R2 storage and a signed download token (`export.ts:656-683`) — completely unused by the UI.
- **Severity:** P1 · **Likelihood:** HIGH · **Invariant:** none (but see G-F-19 for the missing consent/audit on export)
- **Remediation:** fix the field names, and route the UI at the existing gateway export job so exports are not silently truncated at 100 rows.
- **Acceptance:** a store with 250 customers exports 250 rows with populated email/name/phone.
- **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-04 — Step-up tokens are replayable inside the 10-minute window `[HIGH-STAKES]`
- **Domain:** payments / security · **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`
- **Evidence:** `services/api-gateway/src/lib/security-controls.ts:160-243` — verification is entirely stateless. The `challenge_id` and `jti` are carried in the token (`:127-140`) and echoed in metadata (`:238-239`) but **never** looked up in `step_up_challenges`, and nothing transitions a challenge to a consumed state. `routes/security.ts:199-217` writes `status:'verified'` at issuance, never `used`.
- **Impact:** one TOTP entry authorises unlimited refunds (or payouts) of that action type for that actor+site for 10 minutes. Defeats the "per-sensitive-action second factor" intent of ART-11.
- **Severity:** P1 · **Likelihood:** MEDIUM · **Reversibility:** ledger postings are irreversible.
- **Remediation:** bind verification to a single-use `step_up_challenges` row (compare `challenge_token_hash`, require `status='verified'`, atomically transition to `used`), or bind `jti` to the specific resource id.
- **Acceptance:** replaying an already-consumed token returns 428.
- **Owner:** security + ARB · **Confidence:** HIGH (absence of the lookup is unambiguous).

---

### G-F-05 — DSR *export* is a declared step-up action but is not step-up gated `[HIGH-STAKES]`
- **Domain:** privacy · **Status:** `PARTIAL`
- **Evidence:** `customer.dsr.export` is in the action enum at `services/api-gateway/src/routes/security.ts:26`, in `SensitiveSecurityAction` (`lib/security-controls.ts:1`) and in the DB CHECK (`database/supabase/migrations/153_executable_identity_security.sql:115`). But `POST /security/dsr/export` (`security.ts:252-308`) never calls `verifySensitiveActionStepUp` — compare `dsr/erase` at `:317-325`.
- **Impact:** a full PII dump (customer row, up to 250 orders, up to 100 addresses, credential metadata — `security.ts:102-122`) is retrievable with a session alone. Same for `GET /v1/customers/:email/data-export` (`customers.ts:661`), which additionally persists nothing.
- **Severity:** P1 · **Likelihood:** MEDIUM · **Owner:** security + CA/compliance · **Confidence:** HIGH.

---

### G-F-06 — `PATCH /v1/customers/segments/:id` always 500s (tenant-guard contract violation)
- **Domain:** customers · **Status:** `BROKEN`
- **Evidence:** `services/api-gateway/src/routes/customers.ts:568-573` queries `customer_segments` with `.eq('id', id).is('deleted_at', null)` and no `store_id`; `customer_segments` scope columns are `['store_id']` (registry); the guard rejects unscoped execution (`services/api-gateway/src/tenant/tenant-scoped.ts:87-92`, behaviour asserted by `tests/governance/foundation-wave2-tenant.test.ts:58-75`); the throw reaches `app.onError` (`services/api-gateway/src/index.ts:838-866`) → 500.
- **Reachable from the UI:** `apps/merchant-control-plane/src/app/[store]/customers/segments/page.tsx:609-610` (edit → PATCH).
- **Also:** no `DELETE /segments/:id` route exists at all → segments can be created but never deleted.
- **Severity:** P2 · **Likelihood:** HIGH · **Remediation:** add `.eq('store_id', …)` to the pre-read (resolving the store from the request, as `GET /segments/:id/customers` at `customers.ts:642-648` already does correctly). · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-07 — Customer address update/delete always 500 (same tenant-guard violation)
- **Domain:** customers · **Status:** `BROKEN` (and `BACKEND_ONLY` — no UI)
- **Evidence:** `services/api-gateway/src/routes/customers.ts:1424-1429` (`select('store_id').eq('id', addressId).eq('customer_email', email)`), `:1454-1459` (update `.eq('id', addressId)` only), `:1487` (delete `.eq('id', addressId)` only) — `customer_addresses` scope is `['store_id']`.
- **Severity:** P3 (no UI reaches it today) · **Likelihood:** HIGH if called · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-08 — Staff RBAC grant lookup queries a non-existent column; every staff member resolves to zero grants `[HIGH-STAKES]`
- **Domain:** RBAC · **Status:** `BROKEN`
- **Evidence:** `services/api-gateway/src/middleware/staff-permission.ts:92` — `.eq('site_id', siteId)` against `employees`. `public.employees` has `store_id`, not `site_id` (`database/supabase/migrations/000_baseline.sql:9172-9194`); no migration adds `site_id` to `employees`. The PostgREST error is discarded (`:89` destructures only `data`), so the function returns `{ found:false, granted: [] }` (`:98`) and `evaluateStaffPermission` returns `{allowed:false, reason:'no-grants'}` (`:66-68`).
- **Impact:** (a) in `dryrun` the decision log (`:111-121`) reports `allowed:false / employee_found:false` for *every* staff request, so the "verify the dry-run logs then flip to enforce" rollout plan (`docs/v1-execution/phase-5-complete/11-live-stack-prep.md:22`) would be validating a column error; (b) flipping to `enforce` denies **all** staff **all** guarded writes regardless of role.
- **Severity:** P1 · **Likelihood:** HIGH · **Invariant:** authz
- **Remediation:** filter on `store_id`; surface (do not discard) the lookup error; make the error path deny rather than fail-open once staff access works.
- **Acceptance:** a manager-role employee resolves `granted` containing `products:write`; a viewer does not.
- **Tests:** integration test against a real `employees` row (the existing `staff-permission.test.ts` only covers the pure decision function and never touches the query).
- **Owner:** security · **Confidence:** HIGH.

---

### G-F-09 — Staff invite acceptance is unreachable: the endpoint sits behind `authMiddleware`
- **Domain:** staff · **Status:** `BROKEN`
- **Evidence:** `services/api-gateway/src/index.ts:750` mounts `authMiddleware` on `/*`; `/employees` is mounted at `:789`, after it. `POST /employees/auth/accept-invite` is `services/api-gateway/src/routes/employee.ts:208`. The public proxy `apps/merchant-control-plane/src/app/api/employees/accept-invite/route.ts:21` calls `merchantApiFetch` with no session, and `apps/merchant-control-plane/src/lib/api/client.ts:57-78` only attaches auth headers when the merchant session cookie exists. `middleware/auth.ts:264-272` returns 401 when every verifier declines.
- **Same applies to `POST /employees/auth/login` (`employee.ts:135`)** — a staff member with no token can never log in through it. (Even if reachable, it returns a raw **Supabase** session, not a LetBuyy merchant session cookie, so it would not authorise the control plane either.)
- **Severity:** P1 · **Likelihood:** HIGH (deterministic) · **Owner:** lead engineer + security (the fix must decide *which* issuer mints the staff session — see G-F-22) · **Confidence:** HIGH.

---

### G-F-10 — The staff-invite email path is never invoked; "Add staff" creates a row with no token and sends nothing
- **Domain:** staff · **Status:** `BROKEN`
- **Evidence:** the UI calls `employees.create` (`apps/merchant-control-plane/src/app/api/stores/[store]/users/route.ts:41`) → `POST /v1/employees` (`employee.ts:313`), which inserts an `employees` row only. The token-minting + email-sending route is `POST /v1/employees/invite` (`employee.ts:413-474`, `enqueueEmployeeInviteEmail` at `:456`). `packages/typescript/api-client/src/index.ts:4697-4707` exposes only `{list, limits, create, update, remove}` — **no `invite`** — and no proxy or page references `/employees/invite`.
- **Impact:** the invitee never receives a link and no `employee_invites` row with a token is ever created, so the accept-invite page (which requires `?token=`) has nothing to accept.
- **Severity:** P1 · **Likelihood:** HIGH · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-11 — Staff permissions are dropped on create; only a later role change persists them
- **Domain:** RBAC · **Status:** `BROKEN`
- **Evidence:** UI sends `permissions: permissionsForRole(newRole)` (`apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx:199`); `planEmployeeStaffCreate` (`packages/auth-core/src/index.ts:1482-1507`) builds the insert payload and never reads `body.permissions`. Only `planEmployeeUpdate` (`auth-core/src/index.ts:1537-1542`) persists it — and that path is broken (G-F-12).
- **Impact:** `employees.permissions` stays at its `'{}'` default (`000_baseline.sql:9180`), compounding G-F-08.
- **Severity:** P1 · **Likelihood:** HIGH · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-12 — Staff role-change and staff-removal always 500 (tenant-guard violation on `employees`)
- **Domain:** staff · **Status:** `BROKEN`
- **Evidence:** `verifyEmployeeOwnership` (`services/api-gateway/src/routes/employee.ts:610-638`) reads `employees` with `.eq('id', employeeId)` only (`:618-622`); `employees` scope columns are `['store_id','user_id']`; the guard rejects. The update at `:571-574` is likewise `.eq('id', employeeId)` only. Reached by `PATCH /employees/:id` (`:556`) and `DELETE /employees/:id` (`:586`), which are the Users & permissions page's role-change (`settings/users/page.tsx:227-231`) and remove (`:249`) actions.
- **Impact:** an owner cannot change a staff role or revoke staff access. Revocation failing is a security-relevant availability defect.
- **Severity:** P1 · **Likelihood:** HIGH · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-13 — Employee portal routes were written to read across all tenants (they now 500 instead)
- **Domain:** staff / tenancy · **Status:** `BROKEN` (fails closed)
- **Evidence:** `GET /employees/tickets` (`employee.ts:481-522`) selects `support_tickets` (registry scope `site_id`) with no site predicate (`:501-506`); `GET /employees/analytics` (`employee.ts:525-553`) counts `sites`, `orders` and `user_profiles` with no predicate (`:542-546`). Authorisation is "is an active employee of *any* store" (`:490-499`, `:530-539`).
- **Impact:** the *intended* behaviour was cross-tenant disclosure to any store's staff. The tenant guard converts it to a 500. `user_profiles` is not in the registry, so had the first two queries not rejected, a platform-wide user count would have been returned.
- **Severity:** P2 (currently non-exploitable; a P0-shaped intent) · **Likelihood:** HIGH that the route errors; LOW that data leaks today · **Remediation:** delete these routes (they belong to the platform-console boundary, not the merchant gateway) or site-scope them and gate them behind operator RBAC. · **Owner:** ARB + security · **Confidence:** HIGH.

---

### G-F-14 — Every staff-lifecycle audit write fails a CHECK constraint and is silently swallowed
- **Domain:** audit · **Status:** `BROKEN`
- **Evidence:** `services/api-gateway/src/routes/employee.ts:189` inserts `actor_type: 'merchant'`; `audit_logs_actor_type_check` allows only `('user','employee','super_admin','system')` (`database/supabase/migrations/000_baseline.sql:8454`); no migration widens it. The failure is caught at `employee.ts:198-205` and only logged. Callers: `:361` (`employee.created`), `:467` (`employee.invited`), `:580` (`employee.updated`), `:605` (`employee.removed`).
- **Impact:** there is **no** persisted trail of who added, re-roled or removed staff.
- **Severity:** P1 · **Likelihood:** HIGH (deterministic) · **Invariant:** audit
- **Remediation:** use a legal `actor_type` (or widen the constraint through a migration + rollback pair). Do not swallow the audit error silently for security-relevant actions.
- **Owner:** security · **Confidence:** HIGH.

---

### G-F-15 — The staff invite email points at a URL that does not exist
- **Domain:** staff · **Status:** `BROKEN`
- **Evidence:** `services/api-gateway/src/lib/transactional-email.ts:66-68` builds `${platformBaseUrl}/employees/auth/accept-invite?token=…`; the only accept-invite page in the merchant control plane is `apps/merchant-control-plane/src/app/accept-invite/page.tsx` (route `/accept-invite`). No `app/employees/**` route exists (verified against the full 77-page listing).
- **Severity:** P2 (unreachable today because of G-F-10) · **Likelihood:** HIGH once G-F-10 is fixed · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-16 — The canonical DPDP consent ledger is schema-only and gates nothing `[HIGH-STAKES]`
- **Domain:** privacy · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** `public.consents` created in `database/supabase/migrations/153_executable_identity_security.sql:6-30` (+ RLS `:224-231`). Runtime references: `services/api-gateway/src/tenant/tenant-tables.registry.ts:594` (generated), `services/api-gateway/src/identity-foundation/repository-boundary.ts:32` (name map), `services/api-gateway/src/__tests__/security-v1.test.ts:64,83` (asserts migration text). **No `.from('consents')` anywhere.**
- **Governance:** ART-07 / R-13 / IDN-R6 make this the canonical, append-only, fail-closed gate for WhatsApp, marketing and analytics sends.
- **Impact:** the legally-required consent record does not exist for any send. What exists is three parallel non-canonical stores (`wa_optins`, `store_customers.accepts_marketing`, `contact_requests.consent_*`). WIN-R7 forbids building beside the named winner.
- **Severity:** P0 (regulatory) · **Likelihood:** HIGH · **Owner:** founder + CA/compliance + ARB
- **Remediation:** complete the canonical ledger in `identity-platform` per IDN-R1/IDN-R6 and make it the single gate; migrate `wa_optins` and `accepts_marketing` into it as evidence rows.
- **Acceptance:** every consent-gated send resolves a `consents` row and hard-stops with a 4xx when absent; the ledger is append-only (revocation is a new row, not an UPDATE).
- **Confidence:** HIGH.

---

### G-F-17 — `POST /v1/customers/:email/email` sends to a customer with no consent check at all (fail-OPEN) `[HIGH-STAKES]`
- **Domain:** privacy · **Status:** `BACKEND_ONLY` + fail-open
- **Evidence:** `services/api-gateway/src/routes/customers.ts:949-993` — ownership at `:955`, customer-exists at `:959-971`, provider-configured at `:973`, then `sendResendEmail` at `:979-986`. There is no `consents` lookup, no `accepts_marketing` check, no suppression list, no unsubscribe footer, and no audit row. Subject and body are free text (`packages/commerce-core/src/index.ts:153-157`, up to 5000 chars).
- **Contrast:** WhatsApp fails closed (`routes/whatsapp.ts:692-701`); marketing campaigns filter on `accepts_marketing` (`routes/marketing.ts:240`, `:279-281`).
- **Governance:** ART-07 "Forbids … A consent gate that fails open"; R-13; SEC-R1.
- **Severity:** P1 · **Likelihood:** MEDIUM (no UI reaches it today — it is API-only) · **Owner:** security + CA/compliance
- **Remediation:** gate on the canonical consent ledger (G-F-16); until it exists, gate on `accepts_marketing` for anything not strictly transactional and record the send.
- **Confidence:** HIGH.

---

### G-F-18 — Customer deletion/redaction is irreversible, ungated and unaudited `[HIGH-STAKES]` `[IRREVERSIBLE]`
- **Domain:** privacy / customers · **Status:** `BACKEND_ONLY`
- **Evidence:** `services/api-gateway/src/routes/customers.ts:1207-1340`. Ownership only (`:1217`). It hard-`delete()`s `customer_addresses` (`:1259`), `customer_credentials` (`:1269`), `wishlists` (`:1293`), `customer_wishlists` (`:1303`), and **rewrites `orders.customer_email/customer_name/customer_phone`** (`:1279-1287`). No step-up, no `customers:write` permission, no `data_subject_requests` record, no `audit_logs` entry. The compliance webhook is dispatched with `failClosed: false` (`:1323`).
- **Contrast:** the near-identical `POST /security/dsr/erase` (`security.ts:310-379`) *does* require step-up and *does* record a DSR — two competing erasure implementations with different security postures (WIN-R7 duplicate authority).
- **Concern:** rewriting `orders.customer_email` mutates records that feed GST invoices and the order ledger. Whether that is legal under Indian invoice-immutability rules is a **CA-tax question I cannot resolve**.
- **Severity:** P1 · **Likelihood:** LOW today (no UI) · **Owner:** ARB + CA-tax + security · **Confidence:** HIGH on the code; UNKNOWN on the tax-law consequence.

---

### G-F-19 — Reading and exporting customer PII requires no permission and leaves no audit trail `[HIGH-STAKES]`
- **Domain:** privacy / RBAC / audit · **Status:** `PARTIAL`
- **Evidence:** `customers:read` has **zero** enforcement sites anywhere in `services/api-gateway/src`. `GET /v1/customers` (`customers.ts:423`), `GET /v1/customers/:email` (`:1134`), `GET /v1/customers/:email/data-export` (`:661`), `GET /v1/export/customers` (`routes/export.ts:727`) and `POST /v1/security/dsr/export` (`routes/security.ts:252`) all carry ownership only, and none writes an `audit_logs` row (the only merchant-domain `audit_logs` writer is `employee.ts`, which fails — G-F-14).
- **Impact:** no `who accessed which customer's PII, when` record exists — a DPDP accountability gap independent of the consent gap.
- **Severity:** P1 · **Likelihood:** HIGH · **Owner:** security + CA/compliance · **Confidence:** HIGH.

---

### G-F-20 — Merchant staff RBAC is enforced nowhere in the UI and is `dryrun` in the gateway
- **Domain:** RBAC · **Status:** `UI_ONLY` for the role concept; `DORMANT_FLAGGED` for enforcement
- **Evidence:** (a) exhaustive grep of `apps/merchant-control-plane/src` finds no role-conditional rendering — `lib/staff/roles.ts` is used only by `settings/users/page.tsx` to compose an invite payload; there is no `middleware.ts` in the app. (b) `MERCHANT_STAFF_RBAC_MODE` defaults to `dryrun` (`services/api-gateway/src/middleware/staff-permission.ts:45-52`) and is set in **no** wrangler config or env template (only in docs and one unit test). (c) `evaluateStaffRequest` fails open on missing context (`:137`) and on any exception (`:154-163`). (d) 5 of the 12 declared permissions (`customers:read`, `returns:write`, `content:write`, `reports:read`, and `settings:write` as a staff key) have zero enforcement sites; the 15-operation matrix in §5.4 shows 12 of 18 sensitive operations with **no** staff gate at all.
- **Impact:** the roles a merchant selects in "Users and permissions" are decorative. This becomes privilege escalation by direct API call the moment staff can authenticate.
- **Severity:** P1 · **Likelihood:** HIGH · **Owner:** security + ARB
- **Remediation:** decide one RBAC authority (`employees.permissions` vs `site_memberships`); make it a default-deny **middleware** on every merchant mutation rather than 30 hand-placed in-handler calls; fix G-F-08/G-F-11 first, then enforce; add the missing read-side guards.
- **Confidence:** HIGH.

---

### G-F-21 — Two competing RBAC data models; `site_memberships`/`site_roles`/`site_role_permissions` are dormant
- **Domain:** RBAC / architecture · **Status:** `NOT_IMPLEMENTED` (dead schema + dead read path)
- **Evidence:** tables at `database/supabase/migrations/000_baseline.sql:11896`, `:11922`, `:11941`; read by `services/api-gateway/src/lib/tenant-context.ts:88-154`, `:156-182`; but ownership is asserted first (`:193-196`) so membership can never grant access, and no code or migration ever inserts into them. `site_role_permissions` is not even in the tenant registry.
- **Governance:** WIN-R7 / ARCH duplicate-authority.
- **Severity:** P2 · **Likelihood:** n/a · **Owner:** ARB · **Confidence:** HIGH.

---

### G-F-22 — Staff/customer identity is minted outside `identity-platform` (three issuers) — ART-05 / IDN-R1 deviation `[HIGH-STAKES]`
- **Domain:** identity · **Status:** `CONTRADICTORY_EVIDENCE` vs the Constitution
- **Evidence:** the gateway's `authMiddleware` accepts exactly three credential shapes (`services/api-gateway/src/middleware/auth.ts:188-204`): a **Supabase** bearer JWT (`:157-186`), an internal SSO **HMAC** header set (`:77-109`), and an internal **session-token HMAC** (`:111-156`). No ES256 / `LETBUYY_IDENTITY_PUBLIC_JWKS` verification appears in this path. Separately, staff credentials are minted by **Supabase Auth** (`routes/employee.ts:143` `signInWithPassword`, `:236-241` `auth.admin.createUser`), and customer sessions are **HS256** off `CUSTOMER_SESSION_SECRET` (`routes/storefront/customer-registration.ts:141-143`; `middleware/customer-session.ts:58`).
- **Governance:** ART-05 / IDN-R1 — identity-platform is the sole, asymmetric issuer; everyone else verify-only; "the shared-`AUTH_SECRET` HS256 design is dead".
- **Note:** this is squarely the identity agent's domain; recorded here because the staff RBAC boundary depends on it and because CLAUDE.md explicitly asked for the HS256 path to be flagged rather than accepted.
- **Severity:** P1 · **Owner:** ARB + security · **Confidence:** HIGH on the code paths; I did **not** determine whether `AUTH_VERIFIER_REGISTRY` (`services/api-gateway/src/identity-foundation/auth-verifier-registry.ts`, imported at `middleware/auth.ts:16-19` but not used by `legacyGatewayAuthVerifiers`) is wired anywhere else — see UNKNOWN-3.

---

### G-F-23 — There is no way to enable/disable a customer account
- **Domain:** customers · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** `UpdateCustomerSchema` (`packages/commerce-core/src/index.ts:134-141`) has no `status` field; no gateway route sets `store_customers.status` except the redaction paths (`customers.ts:1246`, `security.ts:348`) and merge (`customers.ts:1096`). The customers list renders a Status badge (`page.tsx:302-311`) and offers an "Active" saved view, implying a control that does not exist.
- **Severity:** P2 · **Likelihood:** n/a · **Owner:** founder (scope decision) · **Confidence:** HIGH.

---

### G-F-24 — Customer note text is duplicated into `store_customers.notes` and never reconciled
- **Domain:** customers · **Status:** `PARTIAL`
- **Evidence:** `services/api-gateway/src/routes/customers.ts:904-912` appends the new note to `store_customers.notes` after inserting the `customer_notes` row. Nothing removes it when a `customer_notes` row is soft-deleted, and `PATCH /:email` can overwrite `notes` wholesale (`:787`). Two divergent copies of the same merchant-authored PII, both exported by the data-export path (`:729`).
- **Severity:** P3 · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-25 — Merchant-facing customer/staff surfaces have effectively zero automated test coverage
- **Domain:** testing · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** the only tests touching this domain are `services/api-gateway/src/__tests__/staff-permission.test.ts` (pure decision function only — never exercises `resolveGrants`, which is where G-F-08 lives), `customer-pagination.test.ts`, `customer-engagement.security.test.ts` (storefront), and `tests/e2e/customer-journey.spec.ts` (storefront buyer journey, and it `test.skip`s unless staging is reachable — `tests/e2e/customer-journey.spec.ts:6-10`). Nothing covers the merchant customers list/detail, notes, segments, staff invite/accept, role change, removal, the tenant-guard-broken routes, or the cross-tenant refund path.
- **Severity:** P1 · **Owner:** lead engineer · **Confidence:** HIGH.

---

### G-F-26 — Minor: double URL-decoding of the customer email path parameter
- **Evidence:** `services/api-gateway/src/routes/customers.ts:192-194` (`normalizeCustomerEmail`) and `:663`, `:1209`, `:1344`, `:1372`, `:1418`, `:1470` call `decodeURIComponent` on `c.req.param('email')`, which Hono has already decoded. An address containing a literal `%` would throw `URIError` → 500.
- **Severity:** P3 · **Likelihood:** LOW · **Confidence:** MEDIUM (I did not verify Hono's decoding behaviour by execution).

---

## 11. Contradictions found

1. **DOC vs CODE — "customer detail is missing".** The prior audit hint is contradicted by `apps/merchant-control-plane/src/app/[store]/customers/[email]/page.tsx` + `.../api/stores/[store]/customers/[email]/route.ts` + `services/api-gateway/src/routes/customers.ts:1134`. **Doc is STALE.** What *is* missing is customer *editing* and privacy actions, not viewing.
2. **Two refund security models in one service.** `payments.ts:497` requires step-up; `orders.ts:1342` reaches the same canonical money RPC family without it. Unresolvable from code alone which is intended — flagged as G-F-01, resolution needs ARB.
3. **Two erasure implementations.** `customers.ts:1207` (no step-up, no DSR record) vs `security.ts:310` (step-up + DSR record). Duplicate authority.
4. **Two RBAC models.** `employees.permissions` (partially wired, broken) vs `site_memberships`/`site_roles` (completely dormant).
5. **Four consent stores**, none of them the canonical `consents` ledger the Constitution names.
6. **Four customer-export implementations**, of which the only UI-wired one is the broken client-side CSV.
7. **`audit_logs` says append-only via RLS, but the writer bypasses RLS.** INSERT-only policies (`000_baseline.sql:24380`) + no FORCE + service-role writer = append-only by convention only.
8. **`CLAUDE.md` vs `AGENTS.md` on migration count** — root `AGENTS.md` still says "current max 161"; `database/supabase/migrations/` contains 187 files up to `195_contact_requests.sql`. Documentation drift (also noted by the commander).
9. **Money representation.** `orders.total`, `orders.subtotal`, `orders.tax`, `orders.discount` are `numeric(10,2)` (`000_baseline.sql:10131-10135`) and `store_customers.total_spent` is `numeric(12,2)` (`:12195`); `complete_order_refund` converts with `round(amount * 100)::bigint` at the ledger boundary (`migrations/168_…sql:363`). ART-10 requires `bigint` minor units everywhere. Flagged for the money agent; the customer domain surfaces these rupee-decimal values directly (`customers.ts:1175`, `:1194`).

---

## 12. UNKNOWNS (honest)

- **UNKNOWN-1 — Runtime behaviour.** Nothing in this domain was executed. Every `BROKEN` verdict rests on a static contradiction (missing column, missing payload field, middleware ordering, tenant-guard contract). They are high-confidence but not `VERIFIED_E2E`. `BLOCKED_EXTERNAL`: no running gateway, no database, no seeded tenant, and connecting to any live environment is out of scope.
- **UNKNOWN-2 — Deployed env vars.** I can confirm `MERCHANT_STAFF_RBAC_MODE` is absent from every file in the repo. I **cannot** confirm whether an operator has set it as a Cloudflare Worker secret/var out-of-band. Same for `STEP_UP_SIGNING_SECRET` and `TOTP_ENCRYPTION_KEY`. `BLOCKED_EXTERNAL`.
- **UNKNOWN-3 — `AUTH_VERIFIER_REGISTRY`.** `services/api-gateway/src/identity-foundation/auth-verifier-registry.ts` is imported by `middleware/auth.ts:16-19` and re-exported as `authMiddlewareVerifierRegistry:34`, but `authMiddleware` itself iterates `legacyGatewayAuthVerifiers`. I did not trace whether the registry is consumed on another path (e.g. a v2 middleware), so I cannot say whether ES256 verification exists somewhere I did not look. Deferred to the identity agent.
- **UNKNOWN-4 — Exploitability of G-F-01.** The cross-tenant refund requires knowing a foreign `refunds.id` UUID. I did not audit whether any endpoint, webhook payload, export or error message discloses refund ids across tenants. That determines whether G-F-01's likelihood is MEDIUM or LOW.
- **UNKNOWN-5 — Legality of order-contact rewriting.** `customers.ts:1279-1287` and `security.ts:356` rewrite `orders.customer_email/name/phone`. Whether that is permissible against GST invoice immutability is a **CA-tax** question. Not answerable from code.
- **UNKNOWN-6 — `employees` RLS FORCE.** `ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY` exists (`000_baseline.sql:24722`); I did not enumerate whether FORCE and a tenant policy were later added by migration 153's loop (that loop covers `store_customers`, `customer_addresses`, `customer_credentials`, `orders`, `wishlists`, `customer_wishlists` — **not** `employees`). Likely no FORCE on `employees`; not confirmed.
- **UNKNOWN-7 — WhatsApp/marketing UI.** I did not audit the merchant marketing/WhatsApp pages (another agent's scope); my consent findings are gateway-side only.

---

## 13. Things I explicitly checked and found CLEAN

- **No customer or staff route is missing a tenant-ownership check.** All 20 customer routes and all owner-scoped employee routes call `hasOwnedStoreScope` / `resolveOwnedStoreScope` / `verifySiteOwnership`.
- **No PII value is written to any log** in the gateway, queue-workers, webhook-service, merchant control plane or identity-platform (§9). Only ids, event names and environment labels.
- **No password, hash, token or secret is returned by any merchant-facing customer read.** All PII selects enumerate columns explicitly and exclude `password_hash` (`customers.ts:377`, `:696`; `security.ts:107`).
- **Step-up is genuine HMAC-SHA256 with constant-time comparison and a TOTP-gated issuance**, and it fails closed on an unset secret (§6). PAY-R7 / R-10 are satisfied *for the routes that call it*.
- **The runtime tenant guard is a real, tested default-deny control** (`tenant/tenant-scoped.ts`; `tests/governance/foundation-wave2-tenant.test.ts:58-75`) and is the reason several defective routes fail closed rather than leaking.
- **Customers are strictly per-site**; there is no cross-store customer identity to leak.
- **Staff seat limits are server-authoritative** and plan-driven (`employee.ts:37-105`), enforced on both create (`:328`) and invite (`:434`) — the UI cap cannot be bypassed.
- **Marketing campaigns and WhatsApp sends both fail CLOSED** on their (non-canonical) consent signals.
