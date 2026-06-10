# Executive Summary — LetBuyy Apps Platform Master Audit

**Date:** 2026-06-05 · **Scope:** complete forensic audit of the apps ecosystem + Shopify-parity rearchitecture blueprint · **Method:** 6 parallel code scans over ~991 source files, 233-table schema, CI/infra configs, with direct verification of every load-bearing claim. **No code was modified; this is documentation only.**

---

## The One-Paragraph Verdict

LetBuyy has built **more of a Shopify-style app platform than its own documentation believes, and less than its marketplace UI implies**. A real OAuth flow (authorize/token/token-exchange), a real signed-webhook pipeline with transactional outbox, a real sandboxed LiquidJS theme runtime with an OS 2.0-grade bundle format, and a charge-approval billing primitive all exist and work — but they are welded into a single 2,721-line gateway file, store credentials inside JSONB, enforce no scopes at request time, and deliver app content to shoppers only as escaped text or mis-sandboxed iframes. The decisive missing layer is **extension delivery**: apps cannot ship Liquid blocks, embeds, scripts, or assets into themes, which forecloses most real app categories. Overall Shopify compatibility scores **37/150 (≈25%)** — strong foundations (theme architecture 4/5), hollow middle (extensions, billing depth, partner tooling 0–1/5).

## Five Numbers That Define the Situation
1. **2,721 lines** — one gateway route file (`app-store.ts`) is the entire apps platform backend (8 concerns, no modules).
2. **50** — permissive `USING (true)` RLS policy lines, including on `app_installations`; tenant isolation currently depends on application discipline, not the database.
3. **6 of 9** — declared services that are manifest-only stubs; their responsibilities silently execute in the gateway.
4. **0** — mechanisms for an app to put JavaScript, CSS, or Liquid into a storefront (no theme app extensions, no app embeds, no app proxy).
5. **~45K LOC** — deletable dead weight (aspirational distributed-runtime packages, stub roots, doc sprawl, legacy Firebase) with zero feature regression if removed in the prescribed order.

## Most Consequential Findings
- **Critical security set (fix before any external app):** RLS bypasses (C1), ambient service-role key (C2), OAuth tokens in JSONB with no rotation/revocation/audit (C3), plaintext webhook secrets (C4), zero request-time scope enforcement (C5), iframe sandbox escape combination (C6). Full register: doc 07.
- **Docs drift both ways:** root ledgers claim marketplace completeness that tests contradict, while `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` declares the Liquid renderer stubbed when it is fully implemented (`theme-renderer.ts:104-210`). Governance memory needs the corrections in doc 02 §11.
- **Backend ahead of frontend:** partner/developer endpoints are live while `developer-portal` is a 10-file shell; embedded apps have three server endpoints **and** a working admin host page (`EmbeddedAppBridgeClient.tsx`) but no published client SDK or protocol docs for app developers — cheap, high-leverage build-outs.
- **What must NOT be rebuilt:** the Liquid bundle contract, outbox→HMAC webhook pipeline, token-exchange-shaped auth, and theme release/rollback model are parity-grade assets (doc 03 §3).

## The Plan (docs 08–22)
**Architecture:** complete the existing canonical topology rather than invent services — activate `media-service` as the app-asset CDN (the only new worker), decompose the gateway monolith into app-store modules, move credentials into `oauth_tokens`/`oauth_clients`/`api_keys` tables, and introduce the Theme App Extension pipeline (validated bundles → R2 immutable CDN → version-pinned release manifests → `@app` blocks + head/body embeds + signed app proxy). Publish-time materialization replaces request-time normalization; a 60-second edge kill switch backstops everything.
**Sequence:** 13 phases (P0 audit ✅ → P1 security/CI hygiene → P2 dead-code deletion → P3 extension registry → P4 app identity/scopes → P5 Liquid integration → P6 TAE end-to-end → P7 `@app` blocks → P8 embeds+proxy → P9 marketplace/review/billing → P10 partner platform/CLI/payouts → P11 migration → P12 GA). Critical path ≈ **86–110 engineer-weeks (~5–6 months at 4 engineers)**.
**Hard gate:** the GA checklist (doc 22) — isolation test matrix, chaos drills, fresh-migration replay, payout reconciliation — signed before any external app touches production. Today's platform is **not ready** for third-party apps; it is roughly one focused phase (P1 + P4 slice) from a safe trusted-partner pilot.

## Deliverable Map
26 mandated deliverables across 22 documents — index and mapping in `00-README.md`.
