import { COPY } from './copy-catalog'

export type CopyVariables = Record<string, string | number>

/** Explicit presentation copy, shared by server and client components. No DOM mutation or external translation service. */
export function translateCopy(language: string, source: string, variables: CopyVariables = {}): string {
    const entry = COPY[source]
    const value = language === 'hi' ? entry?.[0] : language === 'ta' ? entry?.[1] : source
    return (value ?? source).replace(/\{(\w+)\}/g, (match, key: string) => String(variables[key] ?? match))
}

export function createCopy(language: string) {
    return (source: string, variables?: CopyVariables) => translateCopy(language, source, variables)
}
