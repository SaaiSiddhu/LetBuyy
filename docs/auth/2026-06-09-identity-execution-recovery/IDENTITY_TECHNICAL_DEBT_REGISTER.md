# IDENTITY TECHNICAL DEBT REGISTER
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY · architecture FROZEN
### The single consolidated ledger — every item: ID · evidence · severity · wave · remediation

> This register is the cross-referenced index across the Phase-3 docs (`IDENTITY_CODEBASE_DEBT_REPORT`, `IDENTITY_SECURITY_REMEDIATION_PLAN`, `IDENTITY_UI_RECOVERY_PLAN`, `IDENTITY_DESIGN_SYSTEM_ENFORCEMENT`) and the frozen gaps (`GAP_ANALYSIS_REPORT`). Severity: **S0** critical/blocking · **S1** high · **S2** medium · **S3** low. Wave = where it is remediated (`IDENTITY_IMPLEMENTATION_WAVES`).

## Security debt
| ID | Item | Sev | Evidence | Wave |
|---|---|:--:|---|:--:|
| SEC-C1 | `/api/auth/switch` account takeover | S0 | `switch/route.ts:22,52,61-64` | 0 |
| SEC-C2 | Forgeable console super-admin (dev secret) | S0 | `platform-console/.../console-session.ts:30` | 0 |
| SEC-C3 | Default mock KMS literal | S0 | `api-gateway/src/lib/crypto.ts:146,180` | 0 |
| SEC-H1 | service_role/BYPASSRLS + dead RLS | S1 | `supabase-adapter/index.ts:35`; `supabase.ts:10` | 1 |
| SEC-H2 | Static shared-token super-admin | S1 | `middleware/auth.ts:224-226` | 0 |
| SEC-H3 | Forgeable `lb_accounts` dev key | S1 | `cookies.ts:11-19` | 0 |
| SEC-H4 | `AUTH_SECRET` reuse ×3 domains | S1 | `console-session.ts:24`;`cookies.ts:12`;`auth-core:451` | 5→8 |
| SEC-H5 | Mock OIDC/JWKS one flag from RPs | S1 | `oidc-disabled.ts:4-16` | 5 (gate) |
| SEC-H6 | Gateway Turnstile bypass no-flag | S1 | `security.ts:199-205,222-224` | 1 |
| SEC-H7 | `/switch`,`/lookup` no rate-limit/Turnstile; enumeration | S1 | `switch/route.ts`; `lookup/route.ts:56-60` | 0 |
| SEC-M1..M8 | PII cookie, non-CT CSRF, token-in-URL, IP-only RL, Supabase auto-confirm, plaintext tokens, in-mem maps, no MFA/recovery | S2 | see `IDENTITY_SECURITY_REMEDIATION_PLAN` | 1/4 |
| SEC-L1..L5 | dual CSRF names, no `__Host-`, weak pw policy, no idle/rotation, no device revoke | S3 | ibid | 1/4 |

## Code debt
| ID | Item | Sev | Evidence | Wave |
|---|---|:--:|---|:--:|
| CD-S0-1 | Shadow design system (1,986 LOC) | S0 | `globals.css`; 76 `unstyled` | 2 |
| CD-S0-2 | `login`≈`lookup` clone (282 lines) | S0 | `login/page.tsx` ‖ `lookup/page.tsx` | 2 |
| CD-S0-3 | Duplicate Turnstile (×2) + dev-bypass (×6) | S0 | `turnstile.ts` ‖ `security.ts:219`; 6 forks | 1 |
| CD-S1-1 | 9× page boilerplate (~360 LOC) | S1 | all `src/app/*/page.tsx` | 2 |
| CD-S1-2 | Legacy Supabase backend (~160) | S1 | `routes/auth.ts:1214-1372` | 7 |
| CD-S1-3 | CSRF in 3 places | S1 | `csrf.ts`,`csrf-client.ts`,`proxy.ts:43-58` | 1 |
| CD-S1-4 | base64url ×10 / timingSafeEqual ×28 | S1 | auth-core + gw | 1 |
| CD-S1-5 | `.letbuyy.store` literal ×2 | S1 | `cookies.ts:54`; merchant-cp logout:33 | 1 |
| CD-S2-1..5 | in-mem maps, dual CSRF names, `--purple`/orphans, resend.ts size, 42 inline styles | S2 | see `IDENTITY_CODEBASE_DEBT_REPORT` | 1/2/4 |
| CD-S3-1..3 | stale switch comment, mixed token strings, device cookie no UI | S3 | ibid | 2/4 |

