# Local checkout TLS — revised preissued-leaf proposal

**V2, source admitted under Root’s exact lease, qualified and frozen/released back to Root.** Root requested consumption of a preissued trusted leaf/key rather than signing certificates. Only the two reviewed shared fixture files were changed; exact hashes and evidence are in [source-handoff.json](source-handoff.json). No trust setting, CA, browser, database or running resource was changed. Editor’s existing human trust question remains pending; no duplicate question was sent. MadeYours’23 runbook/facts/native proofs remain frozen, position7 pending.

## Current evidence

Root reports healthy9cd production applications, normal buyer consent/cart reaching two Pink units at1120, and normal `checkout.localhost:57228` navigation refused with `ERR_CERT_AUTHORITY_INVALID`; no confirmation/order. Those are coordinator-reported observations, not this chat’s reproduction. No blocked URL/data URL was retried. Existing private9cd keys/resources remain untouched.

The current helper proves owned handle and fixture binding, produces its one-day self-signed leaf/SPKI and deletes its generated temporary files. **The native generation body remains byte-identical** in the staged copies. The existing TLS bridge initializes its certificate once; no supported hot certificate reload exists. This patch cannot retrofit9cd. A source-fresh invocation of the existing fixture requires an explicit allocation; no live process injection, extra listener, control endpoint, harness or checkout-order API substitute is proposed.

## Exact staged source delta

[manual-owned-tls.patch](manual-owned-tls.patch) records exactly the admitted changes to the existing `owned-db-support.ts` helper and `threadline-browser-fixture.ts` opt-in flag/call. Adjacent `.ts.proposed` files remain byte-equal review copies; tests now read the actual admitted workspace source. No dependency manifest or runtime is added.

