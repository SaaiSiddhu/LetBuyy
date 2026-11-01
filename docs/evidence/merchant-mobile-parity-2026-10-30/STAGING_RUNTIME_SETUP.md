# Staging runtime setup — 1 November 2026

Runtime source remains `288cb3dfa02f8b0d2b650de7126504864b3c89b6`; this continuation changes staging configuration and evidence only. Production activation is not authorized. Migration 414 was already committed and was not submitted again.

## Completed and independently read back

- The existing **LetBuyy Staging Runtime** Turnstile widget now allows `accounts-staging.letbuyy.com`, in addition to its three prior hosts. Managed mode and pre-clearance settings were preserved.
- The previously approved single verifier key was transferred through the browser to **letbuyy-mobile-bff-staging** and **Accounts / Preview / branch staging**. Source and pasted values were compared in memory; the widget key was not rotated. The clipboard was replaced with harmless text. The value was not written to files, logs or evidence.
- The seven task-generated staging credential bindings (two Merchant, five Accounts) were changed from readable Config storage to sealed Secret storage, retaining their values and Preview/staging scope. Public verification keys remain public configuration. No production environment value was edited.
- Staging BFF version **`1c53075f-6e92-4a7c-ad63-530b0ff23572`** serves the same `index.js` SHA-256 **`b82206854a9e7b10c3626e88027c40b612f8c8efa1aa19e13b49f11d412b0603`**. Its other bindings were preserved. Staging API version remains **`2ec36261-eee3-49b5-95e8-5c6c0b7d9928`**.
- Accounts was redeployed from its previously admitted artifact, tree SHA-256 **`31b5be5e2f3b25a50bbb97fc9c7409f5ebafa93f7f6406fd6306e9fade510087`**, to activate the sealed verifier. Deployment **`dpl_Fr4p9vCTyiy4ag3YkP8zDL3BRi2B`** is READY; actual Git metadata is branch `staging`, source `288cb3dfa…`. No remote commit was pushed.
- After the owner's specific domain-access confirmation, two TXT proofs were appended at `_vercel.letbuyy.com`. All five previous proofs were observed preserved. The missing `admin-staging` CNAME was added using Vercel's exact displayed target, DNS only. Existing Accounts routing was retained.
- Vercel independently verifies both project domains against branch `staging`. Verification automatically assigned the expected aliases; the helper's old absence precondition stopped before mutation. Readback reconciled the exact assignments, then confirmed protection:

| Host | Project deployment | Anonymous read |
| --- | --- | --- |
| `admin-staging.letbuyy.com` | `dpl_EfLAyZXXmP1C6jZcBAVcUgPkwEfD` | 302 to Vercel SSO, nonce set |
| `accounts-staging.letbuyy.com` | `dpl_Fr4p9vCTyiy4ag3YkP8zDL3BRi2B` | 302 to Vercel SSO, nonce set |

Production Worker versions and the `admin.letbuyy.com` / `accounts.letbuyy.com` deployment IDs match the previous checkpoint. Deployment protection was not disabled, and no protection bypass was added to the mobile app.

## Evidence and remaining acceptance

Private receipts under `/private/tmp/letbuyy-parity-continuation-20261101/`: `staging-secret-storage-activation.json`, `turnstile-ui-transfer.json`, `turnstile-transfer-provider-readback.json`, `accounts-staging-verifier-deployment.json`, `accounts-and-domain-readback.json`, `staging-alias-reconciliation.json`, and `staging-alias-activation.json`. They record metadata, not secret values. The initial expired Cloudflare OAuth read refusal was followed by the normal scoped credential refresh; no new permissions were requested. The first sandboxed Accounts metadata request failed DNS resolution before dispatch; the authorized network attempt completed and was read back.

This closes the missing staging key, credential storage, preview activation and custom-domain setup. It does **not** prove normal password/Turnstile login, provider sandbox effects or all 122 features. The protected Accounts hostname correctly blocks a direct native HTTP client without Vercel access. Browser navigation was interrupted by concurrent user activity; no CAPTCHA was solved in this continuation. A controlled native acceptance transport must keep provider protection credentials outside the app and preserve canonical identity verification. Existing hosted SDK/Next/warehouse evidence remains bounded as documented in [STAGING_WAREHOUSE_ACCEPTANCE.md](STAGING_WAREHOUSE_ACCEPTANCE.md).

CSV upload and interrupted import recovery remain open: the current R2 job creator allocates a new job for each request and the product loop has no durable row identity. Do not call a retry safe or expose a native CSV success flow until this is repaired and fault-tested through the existing product owner.
