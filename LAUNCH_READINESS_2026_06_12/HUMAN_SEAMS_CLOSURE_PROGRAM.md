# DOCUMENT 3 — HUMAN SEAMS CLOSURE PROGRAM

**Source of truth:** `SKIPPED_HUMAN_DECISIONS.md` (56 rows at `533479cb`) + `EXECUTABLE_HUMAN_REQUIRED.md` (19 HR rows) + `CAPABILITY_BACKLOG.md` (16 CAP rows). This program categorizes and prioritizes every seam; it invents none and drops none. Closing a seam means: do the human/live action, attach evidence, supersede the row — never delete it silently (runbook guardrail 4).

**Priority key:** 🔴 CRITICAL = blocks Phase D/F/G (no merchant, no money, or no deploy without it). 🟡 IMPORTANT = blocks scale/quality, pilot can start with explicit ARB waiver. 🟢 NICE = post-launch acceptable.

---

## 1. GOVERNANCE & PROMOTION (Phase A owners: founder + repo admin)

| Seam | Pri | Action |
|---|---|---|
| SKIP-GATE1-ARB-RATIFICATION | 🔴 | Sign root AGENTS.md promotion + GATE-1 acceptance (minutes row) |
| SKIP-PROD-DEPLOY-PROMOTION / SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE | 🔴 | Execute MERGE_RUNBOOK on clean tree |
| SKIP-A2-REMOTE-BRANCH-CONVERGENCE | 🔴 | Push stepup/main → main order; neutralize origin/develop |
| SKIP-A3-GITHUB-GOVERNANCE-STATUS-CHECK | 🔴 | Required `governance-gate` check on protected main |
| SKIP-A4-ATOMIC-GO-LIVE-G4 | 🔴 | Run G4 packet; record smoke evidence |
| SKIP-A5-BRANCH-LAG-MONITOR-LIVE | 🟡 | Activate scheduled lag monitor post-promotion |
| SKIP-SURVIVABILITY-REPEAL-ARB | 🟡 | ARB minutes acknowledging repeal (paper formality) |
| SKIP-EG1-ARB-SINGLE-REALITY-CERTIFICATION | 🟡 | ARB signature on Phase E single-reality cert |
| SKIP-GATE-OPS-SURVIVOR-ARB | 🟡 | Sign platform-console as sole ops console |
| SKIP-TASKS-EXECUTABLE-DISPOSITION | 🟢 | Decide archived task specs: historical vs revive |
| SKIP-MOBILE-EDITOR-ARB | 🟢 | Wire-or-delete decision on mobile theme editor pair |
| SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB | 🟢 | Scope decision before deleting dead-by-flag GraphQL/extension surfaces (pairs with Phase A.5 Wasm deletion) |
| SKIP-SECONDBACKEND-CALLGRAPH-TRACE | 🟢 | Page-level call-graph trace before any route contraction |
| SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY | 🟡 | ARB/finance: partner payout ledger folds into canonical or stays scoped |

## 2. DNS (Phase A/C owner: founder; provider: Cloudflare/Vercel)

| Seam | Pri | Action |
|---|---|---|
| SKIP-PROD-DNS-CUTOVER + SKIP-W3-DNS-CUTOVER | 🔴 | Cut `letbuyy.com` (+`checkout.`) to production hosts |
| SKIP-D5-DNS-TERRAFORM-APPLY | 🔴 | Apply the single-zone `infrastructure/dns/dns.tf`; verify records |
| SKIP-D6-LIVE-CHECKOUT-CUTOVER (DNS part) | 🔴 | checkout host attachment + signing secret + smoke |
| SKIP-D4-FROZEN-VERCEL-PROJECT-DELETION | 🟡 | Delete/disable frozen-app Vercel projects (console evidence) |

## 3. SECRETS & KEYS (Phase C owner: founder; KMS discipline)

