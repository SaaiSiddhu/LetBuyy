# Checkout Runtime Reserved Root

Runtime boundary: `services/checkout-runtime`.

Status: reserved-not-implemented, manifest-only.

The active checkout owner is `services/api-gateway` plus hosted storefront checkout surfaces. This directory is a reserved seam only.

Rules:

- MUST remain manifest-only.
- MUST NOT add source, tests, package.json, wrangler.toml, or deployment config.
- MUST NOT extract checkout, payments, inventory reservation, or order finalization into this root.
- Any change from reserved status requires a human ARB amendment and the canonical topology update before source exists.
