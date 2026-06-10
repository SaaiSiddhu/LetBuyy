# ARCHITECTURAL DEBT REGISTER
### Phase 13 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY
### Every item carries file:line evidence and a severity. Cross-referenced to the phase that proves it.

> Severity key: **S0** = exploitable/critical now · **S1** = high (security or blocks SSOT) · **S2** = medium · **S3** = low/hygiene.

---

## Security Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| SEC-1 | Account takeover via `/api/auth/switch` (session minted for arbitrary verified email) | **S0** | `apps/identity-platform/src/app/api/auth/switch/route.ts:22,52,61-64` | 6 C-1 |
| SEC-2 | Forgeable ops super-admin session (`dev-only-console-session-secret`, `NODE_ENV`-only gate) | **S0** | `apps/platform-console/src/lib/console-session.ts:23-31` | 6 C-2 |
| SEC-3 | Default mock KMS literal = data-at-rest effectively plaintext | **S0** | `services/api-gateway/src/lib/crypto.ts:144-158,180` | 6 C-3 |
| SEC-4 | `service_role`/BYPASSRLS default + dead RLS; one missing check = IDOR | **S1** | `packages/infrastructure/supabase-adapter/index.ts:34-39`; `lib/supabase.ts:12-25` | 6 H-1 / 7 |
| SEC-5 | Static shared-token super-admin principal | **S1** | `services/api-gateway/src/middleware/auth.ts:217-231` | 6 H-2 |
| SEC-6 | `AUTH_SECRET` reused across console + accounts + internal HMAC | **S1** | `console-session.ts:24`; `cookies.ts:12`; `auth-core/src/index.ts:451` | 6 H-4 |
| SEC-7 | Gateway Turnstile dev-bypass needs no feature flag | **S1** | `services/api-gateway/src/middleware/security.ts:199-205,222-224` | 5 / 6 H-6 |
| SEC-8 | User-enumeration oracle `/api/auth/lookup` | **S2** | `lookup/route.ts:56-60` | 6 M-1 |
| SEC-9 | Supabase legacy signup auto-confirms email + client-trusted role | **S2** | gw `routes/auth.ts:1214-1241` | 6 M-7 |
| SEC-10 | In-memory auth fallback maps in prod-shaped code | **S2** | gw `routes/auth.ts:82-85,925,1058` | 6 M-8 |
| SEC-11 | Weak password policy (8 / 1 upper / 1 digit) | **S3** | `apps/identity-platform/src/lib/auth/password.ts:13-17` | 6 L-4 |

## Identity Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| ID-1 | Seven concurrent auth systems, no single issuer | **S1** | Phase 1 §2 table | 1 |
| ID-2 | "v2 identity foundation" is dead scaffolding (6 interface-only packages + flag-gated in-memory factories, 0 runtime callers) | **S1** | `packages/session-core/src/index.ts:17-49`; gw `identity-foundation/session-services.ts:29-114` | 1 / 3 |
| ID-3 | No merchant MFA; no passkeys (flag without impl) | **S2** | `features.ts:14` (`FEATURE_PASSKEY`, no consumers) | 1 |
| ID-4 | Aspirational comments diverge from code (switch "accounts-cookie" claim) | **S2** | `switch/route.ts:12` vs absent check | 1 / 6 |

## OIDC Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| OIDC-1 | Provider is a 501 skeleton; 0/16 capabilities functional | **S1** | `lib/identity-foundation/oidc-disabled.ts:50-103` | 2 |
| OIDC-2 | JWKS is a literal `mock-x-coordinate`; no asymmetric signing | **S1** | `oidc-disabled.ts:4-16` | 2 |
| OIDC-3 | Discovery advertises grants/PKCE the endpoints can't honour; `mock:true` | **S1** | `oidc-disabled.ts:56-67` | 2 |
| OIDC-4 | No introspection / revocation / client-registration routes | **S1** | `find app/oauth2` → 6 dirs only | 2 |
| OIDC-5 | Enabling provider flags would expose an unusable issuer to RPs | **S1** | `features.ts:22-23` | 2 / 6 H-5 |

## Session Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| SESS-1 | Opaque 30-day token, no rotation/idle-timeout/reuse-detection/binding | **S1** | gw `routes/auth.ts:1047`; `cookies.ts:81` | 3 |
| SESS-2 | No refresh on merchant path; mobile "refresh" re-validates same token | **S2** | `store_auth_service.dart:334-357` | 3 |
| SESS-3 | Five session impls + dead v2 service implementing the rotation the live ones lack | **S2** | Phase 3 §1 | 3 |

