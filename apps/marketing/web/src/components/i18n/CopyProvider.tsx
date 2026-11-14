'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { en, type Dictionary } from '@/lib/i18n/dictionaries/en'
import { DEFAULT_LOCALE, getLocale } from '@/lib/i18n/locales'
import { formatCopy, type CopyMessages, type CopyVariables } from '@/lib/i18n/copy-format'

const english = {
    locale: DEFAULT_LOCALE,
    dictionary: en,
    t: (source: string, variables?: CopyVariables) => formatCopy(source, {}, variables),
}
const CopyContext = createContext(english)

/** The server supplies one language. Text leaves share one translator and locale. */
export default function CopyProvider({ segment, messages, dictionary, children }: { segment: string; messages: CopyMessages; dictionary: Dictionary; children: ReactNode }) {
    const value = useMemo(() => ({
        locale: getLocale(segment),
        dictionary,
        t: (source: string, variables?: CopyVariables) => formatCopy(source, messages, variables),
    }), [segment, messages, dictionary])
    return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>
}

export function useCopyContext() {
    return useContext(CopyContext)
}
