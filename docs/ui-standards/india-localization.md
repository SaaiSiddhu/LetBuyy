# India Localization (India-First)

LetBuyy is built for Indian merchants and shoppers first.

- **Currency** — INR everywhere via `formatInrCurrency` (`@letbuyy/ui/formatting`); amounts stored as `*_minor bigint`. ₹ symbol; lakh/crore grouping where natural.
- **Dates/numbers** — `toLocaleDateString('en-IN')`, `en-IN` number formatting.
- **GST** — GSTIN capture (B2B), GST breakdown shown at checkout, immutable GST invoices; tax computed server-side.
- **Addresses** — Indian address shape: pincode (serviceability checks), state, city; phone +91.
- **Payments** — Razorpay (cards/UPI/netbanking/wallets) + COD as first-class; UPI-friendly flows.
- **Shipping** — pincode-based serviceability + zone rates; manual fulfilment in V1.
- **Language/tone** — clear English; avoid US-centric idioms; keep copy simple for small merchants.
- **Performance** — optimize for mid-range Android on patchy networks (mobile-first, light bundles, cached reads).