## Cookie Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| CK-1 | `lb_accounts` signing key dev-literal under `NODE_ENV`-only gate | **S1** | `cookies.ts:11-19` | 4 D1 |
| CK-2 | Cookie domain `.letbuyy.store` vs canonical `.letbuyy.com` (cutover break) | **S1** | `cookies.ts:53-54`; `config/urls.ts:1-2` | 4 D2 |
| CK-3 | `lb_accounts` "encrypted" = signed PII, 365-day | **S2** | `cookies.ts:171-176` | 4 D3 |
| CK-4 | Dual CSRF cookie names; no `__Host-`/`__Secure-` prefixes | **S3** | `csrf.ts:22`; `cookies.ts:56-62` | 4 D4/D5 |

## Tenant Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| TEN-1 | Isolation = per-route app predicates over BYPASSRLS, no DB net | **S1** | `lib/auth-user.ts:40-67`; dead `tenant-core` GUC `tenant-core/src/index.ts:590-629` | 7 |
| TEN-2 | Merchant staff RBAC is owner-or-nothing; `requirePermission` is plan-gating | **S2** | `services/api-gateway/src/middleware/permission.ts:1-4,29-78` | 7 |
| TEN-3 | Org-level isolation undefined (org-core stub) | **S2** | `packages/organization-core/src/index.ts` | 7 |

## UI Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| UI-1 | 9 `.auth-error` blocks silent to screen readers (no `aria-live`) | **S2** | `signup:513,585`; `lookup:496,590`; `login:243,330` | 8 |
| UI-2 | Focus rings removed (`outline:none`×4, 0 `:focus-visible`) | **S2** | `globals.css:371,432,1011,1498` | 8 |
| UI-3 | Unlabelled OTP grid; dead Terms/Privacy `href="#"` | **S3** | `signup:568-582,546` | 8 |

## Design Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| DS-1 | `unstyled` bypass on 67/79 Buttons + 1,984-line shadow stylesheet | **S2** | `login:245,332`; `globals.css` | 9 |
| DS-2 | Parallel token namespace (`--text-*`,`--bg-*`) vs `--lb-*`; 424 raw px, 77 hardcoded font-sizes | **S2** | `globals.css:5-40` | 9 |
| DS-3 | Orphan classes `.auth-label`/`.auth-input` undefined; 3 lint rules only `warn` | **S3** | `onboarding:885,950`; `eslint.config.mjs:14-22` | 9 |

## Theme Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| TH-1 | `--purple` consumed but undefined → broken color both themes | **S2** | `globals.css:212,527` | 11 T4 |
| TH-2 | Parallel hand-written `.dark` block + `rgb(5 8 16)` body bg | **S3** | `globals.css:31-40,1108` | 11 T1/T2 |

## Code Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| CODE-1 | ~1,490-1,600 redundant LOC / ~14 clusters (~18-20% of app) | **S2** | Phase 10 table | 10 |
| CODE-2 | login≈lookup 282-line clone (already drifting) | **S2** | `login/page.tsx` ‖ `lookup/page.tsx` | 10 C12 |
| CODE-3 | base64url ×10 / `timingSafeEqual` ×28 crypto-primitive sprawl | **S2** | Phase 10 §3 | 10 |
| CODE-4 | Two Turnstile validators + 6-way dev-bypass fork (security drift) | **S1** | Phase 10 C1/C6 | 10 |

## Operational Debt
| ID | Item | Sev | Evidence | Phase |
|---|---|:--:|---|---|
| OPS-1 | No identity-app `middleware.ts` — protection opt-in per handler | **S1** | `find src -name middleware.ts` → none | 1 / 6 M-9 |
| OPS-2 | Mobile login fails closed without a real Turnstile key (default placeholder) | **S2** | `store_auth_service.dart:364-375`; `app_config.dart:36-45` | 5 |
| OPS-3 | No clickjacking headers set in app code | **S3** | no middleware/CSP | 6 M-10 |
| OPS-4 | No device-revocation UI for `lb_device` | **S3** | `cookies.ts:152-159` | 4 |

---

## Debt summary
**S0: 3** (all security — SEC-1/2/3) · **S1: 16** · **S2: ~18** · **S3: ~10**. The S0/S1 band is dominated by **security + identity-authority + OIDC** debt; UI/design/theme/code debt is real but almost entirely **S2/S3** (maintainability, not exploitability). The center of gravity is unambiguous: the authority layer, not the front end.
