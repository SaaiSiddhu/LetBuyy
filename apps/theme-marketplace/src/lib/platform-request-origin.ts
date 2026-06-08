import { headers } from 'next/headers'

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com', 'letbuyy.store'] as const
const HOST_PATTERN = /^[a-z0-9.-]+(?::\d+)?$/i

function normalizeHostname(host: string): string {
    return host.toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')
}

function isPlatformHost(host: string): boolean {
    if (!HOST_PATTERN.test(host)) return false

    const hostname = normalizeHostname(host)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true

    return PLATFORM_ROOT_DOMAINS.some((root) => hostname === root || hostname.endsWith(`.${root}`))
}

function normalizeProtocol(protocol: string | null): string {
    return protocol === 'http' ? 'http' : 'https'
}

export async function getPlatformRequestOrigin(fallbackOrigin: string): Promise<string> {
    const requestHeaders = await headers()
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')

    if (!host || !isPlatformHost(host)) return fallbackOrigin

    return `${normalizeProtocol(requestHeaders.get('x-forwarded-proto'))}://${host}`
}

export function appendOriginPath(origin: string, path = ''): string {
    if (!path) return origin
    return `${origin.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}
