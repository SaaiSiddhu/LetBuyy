# Canonical confirmation lifetime and difficult-text repair — 6 November 2026

Source confirmation-source-v2, SHA1029fe659065f6110351560cecd8ece3f7656665f2b499ec6e9019a9b216eb65,8,445 inputs. The current diff from saved-fields4 is exactly the Merchant ConfirmDialog adapter, existing ui_kit confirmation owner and one new frontend test file. All8,442 other canonical inputs, including actual Settings/logout/store-details/SEO callers, services, domains, identity, routes, persistence and backend, remain byte-identical. Exact original preimages and3-file custody are retained in verification-2026-11-05.

## Behavior and canonical ownership

The existing public ConfirmDialog constructor/static show signature remains available as a thin adapter to the existing ui_kit owner. Labels, message, destructive flag, icon, custom confirm fill and true/false/cancel outcome stay with the original caller. The duplicate app-local dialog layout is replaced by that owner; no parallel confirmation system or business callback is introduced.

The shared show helper declines a covered or disposed origin before accessing its Navigator. Existing completeLetbuyySurface result guards prevent old/captured button callbacks from popping a newer route or throwing after disposal. This is presentation lifetime, not renewed authorization or a promise to cancel a server operation.

Optional icon/custom color are now visual parameters of the existing canonical frame. Default callers retain their existing theme/error pairing. Custom fills are preserved exactly; the foreground chooses the higher-contrast black/white text. The tested amber fill uses black text. The frame's native AlertDialog scroll owns title/message/content together, while standard actions wrap and stay reachable; the former nested content-only scroll could not protect a tall title/actions composition.

## Observed proof

confirmation-negative-v1:0PASS/7FAIL on the original implementation. Reproduced covered callback popping the covering route, a covered owner presenting a new dialog, disposed-context access, repeated old callbacks after a result, and158px overflow in both themes at320dp/2.4text scale. After adapter/lifetime preservation, confirmation-focused-v1 passed5 and failed only the2large-text cases, reproducing76px overflow in the existing canonical frame. That measured shared cause was then fixed.

confirmation-focused-v2 passes **41 tests**,0FAIL/0SKIP:7new lifetime/result/icon/color/large-text cases plus34neighboring supporting, warehouse action-lifetime and creation-form cases. Real pointer hit-test warnings are fatal. No test invokes an actual logout, sends an external message or performs a production operation. Current source and all protected inputs remain pinned throughout each run.

Current-source qualification/readback is complete: UI-kit and app analysis0issues; full Flutter1,485PASS/1unchanged protected Staff FAIL/0SKIP; governance114PASS/0FAIL/0BLOCKED/0SKIP/1NA; Android and iOS normal main.dart debug compilation exit0; independent retained APK and all377arm64 iOS bundle files match, with the owned iOS simulator Shutdown. No current confirmation native/hosted acceptance is inferred. The existing protected Staff namespace failure remains separate and must not be weakened or hidden.

## Still open

Actual Android/iOS confirmation accessibility/Back and complete Settings/SEO/store-details journeys need current runtime/integration evidence. The broader utility cohort still includes store switching, Help and CapabilityGate. Existing backend and business effects remain their canonical owners. Native41 accepted its own preceding exact warehouse artifact; it is not acceptance of this new confirmation source. Full119-feature parity, providers, hosted operation, physical performance, signing and production readiness remain open.