| Seam | Pri | Action |
|---|---|---|
| SKIP-PROVIDER-SECRETS | 🔴 | Provision Cloudflare/Vercel/ESP/payment/mobile-lane secrets into CI + worker scopes |
| SKIP-W4-LIVE-SECRET-ROTATION | 🔴 | Rotate internal/session/TOTP secrets; dual-secret cutover evidence |
| HR-KMS-LIVE | 🔴 | KMS-backed key custody for signing keys |
| SKIP-D3-IDENTITY-LIVE-PROVIDERS | 🔴 | Identity keys, JWKS rotation, OIDC client regs, WebAuthn RP, Turnstile |
| SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS | 🟡 | Android keystore, Play service account, Apple signing |
| SKIP-W7-MOBILE-TURNSTILE-SECRET / SKIP-CAP-MOBILE-TURNSTILE-DOUBLE-SPEND | 🔴 | Turnstile secret for mobile-bff; live-cert single-use exchange (CAP-C09) — unblocks mobile login |

## 4. PAYMENT PROVIDERS (Phase D owners: founder + finance)

| Seam | Pri | Action |
|---|---|---|
| HR-PA-SPLIT-LIVE | 🔴 | Razorpay Route (PA-split) live enablement — the disbursement rail |
| SKIP-MERCHANT-PSP-LIVE-CREDENTIALS / HR-MERCHANT-PSP-LIVE | 🔴 | Merchant-owned Razorpay/Cashfree/UPI live creds + webhook proof |
| SKIP-CAP-CAPTURE-LEDGERING (CAP-C01) | 🔴 | Live capture-ledger certification |
| SKIP-CAP-REFUND-LEDGERING (CAP-C02) | 🔴 | Live refund-ledger certification |
| SKIP-CAP-PAYOUT-PROVIDER-CLIENT (CAP-C03) | 🔴 | Certify Route payout client on real rails |
| SKIP-CAP-SETTLEMENT-EXECUTOR (CAP-C05) | 🔴 | Live settlement executor + dedupe cert |
| SKIP-CAP-RECONCILIATION-WIRING (CAP-C04) / SKIP-D5-LIVE-MONEY-RECONCILIATION | 🔴 | Live reconciliation: zero-break-or-explained |
| SKIP-CAP-AI-CREDIT-PURCHASE-PROVIDER (CAP-C17) | 🟡 | AI-credit payment-link smoke + webhook + ledger posting |
| SKIP-RAZORPAYX-ENUM-PURGE | 🟡 | Purge residual `razorpayx` enum values (repo-side, A.5 adjacency) |
| SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB / -PRODUCT-DEAD-TABLE-WRITER-PROBE / -OPERATIONAL-THEATER-TABLE-PROBE | 🟢 | Live `pg_stat` probes before index/table contraction |
| HR-AUTOPAY-LIVE | 🟢 | UPI Autopay (subscription) live — post-pilot |
| HR-GST-IRP-LIVE | 🟡 | GST e-invoice IRP registration (needed for invoicing at scale) |
| SKIP-THEME-MARKETPLACE-LIVE-GSTIN | 🟢 | Theme marketplace seller GSTIN — frozen app, post-launch |

## 5. EMAIL (Phase B/F owner: founder)

| Seam | Pri | Action |
|---|---|---|
| SKIP-CAP-LIVE-EMAIL-DISPATCH (CAP-C18) / HR-ESP-LIVE | 🔴 | Resend live: verified sender domain, creds, delivery webhooks, smoke. SES/SendGrid stay recorded-unavailable until clients ship (by design) |

## 6. WHATSAPP & MESSAGING (Phase B/F; longest lead time — START FIRST)

| Seam | Pri | Action |
|---|---|---|
| SKIP-D10-WHATSAPP-BSP-WABA-HSM / HR-WHATSAPP-LIVE | 🔴 | BSP/Meta WABA onboarding, business verification, sender approval, HSM templates, webhook secret |
| SKIP-W7-WHATSAPP-LIVE-CREDS | 🔴 | Order/COD lifecycle template creds |
| HR-DLT-TRAI-LIVE | 🟡 | DLT/TRAI SMS registration (India compliance) if SMS lane used |

## 7. KYC (Phase F gate — merchants cannot be paid without it)

