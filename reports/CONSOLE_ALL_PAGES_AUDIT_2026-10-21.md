# Console page audit and repairs — 21 October 2026

Working position: branch `develop`, source HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`; changes remain local and uncommitted. Existing unrelated work and environment files are preserved.

Scope: `apps/internal/console`, its existing API contracts and shared UI. This follows the redesign and directory read repair reports. The work preserves the canonical monolith, Identity issuer, permission resolver and tenant guards. No production deployment, schema migration, provider execution or real merchant mutation was performed.

## Page inventory

The inspected Console contains 31 page source files. The enabled index sweep covers dashboard, stores, merchants, founding, users, employees, revenue, subscriptions, money reconciliation, listing reviews, reels, trust and safety, analytics, operations, incidents, risk, compliance, approvals, audit logs and settings. Populated detail coverage targets merchant, trust case, listing and a synthetic rejected reel record; approval detail is exercised in the separate independent-approval browser journey. Login/MFA/logout and mobile navigation are also exercised. Developer and app-governance pages remain gated with a rendered not-found response (Next streaming can begin with HTTP 200 before `notFound()`).

## Findings repaired

- Operations pages sent the private Console bridge to legacy endpoints expecting a human bearer. An exact-route private adapter now binds the verified durable Console session to the existing operator handlers. Existing role/scope checks remain; admitted writes also require current permission and fresh step-up. Generic runtime execution, outbox dispatch and frozen app-platform routes are not admitted.
- Runtime queue diagnostics triggered the tenant guard. Only that cross-site read now uses the existing operator-read client, behind `incident:view`, capped at 30 snapshots. Other guarded queries stay guarded. The source-contract allowlist records the specific exception.
- Additional private analytics, settings, user, employee, founding and compliance endpoints now verify live human permissions rather than relying on a bridge alone. Audit authors come from the validated session, not request actor fields. Audit failures remain blocking.
- Compliance creation supports an exact idempotent retry and rejects a changed intent; detail and update resolve the record owner and constrain updates by both tenant and primary key. This is recovery coverage, not a certification of every possible concurrent compliance mutation.
- Failed action forms now display an inline recovery message and retain draft inputs and existing request keys. Double submission is disabled while pending. Next redirect control flow is preserved.
- Missing analytics, revenue, subscriptions, risk, compliance and operations responses no longer masquerade as healthy zero totals. Actual zero values remain valid. Missing founding configuration and settings show an explicit unavailable state.
- The listing review queue now paginates in 25-record pages instead of silently stopping at 50. Fractional and unsafe page values are rejected/reset at the UI boundary.
- Founding CSV downloads preserve the current page/filter and identify themselves as page exports. Both web and direct worker exports are bounded, validate inputs, report failures and encode CSV cells, including spreadsheet formula prefixes. Exports use private/no-store caching.
- Audit date filters now use IST midnight boundaries to match displayed dates; impossible calendar dates are rejected.

## Verification

- Full gateway unit/source-contract lane: **1,608 passed**.
- Console application and federation tests: **34 + 12 passed**.
- Isolated API regression suites: **15 passed**, including real worker/PostgreSQL reads, permission denials, forged audit identity, compliance retry/update, failing founding RPCs, IST dates and bounded CSV.
- Real browser sign-in/logout recovery, independent merchant approval and trust-case reinstatement: **3 passed** in an isolated candidate checkout with no developer environment files.
- Type checks, Console production build, design-system governance and touched CSS lint passed. Console ESLint reports 25 existing raw-control warnings, no errors.
- The all-pages acceptance sweep uses synthetic records and disposable databases. Earlier failures are retained as evidence of discovered defects rather than counted as successful runs. One later run stopped on Chromium `ERR_NETWORK_IO_SUSPENDED` while navigating to a reel detail; its result is not counted as a pass.
- Final API permission rerun: **8 passed**, including bridge-only/read-only denial for admitted operator mutations. Fixture cleanup reports no remaining owned containers, networks or volumes.
- Live local checks: Console `http://localhost:9007/login` and backend `http://localhost:9010/health` both returned HTTP 200.

The initial reel fixture was a merchant draft, which the canonical operator reader correctly denied. That fixture failure is excluded from positive coverage; the final fixture is explicitly synthetic and rejected, with no fabricated media custody or inspection evidence.

## Final all-pages browser result

**PASS**, run `3d99df6d6371`, `/tmp/console-all-pages-final6.json`: one complete acceptance journey, zero failures/skips/cancellations. Coverage: **20 enabled index pages, four populated detail pages, two gated pages, listing second-page navigation, failed-form draft retention with no schedule insert, and mobile navigation**. Each enabled index rendered one main landmark with no page API error alert and no horizontal overflow at 390px. The final run did not need the narrow network-suspension retry. The reel detail displayed its synthetic revision caption; actual media inspection remains unavailable and is not claimed.

Fixture cleanup: no failures and no remaining owned containers, networks or volumes. Final Console production build and both runtime type checks passed after the subscription outage display correction. The local servers remained available; no production deployment was made.

## Limits

This is a Console audit, not a certification that every domain or provider integration is production-ready. Frozen developer/app governance stays disabled. Synthetic browser coverage does not prove real provider delivery, private media playback, ledger reconciliation against a live PSP or every possible concurrent command outcome. No claim is made that all possible bugs in LetBuyy have been eliminated.
