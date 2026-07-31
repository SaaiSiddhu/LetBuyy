# 02 — MCP Navigation Route Registry

**Source:** `apps/merchant-control-plane/src/components/merchantNavigation.ts` (store site type). **Verification:** every nav path resolves to a real `app/[store]/<path>/page.tsx`. **Result: 26/26 — NO dead navigation.**

| Nav path | Page exists | Notes |
|---|---|---|
| dashboard | ✅ | Home |
| orders | ✅ | + `?view=drafts`, `?view=abandoned-checkouts`; detail at `orders/[orderId]` (row-click) |
| settings/billing · payouts | ✅ | Money group |
| products | ✅ | |
| products/new · products/collections · products/inventory · categories · products/purchase-orders · products/transfers · products/gift-cards | ✅ | PO + transfers pages exist as labeled stubs (see `05`) |
| coupons | ✅ | Discounts |
| customers | ✅ | detail at `customers/[email]` (row-click) |
| **customers/segments** | ✅ | **NEW (Phase 4.75)** — linked under Marketing |
| reviews | ✅ | |
| **marketing** | ✅ | **NEW (Phase 4.75)** — Campaigns, linked under Marketing |
| pages · posts · comments | ✅ | Content |
| online-store/themes · online-store/pages · online-store/preferences | ✅ | |
| apps · settings · appearance | ✅ | |

## Dynamic (non-nav) routes — reachable by interaction, correctly not nav items
- `orders/[orderId]` — order detail (orders list row-click). **NEW (Phase 4.75).**
- `customers/[email]` — customer detail (customers list row-click). **NEW (Phase 4.5).**

## Command palette
`getMerchantCommandItems` derives palette entries from this same nav tree + children, so the new Segments + Campaigns entries are also command-palette addressable. Keyboard shortcuts unchanged (`shortcutDestinations`).

**Locked:** the navigation registry is complete and dead-link-free for the store site type.
