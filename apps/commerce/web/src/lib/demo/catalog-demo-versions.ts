/** Versions admitted for the public, read-only first-party catalog sample. */
export function isCatalogDemoVersion(version: string): boolean {
    return version === '2.0.0' || version === '2.1.0';
}
