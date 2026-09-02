# services/compatibility/agrimore_bridge/media-gateway AGENTS.md

Purpose: Local operating rules for this directory. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- This is a **bounded, non-deployed compatibility bridge** (System B/Agrimore's own Cloudflare Worker), not a canonical runtime. See `../README.md`.
- **Never wire this into any canonical ACTIVE runtime.** It structurally resembles the currently-RESERVED (must-stay-empty) `services/media-service` — activating either requires a named trigger and ARB approval, independent of any D-0 decision.

## Forbidden Imports

- Must not be imported by any canonical ACTIVE runtime.

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 5) by cross-repository copy from System B's `workers/media-gateway`. Full history in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle`.
