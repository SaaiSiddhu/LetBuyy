# Hosted warehouse recovery — 1 November 2026

## Candidate and scope

The integrated backend/web candidate is `9b5b89437703cba8527b9e0ca32ca9a7aca495b8` on
`codex/merchant-mobile-parity`. Accepted Accounts CSRF changes and shipping/GST
release evidence were merged from `origin/develop` at `14961c132`. The only merge
conflict was the branch-disposition table; both original rows were retained.
Merchant web/mobile, shared contracts, Gateway, BFF and database trees are
unchanged from the qualified warehouse source `15fca500a`. The dirty primary
checkout was not modified. This is a bounded warehouse candidate, not acceptance
of the whole 122-item programme.

The subsequent native-only environment repair is
`13d254de23e29919af5d5d4ce81e567584adc338`: **747/747 Flutter tests**, including
19 endpoint-boundary cases, clean analysis and disposable-clone **114 passing
governance validators**, zero failures/blocked/skips and one not-applicable.
Branch-disposition checks retain declared nonblocking missing-local-ref advisories;
they do not prove live promotion readiness. The ignored `--json-out` argument
emitted no full machine-readable matrix; the completed gate text and a derived
summary are retained. All backend/web/database component trees remain identical
to 9b5b89437. The new production-configured debug APK is 219,844,402 bytes, SHA256
`f18e002298f23dcb46b798e9d4e8950fe374fe8ca880204fb45e1895c589b7db`; installed
hash matched on `emulator-5580`. Startup retained sign-in, Products was reachable,
no configuration error or password fields were visible. This does not accept
warehouse creation, staged sync, release signing or an iOS artifact.

## Observed production cause

Authenticated requests from the signed-in task emulator reached both production
Workers. Sanitized, bounded tails observed:

| Request | BFF | Gateway |
| --- | ---: | ---: |
| `/v1/inventory/locations` | 200 | 200 |
| `/v1/inventory/suppliers` | 200 | 200 |
| `/v1/inventory/command-capabilities` | 404 | 404 |

The active API version is `f5d20b78-e4ba-4c26-95f7-65d5ffc17bfa`; active BFF is
`984c46ab-17d9-4a8b-9320-9a089fcfef84`. The API's accepted shipping release receipt
identifies qualified runtime source `d0afb9060`. Its source handlers return bare
metadata arrays without the current scope/count/page acknowledgement. They do
not implement the command-capabilities route. Actual app transport succeeds;
the hosted contract is downlevel. The native unavailable state must remain until
the compatible API/schema is activated and read back.

Separate unauthenticated Python probes received Cloudflare 403/error 1010. They
do not explain the authenticated app's 200/404 responses. No firewall, browser
integrity, challenge or access control was weakened.

Certificate-verified, read-only production catalog inspection found 341 history
rows, migration 414 absent, no warehouse command function/receipt relation, and
both metadata tables owned by `postgres` with RLS and FORCE RLS enabled. The
canonical product actor guard exists. Observed history digest:
`db50a4d8614bba02fed5b8fb965495b35274f94f39c474a6401061e7cffc3319`.

## Approved recovery proof

The owner explicitly approved an encrypted production recovery export including
commerce, authentication/session, storage metadata and migration history solely
for local rehearsal. The first export attempt was rejected before execution by
automatic review; the explicit approval resolved that export authorization gap.
Provider-role passwords were excluded. The custom PG17 archive was encrypted in
flight; no plaintext dump was retained. Decrypt/hash round-trip verification
passed. Ciphertext SHA256:
`1b01ff49c4a5f362cdee98a9d6d6a8191dc50b1054da8ad88cca33370d74c76e`.

Owned restore run `d0b2239984e0` used the pinned Supabase PG17 image, network
disabled, original owners/grants/constraints/triggers, and the exact short-lived
CLI maintenance identity. Migration 414 UP → DOWN → UP passed locally. All
original rows across 523 public/auth/storage tables were preserved exactly;
retained changes were empty. Rollback restored original history and guards.
The only expected privilege-journal additions were 41 migration-414 rows; the
new command-receipt table remained empty. Raw metadata INSERT denial and private
function ACLs were rechecked. The first rehearsal failed before archive restore
because an old temporary native helper was absent; its failed receipt remains,
and the task-owned replacement helper's rerun passed. No hosted write occurred.
Independent exact-run Docker readback found no remaining container, network or
volume. Its first inventory check used an invalid container formatter and was
corrected before recording that result.

## Prepared artifacts

Private local directory: `/private/tmp/letbuyy-hosted-warehouse-20261101`.
All artifacts below are preparation only; none was uploaded or activated.

