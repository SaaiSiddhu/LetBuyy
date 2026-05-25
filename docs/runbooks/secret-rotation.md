# Secret Rotation Runbook

Owner: platform security.

1. Rotate provider secrets in Supabase, Cloudflare, Vercel, Upstash, Resend, Razorpay, Stripe, and PayPal control planes.
2. Never paste secret values into git, docs, logs, or issue trackers.
3. Load replacement values into operator environment variables named `ROTATE_SECRET_<SECRET_NAME>`.
4. Run `node infrastructure/scripts/security/rotate-secrets.mjs --environment=production --execute` from an audited operator shell.
5. Deploy Workers with `--keep-vars` only after the provider secret store contains the replacement values.
6. Record each rotation in `runtime_secret_rotation_events` and record enforcement evidence with `POST /v1/operations/runtime/security/enforcement-events`.
7. Revoke the old secret after all health gates and provider callback tests pass.
8. If the rotated secret was historically committed, coordinate a separate history rewrite window.
