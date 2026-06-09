# Foundation Wave 4 Session Security Apply Runbook

Status: `SKIP-DEPLOY`. Codex must not execute this against staging or production.

## Preconditions

- Run `node scripts/foundation/production-safety-preflight.mjs` in the approved operator shell for the target shared environment.
- Confirm `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`, `TOTP_ENCRYPTION_KEY`, and `INTERNAL_GATEWAY_IP_ALLOWLIST` are configured in the provider secret store.
- Confirm `INTERNAL_API_SECRET_PREVIOUS` and `LETBUYY_INTERNAL_API_SECRET_PREVIOUS` are empty before the first rotation window, or set only to the immediately previous values during a bounded rotation.
- Confirm the session migration has been applied only through the governed migration workflow after fixture apply/down is green.
- Confirm Cloudflare Access or mTLS provider changes are approved before configuring live perimeter policy.

## Apply

- Human sets new dedicated internal and TOTP secrets in the target provider secret store.
- Human sets previous internal secrets only for the planned dual-accept TTL.
- Human configures `INTERNAL_GATEWAY_IP_ALLOWLIST` to verified ingress ranges for the target shared environment.
- Human applies Cloudflare Access or mTLS policy only through the approved provider/IaC path.
- Human deploys through governed CI; Codex must not run shared-env deploy, migration, secret rotation, or provider mutations.

## Verify

- `/v1/internal/*` rejects production requests when `INTERNAL_GATEWAY_IP_ALLOWLIST` is absent.
- `/v1/internal/*` rejects denied source IPs and requests without an internal credential.
- Signed internal app/session/identity requests include `X-LetBuyy-Internal-JTI` and reject replayed signatures.
- Merchant `/auth/custom/session` rotates eligible sessions, sets a replacement cookie at the app boundary, and revokes reused old tokens.
- Enrolled merchant MFA returns `MFA_REQUIRED` without a code and accepts only valid per-factor TOTP using `TOTP_ENCRYPTION_KEY`.
- Platform Console production MFA uses `PLATFORM_CONSOLE_TOTP_SECRETS` per principal and does not fall back to a shared secret.

## Rollback

- Restore the previous deployed application version through governed CI if runtime errors occur.
- Restore the previous internal secret by placing it in the current secret slot; keep previous-secret dual accept only for the incident TTL.
- Remove the new Cloudflare Access or mTLS policy if it blocks valid internal callers, then restore the prior verified allowlist.
- Revoke sessions only through the approved session invalidation workflow; do not edit live session rows manually.
