# Media Service Reserved Root

Runtime boundary: `services/media-service`.

Status: reserved-not-implemented, manifest-only.

The active media owner is the canonical monolith and approved infrastructure adapters. This directory is a reserved seam only.

Rules:

- MUST remain manifest-only.
- MUST NOT add source, tests, package.json, wrangler.toml, or deployment config.
- MUST NOT extract uploads, transforms, storage policy, validation, or delivery coordination into this root.
- Any change from reserved status requires a human ARB amendment and the canonical topology update before source exists.
