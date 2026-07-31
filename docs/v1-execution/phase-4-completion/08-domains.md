# 08 — Domains

**Readiness: ~93% code-present.** Real DNS/SSL/routing, no mocks. Blockers are deploy-time seams.

## Real (end-to-end, real data sources)
Add-domain wizard (TXT/CNAME generation), DNS verification via real DoH (Cloudflare + Google, ≥2 TXT answers), SSL status from the real Vercel API (`ssl_active`/`renewal_status`/`renewal_date` — not hardcoded), host routing in `proxy.ts` (custom domain → rewrite; redirect role → 301), 6 status + 5 SSL badge states (data-driven), background reconciler with drift events, abuse screening, 14 registrar deep-links. The one "NOT CONNECTED" label is an honest migration-gate, not a stub.

## Gaps
- **Deploy-time seams (H2/H3):** `CUSTOM_DOMAIN_CNAME_TARGET`, `VERCEL_API_TOKEN`/project id, registrar creds, migration 185 — all gracefully degraded; not code work.
- No DNS auto-poll in the wizard (manual "check again"); no redirect-target edit UI (client + gateway exist); no transfer-in. P2 code/UX.

**Verdict:** code-complete + real; production-readiness is gated by infra secrets/migrations (human seams), not code.
