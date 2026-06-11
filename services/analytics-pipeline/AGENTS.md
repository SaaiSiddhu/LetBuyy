# Analytics Pipeline Reserved Root

Runtime boundary: `services/analytics-pipeline`.

Status: reserved-not-implemented, manifest-only.

The active analytics owner is the canonical monolith read paths and approved queue-worker jobs. This directory is a reserved seam only.

Rules:

- MUST remain manifest-only.
- MUST NOT add source, tests, package.json, wrangler.toml, or deployment config.
- MUST NOT introduce a standalone ingestion pipeline, projection runtime, replay system, or cross-region analytics service.
- Any change from reserved status requires a human ARB amendment and the canonical topology update before source exists.
