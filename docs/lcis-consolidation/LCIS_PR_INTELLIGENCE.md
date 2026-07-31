# LCIS PR Intelligence

Package: `@letbuyy/lcis-pr-check` | Binary: `lcis-pr-check`

---

## Overview

The PR check analyzer ingests a list of changed file paths, maps them to LetBuyy's 22 business domains, derives a risk level, raises 8 sensitivity flags, and produces a structured PR comment with blast-radius evidence from the live LCIS engine.

---

## How It Works

```
changed-files.txt
       │
       ▼
  domain-map.ts          ← PATH_DOMAIN_RULES (22 domains, first-match-wins)
  (filePathToDomain)
       │
       ▼
  analyze.ts             ← analyzePr(input: PrInput): Promise<PrReport>
  ├── 8 sensitivity flags (path pattern matching)
  ├── domain fan-out (DOMAIN_TO_SERVICES)
  ├── blast radius (engine.blast.blast() per changed symbol)
  └── risk derivation (RiskDerivation)
       │
       ▼
  comment.ts
  ├── renderComment()    → markdown PR comment
  ├── renderJson()       → JSON artifact
  └── renderSummary()    → one-line step summary
```

---

## Input

```ts
interface PrInput {
  files: string[];        // changed file paths relative to repo root
  symbols?: string[];     // optional: explicit symbol names to blast
  prNumber?: number;
  prTitle?: string;
  baseSha?: string;
}
```

Accepted via:
- `--files path/a.ts path/b.ts` (CLI args)
- `--files-from <file>` (one path per line)
- stdin (one path per line)

---

## Domain Mapping

`PATH_DOMAIN_RULES` in `domain-map.ts` contains ordered, first-match-wins rules that map file paths to one of 22 business domains:

| Domain key | Example paths |
|-----------|--------------|
| `payments` | `services/api-gateway/src/routes/payments*`, `*payment*` |
| `identity` | `apps/identity-platform/**` |
| `orders` | `*orders*`, `*order_items*` |
| `checkout` | `apps/storefront-runtime/src/*checkout*` |
| `products` | `*products*`, `*collections*`, `*inventory*` |
| … | (22 total) |

`DOMAIN_TO_SERVICES` maps each domain key to the services it touches.

---

## Sensitivity Flags

8 boolean flags are raised when any changed file path matches the corresponding pattern set:

| Flag | Pattern set |
|------|-------------|
| `crossDomain` | Changes span more than one domain |
| `authRelated` | `AUTH_PATTERNS` — jwt, session, oauth, turnstile, credentials |
| `paymentRelated` | `PAYMENT_PATTERNS` — razorpay, ledger, rpc payment, webhook payment |
| `rlsRelated` | `RLS_PATTERNS` — policy, rls, row level, security definer |
| `migrationRelated` | `MIGRATION_PATTERNS` — migrations/, supabase/migrations/ |
| `tenantIsolation` | `TENANT_PATTERNS` — site_id, tenant, getSupabaseAdmin |
| `validatorImpact` | `VALIDATOR_PATTERNS` — validate-governance, canonical-ledger |
| `securitySensitive` | `SECURITY_PATTERNS` — crypto, hash, signature, hmac, secret |

---

## Risk Derivation

`RiskLevel`: `LOW | MEDIUM | HIGH | CRITICAL`

`RiskDerivation` includes:
- `level` — final risk level
- `reasons[]` — human-readable rationale strings
- `evidence[]` — blast-radius nodes and file counts from LCIS engine

Risk is elevated by: high-sensitivity flags (`paymentRelated`, `authRelated`, `rlsRelated`), cross-domain changes, and blast radius criticality (`critical` / `high`).

---

## Output Formats

### Markdown PR Comment

The `## LCIS ANALYSIS` comment posted or edited on the PR includes:

```markdown
## LCIS ANALYSIS

**Risk Level:** HIGH  
**Domains Affected:** payments, identity (2)  
**Sensitivity Flags:** paymentRelated, authRelated

### Blast Radius
| Symbol | Nodes | Files | Criticality |
|--------|-------|-------|-------------|
| confirmPayment | 43 | 28 | high |

### Evidence
- services/api-gateway/src/routes/payments.ts
- packages/shared-types/src/payment.ts
…

### Recommendation
…
```

### JSON Artifact

Full `PrReport` as JSON, suitable for CI artifact upload and downstream tooling.

### Summary

One-line summary written to `$GITHUB_STEP_SUMMARY`:
```
LCIS: HIGH risk — payments, identity — paymentRelated, authRelated — 43 blast nodes
```

---

## CLI Usage

```bash
# from stdin
git diff --name-only HEAD~1 | pnpm lcis:pr-check

# from file
pnpm lcis:pr-check --files-from lcis-changed-files.txt --format markdown

# with output artifact
pnpm lcis:pr-check --files-from changed.txt --format json --out lcis-report.json

# with explicit symbols
pnpm lcis:pr-check --files a.ts b.ts --symbols confirmPayment --format markdown
```

---

## GitHub Action

The composite action at `.github/actions/lcis-analysis/` automates the full flow:

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | yes | — | Must have `pull-requests: write` |
| `base-ref` | no | PR base SHA | Git ref for diff computation |
| `comment` | no | `'true'` | Whether to post/update the PR comment |

**Steps:**

1. **Compute changed files** — `git diff --name-only BASE...HEAD > lcis-changed-files.txt`; falls back to `HEAD~1...HEAD` if the base ref is not verifiable.
2. **Run LCIS PR analysis** — runs `pnpm lcis:pr-check` three times:
   - `--format json --out lcis-report.json`
   - `--format markdown --out lcis-comment.md`
   - `--format summary >> $GITHUB_STEP_SUMMARY`
3. **Post / update PR comment** — `gh pr comment --body-file lcis-comment.md --edit-last || gh pr comment --body-file lcis-comment.md` (only on pull_request events when `comment == 'true'`).
4. **Upload artifact** — `lcis-pr-report` containing `lcis-report.json`, `lcis-comment.md`, `lcis-changed-files.txt`.

---

## Workflow Integration

`.github/workflows/lcis-pr-analysis.yml` triggers on `pull_request` (opened / synchronize / reopened):

```
checkout (fetch-depth: 0)
  → pnpm install
  → cache restore graphify-out/ (keyed to SHA)
  → if cache miss: graphify update + graph:db + graph:infra + graph:domain + graph:relationships
  → .github/actions/lcis-analysis (composite)
```

**Artifact dependency:** the `graphify-out/` directory must exist before the analyzer runs. The workflow caches it by `github.sha` and regenerates it on cache miss. Each graph script uses `|| true` so a failure in one script degrades gracefully rather than failing the entire job.

**Concurrency:** `lcis-pr-<pr-number>`, cancel-in-progress — ensures only one analysis runs per PR at a time.

**Permissions:** `contents: read`, `pull-requests: write`.

---

## Programmatic Use

```ts
import { analyzePr, renderComment } from '@letbuyy/lcis-pr-check';

const report = await analyzePr({
  files: ['apps/identity-platform/src/app/api/auth/create-store/route.ts'],
  prTitle: 'Fix store creation auth flow',
});

const markdown = renderComment(report);
```