## UI / Design / Theme debt
| ID | Item | Sev | Evidence | Wave |
|---|---|:--:|---|:--:|
| UI-1 | 6/10 pages non-DS (shadow CSS) | S1 | `login/lookup/signup/onboarding/select` | 2 |
| UI-2 | 8 target surfaces MISSING (MFA/passkey/consent/session/device/org/team/security) | S1 | `IDENTITY_UI_RECOVERY_PLAN §map` | 3-6 |
| UI-3 | a11y: 9 silent errors, no focus-visible, unlabelled OTP, dead links | S2 | `signup:513,546,568-582`; `globals.css:371,432` | 2 |
| DS-1 | 76 `unstyled` + 42 inline + 426 px + 60 rgb; ~45% compliance | S1 | measured this pass | 2 |
| DS-2 | parallel token namespace (`--text-*`) | S2 | `globals.css:5-40` | 2 |
| TH-1 | undefined `--purple` (broken both themes) | S2 | `globals.css:212,527` | 2 |
| TH-2 | parallel `.dark` block + `rgb(5 8 16)`/`rgb(10 15 26)` | S3 | `globals.css:31-40,1108`; `layout.tsx:102` | 2 |

## Architecture-gap debt (frozen target not yet built)
| ID | Item | Sev | Evidence | Wave |
|---|---|:--:|---|:--:|
| OIDC-1 | Provider is 501 skeleton; mock JWKS | S1 | `oidc-disabled.ts:50-103` | 5 |
| SESS-1 | Opaque 30d session; no rotation/idle/reuse | S1 | `cookies.ts:81`; gw mint | 3 |
| TEN-1 | Tenant isolation app-layer only; dead GUC | S1 | `auth-user.ts:40-67`; `tenant-core:590-629` | 1→8 |
| ID-1 | No merchant MFA / passkey / recovery / consent UI | S1 | `FEATURE_PASSKEY` unused; surfaces missing | 4/5 |
| KEY-1 | Single-region keys; mock key service | S1 | `crypto.ts`; `KEY_ROTATION_AND_CRYPTOGRAPHY §3` | 5/8 |
| AUD-1 | Audit chain verification cadence/budget undesigned (now specified) | S2 | `AUDIT_ARCHITECTURE §3-5` | 4/8 |
| GOV-1 | No CI gates preventing regression | S1 | `IDENTITY_GOVERNANCE_MODEL §4` | 1/2 |

## Operational debt
| ID | Item | Sev | Evidence | Wave |
|---|---|:--:|---|:--:|
| OPS-1 | Operational readiness 58/100 (binding gate) | S0 (gate) | `IMPLEMENTATION_READINESS_REVIEW` | 0 |
| OPS-2 | 8 human-required provisioning items (Hydra/KMS/DLT/residency) | S1 | `CODEX_…_STATUS` HR rows | 0/5 |
| OPS-3 | `.store`→`.com` + cookie cutover not jointly designed | S1 | Recovery Plan §6 | 7 |

---

## Roll-up
**S0: 6** (SEC-C1/C2/C3, CD-S0-1/2/3) + 1 operational gate (OPS-1) · **S1: ~22** · **S2: ~14** · **S3: ~8**. Removable/consolidatable LOC ≈ **3,000–3,500**. Center of gravity: **3 live security S0s** (Wave 0, days), then the **front-end shadow-system + duplication** (Wave 2) and the **architecture build** (Waves 3-6). The binding constraint is **operational maturity (OPS-1)**, not code volume.
