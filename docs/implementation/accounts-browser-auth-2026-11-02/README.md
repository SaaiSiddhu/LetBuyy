# Accounts hosted authentication for Merchant web and Flutter

Date: 2 November 2026
Status: **Core source implemented; local qualification recorded; hosted/device acceptance remains open.**
Source baseline inspected: `develop` at `e4105581e`.

Current implementation, verification evidence and remaining release gates: [Execution report](EXECUTION.md). The numbered documents below preserve the design and acceptance requirements; their original proposal wording is historical.

Flutter presents **Log in** and **Sign up**. Either button opens `accounts.letbuyy.com` in an **in-app system browser**. Accounts completes the selected account journey, then automatically returns control to Flutter. Flutter exchanges a short-lived, one-use code for its own Accounts-issued session and resolves the authorized destination.

The same Accounts screens and rules serve Merchant web and native users. Passwords, email codes, signup, password reset, reactivation and login MFA are entered only on Accounts. Flutter remains a native Merchant application after authentication; this proposal does not turn the Merchant workspace into a website wrapper.

## 1. User decisions captured

| Decision | Proposed behavior |
|---|---|
| One authentication experience | Accounts hosts the account forms for browser and Flutter entry |
| Minimal native entry | Log in and Sign up buttons; no duplicated native password/OTP/reset forms |
| Browser stays within the app experience | Android Custom Tabs; iOS `ASWebAuthenticationSession` |
| Automatic return | On a terminal successful account journey, return to the initiating app without asking the merchant to copy a code |
| All checkpoints included | Login, registration, required reactivation, recovery and MFA retain the same pending app request |
| Store creation | Use one Accounts-hosted create-store flow over Gateway; remove the separate native first-store wizard after qualification |
| Existing backend first | Complete Accounts session and Gateway authorization contracts; keep Mobile BFF a transport boundary |
| Professional UX | Preserve LetBuyy identity, use short focused screens, retain safe progress, explain errors and return automatically |
| Current scope | Plan and document; no implementation, migrations, provider changes, cleanup or release |

“In-app browser” here means browser-owned authentication UI presented from the app. It does not mean a credential-readable Flutter WebView, injected JavaScript or copying browser cookies into Flutter. The system may show its own hostname, permissions or confirmation controls; those controls remain visible.

## 2. Read this specification

| Document | Purpose |
|---|---|
| [Product and UX](01_PRODUCT_AND_UX.md) | Screens, account journeys, automatic return, onboarding and failure UX |
| [Protocol and backend](02_PROTOCOL_AND_BACKEND.md) | Existing owners, PKCE, endpoints, session handoff, storage, native links and security |
| [Delivery and verification](03_DELIVERY_AND_VERIFICATION.md) | Eight implementation phases, release gates, tests, rollback and deletion |
| [Capability and source inventory](04_CAPABILITY_AND_SOURCE_INVENTORY.md) | Existing backend reuse, required extensions and disposition of all 16 audit findings |

Related evidence:

- [Web and Flutter account-flow audit](../merchant-canonical-ui-2026-10-30/WEB_FLUTTER_ACCOUNT_FLOW_AUDIT_2026-11-02.md).
- [Earlier account and store journey proposal](../merchant-canonical-ui-2026-10-30/PROPOSED_ACCOUNT_AND_STORE_CREATION_FLOW.md).

This proposal refines the earlier proposal specifically for hosted native authentication and replaces its assumption that Flutter keeps its own first-store wizard. Neither proposal changes governance authority or claims implementation. The audit remains a record of the inspected implementation, not a description of this target.

## 3. Architecture and authority

Constitution Amendment 3, change 4 expressly authorizes first-party authorization-code flows with PKCE for LetBuyy's own registered clients. ART-05 and IDN-R1 retain Accounts as sole issuer. ART-07 keeps the general OIDC provider and passkeys deferred. This proposal uses the authorized first-party flow; it does not activate discovery, arbitrary third-party clients, dynamic registration or a new identity runtime.

