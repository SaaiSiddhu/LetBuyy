# Buyer identity reference for all nine mockup packs

Repository observation, 23 October 2026. This records current contracts, not a new identity policy. Source owner remains `apps/platform/identity`; the programme does not change it during mockups.

## Actual mounted entry

`apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx` is the current buyer sign-in/register surface. It accepts email/password and the configured Turnstile token. Registration help says **at least 8 characters**. Credential submission posts to `/api/buyer/login` or `/api/buyer/register`; successful submission refreshes the page rather than automatically sending the buyer to a store.

The signed-in state explicitly says **Continue to <store>**, identifies the signed-in email, explains the store receives the email, and offers **Use a different account**. Only explicit Continue calls `/api/buyer/oauth/authorize` and follows its validated redirect. The authorization code in this flow is not a user-entered email verification code.

`apps/platform/identity/src/app/api/buyer/register/route.ts` sets the identity-issued session and returns 201 after successful gateway registration. It does not make clicking a verification email link the next step.

Separate buyer email-verification APIs exist at `/api/buyer/verify-email/send` and `/confirm`. `buyer-email-code.ts` specifies a six-digit code. That API's existence does not establish a mandatory next screen in BuyerAuthorize. Do not invent a verification link, automatic email dispatch, or a requirement that an unverified account cannot sign in. Optional verification/verified-order linking must be distinguished and source-grounded if depicted.

## Mockup alignment

- Keep canonical LetBuyy credential identity and the current semantic platform primary action treatment, with the named theme destination. Current `apps/platform/identity/src/app/globals.css` forces the admin/light surface and binds `--primary` to `--lb-color-primary`; `packages/typescript/ui/src/tokens.ts`'s admin surface maps that role to brand ink. The earlier purple instruction in this reference was based on historical Threadline mockups and is superseded by this source observation. Preserve the active platform identity rather than introducing an independent credential palette. Record the source/palette baseline used by the mockup.
- Show the actual email/password entry and recoverable errors; bot verification is configuration-dependent and a mockup must not impersonate a real completed challenge.
- Scene 11 can include a labelled post-creation **Continue to <theme>** state in the same scene, or a linked supplementary state, so the explicit consent/return transition is visible.
- Use the clear primary heading **Create your LetBuyy account**. Theme-specific editorial copy belongs in supporting content.
- Current `apps/platform/identity/src/app/layout.tsx` loads the canonical local Geist Sans face from `packages/typescript/ui/assets/fonts/geist-sans-latin.woff2` and forces the admin/light provider. The credential reference uses this font; storefront typography remains theme-specific.
- Do not add an unsupported required consent checkbox/field to the actual credential contract. A non-interactive legal statement is distinct from a new required consent mechanism.
- Recovery and optional email verification must follow current source, with proposed/absent UI stated accurately. Mockup interactions never submit credentials or send emails.

A pack that previously described a verification link as mandatory needs its source, affected scene-device exports, boards, ZIP and provenance refreshed. This does not require regenerating product photography or unrelated scenes. Retain accurate limits: mockup signup is not browser-verified registration.