| Seam | Pri | Action |
|---|---|---|
| SKIP-CAP-KYC-LIVE-PROVIDER (CAP-C15) / HR-KYC-LIVE | 🔴 | Signzy/HyperVerge live creds + automated path; manual `needs_review` path already live repo-side (commit `c8592b2b`) — pilot can run manual-KYC-only with ARB waiver |

## 8. LOGISTICS (Phase F)

| Seam | Pri | Action |
|---|---|---|
| SKIP-CAP-LOGISTICS-LIVE-PROVIDER (CAP-C16) / HR-CARRIER-LIVE | 🔴 | Shiprocket/Delhivery/Pickrr live: labels, rates, AWB, tracking, pickup/legal setup |
| HR-WAREHOUSE-LIVE | 🟢 | Warehouse integration — post-pilot |

## 9. MONITORING & ALERTING (Phase C)

| Seam | Pri | Action |
|---|---|---|
| SKIP-W3-SENTRY-DSN | 🔴 | Observability project, DSN, alert routing, redaction proof |
| SKIP-CAP-ALERTING-END-TO-END (CAP-C10) | 🔴 | Live alert delivery cert (emitters + routing already dry-run, commit `0f72fbe3`) |
| SKIP-W0-PITR-TIER | 🔴 | Supabase PITR tier + restore drill evidence |

## 10. SECURITY & IDENTITY (Phase C/B)

| Seam | Pri | Action |
|---|---|---|
| SKIP-D2-LIVE-ANON-GRANT-PROBE | 🔴 | Live DB proof anon can't reach tenant tables |
| SKIP-D4-LIVE-FORCE-COVERAGE-PROBE | 🔴 | Live FORCE-RLS + GUC coverage proof post-migration 164 |
| SKIP-CAP-TENANT-REDTEAM-ADOPTION (CAP-C11) | 🔴 | RT-1…RT-9 under production-shaped roles (repo proof exists, commit `b09b2ab2`) |
| SKIP-CAP-STEPUP-CRYPTO (CAP-C06) | 🔴 | Live step-up cert (TOTP+HMAC path) |
| SKIP-W4-MTLS-CF-ACCESS | 🟡 | CF Access/mTLS on internal routes |
| SKIP-OPS-SSO-IDP | 🟡 | Per-operator ops identity (SSO/IdP) |
| SKIP-CAP-OIDC-REVOCATION (CAP-C07) / HR-HYDRA-LIVE / SKIP-IDN-R2-DRAIN-TELEMETRY | 🟡 | OIDC live regs + HS256 drain telemetry → final drain |
| HR-IDENTITY-DECISIONS / HR-RESIDENCY-DPDP / HR-LEGAL-DPDP-PA | 🟡 | Identity-foundation decisions; DPDP residency/legal posture |
| SKIP-BRAND-LEGAL-FACTS | 🟡 | Verified legal entity facts (blocks invoices/footer/ToS) |

## 11. THEME/STOREFRONT (Phase E)

| Seam | Pri | Action |
|---|---|---|
| SKIP-CAP-LIQUID-CHROME (CAP-C08) | 🟡 | Canary + parity corpus + ARB flip (Document 6) |
| SKIP-CAP-STORE-PUBLISH-PIPELINE (CAP-C12) | 🔴 | Live store-publish cert (publish→canonical config, commit `1f5ef72b`) — pilot merchants need publishing |
| HR-AI-MODEL-LIVE | 🟢 | AI model creds for AI features — pilot can waive |

---

## 12. CLOSURE PROTOCOL & COUNTS

**Counts:** 🔴 CRITICAL 28 · 🟡 IMPORTANT 17 · 🟢 NICE 11 (56 total; CAP/HR rows that alias a SKIP row are counted once).
**Protocol per seam:** (1) human performs the live action; (2) evidence artifact captured (provider console screenshot/API response/probe output) and referenced; (3) `SKIPPED_HUMAN_DECISIONS.md` row superseded with evidence pointer + date; (4) ledger row appended; (5) gate green. **Order of attack:** start WhatsApp WABA + KYC provider onboarding on day 1 (longest external lead times), then the A-lane governance seams, then secrets/DNS, then money lane.