The authority chain remains Constitution, root/local AGENTS, canonical registry, then implementation documentation. Relevant rules include ARCH-R11–17, WIN-R4, IDN-R1–6, SEC-R10, CODE-R1–4, DEL-R1–6 and TEST-R5. Registry references to older merchant session representations must be reconciled with current signing/registration code during implementation; do not invent a third session authority to hide that difference.

| Boundary | Owns |
|---|---|
| `apps/platform/identity` | Account screens, checkpoints, request continuation, first-party code handoff and sole session issuance |
| `services/api-gateway` | Existing account persistence adapters during convergence, membership/permissions, sites, onboarding state and commerce mutations |
| `services/mobile-bff` | Existing native credential verification/forwarding boundary; no credential issuance or direct database access |
| `apps/merchant/mobile` | Entry buttons, OS authentication-browser lifecycle, pending request proof, secure session custody and native workspace |
| `apps/merchant/web` | Browser Merchant workspace consuming Accounts sessions |
| Shared packages | Published account/continuation/error contracts, validators and generated native contract bridge |
| `database` | Narrow durable handoff/session transactions, policies, expiry and paired migrations |

All remain inside the existing runtime topology and 100–10,000 India-merchant envelope. No new auth service, separate password store, new realm or `stores` table is proposed.

## 4. End-to-end picture

```mermaid
sequenceDiagram
    participant F as Flutter Merchant
    participant B as In-app system browser
    participant A as Accounts
    participant G as Gateway and canonical persistence
    F->>F: Create state and PKCE verifier
    F->>A: Register bounded first-party request with challenge
    A-->>F: Accounts authorization URL
    F->>B: Open Accounts within authentication browser
    B->>A: Login or signup
    A->>G: Existing credential and account checks
    A->>B: Any required email proof, MFA or reactivation
    B->>A: Complete required checks
    A->>G: Resolve current memberships and setup state
    Note over A,B: First-store creation runs here when required
    A-->>B: Exact registered callback with one-use code and state
    B-->>F: OS callback; dismiss authentication surface
    F->>F: Validate callback and pending state
    F->>A: Redeem code with PKCE verifier
    A->>G: Atomic redemption and native session registration
    A-->>F: Accounts-issued native session over HTTPS
    F->>G: Validate session and current authorized bootstrap
    G-->>F: Actor, memberships and allowed destination
    F->>F: Open native Merchant workspace
```

“Pass the session to Flutter” means create an independent native session under the same Accounts identity and revocation authority. The browser's HTTP-only session cookie stays in the browser. No password, OTP, MFA seed, browser cookie or reusable session token appears in the callback URL.

## 5. Delivery boundaries

The core release covers email/password login and verified signup, enrolled MFA, password recovery continuation, store discovery/create, secure native handoff and session lifecycle. It also fixes the shared Accounts failures that would otherwise affect both clients.

Reactivation is supported as a checkpoint in the state machine, but an inactivity policy and backend recovery mechanism must be approved before that feature is advertised. No Shopify inactivity threshold or subscription price is adopted.

Google/Apple sign-in, passkeys and expanded recovery channels are separately gated capabilities. They may appear only after complete backend/provider qualification. There must be no “coming soon” button inside the main sign-in form pretending to be a usable method. Shopify is a UX quality reference, not a provider, architecture or feature-parity requirement.

## 6. Completion definition

The migration is complete only when both web and installed Android/iOS apps finish the accepted account journeys, native callback/replay/failure tests pass, store operations have durable readback, old native credential callers are retired under deletion gates, and the same Accounts rules govern both clients. A successful callback or green unit suite alone is insufficient.

## 7. Technical references

These references guide the proposed protocol and browser choice; they do not establish Shopify implementation details or current LetBuyy runtime readiness.

- Native authentication uses a browser-controlled authorization surface: [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html).
- The app proves possession of its request verifier during code exchange: [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html).
- Exact redirect handling and replay protections follow current OAuth security guidance: [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).
- Android provides browser UI within an app through [Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs); verified links require [App Links verification](https://developer.android.com/training/app-links/verify-applinks).
- iOS provides [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession) and [associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains). Callback API availability and link behavior must be qualified against the supported iOS versions and chosen Flutter bridge.
