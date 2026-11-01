import type { CSSProperties } from 'react'
import Image from 'next/image'
import { EmptyState, type EmptyStateProps } from '@letbuyy/ui'

export const merchantEmptyScenes = [
    'plans', 'ai', 'analytics', 'apps', 'categories', 'certifications',
    'comments', 'contact', 'reels', 'coupons', 'customer-detail',
    'customers', 'segments', 'dashboard', 'education', 'experience',
    'gallery', 'leads', 'marketing', 'store-pages', 'order-detail',
    'orders', 'pages', 'payouts', 'posts', 'collections', 'gift-cards',
    'inventory', 'inventory-history', 'locations', 'product-editor', 'product-detail',
    'operations', 'products', 'purchase-orders', 'receipts',
    'reservations', 'smart-collections', 'suppliers', 'transfers',
    'projects', 'reviews', 'billing', 'domains', 'notifications',
    'security', 'shipping', 'taxes', 'staff', 'skills', 'testimonials',
    'theme-editor', 'theme-marketplace', 'themes', 'installed-apps',
    'payment-methods', 'stores', 'settings-search', 'backend-contract',
] as const

export type MerchantEmptyScene = (typeof merchantEmptyScenes)[number]

export function MerchantEmptyArtwork({ scene, compact = false }: { scene: MerchantEmptyScene; compact?: boolean }) {
    return (
        <span
            className="relative block shrink-0"
            style={{
                width: compact ? 112 : 'calc(var(--lb-density-empty-state-illustration-width) * 1.3)',
                height: compact ? 74 : 'calc(var(--lb-density-empty-state-illustration-height) * 1.3)',
            } as CSSProperties}
            aria-hidden="true"
            data-merchant-empty-scene={scene}
        >
            <Image
                src={`/empty-states/generated/${scene}.png`}
                alt=""
                fill
                loading="lazy"
                sizes={compact ? '112px' : '208px'}
                className="object-contain"
            />
        </span>
    )
}

export interface MerchantEmptyStateProps extends EmptyStateProps {
    scene: MerchantEmptyScene
}

export function MerchantEmptyState({ scene, illustration, title, ...props }: MerchantEmptyStateProps) {
    const isFailure = /^(unable|could not|failed|error)/i.test(title)
    return <EmptyState {...props} title={title} illustration={illustration ?? (isFailure ? undefined : <MerchantEmptyArtwork scene={scene} />)} />
}
