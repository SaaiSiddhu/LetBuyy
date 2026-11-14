import { COPY } from './copy-catalog'
import { formatCopy, type CopyMessages, type CopyVariables } from './copy-format'

export type { CopyVariables } from './copy-format'

/** Server-side selection; English requires no translated catalogue in the browser. */
export function getCopyMessages(language: string): CopyMessages {
    if (language !== 'hi' && language !== 'ta') return {}
    const index = language === 'hi' ? 0 : 1
    return Object.fromEntries(Object.entries(COPY).map(([source, values]) => [source, values[index]]))
}

/** Explicit presentation copy, shared by server and client components. No DOM mutation or external translation service. */
export function translateCopy(language: string, source: string, variables: CopyVariables = {}): string {
    const entry = COPY[source]
    const value = language === 'hi' ? entry?.[0] : language === 'ta' ? entry?.[1] : source
    return formatCopy(value ?? source, {}, variables)
}

export function createCopy(language: string) {
    return (source: string, variables?: CopyVariables) => translateCopy(language, source, variables)
}
