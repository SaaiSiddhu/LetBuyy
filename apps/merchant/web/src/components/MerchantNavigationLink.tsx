'use client'

import Link from 'next/link'
import type { AnchorHTMLAttributes } from 'react'

/** Preserve the shared shell without prefetching every private sidebar destination. */
export function MerchantNavigationLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    if (!href || !href.startsWith('/') || href.startsWith('//') || props.download !== undefined) return <a href={href} {...props} />
    return <Link href={href} prefetch={false} {...props} />
}
