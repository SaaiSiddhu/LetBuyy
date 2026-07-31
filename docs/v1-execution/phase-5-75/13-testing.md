# 13 — Testing

**Status: ✅ green. No fake tests — every assertion checks a real file/route/method.**

| Check | Result |
|---|---|
| `@letbuyy/tenant-core` typecheck | ✅ EXIT 0 (payment schema field) |
| `@letbuyy/api-client` typecheck | ✅ EXIT 0 (notifications methods) |
| `@letbuyy/api-gateway` typecheck | ✅ EXIT 0 (RBAC ×12 + stores allow-list) |
| `@letbuyy/merchant-control-plane` typecheck | ✅ EXIT 0 (notifications + payment UI) |
| `tests/launch/lb-phase5-commerce.test.mjs` | ✅ **12/12** (4 PO + 5 [5.5] + 3 [5.75]) |
| Full launch suite | ✅ **196/196** (was 193 + 3) |

## Contract tests added (Phase 5.75)
- **RBAC:** inventory.ts imports the guard + has ≥12 `products:write` `assertStaffPermission` call sites.
- **Notifications:** api-client `preferences`/`deliveryLogs` present; proxies ownership-checked + delegate; ops page consumes them.
- **Payment:** `stores.ts` allow-list includes `cod_enabled`/`online_payment_enabled`; payment-config proxy has PATCH; settings page wires the toggle to the proxy.

## Honest boundary
All tests are **compile + contract** level. Runtime flow (toggle persists to `sites`; preference PUT round-trips; the 12 RBAC guards actually 403 a viewer in `enforce` mode) needs a live gateway + DB — explicitly out of scope, not faked.

**Verdict:** the Phase-5.75 work is typecheck-clean across 4 packages + contract-tested + regression-free.