- Default mode stays `native-ephemeral`; its original openssl invocation, one-day validity, SPKI result, ownership proof and cleanup remain unchanged. Unknown enum values refuse. Both modes retain the existing exact handle and GUARD binding re-verification before dispatch.
- Manual mode requires macOS, exact `LETBUYY_THEME_EDITOR_BROWSER_HOLD=1`, no Threadline QA profile and explicit `LETBUYY_MANUAL_CHECKOUT_TLS_MODE=manual-os-trusted`. The fixture rejects invalid flag/profile combinations before other setup. This flag survives the current runner filter; no runner change is needed.
- The only manual input directory is `/private/tmp/letbuyy-owned-checkout-manual-<current OS uid>`, containing `cert.pem` and `key.pem`. No caller path, hostname, executable, trust anchor, CA path or issuer option exists. Directory0700, files0600, current owner, canonical nonsymlink paths, regular files and one link are required. Reads use `O_NOFOLLOW`, descriptor metadata, a65537-byte cap and stability checks, rejecting empty/oversize/changing files.
- Accept exactly one leaf PEM. Reject CA certificates, extra/wildcard/missing SANs, non-server-auth usage, expired/future validity or mismatched private key. SAN is exactly `DNS:checkout.localhost`; hostname matching uses no CN fallback. Node’s X509/private-key APIs perform the actual parsing and match checks. [Node22 API](https://nodejs.org/docs/latest-v22.x/api/crypto.html#x509checkprivatekeyprivatekey).
- Copy only the verified public certificate bytes into a newly created private verification directory. Apple’s fixed `/usr/bin/security verify-cert -c <snapshot> -p ssl -n checkout.localhost -L -q` must succeed against current OS SSL trust. No supplied root, custom keychain, allowed error, alternate policy or browser exception. Verifying a snapshot prevents replacing the input path between parsing and OS evaluation. The helper never invokes mkcert, openssl signing, trust installation/removal or CA-key reads in manual mode. Installed `security help verify-cert` confirms the exact command contract. [Apple tool source](https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/security.c).
- Return compatible key/cert/SPKI bytes. On failure zero the loaded key buffer and return a sanitized message. Clean only the public verification snapshot created by this call. **Preissued inputs remain private and intact**, for their provisioning owner to manage. No CA bootstrap or issuer/lifetime policy is part of fixture control.

Root granted the source lease after reviewingV2. The exact scope is applied, tested and source-frozen; no further shared writes are held by this chat. The current9cd/final02 runtime copy was not accessed or changed.

## Standard provisioning and the existing human decision

Provisioning is outside this helper and requires the existing user trust decision. The fixture must not treat a pending question or these docs as permission. Root should review the following concrete actions before any follow-up:

1. Standard binary installation, if approved: `/opt/homebrew/bin/brew install mkcert`, then verify the installed version/provenance. Read-only metadata found mkcert absent from the two standard Homebrew locations; Homebrew and Apple security exist. No installation occurred. The reviewed CLI isv1.4.4; recheck its installed contract if different. [Official mkcert installation](https://github.com/FiloSottile/mkcert#installation).
2. Standard mkcert provisioning, after explicit approval: create a fresh owned0700 CA directory under its separately approved fixed private path; refuse unknown existing content. The first standard issuance initializes mkcert’s CA. Keep signing-key access confined to the standard tool; never print/read that key through the agent. Issue exactly checkout.localhost into the fixed UID-private leaf directory with `-cert-file` / `-key-file`, then set the two leaf files0600. The helper has no knowledge of or access to the CA directory. Record only public root/leaf fingerprints, actual paths, ownership and approval scope in a private owner receipt. [Official options/source](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/main.go).
3. Narrower trust action proposed for Root’s decision: current-user login keychain, SSL policy and exact checkout.localhost policy string:

```text
/usr/bin/security add-trusted-cert -r trustRoot -p ssl -s checkout.localhost -k <verified current-user login keychain> <approved public root certificate>
```

Resolve the user’s actual default keychain read-only and reject unexpected/shared paths until reviewed. No admin `-d`, allowed-error flags or whole-store trust import. Apple implements user-domain policy/string constraints; local help verifies these options. Actual browser acceptance remains a required positive gate, not an assumption. [Apple implementation](https://raw.githubusercontent.com/apple-oss-distributions/Security/main/SecurityTool/macOS/trusted_cert_add.c).

The user must understand the OS trust change and that the CA signing key is powerful. Intended trust is limited to this account’s SSL checkout host. Do not broaden it automatically. Standard `TRUST_STORES=system mkcert -install` uses administrator System.keychain trust on macOS and is a materially different approval, not an equivalent fallback. No Firefox/Java trust installation is needed. [mkcert macOS implementation](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/truststore_darwin.go).

Only after approved provisioning and trust, final source admission and a separately allocated source-fresh existing fixture should the manual flag be enabled. Missing/untrusted preissued files fail closed and never trigger issuance or trust changes.

## Rollback only our own certificate trust/files

Before provisioning, record whether the proposed CA/trust item exists. Capture the exact new root’s public SHA256 and chosen user keychain/policy. Rollback must match that receipt and certificate, never a common name or global store scan. For the proposed user-domain route, `/usr/bin/security remove-trusted-cert <the same verified public root>` with no `-d` removes only its user trust. If removing its keychain certificate item as well, use the exact recorded SHA256 with `security delete-certificate -Z <actual fingerprint> -t <same verified keychain>`. Installed local help confirms targeted SHA256 removal. Stop on any mismatch; do not restore/export/import unrelated trust settings.

If Root separately approved the broader System mkcert route, rollback must use that dedicated CAROOT with `TRUST_STORES=system mkcert -uninstall`, never the user’s unrelated default CA. Its uninstall removes trust, not CA files. [Official uninstall semantics](https://raw.githubusercontent.com/FiloSottile/mkcert/v1.4.4/main.go).

Only the provisioning/fixture owner may remove its exact private leaf/CA resources, after its listener no longer needs them and after explicit release. Manual helper consumption itself preserves preissued files. Do not touch9cd material or other users’/tools’ roots.

## Validation: separate evidence classes

- **V1 historical:**25 stub/control checks for the superseded signing design remain intact at [revisions/issuance-v1/proposal-control-test-results.json](revisions/issuance-v1/proposal-control-test-results.json). They are not recredited to V2 and prove no real crypto/trust.
- **V2 source contracts:**8 checks pass at [proposal-control-test-results.json](proposal-control-test-results.json): syntax, unchanged shared-source hashes/native body, no manual issuer/CA/install seam, exact OS verification/snapshot, preserved input files, early explicit flag and ownership ordering. A separate full gateway noEmit also passes; the eight source-contract checks remain a distinct evidence class.
- **V2 actual leaf/file checks:**24 pass at [proposal-real-leaf-test-results.json](proposal-real-leaf-test-results.json). Standard local openssl generated disposable **non-CA** self-signed leaf/key fixtures only. Real Node parsing/key matching, wrong/extra/wildcard SAN, client EKU, actual expired/future certificate dates, malformed/mismatched keys, symlink/hardlink/modes/size/absence/owner checks and cleanup were exercised. Every generated certificate had CA=false; no signing CA or trust was created. All temporary fixture files were removed.
- Positive-path OS success is stubbed in those crypto/file tests and is clearly labelled. One separate negative executes genuine macOS SSL verification of our disposable self-signed non-CA leaf, without a supplied anchor, and requires rejection. **A real OS-trusted-chain positive, actual owned-DB integration, normal browser HTTPS and COD remain NOT_RUN.** The fixed input path is mapped only inside the test adapter to an own disposable directory; no real provisioned input or CA file was read.

[Real remaining gates](test-plan.json) remain required. Native owned-DB lane is reserved for Threadline391 first. No DB/build/browser/runtime was started here. The actual leaf-test program is a focused docs test adapter reading admitted helper functions, not another runtime or fixture harness. Existing guard/lane/credential/host/URL contracts pass33/33 and existing fixture units17/17. The first guard process-probe failure (tsx IPC sandbox refusal) is preserved; the same unmodified tests pass with local IPC enabled, without Docker provisioning or any assertion change.

## Safe normal HTTPS readiness after approval and allocation

Prove the source-fresh fixture owner, exact loopback TLS listener/checkout origin and unchanged source receipt. Require matching leaf/key, exact SAN/current validity, actual OS SSL-chain acceptance and unchanged private input permissions. Then Editor’s single leased browser controller navigates the normal HTTPS checkout origin with no certificate bypass, error override, data URL, alternate browser or SPKI whitelist. Stop on any interstitial/authority error. Record the actual page/DOM/URL and supported certificate status, plus any redirect or failure. Only then resume normal buyer login, cart, delivery, COD and confirmation UI. No checkout-order API substitute and no setup-order purchase credit.
