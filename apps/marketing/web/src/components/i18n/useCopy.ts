'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { localeFromPathname } from '@/lib/i18n/routing'
import { createCopy } from '@/lib/i18n/copy'

export function useCopy() {
    const locale = localeFromPathname(usePathname())
    const t = useMemo(() => createCopy(locale.language.code), [locale.language.code])
    return { locale, t }
}
