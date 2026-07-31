# 15 — Phase 4 Certification Decision

**Date:** 2026-06-19 · **Branch:** `stepup/main` · **Scope:** Merchant Control Plane (admin/operating system)

## Decision: ⛔ PHASE 4 NOT COMPLETE — denied with evidence.

The objective is a **production-grade merchant operating system**: create-store → products → inventory → collections → discounts → customers → orders → domains → shipping → analytics → staff → settings → launch, **without developer involvement.** The admin is **substantially built** (63 pages, 85 API routes, compiles clean, 171/171 tests) and the *backend/gateway* is broadly production-quality (~88%). But the *merchant UI* consumes only part of it (~65% avg), with real holes in the end-to-end flow — so an honest "complete OS" cannot be certified.

## Orchestration note
The 15 mission streams were consolidated into **5 parallel read-only audit agents** (all 12 domains + UX + staff) + a verifiable baseline — efficient and non-redundant rather than 15 blind spawns. Per the mission's "every fix verified / no fake completion" rules, I applied only the fixes I could verify here and **documented** (not blind-applied) the UI/security work that needs a running stack.

## Readiness (merchant UI, evidence-based)
| Domain | % | Note |
|---|---|---|
| Products | 72% | CRUD/variants/media/SEO real; **delete-product button missing** (backend ready) |
| Collections | 62% | list/create/assign real; **edit/delete proxy FIXED this phase**; page buttons + smart collections remain |
| Inventory | 40% | view+adjust real; **purchase-orders + transfers are STUBS**; history UI-less |
| Orders | 62% | daily ops + step-up refund real; no detail page/timeline/returns UI |
| Customers | 25% | list only; **no detail page** (gateway rich, unconsumed) — lowest |
| Discounts | 85% | coupons production-ready; promotions = V1.1 |
| Analytics | 68% | **real live queries (no fabrication)**; monthly chart + telemetry gaps |
| Domains | 93% | real DNS/SSL/routing; blockers = deploy seams (H2/H3) |
| Shipping | 75% UI / 90% gw | LB-7 confirmed; rate-edit proxy + non-flat types remain |
| Settings | 84% | broad + real; **AISidebar 404 FIXED**; email page/payment-toggles/policies-storage remain |
| Staff/RBAC | 52% | management real; **permissions NOT enforced (security gap)** |
| Marketing | 67% | reviews+SEO real; campaign UI absent; H6 email seam |
| **UX** | **82%** | consistent; coupons mobile table regression |
| **Merchant Control Plane (UI)** | **~65%** | **backend/gateway ~88%** |

## Fixed this phase (verified)
1. **Collections edit/delete proxy** (was missing → 404): new ownership-checked `[collectionId]/route.ts` (PATCH/DELETE). Typecheck clean; contract-tested.
2. **AISidebar 404 link** (`settings/appearance` → `appearance`). Contract-tested.
- Files changed: 2 + 1 new test. Tests: 171/171 launch, 2/2 new, MCP typecheck clean, anti-fabrication + undeclared-import PASS.

## Known risks / blockers to PHASE 4 COMPLETE
1. **Customers: no detail page** (25%) — the single highest-value UI gap (add `/customers/[email]` → unlocks notes/addresses/history/timeline; gateway ready). UI, needs visual verification.
2. **Staff RBAC not enforced** — HIGH security: a viewer-role staff can call any write route. Needs a `requireStaffPermission` middleware + invite-acceptance page, carefully tested (not blind-applied).
3. **Inventory stubs** — purchase-orders + transfers pages are explicit "not available yet"; history is UI-less. Either finish or remove the stub pages.
4. **Missing edit/delete UI buttons** — products (delete), collections (proxy now exists, buttons don't), shipping (rate-edit proxy + non-flat types).
5. **Settings** — no `/settings/email` page; payment online/COD toggles are display-only; policies storage path inconsistency; custom-data is a stub.
6. **Marketing campaign UI** absent (backend ready); abandoned-cart worker missing.
7. **No visual/interaction verification** possible here (no running authenticated merchant stack) — UI correctness for every page is unverified by definition.
8. **Deploy seams:** H2/H3 (domains/DNS/SSL/Vercel), H6 (Resend email).
9. **Inherited WIP:** design-system + tenant-isolation validators (cross-app, not this phase).

## Path to PHASE 4 COMPLETE
Build the documented UI (customer detail, inventory finish-or-remove stubs, missing edit/delete buttons, settings email + payment toggles, marketing campaign UI) on a running stack with visual verification → implement + test staff RBAC enforcement + invite acceptance → provision H2/H3/H6 → re-certify with screenshots/interaction proof. The foundation is strong (rich backend, consistent UX, compiles, tests green); the gap is **UI consumption of the backend + RBAC enforcement + live verification** — real engineering, but not blind-applicable in this environment.

## Recommendation
Two tracks: **(a)** merchant-UI completion track (eng, on a running stack, visually verified — customer detail page first, then inventory stubs + edit/delete buttons + settings); **(b)** the staff-RBAC security track (eng, dedicated + tested). The collections-proxy and AISidebar fixes this phase are merged-ready and low-risk. Re-evaluate Phase 4 once the UI gaps close with visual proof and RBAC is enforced.
