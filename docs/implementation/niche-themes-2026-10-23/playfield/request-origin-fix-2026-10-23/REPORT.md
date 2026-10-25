# Merchant mutation origin guard correction

**Source fix complete; writer released for a controlled next candidate.** Only `apps/merchant/web/src/lib/api/request-origin.ts` and adjacent `request-origin.test.ts` changed in production/test source. No current9cd runtime, database, browser, build, authentication code, product form, backend, schema or frozen theme artifact was changed. Playfield's14 installed lifecycle cases remain NOT_RUN.

Editor saved a real `FORBIDDEN_ORIGIN` product-edit denial in run9cd50e893016; the draft remained unsaved. Its original saved error fields and source hash are referenced in `original-denial-reference.json`. The original guard is preserved byte-for-byte as `original-request-origin.ts` (SHA256 c288af9f88b5919f09c28391625801ee0c1331544085e01a60ad9252e4934631). The original15-group security run passed4 and failed11; the unchanged assertions now pass15/15.

## Framework finding and fix

Installed Next.js16.1.6's actual `NextRequest` **preserves** a directly supplied `http://admin.threadline-9cd50e893016.localhost:57225` URL. Its normalization code replaces literal loopback IPs. It does not establish the earlier suggestion that the constructor generally strips a `*.localhost` subdomain. `installed-next-reproduction.json` records the public input URL, request URL, nextUrl origin and Host, with hashes of the exact installed primary implementation files. No cookies or tokens were read.

A separate in-memory route-context reproduction supplies `http://localhost:57225` as the request URL, with the run-specific Host/Origin and exact configured `NEXT_PUBLIC_ADMIN_URL`. The old guard denies this request. This task did not inspect the current runtime's internal nextUrl and does not claim browser confirmation of that internal cause.

The corrected guard requires a valid canonical Host. If an admin origin is configured, it must be an absolute HTTP(S) origin without credentials, path, query, fragment or surrounding whitespace. The parsed origin must match the request Host, protocol and port exactly. A different request URL hostname can qualify only when it is the `localhost` route context and all those configured-origin bindings match. Unknown aliases, suffix lookalikes, different hosts/ports/protocols and invalid configuration fail closed. Forwarded/X-Forwarded values supply no authority.

When configuration is absent, canonical request-origin/Host agreement remains valid, alongside the existing narrowly bound HTTP127.0.0.1/IPv6 compatibility. Origin is still required. Existing idempotency-key length, trimming/control-character validation, explicit opt-out semantics and custom merchant/staff errors remain unchanged. No auth/membership authority moved into this transport helper (ARCH-R17, WIN-R4).

## Validation at released bytes

| Check | Result |
| --- | --- |
| Original new15-group test run |4PASS /11FAIL, retained in original-red.tap |
| Corrected adjacent origin/security tests, actual NextRequest |15/15PASS;0FAIL;0SKIP |
| Existing foreign-Origin export guard and literal-loopback consumer regressions |2/2PASS;0FAIL;0SKIP |
| Merchant `tsc --noEmit --incremental false` |exit0, run once |
| ESLint on the two allocated files |exit0 |
| Source diff whitespace check |exit0 |

The focused tests include direct and normalized route origins, exact configured binding, unknown/suffix alias, Host mismatch, wrong port/protocol, null/missing/foreign Origin, spoofed forwarded headers, malformed configured URLs and Host values, production and legacy loopback positives, key size boundaries/missing/trim/C0/DEL rejects, explicit key opt-out, and the staff consumer's customized errors. Raw key-control tests explicitly exercise guard-returned header values because HTTP Headers itself normalizes/rejects some raw input before the guard.

`source-release.json` pins the source/test hashes, exact commands, exits and retained output hashes. Test selection is explicit; the new adjacent test is not silently claimed to be added to the package's existing explicit default test list.

## Remaining acceptance

Apply these frozen source bytes through the coordinator's controlled next-candidate process alongside its other allocated changes. Then Editor must reattempt a normal versioned product save/reload, confirm draft preservation on denial/conflict and retain wrong-origin/idempotency rejection. The current fixture remains immutable; no guard bypass or current-fixture hotfix is authorized by this handoff. Browser/runtime acceptance and the14 Playfield installed cases are separate and pending.

The previous denied cross-chat message was not retried. This local saved handoff contains the full release information for the coordinator to read.
