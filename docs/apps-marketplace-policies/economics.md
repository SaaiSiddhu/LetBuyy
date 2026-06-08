# Apps Marketplace Economics

The in-code default is one marketplace revenue share: partner share `8500` bps and LetBuyy platform fee `1500` bps.

## Built Behavior

- The revenue share is sourced from `DEFAULT_APP_REVENUE_SHARE_BPS` in `@letbuyy/billing-core`.
- App billing supports free, freemium, recurring, one-time, and usage pricing models.
- Pricing plans, trials, usage metering, spend controls, charge approval, payout ledger state, and payout statements are implemented in code.
- Live payout release requires approved provider credentials and finance authorization.

## Human Approval Still Required

- Final business/legal confirmation of revenue share and effective date.
- Live payout provider credentials and go-live approval.
- Real partner bundle pricing rules and single-transaction bundle checkout policy.

## Operator Rule

Do not publish conflicting platform fee copy. If the rate changes, update the billing-core constant, developer UI, policy docs, and ledger evidence in the same change.
