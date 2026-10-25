# Local checkout TLS — unapplied proposal for Root review

Status: **PROPOSAL ONLY.** Root must review this bundle before any new human permission question. Editor’s existing trusted-HTTPS question remains pending; this document does not ask it again. No binary installation, CA/key read or generation, trust change, DB/build/app startup, TLS navigation or shared-source edit occurred. MadeYours’23 buyer cases, position7, runbook/facts/native proofs remain frozen.

## Evidence and scope

Root reports the9cd production applications healthy and the normal buyer/cart path reached two Pink units at1120. Its normal browser checkout at `checkout.localhost:57228` failed `ERR_CERT_AUTHORITY_INVALID`; no confirm/order occurred. These are coordinator-reported observations, not a new reproduction here. No blocked URL or data URL was retried.

The current `createOwnedCheckoutTlsCertificate` proves the owned handle and fixture binding, creates a one-day self-signed checkout certificate, returns key/certificate/SPKI and removes its temporary files. Its exact native generation body is preserved in this proposal. The HTTPS bridge captures that context once at creation. There is no supported certificate-reload control in this fixture; **the patch cannot retrofit running9cd**. Preserve it and its private state/keys. A source-fresh invocation of the existing fixture needs its own explicit resource allocation; no hot injection, alternate harness or API-order substitute is proposed.

Read-only metadata confirms `/opt/homebrew/bin/mkcert` and `/usr/local/bin/mkcert` absent; Homebrew and Apple `/usr/bin/security` exist. Only file metadata and security help were inspected. No CA/keychain certificate material was inspected.

## Minimal source delta, not applied

[manual-owned-tls.patch](manual-owned-tls.patch) changes only the existing owned support helper and its existing manual fixture call. Proposed copies are adjacent. No new runtime, harness, auth, route, production payment path or dependency manifest.

