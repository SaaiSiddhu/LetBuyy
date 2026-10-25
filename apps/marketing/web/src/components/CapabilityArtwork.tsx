import Image from 'next/image'
import type { CapabilityId } from '@/lib/capability-tour'

const ARTWORK = {
    storefronts: 'storefronts',
    orders: 'orders',
    inventory: 'inventory',
    payments: 'payments',
    customers: 'customers',
    analytics: 'analytics',
    ai: 'ai',
    b2b: 'b2b',
} satisfies Record<CapabilityId, string>

/** Decorative shortcut artwork; the parent node or button owns its label and state. */
export default function CapabilityArtwork({ module }: { module: CapabilityId }) {
    return <Image className="cmap-shortcut-artwork" src={`/illustrations/capabilities/icons/${ARTWORK[module]}-v2.webp`} alt="" width={256} height={256} sizes="60px" loading="eager" unoptimized aria-hidden="true" draggable={false} />
}
