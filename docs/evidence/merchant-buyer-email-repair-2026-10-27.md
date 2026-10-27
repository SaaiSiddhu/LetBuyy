# Merchant / buyer entry and transactional email repair — 27 October 2026

Phase PHASE-BUYER-AUTH-CANONICAL-ENTRY-20261027. The owner approved the reviewed merchant-to-buyer sign-in proposal: “Implement and test secure account connection (Recommended)”. The private proposal/decision receipts are under /private/tmp/letbuyy-storefront-recovery-20261027/. This is phase evidence, not a Constitution amendment, signature, implementation acceptance or deployment claim.

Complete existing Identity authentication with full Merchant verification/MFA, explicit ownership and buyer consent, then a separate canonical buyer principal/session. Merchant credentials never authorize buyer APIs and buyer credentials never authorize Merchant APIs. Keep CSRF, Turnstile, exact store callbacks, PKCE/state, generic failures, durable replay, disabled/revoked principal and changed-address checks. Do not copy hashes or auto-link from an unverified identifier.

Buyer recovery intentionally sends no email for an address without a buyer account. The new report requires account-appropriate recovery and a truthful shared account entry, rather than bypassing that anti-enumeration control. No password hash, real password or verification code is read or displayed for diagnosis.

The owner requests all platform-owned email templates, including store creation, OTP, password reset and security alerts, in Deep Plum & Champagne: primary #6A436B, canvas #F4F0F5, cards #FFFFFF, dark panel #271F2D, selected #4D3652, main text #2D2431, secondary #6A5E70, champagne #D7BE98 and borders #8B7C90. Reuse the existing LetBuyy logo and one shared email shell. Third-party screenshots are layout references, not copied branding, commercial offers, addresses or legal terms.

Retain inline/table email fallbacks, meaningful text when images are blocked, safe links/escaping, plain-text alternatives and responsive light/dark rendering. Client-specific rendering limits and actual inbox delivery must be reported separately from local HTML previews. No bulk email or real order/payment is authorized by this phase. Existing payment/theme work remains local at d68ae1662; branded-host foundations remain local at 8c718da4e.
