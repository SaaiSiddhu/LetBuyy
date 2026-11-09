# Security, retained app source and actual capability gates

Historical discovery; inline security label/lifetime/layout fixes and current qualification are now in MOBILE_UI_SECURITY_PROGRESS.json. Capability gates remain unchanged.

Read complete TwoFactorScreen and TwoFactorService, its current Settings/route and Refund/Returns/Payout callers, complete AppsScreen and AppBridgeRuntimeScreen, V1CapabilityPolicy, route composition `_buildConfiguredRoute`/`_gatedPage`, CapabilityGate and relevant existing route-gate tests. This is read-only discovery during fixed Warehouse5/native37; no security/provider/gate activation or source change.

## Active security ownership

`/two-factor` and its feature alias build HostedAccountScreen with purpose `manage_security`, preserving the canonical OS-browser flow. They do not directly build TwoFactorScreen. The latter remains an actual inline step-up page through Order Detail, Returns and Money. Refund callers use the existing `refund.approve` proof; Money explicitly passes `payout.release`.

TwoFactorService owns captured actor/store/version, strict current checks, encrypted original enrollment/activation/disable commands, original challenge key and validated MerchantStepUpProof. Preserve all service/SDK/auth/domain bytes, recovery-code acknowledgement, original factor IDs and six-digit/recovery input behavior. The current UI always titles a non-null action `Verify refund approval`; that is a source-proven presentation mismatch for Money's `payout.release` caller. Correct only copy/action presentation later; never change the action or proof consumed by Money.

Current UI candidates requiring composed reproduction: `_run` does not reject a captured covered-route callback before dispatch; `_current` rejects covered-route settlement and finally, which may retain a busy state after a completed call. Header/actions/recovery-code text/long factor and session metadata need current small/large-text/keyboard tests. Keep secret and OTP evidence private, use synthetic fixtures only, preserve original pending operation identity and honest uncertain completion. No real account factor/session/permission changes are authorized by frontend discovery.

## Closed app bodies and actual routed owner

All three app-related IDs (`apps`, `featureAppMarketplace`, `featureEmbeddedAppBridge`) are constitutionally forbidden and gated before their builders execute. AppBridgeRuntimeScreen's only normal parent is the gated AppsScreen. Retain both bodies as excluded source; do not polish, fix, activate, invoke remote apps or extend their bridge/services under a parity claim. Source bodies were read for classification, not certified for live execution. Deletion requires its own formal gates.

Gift cards are a different reason: deferred, not constitutionally forbidden. Both Gift-card route IDs are gated before the retained body is constructed. Preserve that distinction and existing copy. No activating a gated capability merely to increase a migration count.

`AppRoutes._gatedPage` plus shared CapabilityGate is the real rendered unavailable surface. It was missing as an explicit host row in the syntax-seeded ledger and is added as one nonadditive shared host, with all five route variants attached. Existing tests assert that guarded deep links never build AppsScreen. Gate body uses a fixed centered Column and default AppBar; short-height/large-text/readable full-copy and Back need composed/native checks. Migrate only presentation while keeping availability and preconstruction guard untouched.

This does not settle the unique screen denominator. Shared hosts, aliases, forbidden/deferred retained source and supported inline step-up variants are separate inventory dimensions.
