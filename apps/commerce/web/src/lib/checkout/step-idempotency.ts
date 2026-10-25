export type HostedStep = 'contact' | 'delivery' | 'payment-intent' | 'confirm';
const ORDER: readonly HostedStep[] = ['contact', 'delivery', 'payment-intent', 'confirm'];
/** Transport keys follow the verified handoff and the submitted data. A retry
 * of the same command keeps its key; an explicit earlier edit invalidates all
 * dependent commands. This grants no price, session or payment authority. */
export function prepareHostedStepRequest(
    checkout: { cartId: string; handoff: Record<string, string> }, step: HostedStep, fingerprint: string,
    payloads: Record<string, string>,
): string {
    const identity = `${checkout.cartId}:${checkout.handoff.cart_digest || checkout.handoff.signature || 'missing'}`;
    const input = (value: HostedStep) => `input:${identity}:${value}`;
    if (payloads[input(step)] !== fingerprint) {
        for (const dependent of ORDER.slice(ORDER.indexOf(step))) {
            delete payloads[input(dependent)];
        }
        payloads[input(step)] = fingerprint;
    }
    // Keep old command keys in memory: an uncertain confirmation must remain
    // recoverable with its original body/key. Only the active dependency chain
    // changes; reverting to an old exact chain recovers that original command.
    const chain = JSON.stringify([identity, ...ORDER.slice(0, ORDER.indexOf(step) + 1).map(value => payloads[input(value)] || '')]);
    const archive = `revision:${chain}`;
    const revision = payloads[archive] || (payloads[archive] = crypto.randomUUID());
    // Only this opaque value reaches getIdempotencyKey. Contact/address data
    // never enters a transmitted idempotency key or persistent browser storage.
    return `hosted-${step}-${revision}`;
}
