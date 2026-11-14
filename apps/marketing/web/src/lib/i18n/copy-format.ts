export type CopyVariables = Record<string, string | number>
export type CopyMessages = Readonly<Record<string, string>>

/** Shared interpolation without importing every language into a client bundle. */
export function formatCopy(source: string, messages: CopyMessages, variables: CopyVariables = {}): string {
    const value = Object.prototype.hasOwnProperty.call(messages, source) ? messages[source] : source
    return value.replace(/\{(\w+)\}/g, (match, key: string) => String(variables[key] ?? match))
}
