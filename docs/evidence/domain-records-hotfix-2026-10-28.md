# Domain records display hotfix — 28 October 2026

The Merchant domain detail incorrectly suggested an apex ALIAS when only a subdomain was connected. Qualified source `2f9fbbaa387ee3a291f18dc3a94c2f81313a3247` removes the eight-line synthetic record from the canonical Gateway health projection. TXT/CNAME records, DNS/provider validation, SSL status, access checks and all other runtime code remain unchanged. No Merchant rebuild or database migration is needed.

Source merged into develop as `724a6336ddcde7af88e69eedb1bedef101d8b373`; its tree exactly matches the qualified source. The same single agent preserved the unmerged notification403 candidate `be83fb3b9` and both original worktrees.

Validation:1825 unit/contract checks, API typecheck,114 actual governance gates,15 passing original owned suites plus separately passed domain route2, tenant red-team2 and reconciliation11 checks. Initial mixed-run failures are retained: the new foreign-owner fixture reused a single-use nonce (correctly401), and role-reset fixtures required their own clusters. Fresh-nonce and isolated-cluster runs passed without weakening denials or role checks.

Staging API `eba16267-5d0e-4b3d-ac3b-934489d27833` matches the qualified bundle bytes; all bindings/secrets and63 variables preserved. Hosted health, ten themes, directory database read and unsigned domain-health401 checks passed. Full hosted staging Merchant sign-in remains unconfigured. The owner explicitly accepted that TEST-R8 gap and approved this API-only production release; the signed-in production Domains page must be verified after activation.

Local evidence directory: `/private/tmp/letbuyy-storefront-recovery-20261027/`, with `domain-records-hotfix-qualification.json`, `domain-records-hotfix-staging-deployment.json`, `domain-records-hotfix-staging-acceptance.json` and the exact production approval. Future production activation and browser evidence are recorded separately in that directory. No DNS/provider write, credential change, Queue/web deployment, schema403, order/payment or mail replay belongs to this hotfix.
