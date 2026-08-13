'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { localeFromPathname, localePath } from '@/lib/i18n/routing'

type LocaleLinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & {
    href: string
}

/**
 * `next/link` that keeps the reader in their locale.
 *
 * Reads the locale from the current pathname rather than taking it as a prop,
 * so the dozens of existing call sites need only their import changed. Paths
 * stay locale-free in data files and get prefixed here — see routing.ts.
 *
 * External URLs, mailto:, tel:, `#fragments` and `?queries` pass through
 * untouched; localePath decides.
 */
export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
    const pathname = usePathname()
    const locale = localeFromPathname(pathname)
    return <NextLink href={localePath(locale, href)} {...props} />
}
