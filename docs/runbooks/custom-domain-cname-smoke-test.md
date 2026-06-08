# Custom Domain Chained-CNAME Smoke Test

## Purpose

Validate that Vercel accepts a merchant custom domain whose merchant-facing CNAME points to the LetBuyy-owned target:

```text
www.<test-domain> -> connect.letbuyy.store -> cname.vercel-dns.com
```

This is a live-provider test. Do not mark custom-domain automation production-ready until this runbook has fresh evidence in the operations ledger.

## Preconditions

- Cloudflare credentials with DNS Edit access to the `letbuyy.store` zone.
- `connect.letbuyy.store` present as a DNS-only CNAME to Vercel.
- `VERCEL_API_TOKEN` and `VERCEL_STOREFRONT_PROJECT_ID` set for `services/api-gateway`.
- A real test domain whose DNS can be changed without affecting production email.
- A test LetBuyy site with a known `site_id`.

## Step 1: Apply the LetBuyy-owned target

```sh
terraform -chdir=infrastructure/dns plan
terraform -chdir=infrastructure/dns apply
dig +short CNAME connect.letbuyy.store
```

Expected result:

```text
cname.vercel-dns.com.
```

## Step 2: Claim the test domain in LetBuyy

```sh
curl -sS -X POST "$API_BASE_URL/v1/custom/domains" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"<site-id>","domain":"www.<test-domain>"}'
```

Add the returned ownership TXT record at the test domain's DNS provider. Add the CNAME:

```text
www  CNAME  connect.letbuyy.store
```

If testing the apex, use DNS-provider ALIAS/ANAME/CNAME-flattening to `connect.letbuyy.store`; do not remove existing MX records.

## Step 3: Verify and attach through the gateway

```sh
curl -sS -X POST "$API_BASE_URL/v1/custom/domains/verify" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"<site-id>","domain":"www.<test-domain>"}'
```

Expected response:

```json
{"success":true,"status":"active"}
```

`pending` or `verifying` is acceptable while Vercel certificate issuance is in progress.

## Step 4: Prove live TLS and storefront serving

```sh
dig +short CNAME www.<test-domain>
curl -I https://www.<test-domain>
```

Expected proof:

- `dig` resolves to `connect.letbuyy.store` or through the chain to Vercel.
- `curl -I` returns a valid TLS response from the storefront runtime.
- Vercel domain config reports valid/ready through the gateway status endpoint or Vercel dashboard.

## Fallback

If Vercel rejects the chained CNAME:

1. Temporarily change merchant instructions and `CUSTOM_DOMAIN_CNAME_TARGET` to Vercel's direct CNAME target for affected domains only.
2. Or stand up the Phase-2 storefront ingress behind `connect.letbuyy.store` and move custom-domain routing there.
3. Record the evidence and decision in `CODEX_DOMAIN_FINALIZATION_LEDGER.md` and `CODEX_DOMAIN_FINALIZATION_STATUS.md`.

## SKIPPED -- NEEDS HUMAN

This smoke test is skipped in local Codex execution because it requires Cloudflare/Vercel credentials and a real test domain.

Future proof command:

```sh
terraform -chdir=infrastructure/dns apply && curl -I https://www.<test-domain>
```
