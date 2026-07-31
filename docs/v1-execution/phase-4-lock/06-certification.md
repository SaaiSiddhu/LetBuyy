# 06 — Phase 4 Lock Certification

**Date:** 2026-06-19 · **Branch:** `stepup/main` · **Type:** LOCK / freeze / baseline (no new features; no code changes).

## Lock checklist (all 8 required actions)
| # | Action | Result |
|---|---|---|
| 1 | Phase-4 deliverables exist | ✅ all pages/proxies/middleware/tests present |
| 2 | Documentation exists | ✅ 34 reports (15 + 6 + 13) + 6 lock docs |
| 3 | Tests pass | ✅ MCP `tsc` 0 · gateway `tsc` 0 · launch **184/184** · gateway suite 313/316 (3 pre-existing/unrelated) |
| 4 | No unfinished migration | ✅ migration-safety PASS; Phase-4 added 0 migrations |
| 5 | No undocumented temp flags | ✅ `MERCHANT_STAFF_RBAC_MODE` documented (only flag) |
| 6 | Nav routes registered | ✅ 26/26 resolve to a page (no dead nav) |
| 7 | API routes registered | ✅ 95 proxies; all 8 new map to real gateway endpoints |
| 8 | Completion matrix | ✅ below |

## Completion matrix (frozen from Phase 4.75)
| Domain | % |
|---|---|
| Products | 72% |
| Collections | 62% |
| Inventory | 40% |
| Orders | 72% |
| Customers | 62% |
| Discounts | 85% |
| Analytics | 72% |
| Domains | 93% |
| Shipping | 80% |
| Settings | 84% |
| Staff | 66% |
| Marketing | 75% |
| **Merchant Control Plane** | **~72% UI / ~89% backend** |

## Known risks
- UI is compile/contract-verified only — **no live-stack flow verification** in this environment (dominant risk).
- Staff RBAC ships **dry-run**; not enforcing until the `enforce` flip is validated live.
- Net-new-backend features (PO, transfers, inventory ledger, smart collections, settings persistence) unbuilt — correctly not faked.
- Inherited repo-wide reds (NOT Phase-4): tenant-isolation registry drift, design-system CSS drift, 3 gateway tests, parallel-workstream migrations. See `05`.

## Locked files (Phase-4.x scope)
- **Gateway:** `middleware/staff-permission.ts`, `__tests__/staff-permission.test.ts`, RBAC/audit edits in `routes/{products,orders,coupons,customers,shipping-tax,employee}.ts`.
- **MCP pages:** `[store]/customers/[email]/page.tsx`, `[store]/customers/segments/page.tsx`, `[store]/orders/[orderId]/page.tsx`, `[store]/marketing/page.tsx`.
- **MCP proxies:** the 13 new/changed `route.ts` in `03`.
- **MCP wiring:** `components/merchantNavigation.ts`, `components/AISidebar.tsx`, `lib/staff/roles.ts`, `api/stores/[store]/analytics/route.ts`.
- **Tests:** `tests/launch/lb-merchant-admin.test.mjs`.
- **Docs:** `docs/v1-execution/{phase-4-completion,phase-4-5-completion,phase-4-75-final,phase-4-lock}/`.

## Phase status

# ✅ PHASE 4 LOCKED

Phase-4 merchant-control-plane scope is **frozen** at ~72% UI / ~89% backend: all deliverables exist, are documented, compile, and pass the launch + scope-relevant governance gates with **zero new drift introduced**. Remaining work (live-stack verification, RBAC enforce flip, net-new-backend features) is captured in `05-known-gaps.md` as the Phase-5 baseline.

The two red repo-wide validators (tenant-isolation, design-system) and 3 gateway test fails are **pre-existing, out-of-scope inherited WIP from parallel workstreams — not Phase-4 regressions** — and therefore do not block this Phase-4 lock; they are recorded as Phase-5 baseline items. No remediation is required within Phase-4 scope.
