# IDENTITY OWNERSHIP MATRIX (reconciled & completed)
### 2026-06-09 · ANALYSIS-ONLY · supersedes the stale Phase-2 `docs/auth/2026-06-08-identity-platform-transformation/AUTHORITY_MATRIX.md`

> **Why this exists.** The corpus `AUTHORITY_MATRIX.md` is a Phase-2 artifact: its rows for membership/authz say "stays in Commerce," which the Phase-16 design (`PERMISSION_MODEL`, `ORGANIZATION_ARCHITECTURE`) and `IMPLEMENTATION_READINESS_REVIEW` Finding **A-1** **supersede**, and it has **no rows** for Organizations, Teams, Delegation, Impersonation, Audit, Keys, Brands, Sandboxes, or Subscriptions. This matrix reconciles A-1 and completes the missing rows. **Rule enforced: exactly one PRIMARY owner per capability. No ambiguity.** Secondary participants are noted but are not owners.

## Owner legend
- **Identity** = LetBuyy Identity Platform (the authority).
- **Commerce** = commerce core services + commerce DB (resource + policy catalog).
- **Gateway** = API Gateway as **PEP** — it *verifies and enforces*, it **owns nothing authoritative** (never a primary owner).
- **Marketplace** = app/theme marketplace service. **Storefront** = storefront runtime.

---

## Capability ownership (one primary owner each)

| # | Capability | **Primary owner** | Secondary (participates, not owner) | A-1 note |
|---|---|---|---|---|
| 1 | Authentication (all realms) | **Identity** | Gateway verifies tokens | — |
| 2 | **Authorization decision** (PEP) | **Gateway (enforcement)**; *inputs* owned upstream | Identity (ReBAC inputs), Commerce (RBAC/ABAC inputs) | Gateway enforces; it is not the *source* — see #15/#16 |
| 3 | ReBAC relationships (who-is-related-to-what) | **Identity** | — | **A-1: moved to Identity** (was "Commerce") |
| 4 | RBAC capability (role→permission policy) | **Commerce** | Identity assigns roles | unchanged |
| 5 | Sessions (create/validate/refresh/revoke) | **Identity** | Gateway checks revoked-sid cache | — |
| 6 | Credentials (password/secret material) | **Identity** | — | — |
| 7 | Passkeys / WebAuthn | **Identity** | — | — |
| 8 | MFA / step-up factors | **Identity** | Gateway enforces `acr` | — |
| 9 | Devices | **Identity** | — | — |
| 10 | Refresh tokens (rotation/reuse) | **Identity** | — | — |
| 11 | Email verification / magic links | **Identity** | — | — |
| 12 | Account recovery / lockout | **Identity** | — | NEW row (corpus G-6) |
| 13 | **Organizations** (lifecycle) | **Identity** | Commerce reads `org_id` cache | NEW row (absent in corpus matrix) |
| 14 | **Brands** | **Identity** (grouping) | Commerce (brand record) | NEW |
| 15 | **Teams** | **Identity** | — | NEW |
| 16 | Memberships (org/brand/store/team/sandbox) | **Identity** | — | **A-1: moved to Identity** (was Commerce `site_memberships`) |
| 17 | **Delegation / agency** | **Identity** | — | NEW |
| 18 | Invitations | **Identity** | — | NEW |
| 19 | Ownership transfer | **Identity** | Commerce updates store record | NEW |
| 20 | **Impersonation / break-glass** | **Identity** | Gateway enforces aal3 | NEW (designed in `PERMISSION_MODEL §9`, unmapped) |
| 21 | Permissions **registry** (catalog of atoms) | **Commerce** | platform governance | NEW (registry ownership was ambiguous, M-4) |
| 22 | Roles — system catalog | **Commerce** | — | — |
| 23 | Roles — custom (per-org) | **Identity** (assignment over Commerce registry) | — | NEW |
| 24 | Consents / OAuth grants | **Identity** | — | — |
| 25 | OAuth clients (registry) | **Identity** | Marketplace registers 3P apps | — |
| 26 | API tokens / M2M client-credentials | **Identity** | — | — |
| 27 | Client-secret / API-key **rotation** | **Identity** | — | NEW (KEY_MGMT covered only signing keys) |
| 28 | Signing keys / JWKS | **Identity** (key service) | Gateway holds public keys | NEW row |
| 29 | Audit ledger | **Identity** | SIEM consumes | NEW row |
| 30 | Logout / end-session | **Identity** | RPs honor back-channel | — |
| 31 | SSO / federation | **Identity** | RPs are clients | — |
| 32 | SCIM provisioning | **Identity** | enterprise IdP is source | NEW (reserve hooks, `IDENTITY_DOMAIN_MODEL §5`) |
| 33 | CSRF mechanism | **Gateway/edge** (per-RP) | Identity for its own surface | — |
| 34 | Turnstile / bot defense | **Gateway/edge** | feeds Identity risk engine | — |
| — | **Commerce-resource capabilities** (one owner each, NOT Identity) | | | |
| 35 | Orders | **Commerce** | Identity authn only | resource |
| 36 | Products / catalog | **Commerce** | — | resource |
| 37 | Store settings | **Commerce** | — | resource |
| 38 | **Billing (invoices/payment methods)** | **Commerce/billing** | Identity owns *who-may-act* via delegation | NEW row (was missing) |
| 39 | **Subscriptions / plan / entitlement** | **Commerce/billing** | Identity caches signed `entitlement` for ABAC | NEW row (was missing entirely) |
| 40 | Customers — **identity** | **Identity** (customer realm) | — | — |
| 41 | Customers — **resource/profile data** | **Commerce/Storefront** | Identity authn only | split clarified |
| 42 | B2B customer-company + buyer roles | **Identity** (membership) / **Commerce** (company record) | — | NEW |

---

## The boundary rule (one sentence, enforced everywhere)
**Identity answers "who is this principal and what orgs/roles/relationships do they hold" (#1–#34, #40, #42-membership); Commerce answers "may this principal do this action on this resource, given the catalog and plan" (#4, #21–#22, #35–#39, #41); the Gateway only *enforces* the composed decision and owns nothing authoritative (#2).** No component writes across this line; cross-reads go through APIs (Membership API, Entitlement snapshot, JWKS), never SQL joins.

## Reconciliation actions (to retire the stale matrix)
1. Update corpus `AUTHORITY_MATRIX.md` rows #4/#18 to reflect A-1 (ReBAC + memberships → Identity).
2. Add the 18 NEW rows above (Orgs/Brands/Teams/Delegation/Invitations/Transfer/Impersonation/Permissions-registry/Custom-roles/Client-secret-rotation/Keys/Audit/SCIM/Billing/Subscriptions/B2B-company/Recovery).
3. Mark every "Authorization stays in Commerce" reference in older docs as **superseded by A-1** pending the human sign-off it requires.
