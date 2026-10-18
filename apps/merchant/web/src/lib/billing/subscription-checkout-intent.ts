type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type CheckoutLocks = Pick<LockManager, 'request'>

export type SubscriptionCheckoutIntent = { slot: string; key: string }

// This is a client retry receipt, never account/payment authority. The Gateway
// independently checks the actor, store, saved quote and provider proof.
export async function retainSubscriptionCheckoutIntent(
    actorId: string,
    body: { store_id: string; plan_slug: string; billing_period: string; site_type: string; coupon_code?: string },
    storage: CheckoutStorage,
    locks: CheckoutLocks,
    mint = () => crypto.randomUUID(),
): Promise<SubscriptionCheckoutIntent> {
    const slot = 'letbuyy:subscription-checkout:v1:' + JSON.stringify([
        actorId, body.store_id, body.plan_slug, body.billing_period, body.site_type, body.coupon_code || null,
    ])
    return locks.request(slot, () => {
        const retained = storage.getItem(slot)
        const key = retained || `subscription-checkout:${mint()}`
        if (!retained) storage.setItem(slot, key)
        return { slot, key }
    })
}

export async function completeSubscriptionCheckoutIntent(
    intent: SubscriptionCheckoutIntent,
    storage: CheckoutStorage,
    locks: CheckoutLocks,
) {
    await locks.request(intent.slot, () => {
        // An older tab's completion cannot erase a newer logical checkout.
        if (storage.getItem(intent.slot) === intent.key) storage.removeItem(intent.slot)
    })
}