| Artifact | Qualified identity |
| --- | --- |
| API, local production and staging bundles | `index.js` SHA256 `cd641400800125fadde1d8615254834e7cdfc6181ad270b6cf000c13df1095c3`; both original WASM modules retained |
| BFF, local production and staging bundles | `index.js` SHA256 `fbe8393288aac8fb548970f4f859d2cec9d65f717c36ff347d3e790de8f619e9` |
| Merchant local production build | Build Output API v3; optimized compilation/typecheck passed; 458 routes; no external symlinks; manifest tree SHA256 `0808f1e3e3793d11c154b42f9b697bd13b23f4eb063954a466b9cd0dee12c2ad` |
| Production history-bound migration 414 preparation | Batch SHA256 `a10aafaa901f8c79f6ef80d20f116344a7184fa40aee8012d413605a4f1b7a12` |
| Staging history-bound migration 414 preparation | Batch SHA256 `dce07915f93131c169be1a52f4daf67e73926900f5e1352172e927e906e330fa` |

API production/staging plain-text bindings match their respective source
configuration exactly. BFF production retains the pre-existing extra
`FAILOVER_REGION` variable without using it to activate a region; deployment must
preserve existing variables. BFF staging plain-text variables match source, but
its internal-session and Turnstile secrets are missing. Source bundles alone do
not repair that configuration.

Integrated BFF unit tests pass 24/24 with clean typing. Disposable exact-source
governance passes 114, zero failures/blocked/skips, one not-applicable. Relevant
15fca500a test evidence remains reusable because the affected trees are identical;
see [metadata recovery](WAREHOUSE_METADATA_RECOVERY.md). Counts are not additive
and do not establish hosted acceptance.

Preparation refusals remain retained: short-SHA and inline-name argument mistakes
were refused before database access; the first local API staging dry-run used the
wrong working directory and failed its WASM check; the runtime-directory rerun
passed. The first Vercel local build misused a READY deployment context and was
refused before building; ordinary local production build passed. Neither failure
activated traffic.

## Staging admission and required maintenance decision

Staging has the same 341-row history digest through migration 413, the canonical
actor guard and FORCE-RLS metadata tables; it has no migration 414 owner/receipt.
Active staging versions are API `5a3ae187-7a51-47f8-b89c-4bc2d8aa0c7b` and BFF
`9e404dac-6659-42f2-a713-2d89415c9bfc`.

Vercel's Merchant project `prj_BkaBsf3h7TvKRMpmyYQWsVmfP38J` has production
settings, but its staging-branch preview environment lacks the Merchant API,
Accounts/admin origins and internal signing configuration. No dedicated Merchant
staging project was found. The `admin-staging.letbuyy.com` and
`accounts-staging.letbuyy.com` alias lookups both returned 404. The ordinary
preview build compiled, but **is rejected for staging deployment** because its
fallbacks may select production. Never deploy that local preview output.

The checked-in mobile staging profile also selected production BFF/Accounts and
inherited the production invitation destination. A subsequent native-only repair
selects the governed staging hosts and checks hosted endpoint coherence before
constructing clients or restoring a session. That repair has its own source/test
identity and does not retroactively change the pinned 9b5b89437 artifacts.

The concrete next hosted step is a staging-only maintenance window:

1. Preserve an encrypted staging public/auth/storage/history recovery backup and
   verify its local retained-data restore; do not export role passwords.
2. Complete the existing canonical Accounts and Merchant staging previews with
   staging-only origins, database/issuer configuration and matching internal
   secrets; retain access protection. Provision the missing BFF staging secrets
   from the same staging authority. Do not reuse production secrets, sessions or
   payment rails, create a parallel issuer, or weaken checks.
3. Reconcile exact accepted source/history, prepare the fresh journal-bound 414
   artifact and apply it on one certificate-verified maintenance backend. Stop
   and read history if acknowledgement is uncertain.
4. Activate only staging API/BFF and the private staging previews from pinned
   source, using the governed wrappers; read back versions/bindings/schema.
5. Use synthetic staging owner/staff/site fixtures to prove web→mobile and
   mobile→web location/supplier creation, original-key recovery, receipt readback,
   store switches and revoked-role refusal. Record actual browser/emulator and
   database effects. Do not call fixture or API-only evidence full UI acceptance.
   Use fresh task-owned staging emulator/app state; never copy or reuse the
   production session or overwrite the signed-in production test installation
   merely to switch environments. Full persisted-state isolation for colocated
   staging/production installations remains a separate native release gate.

The existing backup approval expressly covers production export/local rehearsal;
it is not a production deployment or hosted migration approval. The staging window
and sensitive staging backup must be explicitly authorized before execution under
[the migration execution requirements](../../../scripts/supabase/README.md) and
`DEPLOY-R1`/the linked promotion procedure. No main/staging push, production schema
write, Worker activation, Merchant alias promotion or business mutation has been
performed here.

## Compatible recovery and open acceptance

Before any command receipt exists, the paired DOWN can be considered only after
fresh exact history reconciliation and the empty-receipt precondition. Once any
business command has committed, preserve its receipt and database changes and
roll forward. Do not drop receipts or restore raw write privileges to manufacture
a rollback. Old clients that use direct metadata writes must be accounted for at
staging admission; safe downlevel refusal is distinct from successful operation.

Production activation requires observed staging acceptance and the owner's
concrete release decision. The complete 122-row audit, owner/staff journeys,
cross-client conflict/synchronization, provider money/commerce proof and signed
Android/iOS release remain open. No production-ready certification is made.
