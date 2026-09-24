# SUSTAINED-F — merchant staff membership: a three-way BLOCKED_DECISION, no code change

Branch `letbuyy/sustained-f-staff-membership-investigation`, base `19e202c` (develop, includes
merged SUSTAINED-B/C/D3/E). Investigation only; no source touched.

## What was asked

The owner's directive: "Determine the canonical relationship between `site_memberships`,
`site_roles`, `employees`, the merchant app's role/permission contracts, and existing owner-only
route restrictions… Consult the canonical registry and approved decisions before choosing an
authority. Do not maintain two permanent independent permission systems… If canonical ownership is
unresolved, record the blocker and move to independent work rather than creating a third access
model."

## What was found: three, not two

**(1) `employees` — the only one of the three that is actually live.** `middleware/
staff-permission.ts`'s `resolveGrants` reads `employees` filtered by `store_id`, `user_id`,
`status = 'active'`, `deleted_at IS NULL`. It is mounted on real merchant routes (products, orders,
and the rest APPID-P5b/APPID-FIX2 already hardened) and is the fail-closed design this session's
own Phase A/C work builds on. This is the system in production use today.

**(2) `site_memberships` / `site_roles` / `site_role_permissions` — fully built, never mounted.**
These are baseline tables (migration `000_baseline.sql`, not recent scaffolding). `lib/
tenant-context.ts`'s `loadMembership`/`loadRolePermissions` read them correctly and completely:
tenant-scoped (`site_id`), active-status and `deleted_at` checked, role→permission resolved through
`site_role_permissions`. This logic is called by `resolveTenantAccessProfile`, which is called only
from `middleware/store-context.ts`'s `storeContext()` factory — grepped across every route file and
`index.ts`: **zero matches**. The middleware exists, is correctly written, and is mounted nowhere.
It has no live effect on any request today.

**(3) `identity-foundation` — a third, more sophisticated model, itself also unmounted.**
`services/api-gateway/src/identity-foundation/repository-boundary.ts` (18 files total under that
directory) defines `organizations`, `org_memberships`, `teams`, `team_memberships`,
`store_memberships`, `delegations`, `invitations` — an org/team model behind
`@letbuyy/organization-core`/`@letbuyy/identity-core`/`@letbuyy/permission-core`/
`@letbuyy/session-core`. Its own `LEGACY_REPOSITORY_TABLES.membership` constant names **(2)**
(`site_memberships`, `site_roles`, `site_role_permissions`) as legacy — i.e., this scaffolding
already declares itself the intended successor to (2), before (2) itself was ever wired to a live
route. Grepped the same way: zero route consumers.

## Why this is BLOCKED_DECISION, not a wiring gap

Every prior phase this session (A, B, C, D3, E's MFA slice) was a case of **one** clearly canonical
mechanism with a **missing or buggy** call site — a bounded, provable fix. This is different: there
is no single canonical mechanism to wire yet. Picking (2) over (1) would relax the fail-closed
design APPID-P5b measured and hardened for no forward benefit, since (3) already marks (2) legacy.
Picking (3) would mean building and shipping a brand-new org/team permission model, unreviewed, as
a side effect of a "membership wiring" phase — precisely the "second canonical system for [a]
domain" and "third access model" both the Constitution (§ Never decide alone) and this directive
explicitly reserve for an ARB/owner decision. Recorded here, not invented.

## What is NOT at risk today

Because (2) and (3) are mounted nowhere, `site_memberships`/`site_roles`/`identity-foundation`
being unfinished or unreconciled creates **no live authorization gap** — every merchant-staff
request today is decided by (1) alone, which fails closed on a missing store, a missing user, a
session bound to another store, or a lookup error (APPID-P5b). This phase changed nothing about
that; it is stated here so the BLOCKED_DECISION above is not mistaken for an open vulnerability.

## What the owner needs to decide, to unblock this

1. Is (2) (`site_memberships`/`site_roles`) still the intended near-term path for staff
   membership beyond owner-only routes, or is it superseded by (3) (`identity-foundation`)
   as its own header already claims?
2. If (3): what is its rollout plan, and does `employees` retire, coexist permanently (against
   the "two permanent systems" rule), or migrate?
3. If (2): should `store-context.ts`'s `storeContext()` actually be mounted, and on which routes,
   and does `employees` retire in its favor?

## Validation

None run this phase — no source changed. The only artifact is this evidence document and the
ledger/disposition rows recording the investigation and its outcome.