1. Retain exact ownership/GUARD re-verification before either certificate mode. Default `native-ephemeral` remains the unchanged openssl one-day generation and SPKI result. Unknown modes refuse.
2. Add the explicit fixed enum `manual-os-trusted`, restricted to macOS, exact existing Editor hold flag1 and no Threadline QA profile. The fixture accepts only `LETBUYY_MANUAL_CHECKOUT_TLS_MODE=manual-os-trusted` in the Editor profile; absent means native. This name survives the runner’s existing environment filter without changing it; `LETBUYY_OWNED_*` would be stripped, so that prefix is deliberately not used.
3. Manual mode requires an already provisioned, user-owned0700 directory at `/private/tmp/letbuyy-owned-checkout-ca-<current uid>` with regular, unlinked0600 `rootCA.pem` and `rootCA-key.pem`. Missing/foreign/symlink/loose paths refuse before issuance. The helper only stats CA files; it never reads the CA key itself. Standard mkcert must read its own signing key when later authorized to issue a leaf. The current proposal performs neither operation.
4. Issue only `checkout.localhost` using fixed `/opt/homebrew/bin/mkcert` and generated owned private output paths. Its argv has no install/uninstall, arbitrary host, executable or user output path. No inherited CAROOT/TRUST_STORES/PATH override is used in this branch. Existing CA provisioning is a separate approved action, not a helper fallback.
5. Open leaf files with no-follow descriptors; verify ownership,0700/0600 modes, one link and bounded size. Validate exact single DNS SAN (no wildcard/additional host), non-CA server-auth leaf, current validity and matching private key with Node X509 APIs. The default remains one day; mkcert’s manual leaf has its standard lifetime, bounded here to825days, and its key files are still deleted on helper return. These lifetime statements are different and must not be conflated. [mkcert certificate source](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/cert.go), [Node22 X509 API](https://nodejs.org/docs/latest-v22.x/api/crypto.html#x509checkprivatekeyprivatekey).
6. Require `/usr/bin/security verify-cert -c <owned leaf> -p ssl -n checkout.localhost -L -q` success. This uses the OS’s current SSL trust and hostname evaluation, local issuer resolution and no supplied trust anchor. No `-r`, allowed-error, custom-keychain, insecure TLS, SPKI-browser override or automatic self-signed fallback. Clean only the temporary directory this invocation created; sanitize failure output.

The helper does **not** install trust, run Homebrew, bootstrap a CA intentionally, choose another browser, weaken browser policy, navigate or create orders. TOCTOU between CA metadata checks and mkcert is within the same OS-user authority; a same-user concurrent CA removal must be prevented by the provisioning owner’s lease. Record and recheck CA identity before/after future issuance; do not concurrently clean that directory. This is a material review point, not a claim of race-proof provisioning.

## Exact future approval actions for Root to review

No action below is currently approved by this proposal. Use structured argv/environment, not interpolated shell text.

A. Install the standard mkcert tool using the existing Homebrew executable (`/opt/homebrew/bin/brew install mkcert`), then verify installed version/provenance. No Firefox NSS/Java tools or stores are required. The reviewed CLI isv1.4.4; recheck installed CLI if it differs. [Official installation/options](https://github.com/FiloSottile/mkcert#installation).

B. Create one fresh private CA directory at the fixed UID-derived path, refusing any pre-existing unowned/unknown directory. Use mkcert, with explicit CAROOT there, to generate the local CA plus a disposable checkout.localhost leaf. mkcert has no create-CA-only CLI flag: its ordinary first issuance initializes it. Do not implement a custom CA. This bootstrap is **outside the fixture helper**, after explicit user approval. Capture only public root fingerprint/path/owner/modes in a private rollback receipt; never log or read the signing key through the agent. Protect files0600/directory0700. [Official CLI/source](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/main.go).

C. Recommended narrower trust action for review: add **only that newly created root**, in the current user’s login keychain, with SSL policy and exact `checkout.localhost` policy string using Apple’s standard tool:

```text
/usr/bin/security add-trusted-cert -r trustRoot -p ssl -s checkout.localhost -k <verified current-user login keychain> <fixed private CA directory>/rootCA.pem
```

Resolve the current-user default keychain read-only with `security default-keychain -d user`; reject an unexpected/shared path until reviewed. No `-d` administrator-domain flag, allowed-error, broad trust-settings import or application policy bypass. Apple’s tool implements the policy/string constraints and defaults to the user domain; local installed help confirms these flags. Actual browser acceptance of this constrained trust remains unverified and must pass the normal readiness gate. [Apple implementation](https://raw.githubusercontent.com/apple-oss-distributions/Security/main/SecurityTool/macOS/trusted_cert_add.c).

The user must understand that this adds an OS trust decision for their account, and that the CA private key can sign certificates. Intended trust is limited to this checkout host/policy; broadening it is a separate decision. Do not silently fall back to mkcert’s broad System.keychain installer. If Root instead chooses standard `TRUST_STORES=system mkcert -install`, its reviewed macOS implementation uses administrator System.keychain trust and is materially broader, requiring explicitly different approval. It must not be described as checkout-only user trust. [mkcert macOS implementation](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/truststore_darwin.go).

D. After trust decision, source review and a separately allocated source-fresh existing fixture: opt into the manual mode. Leave9cd untouched until its owner chooses its lifecycle. Normal browser HTTPS verification remains required; success from an API client alone does not unblock buyer checkout acceptance.

## Rollback only our own trust

Record pre-existing absence and the exact newly created root’s public SHA256, certificate bytes/path, UID, chosen user keychain and policy. If the fingerprint/path/ownership differs, stop; never remove by common name or scan-delete other roots. For the recommended user trust route, use `/usr/bin/security remove-trusted-cert <the same verified rootCA.pem>` with **no `-d`**. This targets that certificate’s user-domain trust. If deleting its certificate item too, use the exact recorded SHA256 with `security delete-certificate -Z <actual recorded hash> -t <same verified keychain>` after matching it, not a name or whole-store restore. Local help supports SHA256 and targeted trust removal.

Only after stopping our future TLS listener and releasing its source-fresh fixture may its owner delete the exact private CA/leaf resources it created. Do not touch9cd key material, unrelated mkcert CAs or other keychains. If the broader System route were separately approved, use the matching dedicated CAROOT and `TRUST_STORES=system mkcert -uninstall`; never run it against the user’s unrelated default CA. That removes trust and does not delete the CA files by itself. [Official uninstall semantics](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/main.go).

## Meaningful validation gates

The staged docs-only control model reports25 passing checks. It stubs child processes, files and X509; it executes **no** real command, key read, certificate generation, trust evaluation or handshake. Its pass is only argv/control-flow/refusal/cleanup evidence. [Model receipt](proposal-control-test-results.json). Baseline shared-source SHA checks and native-body byte equality pass. TypeScript transpilation is syntax-only, not full gateway typecheck.

Required later actual tests are enumerated in [test-plan.json](test-plan.json), all NOT_RUN: real native owned-handle path/cleanup; real manual trusted handshake positive; self-signed/wrong-chain/expired/name/key negative; unsupported mode/path/owner denial; no trust change by helper; no browser policy bypass; preserved tenant/session cookie boundaries; normal browser navigation without bypass and actual COD UI. No generic test is silently skipped or relabelled green because no CA exists. Use the existing owned runner/lifecycle fixture and its explicit manual mode, not a new harness.

## Safe normal HTTPS readiness after approval/allocation

First verify the source-fresh ownership receipt, exact loopback listener/checkout origin, current leaf identity/validity, actual OS SSL-chain verification and private file cleanup. Then Editor’s single leased browser controller navigates the normal checkout origin **without** error overrides, alternate browser, data URL or certificate acceptance trick. Stop if it shows a certificate interstitial or authority error. Record the actual loaded HTTPS URL, normal page/DOM, certificate status where the supported browser exposes it, server health and no unexpected redirect. Only then resume the real normal-login/cart/checkout UI. Do not call a checkout order API as a substitute, and do not call setup orders buyer purchases.
