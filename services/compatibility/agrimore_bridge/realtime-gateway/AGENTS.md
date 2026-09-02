# services/compatibility/agrimore_bridge/realtime-gateway AGENTS.md

Purpose: Local operating rules for this directory. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- This is a **bounded, non-deployed compatibility bridge** (System B/Agrimore's own Cloudflare Worker), not a canonical runtime. See `../README.md`.
- **Never wire this into any canonical ACTIVE runtime.** System C has no clearly-named realtime canonical owner today — this is flagged in `docs/migration/repository_consolidation/11_backend_consolidation.md` as the domain needing the owner's specific attention when D-0 resolves, not a signal to activate this bridge by default.
- Its direct provider SDK imports (`@upstash/redis/cloudflare`) are a known, disclosed deviation — inherited from System B verbatim.

## Forbidden Imports

- Must not be imported by any canonical ACTIVE runtime.

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 5) by cross-repository copy from System B's `workers/realtime-gateway`. Full history in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle`.
