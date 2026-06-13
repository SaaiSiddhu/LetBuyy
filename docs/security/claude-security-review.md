# Claude Code Security Review — Setup & Operations

LetBuyy runs Anthropic's [`claude-code-security-review`](https://github.com/anthropics/claude-code-security-review) GitHub Action as **advisory** AI security signal on top of the authoritative deterministic governance gate.

## Workflows
| Workflow | Trigger | Behaviour |
|----------|---------|-----------|
| `.github/workflows/security-review.yml` | every PR (`opened`/`synchronize`/`reopened`) | reviews the PR diff, posts inline review comments. Skipped on forks. |
| `.github/workflows/full-security-audit.yml` | weekly cron (Mon 04:30 UTC) + manual | whole-repo AI audit **and** the deterministic security validators (canonical-ledger, no-public-USING-true, rls-force, no-blanket-service-role, identity-sole-issuer). |

## Required secret
- **`ANTHROPIC_API_KEY`** — set in *Repo → Settings → Secrets and variables → Actions*. Without it the AI jobs are skipped/fail-soft; the deterministic validators still run.

## What it scans for
Injection (SQL/command/XSS), authn/authz gaps, missing ownership/tenant checks, secret exposure, SSRF, crypto misuse, unsafe deserialization, insecure config.

## False-positive tuning (LetBuyy invariants)
`security-review.yml` passes `false-positive-filtering-instructions` so the reviewer does **not** flag these correct patterns:
- Money mutations via `SECURITY DEFINER` RPCs (`db.rpc`) — not direct table writes.
- HS256 customer / ES256 merchant session separation.
- `getSupabaseAdmin` (service role) used behind explicit `verifySiteOwnership` checks.

## Relationship to the governance gate
This action is **advisory and non-blocking**. The blocking authority is `node scripts/validate-governance.mjs` (107 validators). AI findings inform; they do not override governance.

## Remediation process
1. Triage each PR comment: **confirmed / false-positive / accepted-risk**.
2. Confirmed → fix in the same PR; re-run the workflow.
3. False-positive → extend `false-positive-filtering-instructions` (don't suppress silently).
4. Accepted-risk → record in `SKIPPED_HUMAN_DECISIONS.md` with rationale + owner.
5. Weekly-audit findings that touch money/identity/tenancy escalate to ARB before merge.
