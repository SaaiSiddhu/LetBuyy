# Search Service Reserved Root

Runtime boundary: `services/search-service`.

Status: reserved-not-implemented, manifest-only.

The active search owner is the canonical monolith and existing storefront/admin query paths. This directory is a reserved seam only.

Rules:

- MUST remain manifest-only.
- MUST NOT add source, tests, package.json, wrangler.toml, or deployment config.
- MUST NOT extract storefront, admin, marketplace, or content search indexing/querying into this root.
- Any change from reserved status requires a human ARB amendment and the canonical topology update before source exists.
