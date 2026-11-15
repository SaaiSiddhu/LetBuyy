// Test infrastructure only. No application imports this module. The supervisor
// admits one verified loopback provider fixture, never an arbitrary fetch proxy.
export const OWNED_TURNSTILE_KIND = 'turnstile-local-v1';

export function validateOwnedProviderFixture(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).sort().join(',') !== 'capability,kind,origin'
        || value.kind !== OWNED_TURNSTILE_KIND
        || typeof value.capability !== 'string' || !/^[a-f0-9]{64}$/.test(value.capability)) {
        throw new Error('owned provider fixture profile refused');
    }
    let url;
    try { url = new URL(value.origin); } catch { throw new Error('owned provider fixture origin refused'); }
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password
        || !url.port || Number(url.port) < 1024 || url.pathname !== '/' || url.search || url.hash
        || value.origin !== url.origin) throw new Error('owned provider fixture requires an exact IPv4 loopback origin');
    return Object.freeze({ kind: value.kind, origin: url.origin, capability: value.capability });
}

/** A deny-only transport wrapper for named occupied loopback ports. It does
 * not create a provider simulation or authorize any extra destination. */
export function withOwnedLocalPortDenials(fetcher, blockedLocalPorts = []) {
    if (!Array.isArray(blockedLocalPorts) || blockedLocalPorts.some(port => !Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('owned provider local deny list refused');
    const deniedPorts = new Set(blockedLocalPorts);
    return async function deniedLocalFetch(input, init) {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
            && deniedPorts.has(Number(url.port || (url.protocol === 'https:' ? 443 : 80)))) throw new Error('owned provider fixture blocked an unrelated local listener');
        return fetcher(input, init);
    };
}

export function createOwnedProviderFetch(fetcher, profile, blockedLocalPorts = []) {
    const fixture = validateOwnedProviderFixture(profile);
    const guardedFetch = withOwnedLocalPortDenials(fetcher, blockedLocalPorts);
    return async function ownedProviderFetch(input, init) {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === 'https://challenges.cloudflare.com'
            && url.pathname === '/turnstile/v0/siteverify' && !url.search && !url.hash) {
            const request = new Request(input, init);
            if (request.method !== 'POST') throw new Error('owned provider fixture refuses non-POST verification');
            const bytes = await request.arrayBuffer();
            if (bytes.byteLength > 8192) throw new Error('owned provider fixture request exceeds limit');
            return guardedFetch(fixture.origin + '/turnstile/siteverify', {
                method: 'POST', body: bytes, redirect: 'error', signal: request.signal,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Owned-Provider-Capability': fixture.capability },
            });
        }
        if (!['http:', 'https:'].includes(url.protocol)
            || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
            || url.username || url.password) throw new Error('owned provider fixture blocked external fetch');
        // Fetch must not follow a local redirect out to a hosted service.
        return guardedFetch(input, { ...init, redirect: init?.redirect === 'manual' ? 'manual' : 'error' });
    };
}
