# 01 — Customers (flagship: the #1 gap, executed)

**Readiness: 25% → ~55%.** The single highest-value gap is closed: a real customer **detail page** now exists.

## Built this phase (real, compiles, contract-tested)
- **Detail page** `apps/merchant-control-plane/src/app/[store]/customers/[email]/page.tsx` (NEW) — Profile (name/email/phone/status/tags/marketing/total-spent/order-count/dates), **Order history** (clickable rows → orders), **Addresses** (responsive grid), **Notes** (view + add via POST). Full loading-skeleton / error-with-retry / per-section empty states. `@letbuyy/ui` + `--lb-*` tokens only (verified: `tsxRawHex` 0, arbitrary-radius improved). Defensive shape-mapping (`readString`/`readNumber`) over the gateway response — **no hardcoded/mock data**.
- **Detail proxy** `api/stores/[store]/customers/[email]/route.ts` (NEW) — GET → `customers.getByEmail`, ownership-checked via `resolveOwnedStoreId` (mirrors the products proxy). 
- **Notes proxy** `api/stores/[store]/customers/[email]/notes/route.ts` (NEW) — GET + POST → `customers.notes.list`/`create`.
- **List wiring** `customers/page.tsx` — rows now navigate to `/${store}/customers/${encodeURIComponent(email)}`.

No api-client additions were needed (`getByEmail` + `notes.list`/`create` already existed — proven by the clean typecheck).

## Verification
merchant-control-plane `tsc --noEmit` EXIT 0 · contract tests `lb-merchant-admin` (detail proxy, notes proxy, real-page-consumes-proxy + clickable rows) PASS · 177/177 launch suite. **Compile-verified + contract-verified.**

## Honest boundary + remaining (still ~45%)
- **Flow/visual NOT verified** — the page renders only against a running authenticated merchant app with a real store; the gateway `GET /:email` returning `orders[]`/`addresses[]`, the notes POST persisting, and the 360px layout are unverified here.
- Activity **timeline** renders an honest empty state (no dedicated `customer_activity_log` read endpoint wired) — not fabricated.
- Order-row link uses `/orders?id=` (orders list may not deep-read the param yet).
- Still missing (Phase-4 register): real segmentation (the list "views" are still client-side), customer create, send-email, merge, GDPR delete/export, server-side list pagination (limit=100).
