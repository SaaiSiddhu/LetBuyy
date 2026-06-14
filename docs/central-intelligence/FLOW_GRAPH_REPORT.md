# LCIS — Flow Graph Report (Phase 3)

End-to-end flows traced from the graph + DB intel (`pnpm graph:intel flow`, `… payment`). Pattern: **UI → API route → service/adapter → RPC → DB → queue → email → response.**

## Checkout (COD + Razorpay)
```
storefront checkout-client
 → /api/storefront/:sub/checkout  (proxy)
 → gateway storefront/checkout-payment-routes.ts  (Razorpay signature verify, server-authoritative)
 → OrderExecutionAdapter.createOrder  → db.rpc('create_checkout_order')
 → tables: orders, order_items, gift_card_accounts/ledger/redemptions, payment_transactions
 → NOTIFICATION_QUEUE (email.order_confirmation) → queue-workers → Resend
 → response: order + payment_due
```
RPC: SECURITY DEFINER ✓ · idempotency ✓ · FOR UPDATE ✓.

## Refund
```
merchant orders page → /api/stores/:store/orders/:id/refund → gateway returns.ts
 → db.rpc('complete_order_refund')  [+ create_order_return_and_refund]
 → tables: refunds, refund_transactions, orders, payment_transactions
 → orders.ts PATCH transition → db.rpc('restore_gift_card_on_refund') (gift-card restore)
 → email.order_refunded → queue → Resend
```

## Gift card
```
merchant gift-cards page → gateway routes/gift-cards.ts
 → db.rpc('issue_gift_card' | 'set_gift_card_status' | 'check_gift_card_balance' | 'gift_card_transactions')
 → tables: gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions
 → email.gift_card_issued → queue → Resend
 → redeem: create_checkout_order (debit) ; refund: restore_gift_card_on_refund (refund_credit)
```

## Payout / settlement
```
gateway routes/payouts.ts, settlements.ts, commission.ts
 → db.rpc('post_settlement_ledger_transaction', …)
 → tables: payouts, settlements, ledger_transactions/entries
```

## Inventory
```
gateway routes/inventory.ts → db.rpc('adjust_inventory_level','reserve_inventory','release_inventory_reservation','set_inventory_level_available')
 → tables: inventory_levels, inventory_reservations
```

## Registration / Login (identity)
```
storefront register → /api/customer/register → gateway customer-registration.ts
 → rate-limit → Turnstile → bcrypt → issueCustomerSession (HS256, CUSTOMER_SESSION_SECRET)
merchant login → identity-platform (ES256 + JWKS)
```

## Theme publishing
```
merchant editor → gateway themes.ts → compilePortableToLiquidBundle → themes.default_template (Liquid bundle, canary-off)
```

> Flows are derived from static route→rpc→table edges + known wiring. Re-run `pnpm graph:intel flow "<route>"` for the live chain after schema changes.
