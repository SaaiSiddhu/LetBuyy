# Merchant Onboarding Checklist — Pilot Program (Document 7 §2)

> **Template:** Copy this file as `MERCHANT_M{1-5}_CHECKLIST.md` and fill in live for each merchant.
> **Rule:** each section must be DONE and evidence-linked before proceeding to the next merchant slot.
> **Target:** < 1 business day total per merchant (Document 7 §2, F8 criterion).

---

## Merchant Slot: M__

| Field | Value |
|-------|-------|
| Slot | M1 / M2 / M3 / M4 / M5 |
| Profile | (e.g. UPI-dominant prepaid seller, fashion/accessories) |
| Site ID (UUID) | PENDING |
| Subdomain | PENDING |
| Onboarding started | PENDING |
| Onboarding completed | PENDING |
| Operator | |
| KYC channel | automated / manual-review |

---

## Step 1 — Account + Store Creation

- [ ] Identity-platform account created; session token issued
- [ ] Store record created via identity → gateway onboarding route
- [ ] Step-up enrollment confirmed active (CAP-C06 live path)
- [ ] Evidence: store ID / account ID recorded below

```
Account ID:
Store / Site ID:
Subdomain:
```

---

## Step 2 — KYC

- [ ] KYC submission received
- [ ] **Automated path:** provider pass confirmed; `kyc_status = verified`
- [ ] **Manual path (CAP-C15):** `needs_review` state set; operator reviewed and approved; ARB waiver reference if required
- [ ] **Invariant:** no payout release permitted until `kyc_status = verified`

```
KYC status:
KYC method: automated / manual
ARB waiver ref (if manual):
```

---

## Step 3 — PSP Credentials + Webhook Proof

- [ ] Merchant connected Razorpay (or Cashfree) sandbox credentials in merchant-control-plane
- [ ] Webhook endpoint verified via provider dashboard ping
- [ ] Provider mode badge shows `sandbox` (not `live`) until production keys provisioned
- [ ] Production PSP credential seam recorded: `SKIP-MERCHANT-PSP-LIVE-CREDENTIALS`

```
PSP: Razorpay / Cashfree
Webhook endpoint:
Webhook verified:
```

---

## Step 4 — Catalog + Theme + Publish

- [ ] ≥ 10 products loaded in catalog
- [ ] Theme selected and customized in editor (merchant-control-plane or merchant Flutter app)
- [ ] Theme published via CAP-C12 live path; `template_config.liquidBundle` or React template confirmed
- [ ] Custom domain: connected (optional) / skipped
- [ ] Storefront publicly accessible at subdomain

```
Product count:
Theme ID:
Published at:
Custom domain:
Storefront URL:
```

---

## Step 5 — Logistics

- [ ] Carrier account linked in merchant-control-plane settings (CAP-C16)
- [ ] Pickup address configured
- [ ] Test label generated; AWB number valid
- [ ] **If CAP-C16 live carrier unavailable:** ARB waiver recorded; COD-only acknowledged

```
Carrier: Shiprocket / Delhivery / Other
Test AWB:
CAP-C16 status: live / waiver
```

---

## Step 6 — Communications

- [ ] WhatsApp Business: template approved for order lifecycle (SKIP-W7 / CAP-D10)
  - [ ] Order confirmed template
  - [ ] Dispatch template
  - [ ] Delivery template
  - [ ] COD confirmation template
- [ ] Email sender: verified for transactional email (CAP-C18)
- [ ] **If WhatsApp live unavailable:** operator-delivered fallback confirmed and documented

```
WhatsApp status: live / fallback
Email sender:
```

---

## Step 7 — First-Order Ceremony

**This is the gate.** The merchant is live only after their first clean ledger trail.

- [ ] Test order placed (real ₹-small amount, operator-observed)
- [ ] Payment capture confirmed in Razorpay dashboard
- [ ] Canonical ledger transaction created: `capture_posted_to_ledger = true`
- [ ] Invariants I1 (balance) and I5 (zero rake) verified on this transaction
- [ ] Fulfillment + dispatch tracked in platform-console
- [ ] Delivery confirmed; carrier tracking active
- [ ] **For M1 only:** refund processed; reversing ledger entries confirmed; merchant payable restored
- [ ] Operator attestation: "first clean ledger trail complete"

```
Order ID:
Canonical ledger transaction ID:
I1 balance check: PASS / FAIL
I5 zero-rake check: PASS / FAIL
Refund ledger txn ID (M1 only):
Operator sign-off:
Date/time:
```

---

## Step 8 — Onboarding Evidence Row

- [ ] Evidence row appended to `EXECUTION_LEDGER.md` (format: `PILOT-M{N}-ONBOARDING`)
- [ ] This checklist file committed to `LAUNCH_READINESS_2026_06_12/evidence/f-pilot/`
- [ ] Next slot (M{N+1}) unblocked: M1 clean → unblock M2; M2 clean → unblock M3; etc.

```
Ledger row ID: PILOT-M__-ONBOARDING
Commit SHA:
Next merchant unblocked:
```

---

## Notes

(Operator notes on rough edges, defects found, tickets opened)

---

## Sequencing Rule (Document 7 §2)

> M2 does not start until M1's first-order ceremony is clean; M3 not until M2's; etc.
> Defects found pause intake, not the live merchants.
