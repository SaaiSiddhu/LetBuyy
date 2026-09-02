# services/compatibility/agrimore_bridge/api-gateway AGENTS.md

Purpose: Local operating rules for this directory. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- This is a **bounded, non-deployed compatibility bridge** (System B/Agrimore's own Cloudflare Worker), not a canonical runtime. See `../README.md`.
- **Never wire this into `services/api-gateway` or any of the 8 canonical ACTIVE runtimes, and never activate any of its routes as a production path.** Agrimore is a quick-commerce and operational feature donor, never a canonical backend, per the owner's standing decision.
- Its direct provider SDK imports (`@upstash/redis/cloudflare`) are a known, disclosed deviation from this repository's `packages/infrastructure` adapter convention — inherited from System B verbatim, not to be "fixed" by making this bridge look more integrated than it is.

## Forbidden Imports

- Must not be imported by any canonical ACTIVE runtime.

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 5) by cross-repository copy from System B's `workers/api-gateway`. Full history in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle`.
