# 11 — Production Infrastructure Readiness

**Readiness: ~15% code-certifiable / ~85% human-gated.** This is the dominant launch gate.
Detailed audit: `docs/v1-execution/pre-launch-wave/10-infrastructure.md`. **No live validation is fabricated.**

## Code-present (verifiable)
4 Workers with staging+prod `wrangler.toml`; 5-queue fanout + DLQs + cron; 186 migrations + 156 RPCs + 651 policies (migration-gated); Vercel targets + topology/lifecycle JSON (schema-validated). `production-topology.json` is explicitly labelled `mode: governance-contract-not-live-evidence`.

## Human-readiness wall (NOT certifiable from the repo)
| Seam | What | Tier |
|---|---|---|
| H2 | ~41 production secrets | Launch-blocking |
| H3 | DNS wildcard + SSL | Launch-blocking |
| H4 | Prod Supabase + 186 migrations applied | Launch-blocking |
| H6 | Resend live (also unblocks console login + order emails) | Launch-blocking |
| H7 | Turnstile live keys | Days |
| H8 | Razorpay Route PA onboarding | **Weeks (regulatory)** |
| H9 | Legal ToS/Privacy/DPDP | Founder+legal |
| — | WABA WhatsApp (COD confirmation) | Business |

## Verdict
Infrastructure **cannot be certified from this engineering environment** — code readiness is high but operational readiness is gated by the H2–H9 human/business/regulatory seams. This is the primary structural reason Phase 3 cannot be certified complete.
