# services/compatibility/firebase_bridge AGENTS.md

Purpose: Local operating rules for `services/compatibility/firebase_bridge`. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- This is a **bounded, non-deployed compatibility bridge** (System A's Firebase Cloud Functions), not a canonical runtime. See `README.md`.
- **Never wire this into `services/api-gateway` or any of the 8 canonical ACTIVE runtimes.** Activating it as a live path requires a D-0 decision this repository has not made.
- Its provider SDK imports (`firebase-admin`, `firebase-functions`) and its `package-lock.json` (npm, not pnpm) are known, disclosed deviations from this repository's normal conventions — inherited from System A verbatim, not to be "fixed" by making this bridge look more integrated than it is.
- Never add a hardcoded credential fallback to any config getter in this directory; see the containment fix in `src/razorpayService.ts`.

## Forbidden Imports

- Must not be imported by any canonical ACTIVE runtime (`apps/*` six-app-model roots, `services/api-gateway`, `services/queue-workers`, `services/mobile-bff`, `services/webhook-service`).

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 5) by cross-repository copy from System A's `functions/`. Full history in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle`.
