'use client'

import Link, { useLinkStatus } from 'next/link'
import { useEffect, useId, type AnchorHTMLAttributes } from 'react'
import { useMerchantLinkPending } from './MerchantNavigationProvider'

function PendingIndicator() {
    const { pending } = useLinkStatus()
    const id = useId()
    const setPending = useMerchantLinkPending()
    useEffect(() => { setPending?.(id, pending) }, [id, pending, setPending])
    useEffect(() => () => setPending?.(id, false), [id, setPending])
    return pending ? <span className="merchant-link-pending" aria-hidden="true" /> : null
}

/** Preserve the shared shell without prefetching every private sidebar destination. */
export function MerchantNavigationLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    if (!href || !href.startsWith('/') || href.startsWith('//') || props.download !== undefined) return <a href={href} {...props}>{children}</a>
    return <Link href={href} prefetch={false} {...props}>{children}<PendingIndicator /></Link>
}
